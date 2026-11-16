import { useState } from "react";
import { BINS, BIN_ORDER, type BinId } from "../core/bins";
import type { TaughtItem } from "../core/memory";
import { BinIcon } from "./icons";

interface Props {
  thumb: string;
  items: TaughtItem[];
  suggestedBin?: BinId;
  onSave: (target: { itemId: string } | { name: string; bin: BinId; note?: string }) => void;
  onCancel: () => void;
}

/** "Tell EcoSort what this is": tag the picture just scanned. */
export function TeachSheet({ thumb, items, suggestedBin, onSave, onCancel }: Props) {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [name, setName] = useState("");
  const [bin, setBin] = useState<BinId | null>(suggestedBin ?? null);
  const [note, setNote] = useState("");
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const ready = mode === "existing" ? !!itemId : name.trim().length > 0 && bin !== null;

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="teach-title">
      <div className="sheet-body">
        <div className="teach-head">
          <img src={thumb} alt="The picture you are tagging" />
          <div>
            <h2 id="teach-title">Tell EcoSort what this is</h2>
            <p className="fine">Next time it sees this item it will use your answer. Tag 2 or 3 photos of the same item from different sides for the best results.</p>
          </div>
        </div>

        {items.length > 0 && (
          <div className="seg" role="radiogroup" aria-label="New or existing item">
            <button role="radio" aria-checked={mode === "new"} className={mode === "new" ? "on" : ""} onClick={() => setMode("new")}>New item</button>
            <button role="radio" aria-checked={mode === "existing"} className={mode === "existing" ? "on" : ""} onClick={() => setMode("existing")}>Another photo of a saved item</button>
          </div>
        )}

        {mode === "existing" ? (
          <label className="field">
            <span>Which item is it?</span>
            <select value={itemId} onChange={(e) => setItemId(e.target.value)}>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({BINS[i.bin].short}, {i.examples.length} photo{i.examples.length === 1 ? "" : "s"})
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label className="field">
              <span>What is it?</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="For example: Al Ain water bottle 500 ml" autoFocus />
            </label>
            <fieldset className="truth">
              <legend>Which bin does it go in?</legend>
              {BIN_ORDER.map((b) => (
                <label key={b}>
                  <input type="radio" name="teach-bin" checked={bin === b} onChange={() => setBin(b)} />
                  <span className="dot" style={{ background: BINS[b].color }} />
                  <BinIcon bin={b} size={20} />
                  {BINS[b].name}
                </label>
              ))}
            </fieldset>
            <label className="field">
              <span>Instruction to show (optional)</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="For example: remove the cap first" />
            </label>
          </>
        )}

        <div className="row actions">
          <button
            className="btn btn-primary"
            disabled={!ready}
            onClick={() => (mode === "existing" ? onSave({ itemId }) : onSave({ name: name.trim(), bin: bin!, note: note.trim() || undefined }))}
          >
            Save
          </button>
          <button className="btn btn-quiet" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export function MyItems({ items, onRemoveItem, onRemovePhoto, onExport, onImport, message }: {
  items: TaughtItem[];
  onRemoveItem: (id: string) => void;
  onRemovePhoto: (itemId: string, photoId: string) => void;
  onExport: () => void;
  onImport: (f: File) => void;
  message: string | null;
}) {
  const photos = items.reduce((n, i) => n + i.examples.length, 0);
  return (
    <section className="page">
      <h1>My items</h1>
      <p>
        Items you have tagged. When a scan looks like one of these, EcoSort uses your bin instead of guessing. To add one, scan the item and press
        <b> Tell EcoSort what this is</b>. Tagging 2 or 3 photos of the same item from different sides works best.
      </p>
      <p className="fine">
        Matching recognises the same or a very similar item. Tagging one brand of can will not teach it every can. Your items are stored in this browser only; export them to move them to another phone.
      </p>
      <div className="row actions">
        <button className="btn btn-quiet" disabled={!items.length} onClick={onExport}>Export my items</button>
        <label className="btn btn-quiet file-btn">
          Import items
          <input type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ""; }} />
        </label>
      </div>
      {message && <p className="toast" role="status">{message}</p>}
      {items.length === 0 ? (
        <p className="empty">No items yet. Scan something, then press Tell EcoSort what this is.</p>
      ) : (
        <>
          <p className="fine">{items.length} item{items.length === 1 ? "" : "s"}, {photos} photo{photos === 1 ? "" : "s"}.</p>
          <ul className="items">
            {items.map((i) => (
              <li key={i.id}>
                <div className="item-head">
                  <span className="item-bin" style={{ background: BINS[i.bin].color, color: BINS[i.bin].ink }}><BinIcon bin={i.bin} size={20} /></span>
                  <div>
                    <p className="item-name">{i.name}</p>
                    <p className="fine">{BINS[i.bin].name}{i.note ? `. ${i.note}` : ""}</p>
                  </div>
                  <button className="link" onClick={() => window.confirm(`Remove "${i.name}" and its photos?`) && onRemoveItem(i.id)}>Remove</button>
                </div>
                <div className="thumbs">
                  {i.examples.map((e) => (
                    <figure key={e.id}>
                      <img src={e.thumb} alt={`Photo of ${i.name}`} />
                      <button className="thumb-x" aria-label={`Remove this photo of ${i.name}`} onClick={() => onRemovePhoto(i.id, e.id)}>×</button>
                    </figure>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
