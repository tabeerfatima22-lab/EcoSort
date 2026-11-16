# EcoSort AI

EcoSort AI looks at a waste item through a phone or laptop camera and tells you which of
four bins it belongs in: general waste, plastic recycling, paper recycling, or other
recyclables (cans and glass). When it is not sure, it says **Uncertain - please check
manually** instead of guessing.

It runs two pretrained neural networks inside the browser. There is nothing to train,
no server, and no picture leaves the device.

- Measured results: [docs/RESULTS.md](docs/RESULTS.md)
- Science project report: [docs/SCIENCE_REPORT.md](docs/SCIENCE_REPORT.md)
- Experiment procedure and recording tables: [docs/EXPERIMENT.md](docs/EXPERIMENT.md)
- Why this model, and what else was considered: [docs/MODEL_SELECTION.md](docs/MODEL_SELECTION.md)
- What was tested, and what was not: [docs/QA_REPORT.md](docs/QA_REPORT.md)

## Read this first: how reliable is it?

No camera model sorts waste perfectly, and this one is no exception. On 700 held-out
independent pictures the material model alone put 86.1% of items in the right bin when forced
to answer. EcoSort therefore only recommends a bin when several checks agree, and otherwise
answers Uncertain. In Strict mode it gave a bin for 49.6% of items and was right for 96.8% of
those; 1.6% of all items were sent to a wrong bin. Full figures are in
[docs/RESULTS.md](docs/RESULTS.md); the app's About page shows the same numbers.

In practice this means:

- A recommendation is usually right, but not always. Treat it as advice.
- Expect "Uncertain" often, especially for unusual items, clutter or poor light.
- The camera cannot see food residue. The app asks whether the item is clean.
- Recycling rules differ from place to place. Edit the bin names and instructions in
  `src/core/bins.ts` to match your site.

## Use it without installing anything (fastest)

The `dist/` folder is the finished website. Cameras only work on `https://` addresses, so
put `dist/` on any static host:

1. **Netlify Drop:** open <https://app.netlify.com/drop> and drag the `dist` folder onto the page.
2. **Cloudflare Pages:** Workers & Pages -> Create -> Pages -> Upload assets -> upload `dist`.
3. **Vercel:** `npx vercel dist` (or import the repository; see below).

Open the address the host gives you on your phone, allow the camera, and press **Scan item**.
The first visit downloads about 40 MB of model files, so use Wi-Fi. Largest single file is
about 15 MB, which is inside the 25 MB per-file limit on Cloudflare Pages.

## Live site (GitHub Pages)

Every push to `main` builds the app and publishes it to
<https://tabeerfatima22-lab.github.io/EcoSort/> through
`.github/workflows/deploy.yml`. To turn this on in a new copy of the repository:
Settings -> Pages -> Source: **GitHub Actions**.

## Run it on your computer

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. The laptop webcam works on `localhost` without https.
To test on a phone during development you need https: deploy `dist/`, or use a tunnel
such as `npx cloudflared tunnel --url http://localhost:5173`.

Tip: keep the project outside a synced folder (OneDrive, iCloud, Dropbox) before running
`npm install`, or exclude `node_modules` from sync. It contains thousands of small files.

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Type-check and build the site into `dist/` |
| `npm run preview` | Serve the built site locally |
| `npm run evaluate -- --images <folder> --name <run>` | Measure accuracy on a folder of labelled pictures |
| `npm run report` | Rebuild `docs/RESULTS.md` from `docs/results/` |

## Deploy from a Git repository

| Host | Build command | Output folder |
|---|---|---|
| Cloudflare Pages | `npm run build` | `dist` |
| Netlify | `npm run build` | `dist` |
| Vercel | `npm run build` (framework: Vite) | `dist` |

No environment variables and no backend are needed. The model files in `public/models/`
are part of the site.

## How it works

```text
camera frame or photo
        |
        v
 four views of the picture  ----->  material model (MobileNetV2, 6 classes)
 (whole, mirrored, 2 crops)                 |
        |                                   v
        |                        average -> bin probabilities
        v                                   |
 object model (MobileNetV2,                 v
 ImageNet, 1000 objects)  -------->  decision rules
                                     - bin probability >= 95% (strict)
                                     - all four views agree
                                     - object is not electronics, medical, food, clothing
                                     - object does not contradict the material
                                            |
                         +------------------+------------------+
                         v                                     v
                 recommend a bin                    Uncertain - check manually
                 then ask: is it clean?
```

