import { assessPlan, type QualityReport } from './planQuality.ts';

/** Longest side used for the checks: enough to see blur and tilt, fast on phones. */
const CHECK_SIDE = 900;

/** Runs the quality checks on an image already loaded in the browser. */
export function assessImage(image: HTMLImageElement): QualityReport {
  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;
  const factor = Math.min(1, CHECK_SIDE / Math.max(naturalWidth, naturalHeight));
  const width = Math.max(1, Math.round(naturalWidth * factor));
  const height = Math.max(1, Math.round(naturalHeight * factor));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const rgba = context.getImageData(0, 0, width, height).data;

  const gray = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const p = i * 4;
    gray[i] = Math.round(0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2]);
  }
  return assessPlan({ width, height, data: gray }, { width: naturalWidth, height: naturalHeight });
}
