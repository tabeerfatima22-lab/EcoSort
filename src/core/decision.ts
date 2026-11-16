import { BIN_ORDER, CLASS_TO_BIN, type BinId } from "./bins";
import type { DecisionSettings } from "./config";
import { EXPECTED_WASTE_CLASSES, type WasteClass } from "./models";
import { IMAGENET_LABELS, KNOWN_OBJECTS, UNSUPPORTED_OBJECTS } from "./objects";

export type UncertainReason =
  | "low-confidence"
  | "views-disagree"
  | "unsupported-object"
  | "object-conflict";

export interface ClassScore {
  label: WasteClass;
  probability: number;
}

export interface Decision {
  /** "recommend" only when every safety check passed, or when the picture matches an item the user tagged. */
  status: "recommend" | "uncertain";
  /** Who decided the bin: the pretrained models, or the user's own tagged item. */
  source: "model" | "taught";
  taught?: { id: string; name: string; similarity: number; note?: string };
  reason?: UncertainReason;
  /** Human-readable explanation of an uncertain result. */
  detail?: string;
  bin?: BinId;
  material: WasteClass;
  /** Probability of the winning bin averaged over views. This is the number shown as "confidence". */
  binProbability: number;
  binProbabilities: Record<BinId, number>;
  /** Material classes, best first (the top three are shown for debugging). */
  ranking: ClassScore[];
  /** How many of the views picked the winning bin. */
  viewsAgreeing: number;
  viewCount: number;
  object?: { name: string; label: string; probability: number; note?: string };
  objectTop: { label: string; probability: number }[];
  unsupportedMass: number;
}

export function toBinProbabilities(classProbs: ArrayLike<number>): Record<BinId, number> {
  const bins: Record<BinId, number> = { general: 0, plastic: 0, paper: 0, other: 0 };
  EXPECTED_WASTE_CLASSES.forEach((label, i) => (bins[CLASS_TO_BIN[label]] += classProbs[i]));
  return bins;
}

export function topBin(bins: Record<BinId, number>): BinId {
  return BIN_ORDER.reduce((best, id) => (bins[id] > bins[best] ? id : best), BIN_ORDER[0]);
}

/**
 * Turns raw model outputs into a recommendation or an explicit "uncertain".
 * Pure function: the same inputs always give the same answer.
 *
 * @param wasteViews  one probability vector (6 classes) per view of the picture
 * @param objectProbs 1000 ImageNet probabilities from the object model
 */
export function decide(wasteViews: ArrayLike<number>[], objectProbs: ArrayLike<number>, settings: DecisionSettings): Decision {
  const mean = new Float64Array(6);
  for (const view of wasteViews) for (let i = 0; i < 6; i++) mean[i] += view[i] / wasteViews.length;

  const binProbabilities = toBinProbabilities(mean);
  const bin = topBin(binProbabilities);
  const binProbability = binProbabilities[bin];
  const ranking = EXPECTED_WASTE_CLASSES.map((label, i) => ({ label, probability: mean[i] })).sort((a, b) => b.probability - a.probability);
  // Material = the most likely class inside the winning bin.
  const material = ranking.find((r) => CLASS_TO_BIN[r.label] === bin)!.label;
  const viewsAgreeing = wasteViews.filter((v) => topBin(toBinProbabilities(v)) === bin).length;

  const order = Array.from({ length: objectProbs.length }, (_, i) => i).sort((a, b) => objectProbs[b] - objectProbs[a]);
  const objectTop = order.slice(0, 3).map((i) => ({ label: IMAGENET_LABELS[i], probability: objectProbs[i] }));
  let unsupportedMass = 0;
  const groupMass = new Map<string, number>();
  for (const [index, group] of UNSUPPORTED_OBJECTS) {
    unsupportedMass += objectProbs[index];
    groupMass.set(group, (groupMass.get(group) ?? 0) + objectProbs[index]);
  }
  const best = order[0];
  const known = KNOWN_OBJECTS.get(best);
  const object =
    known && objectProbs[best] >= settings.objectNameMin
      ? { name: known.name, label: IMAGENET_LABELS[best], probability: objectProbs[best], note: known.note }
      : undefined;

  const base = { source: "model" as const, bin, material, binProbability, binProbabilities, ranking, viewsAgreeing, viewCount: wasteViews.length, object, objectTop, unsupportedMass };

  if (unsupportedMass >= settings.unsupportedObjectVeto) {
    const group = [...groupMass.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return { ...base, status: "uncertain", reason: "unsupported-object", detail: `This looks like ${group}, which these four bins are not meant for.` };
  }
  if (known && objectProbs[best] >= settings.objectConflictVeto && !known.materials.includes(material)) {
    return {
      ...base,
      status: "uncertain",
      reason: "object-conflict",
      detail: known.note ?? `It looks like a ${known.name.toLowerCase()}, but the material check disagrees.`,
    };
  }
  if (binProbability < settings.minBinProbability) {
    return { ...base, status: "uncertain", reason: "low-confidence", detail: "The model is not confident enough about the material." };
  }
  if (settings.requireViewAgreement && viewsAgreeing < wasteViews.length) {
    return { ...base, status: "uncertain", reason: "views-disagree", detail: "Different parts of the picture point to different bins. Show one item on a plain background." };
  }
  return { ...base, status: "recommend" };
}
