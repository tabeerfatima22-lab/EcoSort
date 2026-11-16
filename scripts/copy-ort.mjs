// Copies the ONNX Runtime Web files the app loads at run time into public/ort.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("onnxruntime-web/ort-wasm-simd-threaded.wasm"));
const target = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "ort");
mkdirSync(target, { recursive: true });
for (const f of ["ort.wasm.min.mjs", "ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"]) copyFileSync(join(dist, f), join(target, f));
console.log("Copied ONNX Runtime Web files to public/ort");
