/**
 * Checks that a plan image is usable before it is analyzed (stage 1 of the
 * proposal: warn when the file is tilted, blurry or incomplete).
 *
 * Everything here is a pure function over a grayscale image, so it is fast,
 * deterministic and tested without a browser.
 */
export interface GrayImage {
  width: number;
  height: number;
  /** One byte per pixel, 0 = black, 255 = white. */
  data: Uint8Array | Uint8ClampedArray;
}

export type CheckId = 'content' | 'contrast' | 'sharpness' | 'tilt' | 'size';

export interface QualityCheck {
  id: CheckId;
  label: string;
  ok: boolean;
  detail: string;
}

export interface QualityReport {
  /** ok: ready to analyze; warning: usable but worth a check; bad: the analysis will most likely fail. */
  level: 'ok' | 'warning' | 'bad';
  checks: QualityCheck[];
  metrics: { inkRatio: number; contrast: number; sharpness: number; tiltDeg: number };
}

const MIN_SIDE = 500;

export function assessPlan(image: GrayImage, naturalSize = { width: image.width, height: image.height }): QualityReport {
  const inkRatio = ink(image);
  const contrast = stdDev(image);
  const sharpness = edgeSharpness(image);
  const tiltDeg = dominantTilt(image);

  const checks: QualityCheck[] = [];
  const blank = inkRatio < 0.003;
  const dark = inkRatio > 0.55;
  checks.push({
    id: 'content',
    label: 'Contenido',
    ok: !blank && !dark,
    detail: blank
      ? 'La imagen parece estar en blanco.'
      : dark
        ? 'Hay demasiado fondo oscuro. Sube el plano sobre fondo claro.'
        : 'Se ve un dibujo sobre fondo claro.',
  });
  checks.push({
    id: 'contrast',
    label: 'Contraste',
    ok: contrast >= 22,
    detail: contrast >= 22 ? 'Líneas bien diferenciadas del papel.' : 'Contraste bajo: las líneas se confunden con el fondo.',
  });
  checks.push({
    id: 'sharpness',
    label: 'Nitidez',
    ok: sharpness >= 0.3,
    detail: sharpness >= 0.3 ? 'Bordes nítidos.' : 'La imagen se ve borrosa. Si puedes, escanéala de nuevo o súbela en PDF.',
  });
  const tilted = Math.abs(tiltDeg) >= 1.5;
  checks.push({
    id: 'tilt',
    label: 'Alineación',
    ok: !tilted,
    detail: tilted
      ? `El plano parece girado ${Math.abs(tiltDeg).toFixed(1)}°. Los muros saldrán en diagonal; endereza la foto antes de subirla.`
      : 'Muros alineados con la hoja.',
  });
  const small = Math.max(naturalSize.width, naturalSize.height) < MIN_SIDE;
  checks.push({
    id: 'size',
    label: 'Resolución',
    ok: !small,
    detail: small
      ? `Solo ${naturalSize.width} × ${naturalSize.height} px: los detalles pequeños se pueden perder.`
      : `${naturalSize.width} × ${naturalSize.height} px.`,
  });

  const failed = checks.filter((c) => !c.ok);
  const level = failed.some((c) => c.id === 'content') || failed.length >= 3 ? 'bad' : failed.length > 0 ? 'warning' : 'ok';
  return { level, checks, metrics: { inkRatio, contrast, sharpness, tiltDeg } };
}

/** Fraction of pixels darker than mid gray. */
export function ink(image: GrayImage): number {
  let count = 0;
  for (let i = 0; i < image.data.length; i++) if (image.data[i] < 128) count++;
  return count / image.data.length;
}

export function stdDev(image: GrayImage): number {
  let sum = 0;
  let sq = 0;
  for (let i = 0; i < image.data.length; i++) {
    sum += image.data[i];
    sq += image.data[i] * image.data[i];
  }
  const n = image.data.length;
  const mean = sum / n;
  return Math.sqrt(Math.max(0, sq / n - mean * mean));
}

/**
 * How abrupt the edges are, from 0 to 1: the strongest one-pixel step found
 * (99th percentile of the gradient) divided by the overall ink/paper range.
 * A crisp line jumps from paper to ink in one pixel (close to 1); a blurred
 * line takes several pixels (well below 0.3).
 */
export function edgeSharpness(image: GrayImage): number {
  const { width, height, data } = image;
  const histogram = new Uint32Array(256);
  let total = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width - 1; x++) {
      const i = y * width + x;
      const dx = Math.abs(data[i + 1] - data[i]);
      const dy = y < height - 1 ? Math.abs(data[i + width] - data[i]) : 0;
      const g = Math.max(dx, dy);
      if (g > 8) {
        histogram[g]++;
        total++;
      }
    }
  }
  if (total === 0) return 0;
  let seen = 0;
  let p99 = 0;
  for (let g = 255; g >= 0; g--) {
    seen += histogram[g];
    if (seen >= total * 0.01) {
      p99 = g;
      break;
    }
  }
  const range = percentile(data, 0.98) - percentile(data, 0.02);
  return range <= 0 ? 0 : Math.min(1, p99 / range);
}

/**
 * Dominant rotation of the drawing in degrees (-10..10), with the classic
 * projection-profile deskew: plans are full of horizontal lines, so when the
 * ink is projected at the right angle the rows pile up into sharp peaks. The
 * angle whose profile has the largest sum of squares wins.
 */
export function dominantTilt(image: GrayImage, maxDeg = 10, stepDeg = 0.25): number {
  const { width, height, data } = image;
  const xs: number[] = [];
  const ys: number[] = [];
  // Sample at most ~60k ink pixels to keep it fast on big plans.
  const stride = Math.max(1, Math.floor((width * height) / 400_000));
  for (let i = 0; i < data.length; i += stride) {
    if (data[i] < 128) {
      xs.push((i % width) - width / 2);
      ys.push(Math.floor(i / width) - height / 2);
    }
  }
  if (xs.length < 50) return 0;
  const size = Math.ceil(Math.hypot(width, height)) + 2;
  const offset = size / 2;
  const profile = new Float64Array(size);

  const score = (deg: number) => {
    profile.fill(0);
    const a = (deg * Math.PI) / 180;
    const sin = Math.sin(a);
    const cos = Math.cos(a);
    for (let k = 0; k < xs.length; k++) {
      const row = Math.round(ys[k] * cos - xs[k] * sin + offset);
      profile[row]++;
    }
    let sum = 0;
    for (let r = 0; r < size; r++) sum += profile[r] * profile[r];
    return sum;
  };

  let best = 0;
  let bestScore = score(0);
  for (let deg = -maxDeg; deg <= maxDeg + 1e-9; deg += stepDeg) {
    const value = score(deg);
    if (value > bestScore * 1.0001) {
      bestScore = value;
      best = deg;
    }
  }
  return Math.abs(best) < stepDeg ? 0 : Number(best.toFixed(2));
}

function percentile(data: Uint8Array | Uint8ClampedArray, q: number): number {
  const histogram = new Uint32Array(256);
  for (let i = 0; i < data.length; i++) histogram[data[i]]++;
  const target = data.length * q;
  let seen = 0;
  for (let v = 0; v < 256; v++) {
    seen += histogram[v];
    if (seen >= target) return v;
  }
  return 255;
}
