import type { WasteClass } from "./models";

export type BinId = "general" | "plastic" | "paper" | "other";

export interface BinInfo {
  id: BinId;
  name: string;
  short: string;
  color: string;
  ink: string;
  spoken: string;
}

/** Bin names and colours. Edit these to match the bins used at your site. */
export const BINS: Record<BinId, BinInfo> = {
  general: { id: "general", name: "General waste", short: "General", color: "#3d444b", ink: "#ffffff", spoken: "general waste" },
  plastic: { id: "plastic", name: "Plastic recycling", short: "Plastic", color: "#f0a800", ink: "#1b1400", spoken: "plastic recycling" },
  paper: { id: "paper", name: "Paper recycling", short: "Paper", color: "#1d63c7", ink: "#ffffff", spoken: "paper recycling" },
  other: { id: "other", name: "Other recyclables", short: "Cans and glass", color: "#16855a", ink: "#ffffff", spoken: "other recyclables" },
};

export const BIN_ORDER: BinId[] = ["general", "plastic", "paper", "other"];

/** The material class the waste model predicts -> the bin it belongs in when clean. */
export const CLASS_TO_BIN: Record<WasteClass, BinId> = {
  cardboard: "paper",
  paper: "paper",
  plastic: "plastic",
  glass: "other",
  metal: "other",
  trash: "general",
};

export const MATERIAL_NAME: Record<WasteClass, string> = {
  cardboard: "Cardboard",
  paper: "Paper",
  plastic: "Plastic",
  glass: "Glass",
  metal: "Metal",
  trash: "Mixed or non-recyclable material",
};

/** Shown with a recommendation. Kept general on purpose: local rules differ. */
export const INSTRUCTION: Record<WasteClass, string> = {
  cardboard: "Flatten it. Keep it dry and free of food.",
  paper: "Keep it clean and dry. No tissues or greasy paper.",
  plastic: "Empty it and give it a quick rinse. Check that your site accepts this type of plastic.",
  glass: "Empty and rinse it. Broken glass, mirrors and drinking glasses do not belong here.",
  metal: "Empty and rinse it. Aerosol cans must be completely empty.",
  trash: "This does not look recyclable. Put it in general waste.",
};

/** Question asked after a recycling recommendation, because a camera cannot judge contamination reliably. */
export const CLEAN_QUESTION: Record<Exclude<BinId, "general">, string> = {
  plastic: "Is it empty, with no food or liquid left inside?",
  paper: "Is it clean and dry, with no food, grease or wetness?",
  other: "Is it empty, with no food or liquid left inside?",
};
