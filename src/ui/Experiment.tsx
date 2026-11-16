import { useState } from "react";
import { BINS, BIN_ORDER, MATERIAL_NAME, type BinId } from "../core/bins";
import type { Analysis } from "../core/pipeline";
import { summarise, toCsv, type LogEntry } from "../app/log";

const LIGHTING = ["Bright", "Normal room light", "Dim"];
const ANGLE = ["Front", "45 degrees", "Top down"];
const DISTANCE = ["About 20 cm", "About 40 cm", "About 80 cm"];
const BACKGROUND = ["Plain", "Cluttered"];

export interface Conditions {
  lighting: string;
  angle: string;
  distance: string;
  background: string;
}
export const DEFAULT_CONDITIONS: Conditions = { lighting: LIGHTING[1], angle: ANGLE[0], distance: DISTANCE[1], background: BACKGROUND[0] };

function Choice({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

/** Dialog shown after a scan: the tester says what the item really was. */
export function RecordForm(props: {
  analysis: Analysis;
  conditions: Conditions;
  onConditions: (c: Conditions) => void;
  onSave: (item: string, truth: LogEntry["truth"]) => void;
  onCancel: () => void;
}) {
  const [item, setItem] = useState("");
  const [truth, setTruth] = useState<LogEntry["truth"] | "">("");
  const d = props.analysis.decision;
  const c = props.conditions;
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="record-title">
      <div className="sheet-body">
        <h2 id="record-title">Record this scan</h2>
        <p className="fine">
          EcoSort answered: <b>{d.status === "recommend" ? BINS[d.bin!].name : "Uncertain"}</b> ({MATERIAL_NAME[d.material]}, {(d.binProbability * 100).toFixed(1)}%)
        </p>
        <label className="field">
          <span>What is the item?</span>
          <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="For example: clear water bottle, 500 ml" />
        </label>
        <fieldset className="truth">
          <legend>Which bin is actually correct?</legend>
          {BIN_ORDER.map((b: BinId) => (
            <label key={b}>
              <input type="radio" name="truth" checked={truth === b} onChange={() => setTruth(b)} />
              <span className="dot" style={{ background: BINS[b].color }} />
              {BINS[b].name}
            </label>
          ))}
          <label>
            <input type="radio" name="truth" checked={truth === "not-for-these-bins"} onChange={() => setTruth("not-for-these-bins")} />
            <span className="dot dot-none" />
            None of these bins (electronics, batteries, medical items)
          </label>
        </fieldset>
        <div className="grid2">
          <Choice label="Lighting" value={c.lighting} options={LIGHTING} onChange={(v) => props.onConditions({ ...c, lighting: v })} />
          <Choice label="Camera angle" value={c.angle} options={ANGLE} onChange={(v) => props.onConditions({ ...c, angle: v })} />
          <Choice label="Distance" value={c.distance} options={DISTANCE} onChange={(v) => props.onConditions({ ...c, distance: v })} />
          <Choice label="Background" value={c.background} options={BACKGROUND} onChange={(v) => props.onConditions({ ...c, background: v })} />
        </div>
        <div className="row actions">
          <button className="btn btn-primary" disabled={!truth} onClick={() => truth && props.onSave(item.trim(), truth)}>Save to experiment log</button>
          <button className="btn btn-quiet" onClick={props.onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

const ratio = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : "no data yet");

export function ExperimentView({ entries, onClear, onRemove }: { entries: LogEntry[]; onClear: () => void; onRemove: (id: string) => void }) {
  const s = summarise(entries);
  const download = () => {
    const url = URL.createObjectURL(new Blob([toCsv(entries)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `ecosort-experiment-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const byLight = [...new Set(entries.map((e) => e.lighting))];
  return (
    <section className="page">
      <h1>Experiment log</h1>
      <p>
        Scan an item, then choose Record for experiment and say which bin was really correct. Everything here is measured on your device with your
        items. The log is stored in this browser only.
      </p>
      {entries.length === 0 ? (
        <p className="empty">No scans recorded yet. Go to Scan, test an item, and record it.</p>
      ) : (
        <>
          <table className="table">
            <tbody>
              <tr><th>Scans recorded</th><td>{s.n}</td></tr>
              <tr><th>Gave a bin (items that belong in one of the four bins)</th><td>{s.answered} of {s.scored} ({ratio(s.answered, s.scored)})</td></tr>
              <tr><th>Correct when it gave a bin</th><td>{s.correct} of {s.answered} ({ratio(s.correct, s.answered)})</td></tr>
              <tr><th>Wrong bin recommended</th><td>{s.wrong} of {s.scored} ({ratio(s.wrong, s.scored)})</td></tr>
              <tr><th>Said Uncertain</th><td>{s.uncertain} of {s.scored} ({ratio(s.uncertain, s.scored)})</td></tr>
              <tr><th>Items for none of the bins, correctly held back</th><td>{s.outOfScopeHeldBack} of {s.outOfScope} ({ratio(s.outOfScopeHeldBack, s.outOfScope)})</td></tr>
              <tr><th>Average analysis time</th><td>{s.meanMs === null ? "no data yet" : `${Math.round(s.meanMs)} ms`}</td></tr>
            </tbody>
          </table>
          {byLight.length > 1 && (
            <table className="table">
              <thead><tr><th>Lighting</th><th>Scans</th><th>Gave a bin</th><th>Correct when it gave a bin</th></tr></thead>
              <tbody>
                {byLight.map((l) => {
                  const x = summarise(entries.filter((e) => e.lighting === l));
                  return <tr key={l}><td>{l}</td><td>{x.n}</td><td>{ratio(x.answered, x.scored)}</td><td>{ratio(x.correct, x.answered)}</td></tr>;
                })}
              </tbody>
            </table>
          )}
          <div className="row actions">
            <button className="btn btn-primary" onClick={download}>Download results as CSV</button>
            <button className="btn btn-quiet" onClick={() => window.confirm("Delete every recorded scan from this browser?") && onClear()}>Delete all records</button>
          </div>
          <div className="scroll">
            <table className="table table-log">
              <thead><tr><th>Item</th><th>Correct bin</th><th>EcoSort said</th><th>Conf.</th><th>Lighting</th><th>Angle</th><th>Distance</th><th>Background</th><th>ms</th><th /></tr></thead>
              <tbody>
                {[...entries].reverse().map((e) => (
                  <tr key={e.id} className={e.answer === "uncertain" ? "" : e.answer === e.truth ? "ok" : "bad"}>
                    <td>{e.item || "(not named)"}</td>
                    <td>{e.truth === "not-for-these-bins" ? "None" : BINS[e.truth].short}</td>
                    <td>{e.answer === "uncertain" ? "Uncertain" : BINS[e.answer].short}</td>
                    <td>{(e.confidence * 100).toFixed(0)}%</td>
                    <td>{e.lighting}</td><td>{e.angle}</td><td>{e.distance}</td><td>{e.background}</td>
                    <td>{Math.round(e.inferenceMs)}</td>
                    <td><button className="link" onClick={() => onRemove(e.id)} aria-label={`Remove record for ${e.item || "item"}`}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
