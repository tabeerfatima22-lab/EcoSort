/**
 * Image resampling shared by the browser app and the Node evaluation script,
 * so that measured results describe exactly the pipeline the app runs.
 *
 * Triangle (bilinear) filter with antialiasing: the kernel is widened by the
 * downscale factor, like tf.image.resize(..., antialias=True) and Pillow's
 * BILINEAR. This matches how the waste model's training images were resized.
 */
export interface RgbaImage {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Span {
  start: number;
  weights: Float64Array;
}

function spans(inputSize: number, outputSize: number): Span[] {
  const scale = inputSize / outputSize;
  const kernel = Math.max(scale, 1);
  const out: Span[] = [];
  for (let i = 0; i < outputSize; i++) {
    const center = (i + 0.5) * scale;
    const start = Math.max(0, Math.ceil(center - kernel - 0.5));
    const end = Math.min(inputSize - 1, Math.floor(center + kernel - 0.5));
    const weights = new Float64Array(Math.max(1, end - start + 1));
    let total = 0;
    for (let k = 0; k < weights.length; k++) {
      const w = Math.max(0, 1 - Math.abs((start + k + 0.5 - center) / kernel));
      weights[k] = w;
      total += w;
    }
    if (total > 0) for (let k = 0; k < weights.length; k++) weights[k] /= total;
    else weights[0] = 1;
    out.push({ start: Math.min(start, inputSize - 1), weights });
  }
  return out;
}

/**
 * Resizes a crop of an RGBA image to outW x outH and returns interleaved RGB
 * float values in [0, 255] (HWC). Aspect ratio is not preserved, by design:
 * the caller chooses the crop.
 */
export function resizeToRgb(image: RgbaImage, crop: CropRect, outW: number, outH: number): Float32Array {
  const cx = Math.max(0, Math.min(image.width - 1, Math.round(crop.x)));
  const cy = Math.max(0, Math.min(image.height - 1, Math.round(crop.y)));
  const cw = Math.max(1, Math.min(image.width - cx, Math.round(crop.width)));
  const ch = Math.max(1, Math.min(image.height - cy, Math.round(crop.height)));
  const cols = spans(cw, outW);
  const rows = spans(ch, outH);
  const src = image.data;

  const horizontal = new Float32Array(ch * outW * 3);
  for (let y = 0; y < ch; y++) {
    const rowOffset = (cy + y) * image.width + cx;
    for (let x = 0; x < outW; x++) {
      const { start, weights } = cols[x];
      let r = 0;
      let g = 0;
      let b = 0;
      for (let k = 0; k < weights.length; k++) {
        const p = (rowOffset + start + k) * 4;
        const w = weights[k];
        r += src[p] * w;
        g += src[p + 1] * w;
        b += src[p + 2] * w;
      }
      const t = (y * outW + x) * 3;
      horizontal[t] = r;
      horizontal[t + 1] = g;
      horizontal[t + 2] = b;
    }
  }

  const out = new Float32Array(outW * outH * 3);
  for (let y = 0; y < outH; y++) {
    const { start, weights } = rows[y];
    for (let x = 0; x < outW; x++) {
      for (let c = 0; c < 3; c++) {
        let v = 0;
        for (let k = 0; k < weights.length; k++) v += horizontal[((start + k) * outW + x) * 3 + c] * weights[k];
        out[(y * outW + x) * 3 + c] = v;
      }
    }
  }
  return out;
}

/** Centre crop covering `fraction` of each side. */
export function centreCrop(width: number, height: number, fraction: number): CropRect {
  const w = width * fraction;
  const h = height * fraction;
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h };
}

/** Largest centred square. */
export function centreSquare(width: number, height: number, fraction = 1): CropRect {
  const side = Math.min(width, height) * fraction;
  return { x: (width - side) / 2, y: (height - side) / 2, width: side, height: side };
}

/** Mirrors an HWC RGB buffer left-to-right. */
export function flipHorizontal(rgb: Float32Array, width: number, height: number): Float32Array {
  const out = new Float32Array(rgb.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 3;
      const t = (y * width + (width - 1 - x)) * 3;
      out[t] = rgb[s];
      out[t + 1] = rgb[s + 1];
      out[t + 2] = rgb[s + 2];
    }
  }
  return out;
}

/** Mean brightness (0-255) and a simple sharpness score, for capture guidance. */
export function imageQuality(rgb: Float32Array, width: number, height: number): { brightness: number; sharpness: number } {
  let sum = 0;
  const lum = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const l = 0.299 * rgb[i * 3] + 0.587 * rgb[i * 3 + 1] + 0.114 * rgb[i * 3 + 2];
    lum[i] = l;
    sum += l;
  }
  let grad = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = 4 * lum[i] - lum[i - 1] - lum[i + 1] - lum[i - width] - lum[i + width];
      grad += lap * lap;
      n++;
    }
  }
  return { brightness: sum / (width * height), sharpness: n ? grad / n : 0 };
}
