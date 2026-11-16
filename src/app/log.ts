/** Experiment log kept in this browser only (localStorage). */
import type { BinId } from "../core/bins";

export interface LogEntry {
  id: string;
  time: string;
  item: string;
  truth: BinId | "not-for-these-bins";
  answer: BinId | "uncertain";
  material: string;
  confidence: number;
  reason: string;
  lighting: string;
  angle: string;
  distance: string;
  background: string;
  source: string;
  mode: string;
  inferenceMs: number;
  modelVersion: string;
}

const KEY = "ecosort.experiment.v1";

export function readLog(): LogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as LogEntry[];
  } catch {
    return [];
  }
}

export function writeLog(entries: LogEntry[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

export function toCsv(entries: LogEntry[]): string {
  const cols: (keyof LogEntry)[] = ["time", "item", "truth", "answer", "material", "confidence", "reason", "lighting", "angle", "distance", "background", "source", "mode", "inferenceMs", "modelVersion"];
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...entries.map((e) => cols.map((c) => cell(c === "confidence" ? e.confidence.toFixed(4) : e[c])).join(","))].join("\n") + "\n";
}

export interface LogSummary {
  n: number;
  scored: number;
  answered: number;
  correct: number;
  wrong: number;
  uncertain: number;
  outOfScope: number;
  outOfScopeHeldBack: number;
  meanMs: number | null;
}

export function summarise(entries: LogEntry[]): LogSummary {
  const scoredEntries = entries.filter((e) => e.truth !== "not-for-these-bins");
  const out = entries.filter((e) => e.truth === "not-for-these-bins");
  const answered = scoredEntries.filter((e) => e.answer !== "uncertain");
  const correct = answered.filter((e) => e.answer === e.truth).length;
  return {
    n: entries.length,
    scored: scoredEntries.length,
    answered: answered.length,
    correct,
    wrong: answered.length - correct,
    uncertain: scoredEntries.length - answered.length,
    outOfScope: out.length,
    outOfScopeHeldBack: out.filter((e) => e.answer === "uncertain").length,
    meanMs: entries.length ? entries.reduce((a, e) => a + e.inferenceMs, 0) / entries.length : null,
  };
}
