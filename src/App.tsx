import { useCallback, useEffect, useRef, useState } from "react";
import { BINS, BIN_ORDER } from "./core/bins";
import { MODES, type ModeName } from "./core/config";
import { toBinProbabilities, topBin } from "./core/decision";
import { analyse, quickLook, type Analysis } from "./core/pipeline";
import type { RgbaImage } from "./core/resize";
import { imageQuality, resizeToRgb } from "./core/resize";
import { decodeBlob, describeCameraError, fetchSnapshot, grabSquare, openCamera, toDataUrl, type CameraProblem } from "./app/camera";
import { EngineError, loadEngine, type Engine, type LoadProgress } from "./app/engine";
import { readLog, writeLog, type LogEntry } from "./app/log";
import { beep, say, speechAvailable, unlockSpeech } from "./app/speech";
import { About } from "./ui/About";
import { DEFAULT_CONDITIONS, ExperimentView, RecordForm, type Conditions } from "./ui/Experiment";
import { BinIcon } from "./ui/icons";
import { Result, spokenSummary } from "./ui/Result";

type View = "scan" | "experiment" | "about";
type Phase = "aim" | "analysing" | "result";
interface Settings {
  mode: ModeName;
  voice: boolean;
  continuous: boolean;
  snapshotUrl: string;
}
const DEFAULTS: Settings = { mode: "strict", voice: true, continuous: false, snapshotUrl: "" };

