/**
 * Decision thresholds. These were chosen on the calibration half of the
 * independent test sample and then measured once on the held-out half
 * (see docs/RESULTS.md). Changing them changes the measured behaviour:
 * re-run `npm run evaluate` afterwards.
 */
export interface DecisionSettings {
  /** Minimum probability of the winning bin, averaged over all views. */
  minBinProbability: number;
  /** Every view (whole picture, mirrored, two centre crops) must pick the same bin. */
  requireViewAgreement: boolean;
  /** Block when the object model's probability mass on out-of-scope objects reaches this. */
  unsupportedObjectVeto: number;
  /** Block when a recognised object (at least this confident) contradicts the predicted material. */
  objectConflictVeto: number;
  /** Show the object name only when the object model is at least this confident. */
  objectNameMin: number;
}

export const STRICT: DecisionSettings = {
  minBinProbability: 0.95,
  requireViewAgreement: true,
  unsupportedObjectVeto: 0.5,
  objectConflictVeto: 0.5,
  objectNameMin: 0.35,
};

export const BALANCED: DecisionSettings = { ...STRICT, minBinProbability: 0.8 };

export const MODES = { strict: STRICT, balanced: BALANCED } as const;
/** Default for new users. Balanced answered 64.8% of held-out items, correct 92.3% of the time (docs/RESULTS.md). */
export const DEFAULT_MODE = "balanced" as const;
export type ModeName = keyof typeof MODES;

/** Capture-quality guidance (mean brightness 0-255 of the analysed picture). */
export const TOO_DARK = 45;
export const TOO_BRIGHT = 235;
