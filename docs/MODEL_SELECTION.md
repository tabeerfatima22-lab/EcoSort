# Model selection

## Requirements

1. Already trained on waste pictures. No training by the user.
2. Small enough to download and run inside a phone browser.
3. Weights I could actually download, load and run, with labels I could check.
4. Documented training data and evaluation.

Requirement 3 mattered in practice. The environment this project was built in could reach
GitHub and npm but not Hugging Face, so models hosted only on Hugging Face could be read
about but not executed. I did not select anything I could not run.

## Candidates considered

| Candidate | Architecture | Trained on | Browser-ready | Verified here | Decision |
|---|---|---|---|---|---|
| SmartWaste v1.3.1 (anniesrdnl) | MobileNetV2 + dense head, 6 classes | TrashNet + RealWaste + Garbage Dataset + 101 custom photos (11,314 pictures) | Yes: ONNX, 10 MB | Yes: downloaded, labels checked, run on 1,760 pictures | **Selected** |
| RecycleNet (LeoYan/recyclenet-mobilenetv3) | MobileNetV3-Small, 6 classes | TrashNet only | Yes: ONNX | No: Hugging Face not reachable | Not selected. TrashNet-only models see only single objects on white backgrounds. |
| Trash-Net (prithivMLmods) | SigLIP2 base (a Vision Transformer), 6 classes | TrashNet-style 6 classes | No ONNX build found; a ViT-Base image encoder is roughly ten times larger than MobileNetV2 | No | Not selected: too heavy for phones, could not verify. |
| WasteWise (YOLOv8n-cls) | YOLOv8 nano classifier, 8 classes | A custom "garbage_office" dataset | Yes: ONNX, about 5.5 MB | No | Not selected: undocumented custom dataset, could not verify. |
| YOLO detectors trained on TACO | YOLOv5/v8 detection | TACO litter photos | Varies | No verified, browser-ready weights located | Not selected. Would be the route to true multi-object detection. |
| EfficientNet waste classifiers | EfficientNet-B0 and similar | Various | None found with verifiable ONNX weights | No | Not selected. |
| ImageNet classifier alone | MobileNetV2, 1,000 objects | ImageNet | Yes | Yes | **Not used for bin decisions.** It names objects, not materials or recyclability. Used only as a cross-check. |

Model descriptions for the candidates I could not run come from their public model pages.
Their accuracy claims are their authors' and were not checked.

## The selected material model

- **Architecture:** MobileNetV2 (ImageNet weights) -> global average pooling -> dropout ->
  dense 256 -> dropout -> dense 6 with softmax. Input 224 x 224 RGB, values 0-255; the
  model graph applies `x / 127.5 - 1` itself.
- **Classes, in order:** cardboard, glass, metal, paper, plastic, trash. EcoSort checks this
  order against `metadata.json` every time the model loads and refuses to run if it differs.
- **Training data (author's description):** TrashNet (single items on white), RealWaste
  (items photographed at a landfill, CC BY 4.0), a public Garbage Dataset of web and phone
  photos (MIT), plus 101 curated photos. Split 70/15/15 with duplicate removal.
- **Author-reported performance:** 87.5% accuracy on the author's 1,698-picture test split
  (by source: TrashNet 83.9%, RealWaste 81.0%, Garbage Dataset 94.0%). Source:
  `public/models/waste/metadata.json`, copied unchanged from the author's repository.
- **Independent performance measured for EcoSort:** see `docs/RESULTS.md`. It is lower than
  the author's figure, as expected for pictures from a different source.

## The object model

MobileNetV2-12 from the ONNX Model Zoo, trained on ImageNet-1k. EcoSort uses it to:

1. name the object when it is confident and the object is on a short list of waste-relevant
   classes (water bottle, carton, envelope and so on);
2. block a recommendation when most of its probability sits on electronics, medical items,
   food or clothing;
3. block a recommendation when the named object's usual material contradicts the material
   model (for example "paper towel" against "paper recycling").

The lists live in `src/core/objects.ts`. Every label in them is checked against the model's
label file at start-up.

## Object recognition versus material classification

These are separate questions and EcoSort keeps them separate. The material model answers
"what is it made of?" and is the only source of the bin. The object model answers "what is
it?" and can only add a name or veto. Neither model can identify a resin code (PET, HDPE);
the app says "Plastic", not "PET plastic".

## Known weaknesses of this choice

- Six classes only. No organics, textiles, batteries or e-waste classes.
- Trained mostly on one item per picture. Multiple items are not detected individually.
- No licence file in the model's repository (see README).
- Softmax confidence is not calibrated.

## Upgrade paths

- A detector trained on TACO for multiple items per frame.
- A zero-shot vision-language model (CLIP or SigLIP through Transformers.js) for open-ended
  object naming. Larger download; needs its own validation.
- Temperature scaling on a local validation set to calibrate confidence.
