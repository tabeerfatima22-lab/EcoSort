/**
 * EcoSort AI evaluation. Runs the exact analysis pipeline the app uses on a
 * folder of labelled pictures and writes measured results.
 *
 *   npm run evaluate -- --images <folder> --name <run-name>
 *        [--list <file with relative paths>] [--mode strict|balanced]
 *        [--brightness <factor>]   simulate darker (<1) or brighter (>1) pictures
 *
 * Folder layout: <folder>/.../<label>/<picture>. By default the label is the
 * name of the folder the picture sits in: cardboard, glass, metal, paper,
 * plastic, trash, or anything else for items the four bins do not cover
 * (correct answer for those: "Uncertain").
 *
 * --labels <json> overrides this with a map from folder path to a material
 * class, "out-of-scope", or "depends" (not scored; reported separately).
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import * as ort from "onnxruntime-web";
import { BIN_ORDER, CLASS_TO_BIN, type BinId } from "../src/core/bins";
import { MODES, type ModeName } from "../src/core/config";
import { topBin } from "../src/core/decision";
import { EXPECTED_WASTE_CLASSES, ObjectModel, WasteModel, type OrtLike, type WasteClass, type WasteMetadata } from "../src/core/models";
import { analyse } from "../src/core/pipeline";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf("--" + name);
  return i === -1 ? fallback : process.argv[i + 1];
}
const root = arg("images");
const name = arg("name", "run")!;
const mode = (arg("mode", "strict") as ModeName) ?? "strict";
const brightness = Number(arg("brightness", "1"));
if (!root || !MODES[mode]) {
  console.error("Usage: npm run evaluate -- --images <folder> --name <run-name> [--list file] [--mode strict|balanced] [--brightness 0.4]");
  process.exit(1);
}

function walk(dir: string, base = ""): string[] {
  return fs.readdirSync(path.join(dir, base), { withFileTypes: true }).flatMap((e) =>
    e.name.startsWith(".") ? [] : e.isDirectory() ? walk(dir, path.join(base, e.name)) : /\.(jpe?g|png|webp)$/i.test(e.name) ? [path.join(base, e.name)] : [],
  );
}
const listFile = arg("list");
const files = listFile ? fs.readFileSync(listFile, "utf8").split("\n").filter(Boolean) : walk(root).sort();

(ort.env as unknown as { wasm: { numThreads: number } }).wasm.numThreads = 1;
const meta = JSON.parse(fs.readFileSync("public/models/waste/metadata.json", "utf8")) as WasteMetadata & { model_file: string };
const models = {
  waste: await WasteModel.load(ort as unknown as OrtLike, fs.readFileSync("public/models/waste/" + meta.model_file), meta),
  object: await ObjectModel.load(ort as unknown as OrtLike, fs.readFileSync("public/models/object/mobilenetv2-12.onnx")),
};
const settings = MODES[mode];

type Truth = BinId | "out-of-scope" | "depends";
const labelMap: Record<string, string> = arg("labels") ? JSON.parse(fs.readFileSync(arg("labels")!, "utf8")) : {};
const labelKeys = Object.keys(labelMap).filter((k) => !k.startsWith("_")).sort((a, b) => b.length - a.length);
function resolve(file: string): { label: string; truth: Truth } {
  const dir = "/" + path.dirname(file).split(path.sep).join("/").toLowerCase() + "/";
  const key = labelKeys.find((k) => dir.includes("/" + k.toLowerCase() + "/"));
  const label = key ? labelMap[key] : path.basename(path.dirname(file)).toLowerCase();
  if (label === "depends") return { label, truth: "depends" };
  return { label, truth: (EXPECTED_WASTE_CLASSES as readonly string[]).includes(label) ? CLASS_TO_BIN[label as WasteClass] : "out-of-scope" };
}
type Answer = BinId | "uncertain";
interface Row { group: string; file: string; label: string; truth: Truth; answer: Answer; forced: BinId; forcedClass: WasteClass; confidence: number; reason?: string; ms: number }
const rows: Row[] = [];
let failed = 0;

for (const file of files) {
  const { label, truth } = resolve(file);
  const group = path.dirname(file).split(path.sep).slice(-2).join("/");
  try {
    const { data, info } = await sharp(path.join(root, file)).rotate().flatten({ background: "#ffffff" }).toColourspace("srgb").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixels = new Uint8Array(data.buffer, data.byteOffset, data.length);
    if (brightness !== 1) for (let i = 0; i < pixels.length; i++) if (i % 4 !== 3) pixels[i] = Math.min(255, Math.round(pixels[i] * brightness));
    const image = { data: pixels, width: info.width, height: info.height };
    const { decision, inferenceMs } = await analyse(image, { x: 0, y: 0, width: info.width, height: info.height }, models, settings);
    rows.push({
      group, file, label, truth,
      answer: decision.status === "recommend" ? decision.bin! : "uncertain",
      forced: topBin(decision.binProbabilities),
      forcedClass: decision.ranking[0].label,
      confidence: decision.binProbability,
      reason: decision.reason,
      ms: inferenceMs,
    });
  } catch {
    failed++;
  }
  if (rows.length % 100 === 0) console.log(`${rows.length}/${files.length}`);
}

const inScope = rows.filter((r) => r.truth !== "out-of-scope" && r.truth !== "depends");
const depends = rows.filter((r) => r.truth === "depends");
const outScope = rows.filter((r) => r.truth === "out-of-scope");
const answered = inScope.filter((r) => r.answer !== "uncertain");
const correct = answered.filter((r) => r.answer === r.truth);
const pct = (a: number, b: number) => (b ? a / b : null);
const fmt = (v: number | null) => (v === null ? "n/a" : (100 * v).toFixed(1) + "%");

const answers: Answer[] = [...BIN_ORDER, "uncertain"];
const truths: Truth[] = [...BIN_ORDER, "out-of-scope", "depends"];
const groups = [...new Set(rows.map((r) => r.group))].sort();
const byGroup = Object.fromEntries(groups.map((g) => {
  const rs = rows.filter((r) => r.group === g);
  return [g, { truth: rs[0].truth, n: rs.length, ...Object.fromEntries(answers.map((a) => [a, rs.filter((r) => r.answer === a).length])) }];
}));
const confusion = Object.fromEntries(truths.map((t) => [t, Object.fromEntries(answers.map((a) => [a, rows.filter((r) => r.truth === t && r.answer === a).length]))]));
const perBin = Object.fromEntries(
  BIN_ORDER.map((b) => {
    const items = inScope.filter((r) => r.truth === b).length;
    const recommended = rows.filter((r) => r.truth !== "depends" && r.answer === b).length;
    const right = rows.filter((r) => r.answer === b && r.truth === b).length;
    return [b, { items, recommended, correct: right, precision: pct(right, recommended), recall: pct(right, items) }];
  }),
);
const reasons: Record<string, number> = {};
for (const r of rows) if (r.reason) reasons[r.reason] = (reasons[r.reason] ?? 0) + 1;
const times = rows.map((r) => r.ms).sort((a, b) => a - b);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

const summary = {
  run: name,
  date: new Date().toISOString(),
  mode,
  settings,
  simulated_brightness_factor: brightness,
  waste_model: `${meta.model_name} ${meta.model_version}`,
  object_model: "mobilenetv2-12 (ONNX Model Zoo, ImageNet-1k)",
  runtime: `onnxruntime-web (WebAssembly, 1 thread) on Node ${process.version}`,
  images: { listed: files.length, analysed: rows.length, unreadable: failed, in_scope: inScope.length, out_of_scope: outScope.length, depends_on_local_rules: depends.length },
  without_safety_checks: {
    note: "Always answering with the most likely class (no thresholds). In-scope pictures only.",
    six_class_accuracy: pct(inScope.filter((r) => r.forcedClass === r.label).length, inScope.length),
    bin_accuracy: pct(inScope.filter((r) => r.forced === r.truth).length, inScope.length),
  },
  with_safety_checks: {
    answered_rate: pct(answered.length, inScope.length),
    accuracy_when_answered: pct(correct.length, answered.length),
    wrong_bin_rate_of_all_items: pct(answered.length - correct.length, inScope.length),
    uncertain_rate: pct(inScope.length - answered.length, inScope.length),
    mean_confidence_correct: mean(correct.map((r) => r.confidence)),
    mean_confidence_wrong: mean(answered.filter((r) => r.answer !== r.truth).map((r) => r.confidence)),
  },
  out_of_scope: {
    note: "Items the four bins do not cover. The correct behaviour is 'Uncertain'.",
    correctly_uncertain: pct(outScope.filter((r) => r.answer === "uncertain").length, outScope.length),
    sent_to_a_recycling_bin: pct(outScope.filter((r) => r.answer !== "uncertain" && r.answer !== "general").length, outScope.length),
  },
  per_bin: perBin,
  by_folder: byGroup,
  confusion_matrix_rows_truth_cols_answer: confusion,
  uncertain_reasons: reasons,
  inference_ms: { mean: mean(times), median: times[Math.floor(times.length / 2)] ?? null, p95: times[Math.floor(times.length * 0.95)] ?? null, note: "Five model passes per picture on this computer's CPU; phones will differ." },
  wrong_recommendations: rows.filter((r) => r.truth !== "depends" && r.answer !== "uncertain" && r.answer !== r.truth).map((r) => ({ file: r.file, truth: r.truth, answer: r.answer, confidence: +r.confidence.toFixed(3) })),
};

fs.mkdirSync("docs/results", { recursive: true });
fs.writeFileSync(`docs/results/${name}.json`, JSON.stringify(summary, null, 2));
fs.writeFileSync(
  `docs/results/${name}.csv`,
  "file,group,label,truth,answer,confidence,reason,ms\n" + rows.map((r) => [JSON.stringify(r.file), JSON.stringify(r.group), r.label, r.truth, r.answer, r.confidence.toFixed(4), r.reason ?? "", r.ms.toFixed(0)].join(",")).join("\n") + "\n",
);

const s = summary;
console.log(`\n${name} (${mode}, brightness x${brightness}) - ${rows.length} pictures`);
console.log(`  no safety checks:  6-class ${fmt(s.without_safety_checks.six_class_accuracy)}, bin ${fmt(s.without_safety_checks.bin_accuracy)}`);
console.log(`  with checks:       answered ${fmt(s.with_safety_checks.answered_rate)}, correct when answered ${fmt(s.with_safety_checks.accuracy_when_answered)}, wrong bin overall ${fmt(s.with_safety_checks.wrong_bin_rate_of_all_items)}`);
console.log(`  out-of-scope:      correctly uncertain ${fmt(s.out_of_scope.correctly_uncertain)}, sent to recycling ${fmt(s.out_of_scope.sent_to_a_recycling_bin)}`);
for (const b of BIN_ORDER) console.log(`  ${b.padEnd(8)} precision ${fmt(perBin[b].precision)} recall ${fmt(perBin[b].recall)} (n=${perBin[b].items})`);
console.log(`  time per picture:  mean ${s.inference_ms.mean?.toFixed(0)} ms`);
console.log(`  written: docs/results/${name}.json and .csv`);
