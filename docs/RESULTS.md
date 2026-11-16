# EcoSort AI - measured results

Generated 2026-11-16 by `npm run report` from the files in `docs/results/`.
Every number on this page was produced by running the app's own analysis code
(`src/core`) on real pictures. Nothing here is estimated or typed in.

## What was tested

- **Waste model:** smart_waste_mobilenetv2 1.3.1 (MobileNetV2, six material classes).
- **Object model:** MobileNetV2 ImageNet-1k (`mobilenetv2-12`, ONNX Model Zoo).
- **Runtime:** onnxruntime-web (WebAssembly, 1 thread) on Node v22.23.4. The browser uses the same runtime and the same code.
- **Independent test set:** a fixed-seed random sample of 1,400 pictures (200 per class folder)
  from the TrashBox dataset, which is **not** one of the model's training datasets.
  The sample was split once at random into a calibration half (used to choose the thresholds)
  and a held-out half (used once, for the numbers below). File lists: `docs/experiment/`.
- **Ground truth:** `docs/experiment/trashbox_labels.json`. Electronics, medical items and
  construction scrap count as "out of scope" (the right answer is Uncertain). Tetra Pak cartons,
  paper cups, plastic cups and plastic bags are marked "depends" because sites differ on whether
  they are accepted; they are listed but not scored.

## Headline result (held-out half, 700 pictures)

Of these, 381 belong in one of the four bins, 217 are out of scope and 102 depend on local rules.

Without any safety checks (always trusting the most likely class), the waste model put
**86.1%** of in-scope items in the right bin
(76.1% when all six material classes must match).

With EcoSort's checks (confidence threshold, agreement between four views, object-model veto):

| Mode | Gave a bin | Correct when it gave a bin | Wrong bin, share of all items | Said Uncertain | Out-of-scope items held back | Out-of-scope items sent to a recycling bin |
|---|---:|---:|---:|---:|---:|---:|
| strict | 49.6% | 96.8% | 1.6% | 50.4% | 85.3% | 9.7% |
| balanced | 64.8% | 92.3% | 5.0% | 35.2% | 73.7% | 15.7% |

Mean confidence shown for correct recommendations (strict): 99.3%; for wrong ones: 97.5%.
The confidence figure is therefore **not** a calibrated probability: wrong answers were also shown with high confidence.

### Per bin (strict, held-out)

Precision counts out-of-scope items that were wrongly given this bin as errors.

| Bin | Items | Recommended | Correct | Precision | Recall |
|---|---:|---:|---:|---:|---:|
| general | 19 | 15 | 3 | 20.0% | 15.8% |
| plastic | 43 | 26 | 18 | 69.2% | 41.9% |
| paper | 156 | 97 | 96 | 99.0% | 61.5% |
| other | 163 | 83 | 66 | 79.5% | 40.5% |

### Confusion matrix (strict, held-out)

| True bin \ EcoSort answered | general | plastic | paper | other | uncertain |
|---|---:|---:|---:|---:|---:|
| general | 3 | 0 | 0 | 0 | 16 |
| plastic | 1 | 18 | 0 | 1 | 23 |
| paper | 0 | 0 | 96 | 0 | 60 |
| other | 0 | 4 | 0 | 66 | 93 |
| out-of-scope | 11 | 4 | 1 | 16 | 185 |
| depends | 2 | 0 | 29 | 3 | 68 |

### By test-set folder (strict, held-out)

