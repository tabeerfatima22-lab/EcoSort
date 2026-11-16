import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import * as ort from "onnxruntime-web";
import { WasteModel, ObjectModel, type OrtLike } from "../../src/core/models";
import { centreSquare, centreCrop } from "../../src/core/resize";
const [root, listFile, outFile] = process.argv.slice(2);
(ort.env as any).wasm.numThreads = 1;
const E = "public/models/";
const meta = JSON.parse(fs.readFileSync(E + "waste/metadata.json", "utf8"));
const waste = await WasteModel.load(ort as unknown as OrtLike, fs.readFileSync(E + "waste/smart_waste_mobilenetv2.onnx"), meta);
const obj = await ObjectModel.load(ort as unknown as OrtLike, fs.readFileSync(E + "object/mobilenetv2-12.onnx"));
const out = fs.createWriteStream(outFile);
const r4 = (a: Float32Array) => Array.from(a).map((x) => +x.toFixed(4));
for (const f of fs.readFileSync(listFile, "utf8").split("\n").filter(Boolean)) {
  const { data, info } = await sharp(path.join(root, f)).rotate().flatten({ background: "#ffffff" }).toColourspace("srgb").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const img = { data: new Uint8Array(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height };
  const sq = centreSquare(img.width, img.height, 0.875);
  const o = await obj.run(obj.prepare(img, sq));
  const w = await waste.run(waste.prepare(img, { x: 0, y: 0, width: img.width, height: img.height }));
  const w8 = await waste.run(waste.prepare(img, centreCrop(img.width, img.height, 0.8)));
  out.write(JSON.stringify({ f, o: r4(o.features!), w: r4(w.features!), w8: r4(w8.features!) }) + "\n");
}
out.end();
