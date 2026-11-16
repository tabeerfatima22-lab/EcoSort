# Experiment guide

Two experiments are provided. Part A has already been run and can be re-run by anyone.
Part B needs physical items and a phone, and has **not** been run: its tables are empty for
you to fill in.

## Research question

Can a pretrained computer vision system accurately classify everyday waste and recommend
appropriate disposal bins?

## Hypothesis

A computer vision model trained on relevant waste images can classify common waste objects
with measurable accuracy under controlled conditions. Specifically:

- H1: When EcoSort recommends a bin in Strict mode, the recommendation is correct in at
  least 90% of cases.
- H2: Accuracy falls when lighting is dim, the background is cluttered, or the item is far
  from the camera.

## Variables

| Type | Variable | Levels |
|---|---|---|
| Independent | Waste material | cardboard, paper, plastic, glass, metal, general waste, items for none of the bins |
| Independent | Lighting | bright, normal room light, dim |
| Independent | Camera angle | front, 45 degrees, top down |
| Independent | Object distance | about 20 cm, 40 cm, 80 cm |
| Independent | Background | plain, cluttered |
| Dependent | Correct bin (yes / no / uncertain) | |
| Dependent | Confidence shown | 0-100% |
| Dependent | Analysis time | milliseconds, shown in "Show model details" |
| Dependent | Wrong-bin recommendations | count |
| Controlled | Camera device | one phone for the whole experiment |
| Controlled | Model version | shown on the About page and saved in every record |
| Controlled | Mode | Strict |
| Controlled | Procedure and scoring rules | as below |

## Part A - Picture test set (completed)

1. Test pictures: 1,400 pictures drawn at random with a fixed seed (20261116), 200 from each
   of the seven class folders of the TrashBox dataset. TrashBox is not one of the model's
   training datasets.
2. The 1,400 pictures were shuffled once (seed 7) and split in half. Thresholds were chosen
   by looking at the calibration half only. The held-out half was then measured once.
3. Ground truth is in `docs/experiment/trashbox_labels.json`.
4. Each picture goes through the same code as the app (`src/core/pipeline.ts`).
5. Simulated lighting: pixel values multiplied by 0.3, 0.6 and 1.5.

Re-run it:

```bash
bash scripts/fetch-testset.sh
bash scripts/run-evaluation.sh
```

Results: `docs/RESULTS.md`. Raw per-picture output: `docs/results/*.csv`.

Caveats to state in any write-up:

- The pictures are web photos, not photos from your camera.
- TrashBox and the model's "Garbage Dataset" training source are both collections of web
  photos. I did not check for individual pictures appearing in both, so some overlap is
  possible.
- The lighting test is a digital simulation.

## Part B - Physical items with a phone (to do)

### Materials

- One phone with EcoSort open (Strict mode). Note the phone model and browser.
- At least 30 clean items: 5 each of plastic bottles or containers, paper, cardboard, glass
  bottles or jars, metal cans, and general waste (wrappers, tissues). Add 5 items that
  belong in none of the bins (a battery, a phone charger, a medicine blister pack).
- None of the items should be photographed beforehand; the model has never seen them.
- A plain table or sheet of paper as background; a cluttered desk as the second background.
- A room where you can change the light (curtains, lamp).

### Procedure

1. Write the item list in Table 1 and decide the correct bin for each **before** scanning.
2. Baseline run: normal light, front angle, 40 cm, plain background. Scan each item once.
   After each scan press **Record for experiment**, type the item name, choose the correct
   bin, set the conditions, and save.
3. Change **one** variable at a time and repeat the full item list:
   - lighting: bright, dim
   - angle: 45 degrees, top down
   - distance: 20 cm, 80 cm
   - background: cluttered
4. Do not rescan an item because the answer was wrong. One scan per item per condition.
5. Open the **Experiment** tab and press **Download results as CSV**.
6. Fill in Tables 2 to 5 from the CSV (a spreadsheet pivot table does this quickly).

### Scoring rules

- **Correct:** EcoSort recommended the bin you wrote down beforehand.
- **Wrong:** it recommended a different bin.
- **Uncertain:** it declined to recommend. This is neither correct nor wrong.
- For items that belong in none of the bins, **Uncertain is the correct outcome**.

### Measures

- Answer rate = scans with a recommendation / scans of in-scope items
- Accuracy when answered = correct / scans with a recommendation
- Wrong-bin rate = wrong / scans of in-scope items
- Precision for bin X = correct recommendations of X / all recommendations of X
- Recall for bin X = correct recommendations of X / all items that belong in X
- Mean analysis time

### Table 1 - Items (fill in before scanning)

| # | Item description | Material | Correct bin |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| ... | | | |

### Table 2 - Overall results (baseline condition)

| Measure | Value |
|---|---|
| Phone and browser | |
| Model version | |
| Scans of in-scope items | |
| Recommendations given | |
| Correct | |
| Wrong | |
| Uncertain | |
| Answer rate | |
| Accuracy when answered | |
| Wrong-bin rate | |
| Out-of-scope items scanned / held back | |
| Mean analysis time (ms) | |

### Table 3 - Per bin (baseline condition)

| Bin | Items | Recommended | Correct | Precision | Recall |
|---|---|---|---|---|---|
| General waste | | | | | |
| Plastic recycling | | | | | |
| Paper recycling | | | | | |
| Other recyclables | | | | | |

### Table 4 - Confusion matrix (baseline condition)

| Correct bin \ EcoSort said | General | Plastic | Paper | Other | Uncertain |
|---|---|---|---|---|---|
| General | | | | | |
| Plastic | | | | | |
| Paper | | | | | |
| Other | | | | | |
| None of the bins | | | | | |

### Table 5 - Effect of conditions

| Condition | Scans | Answer rate | Accuracy when answered | Wrong-bin rate | Mean confidence | Mean time (ms) |
|---|---|---|---|---|---|---|
| Baseline (normal, front, 40 cm, plain) | | | | | | |
| Bright light | | | | | | |
| Dim light | | | | | | |
| 45 degree angle | | | | | | |
| Top down | | | | | | |
| 20 cm | | | | | | |
| 80 cm | | | | | | |
| Cluttered background | | | | | | |

### Table 6 - Incorrect classifications

| Item | Condition | Correct bin | EcoSort said | Confidence | Likely cause |
|---|---|---|---|---|---|
| | | | | | |

### Reporting

Report Part A and Part B separately. Label every number as measured, and say on which
device and how many scans. With 30 items per condition, one item is 3.3 percentage points,
so small differences between conditions are not meaningful.