function loadSettings(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem("ecosort.settings.v1") ?? "{}") };
  } catch {
    return DEFAULTS;
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function App() {
  const [view, setView] = useState<View>("scan");
  const [engine, setEngine] = useState<Engine | null>(null);
  const [progress, setProgress] = useState<LoadProgress>({ step: "Starting", fraction: 0 });
  const [engineError, setEngineError] = useState<EngineError | null>(null);
  const [attempt, setAttempt] = useState(0);

  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [camera, setCamera] = useState<"off" | "starting" | "live">("off");
  const [cameraProblem, setCameraProblem] = useState<CameraProblem | null>(null);
  const [phase, setPhase] = useState<Phase>("aim");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [still, setStill] = useState<string | null>(null);
  const [source, setSource] = useState("camera");
  const [clean, setClean] = useState<"yes" | "no" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [liveHint, setLiveHint] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [conditions, setConditions] = useState<Conditions>(DEFAULT_CONDITIONS);
  const [log, setLog] = useState<LogEntry[]>(readLog);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = useRef(false);

  useEffect(() => {
    localStorage.setItem("ecosort.settings.v1", JSON.stringify(settings));
  }, [settings]);

  /* Load the models once (again if the user presses Try again). */
  useEffect(() => {
    let cancelled = false;
    setEngineError(null);
    loadEngine((p) => !cancelled && setProgress(p))
      .then((e) => !cancelled && setEngine(e))
      .catch((e) => !cancelled && setEngineError(e instanceof EngineError ? e : new EngineError("The models could not be started", String(e))));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamera("off");
  }, []);

  const startCamera = useCallback(async () => {
    setCameraProblem(null);
    setCamera("starting");
    try {
      const stream = await openCamera();
      streamRef.current = stream;
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        setCamera("off");
        setCameraProblem({ title: "The camera stopped", help: "Press Turn on camera to start it again." });
      });
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      setCamera("live");
    } catch (error) {
      setCamera("off");
      setCameraProblem(describeCameraError(error));
    }
  }, []);

  /* Start the camera when the scan view opens; release it when leaving or when the tab is hidden. */
  useEffect(() => {
    if (view !== "scan") return;
    void startCamera();
    const onVisibility = () => {
      if (document.hidden) stopCamera();
      else if (!streamRef.current) void startCamera();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stopCamera();
    };
  }, [view, startCamera, stopCamera]);

  const finish = useCallback(
    (result: Analysis, picture: RgbaImage, from: string) => {
      setAnalysis(result);
      setStill(toDataUrl(picture));
      setSource(from);
      setClean(null);
      setPhase("result");
      const ok = result.decision.status === "recommend";
      beep(ok);
      if ("vibrate" in navigator) navigator.vibrate(ok ? 40 : [40, 60, 40]);
      if (settings.voice) say(spokenSummary(result));
    },
    [settings.voice],
  );

  const run = useCallback(
    async (getPicture: () => Promise<RgbaImage>, from: string) => {
      if (!engine || busy.current) return;
      busy.current = true;
      setMessage(null);
      setPhase("analysing");
      try {
        const picture = await getPicture();
        await wait(30); // let the "Analysing" state paint before the models run
        const result = await analyse(picture, { x: 0, y: 0, width: picture.width, height: picture.height }, engine, MODES[settings.mode]);
        finish(result, picture, from);
      } catch (error) {
        setPhase("aim");
        setMessage(error instanceof Error ? error.message : "Something went wrong while analysing the picture.");
      } finally {
        busy.current = false;
      }
    },
    [engine, settings.mode, finish],
  );

  /** Takes three frames a moment apart and keeps the sharpest, to avoid motion blur. */
  const sharpestFrame = useCallback(async (): Promise<RgbaImage> => {
    const video = videoRef.current;
    let best: RgbaImage | null = null;
    let bestScore = -1;
    for (let i = 0; i < 3; i++) {
      const frame = video ? grabSquare(video) : null;
      if (frame) {
        const small = resizeToRgb(frame, { x: 0, y: 0, width: frame.width, height: frame.height }, 96, 96);
        const score = imageQuality(small, 96, 96).sharpness;
        if (score > bestScore) {
          bestScore = score;
          best = frame;
        }
      }
      if (i < 2) await wait(110);
    }
    if (!best) throw new Error("The camera is not showing a picture yet. Wait a moment and scan again.");
    return best;
  }, []);

  const scan = () => {
    unlockSpeech();
    void run(sharpestFrame, "camera");
  };
  const scanNetwork = () => {
    unlockSpeech();
    void run(() => fetchSnapshot(settings.snapshotUrl.trim()), "network camera");
  };
  const onFile = (file: File | undefined) => {
    if (!file) return;
    unlockSpeech();
    void run(() => decodeBlob(file), "uploaded photo");
  };
  const rescan = () => {
    window.speechSynthesis?.cancel();
    setAnalysis(null);
    setStill(null);
    setPhase("aim");
    setLiveHint(null);
  };

  /* Continuous detection: a light single-view pass about twice a second with temporal smoothing.
     When three passes in a row agree, the full checked analysis runs on a fresh frame. */
  useEffect(() => {
    if (!settings.continuous || !engine || camera !== "live" || phase !== "aim" || view !== "scan") return;
    let stop = false;
    const recent: string[] = [];
    let smooth: number[] | null = null;
    (async () => {
      while (!stop) {
        await wait(450);
        if (stop || busy.current) continue;
        const video = videoRef.current;
        const frame = video ? grabSquare(video, 320) : null;
        if (!frame) continue;
        const probs = Array.from(await quickLook(frame, { x: 0, y: 0, width: frame.width, height: frame.height }, engine));
        if (stop) break;
        smooth = smooth ? smooth.map((v, i) => 0.6 * v + 0.4 * probs[i]) : probs;
        const bins = toBinProbabilities(smooth);
        const bin = topBin(bins);
        const strong = bins[bin] >= MODES[settings.mode].minBinProbability;
        recent.push(strong ? bin : "none");
        if (recent.length > 3) recent.shift();
        setLiveHint(strong ? `Looks like ${BINS[bin].short.toLowerCase()}. Hold still.` : "Looking. Hold one item inside the frame.");
        if (recent.length === 3 && recent.every((b) => b === bin) && strong) {
          stop = true;
          void run(sharpestFrame, "camera (continuous)");
        }
      }
    })();
    return () => {
      stop = true;
      setLiveHint(null);
    };
  }, [settings.continuous, settings.mode, engine, camera, phase, view, run, sharpestFrame]);

  const saveRecord = (item: string, truth: LogEntry["truth"]) => {
    if (!analysis || !engine) return;
    const d = analysis.decision;
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      time: new Date().toISOString(),
      item,
      truth,
      answer: d.status === "recommend" ? d.bin! : "uncertain",
      material: d.material,
      confidence: d.binProbability,
      reason: d.reason ?? "",
      ...conditions,
      source,
      mode: settings.mode,
      inferenceMs: analysis.inferenceMs,
      modelVersion: `${engine.meta.model_name} ${engine.meta.model_version}`,
    };
    const next = [...log, entry];
    setLog(next);
    setMessage(writeLog(next) ? "Saved to the experiment log." : "The record could not be stored. This browser is blocking storage (private mode?).");
    setRecording(false);
  };

  const shownBin =
    phase === "result" && analysis?.decision.status === "recommend" ? (clean === "no" && analysis.decision.bin !== "general" ? "general" : analysis.decision.bin) : null;

  const status = engineError
    ? "Model failed to load"
    : !engine
      ? `${progress.step}`
      : phase === "analysing"
        ? "Analysing"
        : phase === "result"
          ? analysis?.decision.status === "recommend"
            ? "Item recognised"
            : "Not sure about this item"
          : camera === "live"
            ? liveHint ?? "Ready. Hold one item inside the frame."
            : camera === "starting"
              ? "Starting the camera"
              : "Camera is off";

  return (
    <div className="app">
      <header className="top">
        <a className="brand" href="./" aria-label="EcoSort AI home">
          <svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true">
            <rect width="64" height="64" rx="14" fill="#14241c" />
            <path d="M14 22V14h8M42 14h8v8M50 42v8h-8M22 50h-8v-8" fill="none" stroke="#f0a800" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="32" cy="32" r="9" fill="#35c486" />
          </svg>
          <span>EcoSort AI</span>
        </a>
        <nav aria-label="Sections">
          {(["scan", "experiment", "about"] as View[]).map((v) => (
            <button key={v} className={view === v ? "tab on" : "tab"} aria-current={view === v ? "page" : undefined} onClick={() => setView(v)}>
              {v === "scan" ? "Scan" : v === "experiment" ? `Experiment${log.length ? ` (${log.length})` : ""}` : "About"}
            </button>
          ))}
        </nav>
      </header>

      {view === "scan" && (
        <main className="scan">
          <div className="stage">
            <div className={`finder ${phase}`}>
              <video ref={videoRef} playsInline muted autoPlay className={phase === "result" || camera !== "live" ? "hidden" : ""} />
              {phase === "result" && still && <img src={still} alt="The picture that was analysed" />}
              {phase !== "result" && camera !== "live" && (
                <div className="finder-empty">
                  {cameraProblem ? (
                    <>
                      <p className="finder-title">{cameraProblem.title}</p>
                      <p>{cameraProblem.help}</p>
                    </>
                  ) : (
                    <p>{camera === "starting" ? "Starting the camera. Allow access if your browser asks." : "The camera is off."}</p>
                  )}
                  {camera === "off" && <button className="btn btn-light" onClick={() => void startCamera()}>Turn on camera</button>}
                </div>
              )}
              {phase !== "result" && camera === "live" && (
                <svg className="brackets" viewBox="0 0 100 100" aria-hidden="true">
                  <path d="M12 26V12h14M74 12h14v14M88 74v14H74M26 88H12V74" />
                </svg>
              )}
              {phase === "analysing" && <div className="sweep" aria-hidden="true" />}
            </div>
            <p className={`status ${engineError ? "bad" : ""}`} role="status">
              <span className={`pulse ${phase === "analysing" || !engine ? "on" : ""}`} aria-hidden="true" />
              {status}
            </p>
            {!engine && !engineError && (
              <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.fraction * 100)} aria-label="Loading the recognition models">
                <span style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
              </div>
            )}
          </div>

          <div className="panel">
            {engineError ? (
              <div className="problem" role="alert">
                <h2>{engineError.title}</h2>
                <p>{engineError.help}</p>
                <button className="btn btn-primary" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
              </div>
            ) : phase === "result" && analysis ? (
              <Result analysis={analysis} onRescan={rescan} onRecord={() => setRecording(true)} clean={clean} onClean={setClean} />
            ) : (
              <>
                <h1 className="headline">Which bin does it go in?</h1>
                <p className="lede">Hold one item inside the frame, in good light, on a plain background. The picture is analysed on this device and is never uploaded.</p>
                <div className="row actions">
                  <button className="btn btn-primary btn-big" disabled={!engine || camera !== "live" || phase === "analysing"} onClick={scan}>
                    {phase === "analysing" ? "Analysing" : "Scan item"}
                  </button>
                  <button className="btn btn-quiet btn-big" disabled={!engine || phase === "analysing"} onClick={() => fileRef.current?.click()}>
                    Upload a photo
                  </button>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
                </div>
                {settings.snapshotUrl.trim() && (
                  <button className="btn btn-quiet" disabled={!engine || phase === "analysing"} onClick={scanNetwork}>Scan from network camera</button>
                )}
                {!engine && <p className="fine">First visit downloads about 40 MB of model files. After that the browser keeps them.</p>}
              </>
            )}
            {message && <p className="toast" role="status">{message}</p>}

            <ul className="legend" aria-label="The four bins">
              {BIN_ORDER.map((b) => (
                <li key={b} style={{ background: BINS[b].color, color: BINS[b].ink }} className={shownBin === b ? "hit" : ""}>
                  <BinIcon bin={b} size={22} />
                  {BINS[b].short}
                </li>
              ))}
            </ul>

            <button className="link" aria-expanded={showSettings} onClick={() => setShowSettings((v) => !v)}>{showSettings ? "Hide settings" : "Settings"}</button>
            {showSettings && (
              <div className="settings">
                <label className="check">
                  <input type="checkbox" checked={settings.voice} disabled={!speechAvailable()} onChange={(e) => setSettings({ ...settings, voice: e.target.checked })} />
                  Speak the result{speechAvailable() ? "" : " (not available in this browser)"}
                </label>
                <label className="check">
                  <input type="checkbox" checked={settings.continuous} onChange={(e) => setSettings({ ...settings, continuous: e.target.checked })} />
                  Scan automatically when an item is held steady
                </label>
                <label className="field">
                  <span>How careful should it be?</span>
                  <select value={settings.mode} onChange={(e) => setSettings({ ...settings, mode: e.target.value as ModeName })}>
                    <option value="strict">Strict: answers less often, fewer mistakes (recommended)</option>
                    <option value="balanced">Balanced: answers more often, more mistakes</option>
                  </select>
                </label>
                <label className="field">
                  <span>Network camera snapshot address (optional)</span>
                  <input type="url" inputMode="url" placeholder="https://camera.example/snapshot.jpg" value={settings.snapshotUrl} onChange={(e) => setSettings({ ...settings, snapshotUrl: e.target.value })} />
                </label>
                <p className="fine">See About for which cameras this works with.</p>
              </div>
            )}
          </div>
        </main>
      )}

      {view === "experiment" && (
        <ExperimentView
          entries={log}
          onClear={() => { setLog([]); writeLog([]); }}
          onRemove={(id) => { const next = log.filter((e) => e.id !== id); setLog(next); writeLog(next); }}
        />
      )}
      {view === "about" && <About engine={engine} />}

      {recording && analysis && (
        <RecordForm analysis={analysis} conditions={conditions} onConditions={setConditions} onSave={saveRecord} onCancel={() => setRecording(false)} />
      )}
    </div>
  );
}
