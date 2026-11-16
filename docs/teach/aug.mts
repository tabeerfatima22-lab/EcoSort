// Same-item proxy: features of the original photo and of 3 altered versions
// (different framing, darker, rotated + mirrored), as if the same item were re-photographed.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import * as ort from "onnxruntime-web";
import { WasteModel, ObjectModel, type OrtLike } from "../../src/core/models";
import { centreSquare } from "../../src/core/resize";
const [root, listFile, outFile] = process.argv.slice(2);
(ort.env as any).wasm.numThreads = 1;
const E = "public/models/";
const meta = JSON.parse(fs.readFileSync(E + "waste/metadata.json", "utf8"));
const waste = await WasteModel.load(ort as unknown as OrtLike, fs.readFileSync(E + "waste/smart_waste_mobilenetv2.onnx"), meta);
const obj = await ObjectModel.load(ort as unknown as OrtLike, fs.readFileSync(E + "object/mobilenetv2-12.onnx"));
const out = fs.createWriteStream(outFile);
const r4 = (a: Float32Array) => Array.from(a).map((x) => +x.toFixed(4));
async function feats(buf: sharp.Sharp) {
  const { data, info } = await buf.flatten({ background: "#ffffff" }).toColourspace("srgb").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const img = { data: new Uint8Array(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height };
  const o = await obj.run(obj.prepare(img, centreSquare(img.width, img.height, 0.875)));
  const w = await waste.run(waste.prepare(img, { x: 0, y: 0, width: img.width, height: img.height }));
  return { o: r4(o.features!), w: r4(w.features!) };
}
for (const f of fs.readFileSync(listFile, "utf8").split("\n").filter(Boolean)) {
  const file = path.join(root, f);
  const m = await sharp(file).rotate().metadata();
  const W = m.autoOrient?.width ?? m.width!, H = m.autoOrient?.height ?? m.height!;
  const views = {
    orig: sharp(file).rotate(),
    reframe: sharp(file).rotate().extract({ left: Math.round(W * 0.12), top: Math.round(H * 0.05), width: Math.round(W * 0.8), height: Math.round(H * 0.85) }),
    dark: sharp(file).rotate().modulate({ brightness: 0.6 }),
    turned: sharp(file).rotate().flop().rotate(12, { background: "#ffffff" }),
  };
  const rec: Record<string, unknown> = { f };
  for (const [k, v] of Object.entries(views)) rec[k] = await feats(v);
  out.write(JSON.stringify(rec) + "\n");
}
out.end();
