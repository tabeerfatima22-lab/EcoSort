/**
 * What the general object recogniser (ImageNet-1k classes) is allowed to say.
 * It is used for three things only:
 *   1. naming the object when it is confident,
 *   2. vetoing a recommendation when the object is something the four bins do
 *      not cover (electronics, medical items, food, clothing),
 *   3. vetoing a recommendation when the object's usual material contradicts
 *      the waste model's material prediction.
 * It never chooses a bin by itself.
 */
import labels from "./imagenetLabels.json";
import type { WasteClass } from "./models";

export const IMAGENET_LABELS = labels as string[];

interface Known {
  name: string;
  /** Materials this object is normally made of. */
  materials: WasteClass[];
  note?: string;
}

const KNOWN_BY_LABEL: Record<string, Known> = {
  "water bottle": { name: "Water bottle", materials: ["plastic"] },
  "pop bottle": { name: "Drinks bottle", materials: ["plastic", "glass"] },
  "beer bottle": { name: "Glass bottle", materials: ["glass"] },
  "wine bottle": { name: "Glass bottle", materials: ["glass"] },
  "pill bottle": { name: "Small container", materials: ["plastic", "glass"] },
  lotion: { name: "Lotion or shampoo bottle", materials: ["plastic"] },
  sunscreen: { name: "Tube or bottle", materials: ["plastic"] },
  "soap dispenser": { name: "Soap dispenser", materials: ["plastic", "glass"] },
  "plastic bag": { name: "Plastic bag", materials: ["plastic", "trash"], note: "Many recycling sites do not take plastic bags." },
  carton: { name: "Cardboard box", materials: ["cardboard", "paper"] },
  crate: { name: "Box or crate", materials: ["cardboard", "plastic"] },
  envelope: { name: "Envelope", materials: ["paper", "cardboard"] },
  "comic book": { name: "Magazine or booklet", materials: ["paper"] },
  "book jacket": { name: "Book or printed paper", materials: ["paper", "cardboard"] },
  menu: { name: "Printed paper", materials: ["paper", "cardboard"] },
  "crossword puzzle": { name: "Newspaper", materials: ["paper"] },
  binder: { name: "Folder", materials: ["paper", "cardboard", "plastic"] },
  packet: { name: "Packet or wrapper", materials: ["trash", "plastic", "paper"], note: "Crisp packets and sweet wrappers are usually general waste." },
  "paper towel": { name: "Paper towel or tissue", materials: ["trash"], note: "Used tissues and paper towels go in general waste." },
  "toilet tissue": { name: "Tissue", materials: ["trash"], note: "Used tissues go in general waste." },
  "milk can": { name: "Metal can", materials: ["metal"] },
  "hair spray": { name: "Spray can", materials: ["metal"], note: "Only empty aerosol cans can be recycled." },
  "can opener": { name: "Metal item", materials: ["metal"] },
  bottlecap: { name: "Bottle cap", materials: ["metal", "plastic"] },
  "beer glass": { name: "Glass", materials: ["glass"] },
  goblet: { name: "Glass", materials: ["glass"] },
  beaker: { name: "Glass container", materials: ["glass", "plastic"] },
  "water jug": { name: "Jug", materials: ["plastic", "glass"] },
  "measuring cup": { name: "Cup or container", materials: ["plastic", "glass", "metal"] },
  cup: { name: "Cup", materials: ["paper", "plastic", "trash", "cardboard"] },
};

/** Things the four bins are not meant for. A confident match blocks any recommendation. */
const UNSUPPORTED_GROUPS: Record<string, string[]> = {
  "an electronic or electrical item": [
    "cellular telephone", "laptop", "computer keyboard", "mouse", "remote control", "iPod", "monitor", "screen",
    "television", "desktop computer", "hand-held computer", "hard disc", "modem", "printer", "radio", "cassette",
    "cassette player", "CD player", "loudspeaker", "microphone", "joystick", "projector", "oscilloscope", "toaster",
    "microwave", "iron", "hand blower", "electric fan", "switch", "digital watch", "digital clock", "analog clock",
    "stopwatch", "reflex camera", "Polaroid camera", "vacuum", "notebook", "space bar", "typewriter keyboard",
    "tape player", "power drill", "dial telephone", "pay-phone", "photocopier", "space heater", "wall clock",
    "sewing machine", "washer", "refrigerator", "dishwasher", "espresso maker", "waffle iron", "Crock Pot",
    "home theater", "entertainment center", "spotlight", "table lamp", "solar dish", "web site",
  ],
  "a medical or hygiene item": ["syringe", "Band Aid", "mask", "oxygen mask", "stethoscope", "crutch", "diaper", "gasmask", "neck brace", "knee pad"],
  "a lighter or other hazardous item": ["lighter"],
  "food": ["banana", "orange", "lemon", "pineapple", "pizza", "cheeseburger", "hotdog", "bagel", "pretzel", "ice cream"],
  "clothing or fabric": ["jersey", "sock", "running shoe", "handkerchief", "maillot", "sweatshirt", "cardigan", "mitten", "pajama", "bib", "shower cap", "ski mask"],
};

export const KNOWN_OBJECTS = new Map<number, Known>();
export const UNSUPPORTED_OBJECTS = new Map<number, string>();

for (const [label, known] of Object.entries(KNOWN_BY_LABEL)) {
  const index = IMAGENET_LABELS.indexOf(label);
  if (index === -1) throw new Error(`Object map refers to a label the object model does not have: "${label}"`);
  KNOWN_OBJECTS.set(index, known);
}
for (const [group, names] of Object.entries(UNSUPPORTED_GROUPS)) {
  for (const label of names) {
    const index = IMAGENET_LABELS.indexOf(label);
    if (index === -1) throw new Error(`Unsupported-object list refers to a label the object model does not have: "${label}"`);
    UNSUPPORTED_OBJECTS.set(index, group);
  }
}
