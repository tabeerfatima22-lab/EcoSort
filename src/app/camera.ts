import type { RgbaImage } from "../core/resize";

export interface CameraProblem {
  title: string;
  help: string;
}

export function describeCameraError(error: unknown): CameraProblem {
  const name = error instanceof DOMException ? error.name : "";
  if (!window.isSecureContext) {
    return { title: "The camera needs a secure address", help: "Open this app from an https:// address (or localhost). You can still upload a photo." };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { title: "This browser has no camera access", help: "Open the page in Safari or Chrome directly, not inside another app's built-in browser. You can still upload a photo." };
  }
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return { title: "Camera permission was not given", help: "Allow the camera for this site in your browser's site settings, then press Turn on camera. You can still upload a photo." };
    case "NotFoundError":
    case "OverconstrainedError":
      return { title: "No camera was found", help: "This device has no usable camera. Upload a photo instead." };
    case "NotReadableError":
    case "AbortError":
      return { title: "The camera is busy", help: "Another app or tab is using the camera. Close it, then press Turn on camera." };
    default:
      return { title: "The camera could not be started", help: "Press Turn on camera to try again, or upload a photo." };
  }
}

export async function openCamera(): Promise<MediaStream> {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new DOMException("unavailable", "NotSupportedError");
  const video = { width: { ideal: 1280 }, height: { ideal: 720 } };
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: false, video: { ...video, facingMode: { ideal: "environment" } } });
  } catch (error) {
    if (error instanceof DOMException && (error.name === "OverconstrainedError" || error.name === "NotFoundError")) {
      return navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    }
    throw error;
  }
}

let scratch: HTMLCanvasElement | null = null;
function canvas(w: number, h: number): CanvasRenderingContext2D {
  scratch ??= document.createElement("canvas");
  scratch.width = w;
  scratch.height = h;
  const ctx = scratch.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  return ctx;
}

/** Grabs the centre square of the video (exactly what the square viewfinder shows). */
export function grabSquare(video: HTMLVideoElement, size = 640): RgbaImage | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const side = Math.min(vw, vh);
  const out = Math.min(size, side);
  const ctx = canvas(out, out);
  ctx.drawImage(video, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, out, out);
  return ctx.getImageData(0, 0, out, out);
}

/** Decodes an uploaded picture or a network-camera snapshot, honouring phone rotation. */
export async function decodeBlob(blob: Blob, maxSide = 1600): Promise<RgbaImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    throw new Error(/heic|heif/i.test(blob.type) ? "HEIC photos are not supported by this browser. Take a JPEG photo or use the live camera." : "This file could not be read as a picture.");
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas(w, h);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return ctx.getImageData(0, 0, w, h);
}

/** Fetches one frame from a network camera's snapshot address. */
export async function fetchSnapshot(url: string): Promise<RgbaImage> {
  if (window.location.protocol === "https:" && url.startsWith("http://")) {
    throw new Error("This page is on https, so the browser blocks plain http:// cameras. Put the camera behind an https address, or run EcoSort from localhost.");
  }
  let response: Response;
  try {
    response = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now(), { cache: "no-store" });
  } catch {
    throw new Error("The camera address could not be reached, or it does not allow this page to read it (CORS).");
  }
  if (!response.ok) throw new Error(`The camera answered with HTTP ${response.status}.`);
  return decodeBlob(await response.blob());
}

export function toDataUrl(image: RgbaImage, max = 480): string {
  const scale = Math.min(1, max / Math.max(image.width, image.height));
  const src = document.createElement("canvas");
  src.width = image.width;
  src.height = image.height;
  src.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
  const out = document.createElement("canvas");
  out.width = Math.round(image.width * scale);
  out.height = Math.round(image.height * scale);
  out.getContext("2d")!.drawImage(src, 0, 0, out.width, out.height);
  return out.toDataURL("image/jpeg", 0.8);
}
