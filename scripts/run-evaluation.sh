#!/usr/bin/env bash
# Re-runs every measurement behind docs/RESULTS.md (about 30 minutes on a laptop).
set -euo pipefail
cd "$(dirname "$0")/.."
TB=testdata/TrashBox
L=docs/experiment/trashbox_labels.json
for half in calibration heldout; do
  for mode in strict balanced; do
    npx tsx scripts/evaluate.ts --images $TB --list docs/experiment/trashbox_$half.txt --labels $L --mode $mode --name trashbox_${half}_$mode
  done
done
for b in 0.3 0.6 1.5; do
  npx tsx scripts/evaluate.ts --images $TB --list docs/experiment/trashbox_heldout.txt --labels $L --mode strict --brightness $b --name trashbox_heldout_strict_brightness_$b
done
npx tsx scripts/evaluate.ts --images testdata/trashnet --list docs/experiment/trashnet_pipeline_check.txt --mode strict --name trashnet_pipeline_check_strict
node scripts/build-report.mjs
