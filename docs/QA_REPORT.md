# Quality assurance report

What was actually tested before delivery, how, and what could not be tested.

## Tests performed

| # | Check | How | Outcome |
|---|---|---|---|
| 1 | Material model exists and is accessible | Downloaded from the author's public GitHub repository (commit `54fe1ea`); SHA-256 recorded in `docs/experiment/model_checksums.txt` | Passed |
| 2 | Object model exists and is accessible | Downloaded `mobilenetv2-12.onnx` from the ONNX Model Zoo | Passed |
| 3 | Model labels match the app's mapping | Class order from `metadata.json` is compared with the app's list at every model load; all object-list labels are checked against the 1,000 ImageNet labels at start-up | Passed (the app refuses to start on a mismatch) |
| 4 | Preprocessing is correct | 360 TrashNet pictures (mostly training data) analysed; accuracy in line with the author's reported figure for TrashNet | Passed, see RESULTS.md "Pipeline check" |
| 5 | Real inference on representative waste pictures | 1,400 TrashBox pictures analysed through the app's pipeline in Node (ONNX Runtime Web, WebAssembly) | Completed, see RESULTS.md |
| 6 | Browser and evaluator give the same numbers | Four pictures (bottle, can, cardboard box, server) uploaded in headless Chrome and analysed by the evaluator; top-three probabilities compared | Matched to the displayed 0.1% |
| 7 | Model initialisation in a real browser | Built site served over HTTP, opened in headless Chrome 1200 x 800 and 390 x 844; models downloaded, warmed up, self-test passed; no console errors | Passed |
| 8 | Camera scan end to end | Headless Chrome with a simulated camera feed showing a plastic bottle; pressed Scan item | Recommendation shown: Plastic recycling, object "Water bottle" |
| 9 | Photo upload | Four pictures uploaded through the file input | Three recommendations, one Uncertain (electronics veto) |
| 10 | Continuous mode | Enabled "Scan automatically" with the simulated camera | Result appeared without pressing Scan |
| 11 | Contamination question | Answered "No, it is dirty" after a plastic result | Switched to General waste |
| 12 | Network camera snapshot | Snapshot address answered by a test stub returning a JPEG | Recommendation shown |
| 13 | Experiment log | Recorded a scan, opened the Experiment tab, checked the summary | Passed |
| 14 | No camera available | Chrome started with no camera device | App showed "No camera was found" with the upload fallback |
| 15 | Model file missing | Model request forced to return 404 | App showed "A model file is missing from this site" with a Try again button |
| 16 | Mobile layout | 390 x 844 viewport with touch; checked for horizontal overflow and reviewed screenshots | No overflow; result visible without scrolling past the picture |
| 17 | Teach it: tag an item, then rescan an altered photo of it | Headless Chrome, 390 x 844: tagged a server photo as "Old router box" (general waste), rescanned a cropped, mirrored, darker copy | Matched the tagged item (86% similarity); unrelated bottle and can were not affected; item survived a page reload |
| 18 | Teach it: add a second photo, My items page, layout | Same session | Second photo saved; My items listed 1 item, 2 photos; no horizontal overflow |
| 19 | Type safety and build | `tsc --noEmit` and `vite build` | Passed |

## Not tested (needs a physical device or a deployment)

| Item | Why it matters | How to test |
|---|---|---|
| Real phone cameras (iPhone Safari, Android Chrome) | Camera permission prompts, rear-camera selection, focus and exposure differ by device | Deploy `dist/`, open on each phone, scan five items |
| Camera permission denied by the user | The message for a refused permission is implemented but only the "no camera" branch was exercised | Refuse the prompt on a phone and check the message |
| Speech output | Headless Chrome has no audio; iOS has its own rules for speech | Scan an item on each phone with the volume up |
| Phone inference speed and memory | Measured only on a laptop-class CPU | Read the time under "Show model details" on each phone |
| Accuracy with physical items under real lighting, angle, distance and background | The measured test set is web photos | Run Part B in `EXPERIMENT.md` |
| HTTPS hosting on Cloudflare Pages, Netlify or Vercel | Only a local HTTP server was used | Deploy and load the site once |
| A real network camera or go2rtc bridge | Only a stub was used | Enter the snapshot address in Settings |
| Xiaomi C200 | No device available; no verified local stream | See README, "Cameras" |
| Firefox and Safari on desktop | Only Chrome was run | Open the deployed site in each |
| Offline use after first load | No service worker is included; it relies on the browser cache | Load once, go offline, reload |

| Teach it with real phone photos of physical items | Measured only on digitally altered pictures | Tag 10 items with 2-3 photos each, rescan each from a new angle, record in the Experiment tab |

## Known issues

- First load downloads about 40 MB.
- Analysis runs on the main thread, so the page pauses for a fraction of a second while it works.
- HEIC photos cannot be decoded by most browsers; the app explains this.
- The evaluator decodes pictures with libvips and the browser with its own decoder. Tiny
  pixel differences are possible; four out of four spot checks matched.
