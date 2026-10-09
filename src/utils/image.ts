import type { PreparedImage } from '../data/repositories.ts';

export const ACCEPTED_PLAN_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
export const MAX_PLAN_BYTES = 10 * 1024 * 1024;

/** Longest side kept when storing raster plans in the browser. */
const MAX_SIDE = 2600;

export interface PreparedPlan extends PreparedImage {
  width: number;
  height: number;
  /** Factor applied when the image had to be reduced (1 = untouched). */
  reduction: number;
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No se pudo leer la imagen del plano.'));
    image.src = url;
  });
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Checks the file and reduces very large raster images so they fit in the
 * browser storage. SVG files are kept as they are.
 */
export async function preparePlanImage(file: Blob): Promise<PreparedPlan> {
  if (!ACCEPTED_PLAN_TYPES.includes(file.type)) {
    throw new Error('Formato no válido. Sube el plano en PNG, JPG, WEBP o SVG.');
  }
  if (file.size > MAX_PLAN_BYTES) {
    throw new Error('El archivo pesa más de 10 MB. Reduce su tamaño e inténtalo de nuevo.');
  }

  const dataUrl = await readAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const width = image.naturalWidth;
  const height = image.naturalHeight;

  if (!width || !height) {
    throw new Error('El plano no tiene un tamaño definido. Si es SVG, agrega width y height.');
  }

  const longest = Math.max(width, height);
  if (file.type === 'image/svg+xml' || longest <= MAX_SIDE) {
    return { dataUrl, blob: file, width, height, reduction: 1 };
  }

  const reduction = MAX_SIDE / longest;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * reduction);
  canvas.height = Math.round(height * reduction);
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('No se pudo reducir el plano.'))), 'image/jpeg', 0.9),
  );
  return {
    dataUrl: await readAsDataUrl(blob),
    blob,
    width: canvas.width,
    height: canvas.height,
    reduction,
  };
}
