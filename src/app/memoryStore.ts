/** Tagged items, kept in this browser (localStorage), with export/import as a JSON file. */
import { BIN_ORDER } from "../core/bins";
import { normalise, type TaughtItem } from "../core/memory";

const KEY = "ecosort.taught.v1";

export function readTaught(): TaughtItem[] {
  try {
    const items = JSON.parse(localStorage.getItem(KEY) ?? "[]") as TaughtItem[];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export function writeTaught(items: TaughtItem[]): string | null {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
    return null;
  } catch {
    return "This browser has no room left to store more photos. Remove some photos from My items, or export them first.";
  }
}

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function exportTaught(items: TaughtItem[]): void {
  const blob = new Blob([JSON.stringify({ app: "EcoSort AI", version: 1, exported: new Date().toISOString(), items }, null, 1)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ecosort-my-items-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Reads an exported file and merges it into the current list (items with the same id are replaced). */
export async function importTaught(file: File, current: TaughtItem[]): Promise<TaughtItem[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error("That file is not an EcoSort items file.");
  }
  const items = (parsed as { items?: unknown }).items;
  if (!Array.isArray(items)) throw new Error("That file is not an EcoSort items file.");
  const clean: TaughtItem[] = [];
  for (const raw of items as TaughtItem[]) {
    if (!raw || typeof raw.name !== "string" || !BIN_ORDER.includes(raw.bin) || !Array.isArray(raw.examples)) continue;
    const examples = raw.examples.filter((e) => Array.isArray(e.features) && e.features.length === 1280).map((e) => ({ ...e, features: normalise(e.features) }));
    if (examples.length) clean.push({ id: raw.id || newId(), name: raw.name.slice(0, 80), bin: raw.bin, note: raw.note?.slice(0, 200), examples });
  }
  if (!clean.length) throw new Error("No usable items were found in that file.");
  const byId = new Map(current.map((i) => [i.id, i]));
  for (const i of clean) byId.set(i.id, i);
  return [...byId.values()];
}