- `src/core/` - preprocessing, model wrappers, bin mapping and decision rules. No browser
  code, so the Node evaluation script runs exactly what the app runs.
- `src/app/` - camera, model loading, speech, experiment log.
- `src/ui/` - screens.
- `scripts/evaluate.ts` - measurement tool.
- `public/models/` - the two pretrained models.

### Settings in the app

- **Strict / Balanced:** Strict needs 95% and gives fewer wrong answers; Balanced needs 80%.
- **Scan automatically:** a light check runs about twice a second; when three checks in a
  row agree, the full analysis runs on a fresh frame.
- **Speak the result:** uses the browser's built-in voice.
- **Network camera snapshot address:** see below.

## Cameras

**Phone and laptop cameras** are the supported input. The rear camera is requested with
`getUserMedia`. If permission is refused or no camera exists, the app explains what to do
and photo upload still works.

**Network (IP) cameras.** Browsers cannot open RTSP streams. EcoSort can instead fetch a
still picture from an `https` snapshot address (Settings). That works when the camera, or a
bridge such as [go2rtc](https://github.com/AlexxIT/go2rtc) (`/api/frame.jpeg?src=<name>`),
serves a JPEG with CORS enabled. This path was built but **not tested against a real
camera**.

**Xiaomi Smart Camera C200.** I could not verify any official local stream (RTSP or ONVIF)
for this model; Xiaomi's own FAQ says the related C300 supports neither, and third-party
guides say C200 support depends on firmware and region. Do not plan on connecting it
directly. Realistic options:

1. Use a spare phone on a stand, running EcoSort in its browser. This is the reliable setup.
2. Use a camera that documents RTSP or ONVIF, with go2rtc as the bridge.
3. If your C200's Mi Home app does offer a local stream option, point go2rtc at it.

## Models and licences

| Part | Source | Licence |
|---|---|---|
| Material model `smart_waste_mobilenetv2.onnx` v1.3.1 | [anniesrdnl/Smart-Waste-Classifier](https://github.com/anniesrdnl/Smart-Waste-Classifier), commit `54fe1ea` | **No licence file in the repository** |
| Object model `mobilenetv2-12.onnx` | [ONNX Model Zoo](https://github.com/onnx/models) | Apache-2.0 |
| ONNX Runtime Web | Microsoft | MIT |
| Bricolage Grotesque font | via Fontsource | SIL OFL 1.1 |

**Licence note.** The material model's repository does not state a licence. Using it for a
school or personal project with credit is common practice, but before you publish EcoSort
publicly or use it commercially, ask the author for permission or swap in a model with a
clear licence. Swapping is a file change: put the new ONNX file and a matching
`metadata.json` in `public/models/waste/` (same six class names), then re-run the
evaluation.

`bash scripts/fetch-models.sh` re-downloads both models from their sources and checks them
against `docs/experiment/model_checksums.txt`.

## Reproduce the measurements

```bash
npm install
bash scripts/fetch-testset.sh      # downloads the 1,400 test pictures (about 235 MB)
bash scripts/run-evaluation.sh     # about 30 minutes; rewrites docs/RESULTS.md
```

To test your own photos, sort them into folders named `cardboard`, `glass`, `metal`,
`paper`, `plastic`, `trash` (anything else counts as "should be Uncertain") and run:

```bash
npm run evaluate -- --images path/to/photos --name my_photos
```

## Troubleshooting

| Problem | Fix |
|---|---|
| "The camera needs a secure address" | Open the site over `https://` (or `localhost`). |
| "Camera permission was not given" | Allow the camera in the browser's site settings, then press Turn on camera. |
| Camera works in Safari but not inside another app | In-app browsers often block cameras. Open the link in Safari or Chrome. |
| "A model file is missing from this site" | Upload the whole `dist` folder, including `models/` and `ort/`. |
| Nothing is spoken on iPhone | Check the ring/silent switch and volume; speech starts after the first tap. |
| HEIC photo cannot be read | Use the live camera, or set the phone camera to "Most Compatible" (JPEG). |
