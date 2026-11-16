#!/usr/bin/env bash
# Downloads only the TrashBox pictures used in EcoSort's evaluation (about 235 MB)
# and the TrashNet pictures used for the pipeline check, into ./testdata.
# Usage: bash scripts/fetch-testset.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p testdata && cd testdata

if [ ! -d TrashBox ]; then
  git clone --depth 1 --filter=blob:none --no-checkout https://github.com/nikhilvenkatkumsetty/TrashBox
fi
cat ../docs/experiment/trashbox_calibration.txt ../docs/experiment/trashbox_heldout.txt | sed 's/[][*?\\]/\\&/g; s#^#/#' > /tmp/ecosort-sparse.txt
git -C TrashBox sparse-checkout init --no-cone
cp /tmp/ecosort-sparse.txt TrashBox/.git/info/sparse-checkout
git -C TrashBox checkout HEAD
echo "TrashBox sample: $(find TrashBox -name '*.jpg' -not -path '*/.git/*' | wc -l) pictures (expected 1400)"

if [ ! -d trashnet ]; then
  mkdir trashnet
  curl -L -o trashnet/dataset-resized.zip https://raw.githubusercontent.com/garythung/trashnet/master/data/dataset-resized.zip
  (cd trashnet && unzip -q dataset-resized.zip && rm -rf __MACOSX)
fi
echo "Done. Now run: bash scripts/run-evaluation.sh"
