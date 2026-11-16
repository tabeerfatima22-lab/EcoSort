/** Loads ONNX Runtime Web and both models in the browser, with progress and clear errors. */
import { ObjectModel, WasteModel, type OrtLike, type WasteMetadata } from "../core/models";
import type { Models } from "../core/pipeline";

export class EngineError extends Error {
  constructor(public title: string, public help: string, options?: ErrorOptions) {
    super(title, options);
  }
}

export interface LoadProgress {
  step: string;
  fraction: number;
}

const base = () => new URL(import.meta.env.BASE_URL, window.location.href).href;

async function fetchBytes(url: string, onBytes: (loaded: number, total: number) => void): Promise<Uint8Array> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (cause) {
    throw new EngineError("The recognition model could not be downloaded", "Check your internet connection, then try again.", { cause });
  }
  if (response.status === 404) {
    throw new EngineError("A model file is missing from this site", `Not found: ${url.replace(base(), "")}. Re-upload the whole dist folder, including the models folder.`);
  }
  if (!response.ok) throw new EngineError("The recognition model could not be downloaded", `The server answered with HTTP ${response.status}.`);
  const total = Number(response.headers.get("content-length")) || 0;
  if (!response.body) return new Uint8Array(await response.arrayBuffer());
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onBytes(loaded, total);
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  // A host that rewrites unknown paths to index.html would hand us HTML instead of a model.
  if (bytes.length < 100_000) throw new EngineError("A model file is missing from this site", `${url.replace(base(), "")} did not contain a model.`);
  return bytes;
}

export interface Engine extends Models {
  meta: WasteMetadata;
}

export async function loadEngine(onProgress: (p: LoadProgress) => void): Promise<Engine> {
  if (typeof WebAssembly === "undefined") {
    throw new EngineError("This browser cannot run the recognition model", "Use a current version of Chrome, Safari, Edge or Firefox.");
  }
  const ortUrl = `${base()}ort/`;
  onProgress({ step: "Starting the recognition engine", fraction: 0.02 });
  let ort: OrtLike & { env: { wasm: { wasmPaths: string; numThreads: number }; logLevel: string } };
  try {
    ort = await import(/* @vite-ignore */ `${ortUrl}ort.wasm.min.mjs`);
  } catch (cause) {
    throw new EngineError("The recognition engine could not be loaded", "The ort folder is missing or blocked. Re-upload the whole dist folder.", { cause });
  }
  ort.env.wasm.wasmPaths = ortUrl;
  ort.env.wasm.numThreads = 1; // single thread: works without special server headers
  ort.env.logLevel = "error";

  let meta: WasteMetadata & { model_file: string };
  try {
    const r = await fetch(`${base()}models/waste/metadata.json`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    meta = await r.json();
  } catch (cause) {
    throw new EngineError("The model description could not be read", "models/waste/metadata.json is missing or damaged.", { cause });
  }

  const sizes = { waste: 10.3e6, object: 14e6 };
  const all = sizes.waste + sizes.object;
  const wasteBytes = await fetchBytes(`${base()}models/waste/${meta.model_file}?v=${meta.model_version}`, (l) =>
    onProgress({ step: "Downloading the waste model", fraction: 0.05 + (0.8 * Math.min(l, sizes.waste)) / all }),
  );
  const objectBytes = await fetchBytes(`${base()}models/object/mobilenetv2-12.onnx`, (l) =>
    onProgress({ step: "Downloading the object model", fraction: 0.05 + (0.8 * (sizes.waste + Math.min(l, sizes.object))) / all }),
  );

  onProgress({ step: "Preparing the models", fraction: 0.9 });
  try {
    const options = { executionProviders: ["wasm"], graphOptimizationLevel: "all" };
    const waste = await WasteModel.load(ort, wasteBytes, meta, options);
    const object = await ObjectModel.load(ort, objectBytes, options);
    // Warm-up pass, and a check that both models produce valid output on this device.
    const blank = { data: new Uint8ClampedArray(64 * 64 * 4).fill(128), width: 64, height: 64 };
    const region = { x: 0, y: 0, width: 64, height: 64 };
    const p = await waste.predict(waste.prepare(blank, region));
    const sum = p.reduce((a, b) => a + b, 0);
    if (!Number.isFinite(sum) || Math.abs(sum - 1) > 0.01) throw new Error("Waste model self-test failed");
    await object.predict(object.prepare(blank, region));
    onProgress({ step: "Ready", fraction: 1 });
    return { waste, object, meta };
  } catch (cause) {
    if (cause instanceof EngineError) throw cause;
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new EngineError("The models could not be started on this device", /memory|alloc/i.test(message) ? "The device ran out of memory. Close other tabs and reload." : message, { cause });
  }
}
