#!/usr/bin/env bash
# Re-downloads both pretrained models from their original sources.
# The project already contains them; use this to verify or restore the files.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/models/waste public/models/object
W=https://raw.githubusercontent.com/anniesrdnl/Smart-Waste-Classifier/54fe1ea8e3be44b52639675c36d60efbd291998a/public/model
curl -fL -o public/models/waste/smart_waste_mobilenetv2.onnx $W/smart_waste_mobilenetv2.onnx
curl -fL -o public/models/waste/metadata.json $W/metadata.json
curl -fL -o public/models/object/mobilenetv2-12.onnx https://media.githubusercontent.com/media/onnx/models/main/validated/vision/classification/mobilenet/model/mobilenetv2-12.onnx
python3 scripts/add-feature-outputs.py   # needs: pip install onnx
shasum -a 256 -c docs/experiment/model_checksums.txt