| Test-set folder | Scored as | Pictures | general | plastic | paper | other | uncertain |
|---|---|---:|---:|---:|---:|---:|---:|
| cardboard | paper | 103 | 0 | 0 | 71 | 0 | 32 |
| glass | other | 86 | 0 | 2 | 0 | 37 | 47 |
| e-waste/electrical cables | out-of-scope | 20 | 3 | 0 | 0 | 1 | 16 |
| e-waste/electronic chips | out-of-scope | 30 | 0 | 1 | 1 | 1 | 27 |
| e-waste/laptops | out-of-scope | 16 | 0 | 0 | 0 | 1 | 15 |
| e-waste/small appliances | out-of-scope | 36 | 0 | 0 | 0 | 0 | 36 |
| e-waste/smartphones | out-of-scope | 8 | 0 | 0 | 0 | 0 | 8 |
| medical/gloves | out-of-scope | 17 | 3 | 0 | 0 | 0 | 14 |
| medical/masks | out-of-scope | 16 | 5 | 0 | 0 | 0 | 11 |
| medical/medicines | out-of-scope | 22 | 0 | 2 | 0 | 0 | 20 |
| medical/syringe | out-of-scope | 32 | 0 | 1 | 0 | 0 | 31 |
| metal/beverage cans | other | 37 | 0 | 1 | 0 | 12 | 24 |
| metal/construction scrap | out-of-scope | 20 | 0 | 0 | 0 | 13 | 7 |
| metal/metal containers | other | 20 | 0 | 0 | 0 | 12 | 8 |
| metal/other metal objects | other | 5 | 0 | 0 | 0 | 3 | 2 |
| metal/spray cans | other | 15 | 0 | 1 | 0 | 2 | 12 |
| paper/news paper | paper | 8 | 0 | 0 | 4 | 0 | 4 |
| paper/paper | paper | 45 | 0 | 0 | 21 | 0 | 24 |
| paper/paper cups | depends | 20 | 0 | 0 | 2 | 3 | 15 |
| paper/tetra pak | depends | 48 | 0 | 0 | 27 | 0 | 21 |
| plastic/cigarette butt | general | 19 | 3 | 0 | 0 | 0 | 16 |
| plastic/plastic bags | depends | 17 | 2 | 0 | 0 | 0 | 15 |
| plastic/plastic bottles | plastic | 26 | 1 | 17 | 0 | 0 | 8 |
| plastic/plastic containers | plastic | 17 | 0 | 1 | 0 | 1 | 15 |
| plastic/plastic cups | depends | 17 | 0 | 0 | 0 | 0 | 17 |

### Why it said Uncertain (strict, held-out, all pictures)

- low-confidence: 294
- unsupported-object: 123
- object-conflict: 28

### Wrong recommendations (strict, held-out)

38 pictures. The full list with file names is in `docs/results/trashbox_heldout_strict.json`.

## Calibration half (used to choose thresholds, so not an unbiased estimate)

| Mode | Gave a bin | Correct when it gave a bin | Wrong bin, share of all items | Said Uncertain | Out-of-scope items held back | Out-of-scope items sent to a recycling bin |
|---|---:|---:|---:|---:|---:|---:|
| strict | 48.1% | 94.1% | 2.8% | 51.9% | 82.5% | 8.8% |
| balanced | 62.5% | 87.2% | 8.0% | 37.5% | 70.6% | 14.0% |

## Simulated lighting (strict, held-out half)

Each picture's pixel values were multiplied by a factor before analysis. This is a digital
simulation of darker or brighter exposure, **not** a physical lighting test. Physical lighting
must be tested with the in-app experiment log (see `docs/EXPERIMENT.md`).

| Brightness factor | Gave a bin | Correct when it gave a bin | Wrong bin, share of all items | Bin accuracy without checks |
|---:|---:|---:|---:|---:|
| x0.3 | 36.0% | 98.5% | 0.5% | 80.3% |
| x0.6 | 45.9% | 97.7% | 1.0% | 85.3% |
| x1 | 49.6% | 96.8% | 1.6% | 86.1% |
| x1.5 | 40.9% | 94.9% | 2.1% | 79.3% |

## Pipeline check on TrashNet (not an independent test)

360 pictures sampled from TrashNet (60 per class). TrashNet is one of the model's
training datasets, so most of these pictures were seen in training. This run only confirms that
EcoSort feeds the model correctly: six-class accuracy without checks was
**87.8%** (bin accuracy 90.8%);
in strict mode it gave a bin for 47.8% of pictures and was correct for 99.4% of those.

## Speed

Mean analysis time per picture (five model passes): 266 ms, median 252 ms,
95th percentile 379 ms, on the evaluation computer's CPU with one thread.
Phone timings were not measured here; the app shows the measured time for every scan under "Show model details".

## What the model's author reports (not measured by EcoSort)

From the model's own `metadata.json`: 87.5% accuracy on the author's 1698-picture test split
(trashnet 83.9%, realwaste 81.0%, garbage 94.0%, custom 80.0%).
That split comes from the same datasets the model was trained on, which is why it is higher than the
independent result above.

## Not measured

- Accuracy on a live phone camera with physical items, real lighting, angles and distances.
- Phone inference time, memory use and battery impact.
- Contaminated items (the app asks the user instead of judging by camera).
- Probability calibration (for example temperature scaling or reliability curves).
