// Turns docs/results/*.json (written by `npm run evaluate`) into docs/RESULTS.md
// and src/measured.json (shown on the app's About page). Every number comes
// from those files; nothing here is typed in by hand.
import fs from "node:fs";

const dir = "docs/results";
const runs = Object.fromEntries(fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => [f.replace(".json", ""), JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8"))]));
const p = (v) => (v === null || v === undefined ? "n/a" : (100 * v).toFixed(1) + "%");
const need = (name) => {
  if (!runs[name]) throw new Error(`Missing ${dir}/${name}.json - run the evaluation first (see docs/EXPERIMENT.md).`);
  return runs[name];
};
const meta = JSON.parse(fs.readFileSync("public/models/waste/metadata.json", "utf8"));

const brief = (r) => ({
  pictures: r.images.analysed,
  inScope: r.images.in_scope,
  outOfScope: r.images.out_of_scope,
  dependsOnLocalRules: r.images.depends_on_local_rules,
  forcedBinAccuracy: r.without_safety_checks.bin_accuracy,
  forcedClassAccuracy: r.without_safety_checks.six_class_accuracy,
  answered: r.with_safety_checks.answered_rate,
  accuracyWhenAnswered: r.with_safety_checks.accuracy_when_answered,
  wrongBinOfAll: r.with_safety_checks.wrong_bin_rate_of_all_items,
  outOfScopeHeldBack: r.out_of_scope.correctly_uncertain,
  outOfScopeToRecycling: r.out_of_scope.sent_to_a_recycling_bin,
  meanMs: r.inference_ms.mean,
});

const strict = need("trashbox_heldout_strict");
const balanced = need("trashbox_heldout_balanced");
const check = need("trashnet_pipeline_check_strict");
const bright = Object.entries(runs).filter(([k]) => k.startsWith("trashbox_heldout_strict_brightness_")).map(([, r]) => ({ factor: r.simulated_brightness_factor, ...brief(r) }));
bright.push({ factor: 1, ...brief(strict) });
bright.sort((a, b) => a.factor - b.factor);

const measured = {
  generated: new Date().toISOString().slice(0, 10),
  wasteModel: `${meta.model_name} ${meta.model_version}`,
  authorReported: { testAccuracy: meta.metrics.test_accuracy, testImages: meta.metrics.test_samples, bySource: Object.fromEntries(Object.entries(meta.metrics.by_source).map(([k, v]) => [k, { accuracy: v.accuracy, images: v.test_images }])) },
  heldout: { strict: brief(strict), balanced: brief(balanced) },
  pipelineCheck: brief(check),
  brightness: bright,
  teach: fs.existsSync("docs/teach/results.json") ? JSON.parse(fs.readFileSync("docs/teach/results.json", "utf8")).chosen : null,
};
fs.writeFileSync("src/measured.json", JSON.stringify(measured, null, 2) + "\n");

const cm = (r) => {
  const cols = ["general", "plastic", "paper", "other", "uncertain"];
  const m = r.confusion_matrix_rows_truth_cols_answer;
  return ["| True bin \\ EcoSort answered | " + cols.join(" | ") + " |", "|---|" + cols.map(() => "---:").join("|") + "|", ...Object.keys(m).map((t) => `| ${t} | ${cols.map((c) => m[t][c]).join(" | ")} |`)].join("\n");
};
const perBin = (r) => ["| Bin | Items | Recommended | Correct | Precision | Recall |", "|---|---:|---:|---:|---:|---:|", ...Object.entries(r.per_bin).map(([b, v]) => `| ${b} | ${v.items} | ${v.recommended} | ${v.correct} | ${p(v.precision)} | ${p(v.recall)} |`)].join("\n");
const folders = (r) => ["| Test-set folder | Scored as | Pictures | general | plastic | paper | other | uncertain |", "|---|---|---:|---:|---:|---:|---:|---:|", ...Object.entries(r.by_folder).map(([g, v]) => `| ${g.replace("TrashBox_train_dataset_subfolders/", "")} | ${v.truth} | ${v.n} | ${v.general} | ${v.plastic} | ${v.paper} | ${v.other} | ${v.uncertain} |`)].join("\n");
const headline = (r) => `| ${r.mode} | ${p(r.with_safety_checks.answered_rate)} | ${p(r.with_safety_checks.accuracy_when_answered)} | ${p(r.with_safety_checks.wrong_bin_rate_of_all_items)} | ${p(r.with_safety_checks.uncertain_rate)} | ${p(r.out_of_scope.correctly_uncertain)} | ${p(r.out_of_scope.sent_to_a_recycling_bin)} |`;

const md = `# EcoSort AI - measured results

Generated ${measured.generated} by \`npm run report\` from the files in \`docs/results/\`.
Every number on this page was produced by running the app's own analysis code
(\`src/core\`) on real pictures. Nothing here is estimated or typed in.

## What was tested

- **Waste model:** ${measured.wasteModel} (MobileNetV2, six material classes).
- **Object model:** MobileNetV2 ImageNet-1k (\`mobilenetv2-12\`, ONNX Model Zoo).
- **Runtime:** ${strict.runtime}. The browser uses the same runtime and the same code.
- **Independent test set:** a fixed-seed random sample of 1,400 pictures (200 per class folder)
  from the TrashBox dataset, which is **not** one of the model's training datasets.
  The sample was split once at random into a calibration half (used to choose the thresholds)
  and a held-out half (used once, for the numbers below). File lists: \`docs/experiment/\`.
- **Ground truth:** \`docs/experiment/trashbox_labels.json\`. Electronics, medical items and
  construction scrap count as "out of scope" (the right answer is Uncertain). Tetra Pak cartons,
  paper cups, plastic cups and plastic bags are marked "depends" because sites differ on whether
  they are accepted; they are listed but not scored.

## Headline result (held-out half, ${strict.images.analysed} pictures)

Of these, ${strict.images.in_scope} belong in one of the four bins, ${strict.images.out_of_scope} are out of scope and ${strict.images.depends_on_local_rules} depend on local rules.

Without any safety checks (always trusting the most likely class), the waste model put
**${p(strict.without_safety_checks.bin_accuracy)}** of in-scope items in the right bin
(${p(strict.without_safety_checks.six_class_accuracy)} when all six material classes must match).

With EcoSort's checks (confidence threshold, agreement between four views, object-model veto):

| Mode | Gave a bin | Correct when it gave a bin | Wrong bin, share of all items | Said Uncertain | Out-of-scope items held back | Out-of-scope items sent to a recycling bin |
|---|---:|---:|---:|---:|---:|---:|
${headline(strict)}
${headline(balanced)}

Mean confidence shown for correct recommendations (strict): ${p(strict.with_safety_checks.mean_confidence_correct)}; for wrong ones: ${p(strict.with_safety_checks.mean_confidence_wrong)}.
The confidence figure is therefore **not** a calibrated probability: wrong answers were also shown with high confidence.

### Per bin (strict, held-out)

Precision counts out-of-scope items that were wrongly given this bin as errors.

${perBin(strict)}

### Confusion matrix (strict, held-out)

${cm(strict)}

### By test-set folder (strict, held-out)

${folders(strict)}

### Why it said Uncertain (strict, held-out, all pictures)

${Object.entries(strict.uncertain_reasons).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

### Wrong recommendations (strict, held-out)

${strict.wrong_recommendations.length} pictures. The full list with file names is in \`docs/results/trashbox_heldout_strict.json\`.

## Calibration half (used to choose thresholds, so not an unbiased estimate)

| Mode | Gave a bin | Correct when it gave a bin | Wrong bin, share of all items | Said Uncertain | Out-of-scope items held back | Out-of-scope items sent to a recycling bin |
|---|---:|---:|---:|---:|---:|---:|
${headline(need("trashbox_calibration_strict"))}
${headline(need("trashbox_calibration_balanced"))}

## Simulated lighting (strict, held-out half)

Each picture's pixel values were multiplied by a factor before analysis. This is a digital
simulation of darker or brighter exposure, **not** a physical lighting test. Physical lighting
must be tested with the in-app experiment log (see \`docs/EXPERIMENT.md\`).

| Brightness factor | Gave a bin | Correct when it gave a bin | Wrong bin, share of all items | Bin accuracy without checks |
|---:|---:|---:|---:|---:|
${bright.map((b) => `| x${b.factor} | ${p(b.answered)} | ${p(b.accuracyWhenAnswered)} | ${p(b.wrongBinOfAll)} | ${p(b.forcedBinAccuracy)} |`).join("\n")}

## Pipeline check on TrashNet (not an independent test)

${check.images.analysed} pictures sampled from TrashNet (60 per class). TrashNet is one of the model's
training datasets, so most of these pictures were seen in training. This run only confirms that
EcoSort feeds the model correctly: six-class accuracy without checks was
**${p(check.without_safety_checks.six_class_accuracy)}** (bin accuracy ${p(check.without_safety_checks.bin_accuracy)});
in strict mode it gave a bin for ${p(check.with_safety_checks.answered_rate)} of pictures and was correct for ${p(check.with_safety_checks.accuracy_when_answered)} of those.

## Speed

Mean analysis time per picture (five model passes): ${strict.inference_ms.mean.toFixed(0)} ms, median ${strict.inference_ms.median.toFixed(0)} ms,
95th percentile ${strict.inference_ms.p95.toFixed(0)} ms, on the evaluation computer's CPU with one thread.
Phone timings were not measured here; the app shows the measured time for every scan under "Show model details".

## What the model's author reports (not measured by EcoSort)

From the model's own \`metadata.json\`: ${p(meta.metrics.test_accuracy)} accuracy on the author's ${meta.metrics.test_samples}-picture test split
(${Object.entries(meta.metrics.by_source).map(([k, v]) => `${k} ${p(v.accuracy)}`).join(", ")}).
That split comes from the same datasets the model was trained on, which is why it is higher than the
independent result above.

## Not measured

- Accuracy on a live phone camera with physical items, real lighting, angles and distances.
- Phone inference time, memory use and battery impact.
- Contaminated items (the app asks the user instead of judging by camera).
- Probability calibration (for example temperature scaling or reliability curves).
`;
fs.writeFileSync("docs/RESULTS.md", md);

// Science report: fill the measured figures into the template.
const S = measured.heldout.strict;
const B = measured.heldout.balanced;
const fill = {
  n: S.pictures, nin: S.inScope, nout: S.outOfScope, ndep: S.dependsOnLocalRules,
  forced: p(S.forcedBinAccuracy), forced6: p(S.forcedClassAccuracy),
  answered: p(S.answered), acc: p(S.accuracyWhenAnswered), wrong: p(S.wrongBinOfAll), oos: p(S.outOfScopeHeldBack),
  b_answered: p(B.answered), b_acc: p(B.accuracyWhenAnswered), b_wrong: p(B.wrongBinOfAll),
  ms: S.meanMs.toFixed(0), author: p(meta.metrics.test_accuracy),
  brightness_rows: bright.map((b) => `| x${b.factor} | ${p(b.answered)} | ${p(b.accuracyWhenAnswered)} | ${p(b.forcedBinAccuracy)} |`).join("\n"),
};
let report = fs.readFileSync("docs/templates/SCIENCE_REPORT.template.md", "utf8");
for (const [k, v] of Object.entries(fill)) report = report.replaceAll(`{{${k}}}`, String(v));
if (/{{\w+}}/.test(report)) throw new Error("Unfilled placeholder in the science report template");
fs.writeFileSync("docs/SCIENCE_REPORT.md", report);
console.log("Wrote docs/RESULTS.md, docs/SCIENCE_REPORT.md and src/measured.json");
