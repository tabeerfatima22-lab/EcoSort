/**
 * The complete analysis of one still picture. The browser app and the Node
 * evaluation script both call analyse(), so docs/RESULTS.md measures the
 * same code path a phone runs.
 */
import type { DecisionSettings } from "./config";
import { decide, type Decision } from "./decision";
import type { ObjectModel, WasteModel } from "./models";
import { centreCrop, centreSquare, flipHorizontal, imageQuality, type CropRect, type RgbaImage } from "./resize";

export interface Analysis {
  decision: Decision;
  inferenceMs: number;
  brightness: number;
  sharpness: number;
}

export interface Models {
  waste: WasteModel;
  object: ObjectModel;
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/**
 * @param region the part of the picture to analyse (the camera's square viewfinder, or the whole upload)
 */
export async function analyse(image: RgbaImage, region: CropRect, models: Models, settings: DecisionSettings): Promise<Analysis> {
  const start = now();
  const inner = (f: number): CropRect => {
    const c = centreCrop(region.width, region.height, f);
    return { x: region.x + c.x, y: region.y + c.y, width: c.width, height: c.height };
  };
  const whole = models.waste.prepare(image, region);
  const views = [whole, flipHorizontal(whole, 224, 224), models.waste.prepare(image, inner(0.8)), models.waste.prepare(image, inner(0.6))];
  const wasteProbs: Float32Array[] = [];
  for (const view of views) wasteProbs.push(await models.waste.predict(view));

  const sq = centreSquare(region.width, region.height, 0.875);
  const objectProbs = await models.object.predict(
    models.object.prepare(image, { x: region.x + sq.x, y: region.y + sq.y, width: sq.width, height: sq.height }),
  );

  const decision = decide(wasteProbs, objectProbs, settings);
  const quality = imageQuality(whole, 224, 224);
  return { decision, inferenceMs: now() - start, ...quality };
}

/** Lightweight single-view pass used only to drive the live preview in continuous mode. */
export async function quickLook(image: RgbaImage, region: CropRect, models: Models): Promise<Float32Array> {
  return models.waste.predict(models.waste.prepare(image, region));
}
