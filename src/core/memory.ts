/**
 * "Teach it": items the user has photographed and tagged with a bin.
 * A new scan is compared with every tagged photo using the object model's
 * 1280 pooled features (cosine similarity). No model weights change.
 *
 * Threshold measured in docs/TEACH.md: at 0.82 a re-photographed item was
 * matched to itself 96.1% of the time and never to another item, while a
 * never-tagged item was falsely matched 1.3% of the time.
 */
import type { BinId } from "./bins";

export const MATCH_MIN = 0.82;
/** If two items with different bins are this close, do not trust either. */
export const AMBIGUITY = 0.02;

export interface TaughtExample {
  id: string;
  /** Unit-length features, stored compactly. */
  features: number[];
  thumb: string;
  addedAt: string;
}

export interface TaughtItem {
  id: string;
  name: string;
  bin: BinId;
  note?: string;
  examples: TaughtExample[];
}

export interface Match {
  item: TaughtItem;
  similarity: number;
}

export function normalise(v: ArrayLike<number>): number[] {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  const n = Math.sqrt(s) || 1;
  return Array.from(v, (x) => Math.round((x / n) * 1e5) / 1e5);
}

function dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** Best match per item, best first. */
export function rankItems(features: ArrayLike<number>, items: TaughtItem[]): Match[] {
  const q = normalise(features);
  return items
    .map((item) => ({ item, similarity: Math.max(-1, ...item.examples.map((e) => dot(q, e.features))) }))
    .filter((m) => m.item.examples.length > 0)
    .sort((a, b) => b.similarity - a.similarity);
}

/** A trustworthy match, or null. */
export function findMatch(features: ArrayLike<number>, items: TaughtItem[]): { match: Match | null; nearest: Match | null } {
  const ranked = rankItems(features, items);
  const best = ranked[0] ?? null;
  if (!best || best.similarity < MATCH_MIN) return { match: null, nearest: best };
  const rival = ranked.find((m) => m.item.bin !== best.item.bin);
  if (rival && best.similarity - rival.similarity < AMBIGUITY) return { match: null, nearest: best };
  return { match: best, nearest: best };
}
