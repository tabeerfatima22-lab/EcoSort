# Teach it: tagging your own items

## What it does

After any scan, press **Tell EcoSort what this is**, type a name and pick the bin. Next time
a scan looks like that item, EcoSort uses your bin instead of the models' guess. You can
add more photos to the same item ("Another photo of a saved item"), and manage, export and
import your items on the **My items** tab.

No model is retrained. The object model (MobileNetV2, ImageNet) already turns every picture
into 1,280 numbers that describe what it looks like. EcoSort stores those numbers for each
tagged photo and compares new scans with them using cosine similarity:

- similarity of at least **0.82** to a tagged photo: your item's bin is used;
- if two tagged items with **different bins** are within 0.02 of each other: not trusted;
- otherwise the normal model decision applies.

The model files were changed only to expose those numbers as an extra output
(`scripts/add-feature-outputs.py`); weights and existing outputs are unchanged.

## How well it works (measured)

### Same item, photographed again

198 TrashBox pictures (8 per sub-folder, fixed seed) were each tagged once. Each was then
scanned again in three altered versions (reframed, 40% darker, mirrored and rotated 12
degrees), giving 594 queries against all 198 tagged items. For the "never tagged" test, the
picture's own tag was removed so any match is false.

| Threshold | Same item found | Matched a different item | Never-tagged item falsely matched |
|---:|---:|---:|---:|
| 0.75 | 99.0% | 0.2% | 17.3% |
| 0.80 | 97.3% | 0.0% | 2.7% |
| **0.82 (used)** | **96.1%** | **0.0%** | **1.3%** |
| 0.85 | 93.4% | 0.0% | 0.2% |
| 0.90 | 77.1% | 0.0% | 0.0% |

The alterations are digital, so this is an optimistic proxy for re-photographing a real item
with a phone. Measure the real effect with the Experiment tab.

### Different items of the same type

Tagging 5 pictures of a type (for example 5 different plastic bottles) and then scanning
*other* items of that type found the right type only 1-3% of the time at thresholds 0.80-0.85
(`docs/teach/teachsim.py`). **Teaching works for the same or very similar items, not whole
categories.** Tag the specific items you throw away often.

## Files

- `src/core/memory.ts` - matching rule and thresholds
- `src/app/memoryStore.ts` - storage in this browser, export and import
- `docs/teach/` - measurement scripts, the 198-picture list and `results.json`

## Saving items to GitHub (shared list)

By default, tagged items are kept in the browser that tagged them. To keep them on
GitHub and share them between phones, **one person sets it up once**; everyone else
just opens a link.

**First time (owner of the GitHub repository, about 2 minutes):**

1. In the app open **My items > Setting it up for the first time > Open GitHub key page**.
   GitHub opens with the key's name, one-year expiry and permission (Contents: read and
   write) already filled in.
2. The one thing GitHub cannot pre-fill: under **Repository access** pick
   **Only select repositories** > `EcoSort`.
3. Press **Generate token**, copy the key, paste it into the app and press **Connect**.
   The app checks the key before accepting it.

**Every other phone (no GitHub account needed):** on the connected phone press
**Send link** (WhatsApp, text, email) or **Show QR code**. The other person opens the
link or scans the code with their camera, and that phone is connected. The key is in
the part of the link after `#`, which browsers do not send to the website, and it is
removed from the address bar as soon as the app opens. Treat the link like a password:
anyone with it can add and remove items in the list. To cut everyone off, delete the
"EcoSort app" key on GitHub (Settings > Developer settings > Fine-grained tokens).

What happens then:

- Items already on the phone are added to `data/my-items.json` in the repository.
- Every save, added photo, removal or import is applied to the latest copy of that file
  on GitHub and committed (commit messages start with `EcoSort:`). If two phones save at
  the same moment, the second retries on the newer copy, so neither loses an item.
- When the app opens it loads the file from GitHub, so all connected phones show the same items.
- If GitHub cannot be reached, the change is kept on the phone, the app says it was
  **not** saved to GitHub, and it is sent the next time the app connects (or on **Sync now**).
  A removal made while offline can come back in that case; remove it again once online.
- Commits to `data/` do not rebuild the website (`paths-ignore` in `deploy.yml`).

Privacy: the repository is public, so item names and their 160-pixel photos in
`data/my-items.json` are visible to anyone. The token is stored in that browser only
and sent only to api.github.com. Do not connect a phone other people use.
