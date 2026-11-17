import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { BINS, BIN_ORDER, type BinId } from "../core/bins";
import type { TaughtItem } from "../core/memory";
import { BinIcon } from "./icons";
import { isConnected, makeConnectLink, testConnection, tokenCreateUrl, type GitHubConfig } from "../app/githubSync";

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

function QrCode({ text }: { text: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(text, { margin: 1, width: 260, errorCorrectionLevel: "M" }).then((u) => live && setSrc(u)).catch(() => live && setSrc(null));
    return () => {
      live = false;
    };
  }, [text]);
  return src ? <img className="qr" src={src} alt="QR code that connects another phone" width={260} height={260} /> : <p className="fine">Making the QR code...</p>;
}

function ShareConnection({ config }: { config: GitHubConfig }) {
  const link = makeConnectLink(config);
  const [showQr, setShowQr] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const share = async () => {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: "EcoSort", text: "Open this on your phone to save EcoSort items to our shared list:", url: link });
        return;
      } catch {
        /* cancelled: fall back to copying */
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setNote("Link copied. Paste it into WhatsApp, a text message or an email.");
    } catch {
      setNote("Could not copy automatically. Use the QR code instead.");
    }
  };
  return (
    <div className="github-share">
      <p className="item-name">Add another phone</p>
      <p className="fine">The other person does not need GitHub. They open the link (or scan the QR code with their camera) and their phone is connected.</p>
      <div className="row actions">
        <button className="btn btn-primary" onClick={share}>Send link</button>
        <button className="btn btn-quiet" onClick={() => setShowQr((v) => !v)}>{showQr ? "Hide QR code" : "Show QR code"}</button>
      </div>
      {note && <p className="fine" role="status">{note}</p>}
      {showQr && <QrCode text={link} />}
      <p className="fine warn">Treat this link like a password: anyone who has it can add and remove items in your list. Share it only with people you trust.</p>
    </div>
  );
}

function GitHubPanel({ config, status, onConnect, onDisconnect, onSync }: {
  config: GitHubConfig;
  status: { state: "off" | "syncing" | "ok" | "error"; text: string };
  onConnect: (c: GitHubConfig) => void;
  onDisconnect: () => void;
  onSync: () => void;
}) {
  const connected = isConnected(config);
  const [draft, setDraft] = useState<GitHubConfig>({ ...config, token: "" });
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const connect = async () => {
    const next = { ...draft, token: draft.token.trim() };
    if (!next.token) return;
    setChecking(true);
    setProblem(null);
    const err = await testConnection(next);
    setChecking(false);
    if (err) {
      setProblem(err);
      return;
    }
    setDraft({ ...next, token: "" });
    onConnect(next);
  };

  if (connected) {
    return (
      <div className={`github-panel github-${status.state}`}>
        <div className="github-head">
          <div>
            <p className="item-name">Shared list on GitHub: on</p>
            <p className="fine" role="status">{status.text}</p>
          </div>
          <button className="btn btn-quiet" disabled={status.state === "syncing"} onClick={onSync}>Sync now</button>
        </div>
        <ShareConnection config={config} />
        <p className="fine">
          Saving to {config.owner}/{config.repo} ({config.path}).{" "}
          <button className="link" onClick={() => window.confirm("Stop saving to GitHub on this phone? Items already saved stay on GitHub.") && onDisconnect()}>Turn off on this phone</button>
        </p>
      </div>
    );
  }

  return (
    <div className={`github-panel github-${status.state}`}>
      <p className="item-name">Share your items between phones</p>
      <p className="fine">
        <b>Someone sent you a link?</b> Just open it on this phone. That is all.
      </p>
      <details>
        <summary className="fine"><b>Setting it up for the first time</b> (one person does this once)</summary>
        <ol className="steps">
          <li>
            <a className="btn btn-primary" href={tokenCreateUrl(draft)} target="_blank" rel="noopener noreferrer">Open GitHub key page</a>
            <span className="fine">Sign in to GitHub if asked. Everything is filled in except one choice: under <b>Repository access</b> pick <b>Only select repositories</b> and choose <b>{draft.repo}</b>.</span>
          </li>
          <li>
            <span className="fine">Scroll down, press <b>Generate token</b>, then press the copy button next to the key (it starts with github_pat_).</span>
          </li>
          <li>
            <label className="field">
              <span>Come back here and paste the key</span>
              <input type="password" autoComplete="off" placeholder="github_pat_..." value={draft.token} onChange={(e) => { setDraft({ ...draft, token: e.target.value }); setProblem(null); }} />
            </label>
            <button className="btn btn-primary" disabled={!draft.token.trim() || checking} onClick={connect}>{checking ? "Checking..." : "Connect"}</button>
          </li>
        </ol>
        {problem && <p className="fine warn" role="alert">{problem}</p>}
        <p className="fine">Then use <b>Send link</b> to connect the other phones; they do not need GitHub.</p>
        <details>
          <summary className="fine">Advanced: a different repository</summary>
          <div className="github-form">
            <div className="row">
              <label className="field"><span>Owner</span><input value={draft.owner} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} /></label>
              <label className="field"><span>Repository</span><input value={draft.repo} onChange={(e) => setDraft({ ...draft, repo: e.target.value })} /></label>
            </div>
            <div className="row">
              <label className="field"><span>Branch</span><input value={draft.branch} onChange={(e) => setDraft({ ...draft, branch: e.target.value })} /></label>
              <label className="field"><span>File</span><input value={draft.path} onChange={(e) => setDraft({ ...draft, path: e.target.value })} /></label>
            </div>
          </div>
        </details>
      </details>
      <p className="fine">Note: the repository is public, so item names and their small photos can be seen by anyone.</p>
    </div>
  );
}

export function MyItems({ items, onRemoveItem, onRemovePhoto, onExport, onImport, message, github, githubStatus, onConnectGitHub, onDisconnectGitHub, onSyncGitHub }: {
  github: GitHubConfig;
  githubStatus: { state: "off" | "syncing" | "ok" | "error"; text: string };
  onConnectGitHub: (c: GitHubConfig) => void;
  onDisconnectGitHub: () => void;
  onSyncGitHub: () => void;
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
        Matching recognises the same or a very similar item. Tagging one brand of can will not teach it every can. Your items are kept in this browser. Turn on the shared list below to keep them on GitHub and use them on other phones.
      </p>
      <GitHubPanel config={github} status={githubStatus} onConnect={onConnectGitHub} onDisconnect={onDisconnectGitHub} onSync={onSyncGitHub} />
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
