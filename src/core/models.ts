/**
 * Model wrappers. The ONNX Runtime module is injected so the same code runs
 * in the browser (onnxruntime-web, WebAssembly) and in the Node evaluator.
 */
import { resizeToRgb, flipHorizontal, type CropRect, type RgbaImage } from "./resize";

/* Minimal structural types so this file does not depend on a specific ORT build. */
export interface OrtTensorLike {
  data: Float32Array | ArrayLike<number>;
  dims: readonly number[];
}
export interface OrtSessionLike {
  inputNames: readonly string[];
  outputNames: readonly string[];
  run(feeds: Record<string, unknown>): Promise<Record<string, OrtTensorLike>>;
}
export interface OrtLike {
  Tensor: new (type: "float32", data: Float32Array, dims: number[]) => unknown;
  InferenceSession: { create(model: Uint8Array | ArrayBuffer, options?: Record<string, unknown>): Promise<OrtSessionLike> };
}

export interface WasteMetadata {
  model_name: string;
  model_version: string;
  class_names: string[];
  input: { name: string; height: number; width: number; layout: string; pixel_range: number[] };
  output: { name: string; num_classes: number };
  metrics?: Record<string, unknown>;
}

/** The six material classes the waste model was trained on, in the order this app expects. */
export const EXPECTED_WASTE_CLASSES = ["cardboard", "glass", "metal", "paper", "plastic", "trash"] as const;
export type WasteClass = (typeof EXPECTED_WASTE_CLASSES)[number];

export function assertWasteMetadata(meta: WasteMetadata): void {
  const got = meta.class_names.join(",");
  const want = EXPECTED_WASTE_CLASSES.join(",");
  if (got !== want) throw new Error(`Waste model labels (${got}) do not match the app's mapping (${want}).`);
  if (meta.input.layout !== "NHWC" || meta.input.width !== 224 || meta.input.height !== 224) {
    throw new Error("Waste model input format is not the expected 224x224 NHWC.");
  }
  if (meta.output.num_classes !== EXPECTED_WASTE_CLASSES.length) throw new Error("Waste model class count mismatch.");
}

export class WasteModel {
  constructor(private ort: OrtLike, private session: OrtSessionLike, readonly meta: WasteMetadata) {}

  static async load(ort: OrtLike, modelBytes: Uint8Array, meta: WasteMetadata, options?: Record<string, unknown>): Promise<WasteModel> {
    assertWasteMetadata(meta);
    const session = await ort.InferenceSession.create(modelBytes, options);
    if (!session.inputNames.includes(meta.input.name) || !session.outputNames.includes(meta.output.name)) {
      throw new Error("Waste model tensor names do not match metadata.json.");
    }
    return new WasteModel(ort, session, meta);
  }

  /** Model input for one view: whole-pixel values in [0,255], HWC. Normalisation is inside the model graph. */
  prepare(image: RgbaImage, crop: CropRect): Float32Array {
    const rgb = resizeToRgb(image, crop, 224, 224);
    for (let i = 0; i < rgb.length; i++) rgb[i] = Math.min(255, Math.max(0, Math.round(rgb[i])));
    return rgb;
  }

  async predict(input: Float32Array): Promise<Float32Array> {
    const tensor = new this.ort.Tensor("float32", input, [1, 224, 224, 3]);
    const out = await this.session.run({ [this.meta.input.name]: tensor });
    const probs = Float32Array.from(out[this.meta.output.name].data as ArrayLike<number>);
    if (probs.length !== 6) throw new Error("Unexpected waste model output size.");
    return probs;
  }
}

const IMAGENET_MEAN = [0.485, 0.456, 0.406];
const IMAGENET_STD = [0.229, 0.224, 0.225];

/** General object recogniser: MobileNetV2 (ImageNet-1k) from the ONNX Model Zoo. */
export class ObjectModel {
  constructor(private ort: OrtLike, private session: OrtSessionLike) {}

  static async load(ort: OrtLike, modelBytes: Uint8Array, options?: Record<string, unknown>): Promise<ObjectModel> {
    const session = await ort.InferenceSession.create(modelBytes, options);
    return new ObjectModel(ort, session);
  }

  /** HWC [0,255] RGB (224x224) -> NCHW normalised. */
  prepare(image: RgbaImage, crop: CropRect): Float32Array {
    const rgb = resizeToRgb(image, crop, 224, 224);
    const out = new Float32Array(3 * 224 * 224);
    const plane = 224 * 224;
    for (let i = 0; i < plane; i++) {
      for (let c = 0; c < 3; c++) out[c * plane + i] = (rgb[i * 3 + c] / 255 - IMAGENET_MEAN[c]) / IMAGENET_STD[c];
    }
    return out;
  }

  async predict(input: Float32Array): Promise<Float32Array> {
    const tensor = new this.ort.Tensor("float32", input, [1, 3, 224, 224]);
    const out = await this.session.run({ [this.session.inputNames[0]]: tensor });
    const logits = out[this.session.outputNames[0]].data as ArrayLike<number>;
    if (logits.length !== 1000) throw new Error("Unexpected object model output size.");
    let max = -Infinity;
    for (let i = 0; i < 1000; i++) if (logits[i] > max) max = logits[i];
    const probs = new Float32Array(1000);
    let sum = 0;
    for (let i = 0; i < 1000; i++) {
      probs[i] = Math.exp(logits[i] - max);
      sum += probs[i];
    }
    for (let i = 0; i < 1000; i++) probs[i] /= sum;
    return probs;
  }
}

export { flipHorizontal };
