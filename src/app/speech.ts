let unlocked = false;

export const speechAvailable = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** iOS only allows speech that starts inside a tap. Call this from the tap handler. */
export function unlockSpeech(): void {
  if (!speechAvailable() || unlocked) return;
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  window.speechSynthesis.speak(u);
  unlocked = true;
}

export function say(text: string): void {
  if (!speechAvailable()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-GB";
  u.rate = 1;
  window.speechSynthesis.speak(u);
}

export function beep(ok: boolean): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = ok ? 880 : 300;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    osc.onended = () => void ctx.close();
  } catch {
    /* sound is optional */
  }
}
