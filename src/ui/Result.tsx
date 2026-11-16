import { useState } from "react";
import { BINS, CLEAN_QUESTION, INSTRUCTION, MATERIAL_NAME, type BinId } from "../core/bins";
import { TOO_BRIGHT, TOO_DARK } from "../core/config";
import type { Analysis } from "../core/pipeline";
import { BinIcon } from "./icons";

const pct = (v: number) => (v >= 0.995 ? "over 99%" : `${Math.round(v * 100)}%`);

export function spokenSummary(a: Analysis): string {
  const d = a.decision;
  if (d.status === "uncertain") return "Uncertain. Please check manually.";
  return `${MATERIAL_NAME[d.material]}. Put it in ${BINS[d.bin!].spoken}.`;
}

interface Props {
  analysis: Analysis;
  onRescan: () => void;
  onRecord: () => void;
  clean: "yes" | "no" | null;
  onClean: (v: "yes" | "no") => void;
}

export function Result({ analysis, onRescan, onRecord, clean, onClean }: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const d = analysis.decision;
  const recommended = d.status === "recommend";
  const dirty = recommended && d.bin !== "general" && clean === "no";
  const shownBin: BinId | null = recommended ? (dirty ? "general" : d.bin!) : null;
  const tips: string[] = [];
  if (analysis.brightness < TOO_DARK) tips.push("The picture is dark. Move to brighter light.");
  if (analysis.brightness > TOO_BRIGHT) tips.push("The picture is very bright. Avoid glare and direct light.");
  if (d.reason === "views-disagree" || d.reason === "low-confidence") tips.push("Show one item only, close up, on a plain background.");

  return (
    <section className="result" aria-live="polite">
      {shownBin ? (
        <div className="slab" style={{ background: BINS[shownBin].color, color: BINS[shownBin].ink }}>
          <BinIcon bin={shownBin} size={56} />
          <div>
            <p className="slab-lead">{dirty ? "Because it is not clean, put it in" : "Put it in"}</p>
            <p className="slab-bin">{BINS[shownBin].name}</p>
          </div>
        </div>
      ) : (
        <div className="slab slab-uncertain">
          <BinIcon bin="uncertain" size={56} />
          <div>
            <p className="slab-bin">Uncertain</p>
            <p className="slab-lead">Please check manually</p>
          </div>
        </div>
      )}

      <dl className="facts">
        <div>
          <dt>Object</dt>
          <dd>{d.object ? d.object.name : "Not named with confidence"}</dd>
        </div>
        <div>
          <dt>Material</dt>
          <dd>{recommended ? MATERIAL_NAME[d.material] : `Possibly ${MATERIAL_NAME[d.material].toLowerCase()}`}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>
            {pct(d.binProbability)}
            <span className="meter" aria-hidden="true">
              <span style={{ width: `${Math.round(d.binProbability * 100)}%` }} />
            </span>
          </dd>
        </div>
      </dl>

      {recommended ? (
        <>
          <p className="instruction">{dirty ? "Food and liquid spoil a whole batch of recycling. Rinse it if you can, then scan it again." : INSTRUCTION[d.material]}</p>
          {d.object?.note && <p className="note">{d.object.note}</p>}
          {d.bin !== "general" && clean === null && (
            <div className="clean">
              <p>{CLEAN_QUESTION[d.bin as Exclude<BinId, "general">]}</p>
              <div className="row">
                <button className="btn btn-quiet" onClick={() => onClean("yes")}>Yes, it is clean</button>
                <button className="btn btn-quiet" onClick={() => onClean("no")}>No, it is dirty</button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="instruction">{d.detail}</p>
          {tips.map((t) => (
            <p className="note" key={t}>{t}</p>
          ))}
        </>
      )}

      <div className="row actions">
        <button className="btn btn-primary" onClick={onRescan}>Scan another item</button>
        <button className="btn btn-quiet" onClick={onRecord}>Record for experiment</button>
      </div>

      <button className="link" aria-expanded={showDetails} onClick={() => setShowDetails((v) => !v)}>
        {showDetails ? "Hide model details" : "Show model details"}
      </button>
      {showDetails && (
        <div className="details">
          <p>Material model, top three (averaged over {d.viewCount} views of the picture):</p>
          <ol>
            {d.ranking.slice(0, 3).map((r) => (
              <li key={r.label}>
                {MATERIAL_NAME[r.label]} <b>{(r.probability * 100).toFixed(1)}%</b>
              </li>
            ))}
          </ol>
          <p>
            {d.viewsAgreeing} of {d.viewCount} views point to the same bin.
          </p>
          <p>Object model, top three:</p>
          <ol>
            {d.objectTop.map((o) => (
              <li key={o.label}>
                {o.label} <b>{(o.probability * 100).toFixed(1)}%</b>
              </li>
            ))}
          </ol>
          <p>
            Analysis took {Math.round(analysis.inferenceMs)} ms on this device. Picture brightness {Math.round(analysis.brightness)} of 255.
          </p>
          <p className="fine">
            Confidence is the model's own probability for the bin. It has not been calibrated, so 95% does not mean 95 correct answers in 100.
          </p>
        </div>
      )}
    </section>
  );
}
