/**
 * Turns the first page of a PDF plan into a PNG, in the browser.
 *
 * The page is drawn at 150 dpi on purpose: that is the resolution the scale
 * conversion assumes (see analysis/scale.ts), so a PDF drawn at 1:100 gives
 * the same meters as the paper plan. pdf.js is loaded only when a PDF arrives.
 */
export const PDF_DPI = 150;
/** Larger pages are drawn at a lower dpi and the scale is adjusted afterwards. */
const MAX_SIDE = 6000;

export interface RenderedPdf {
  blob: Blob;
  pages: number;
  /** dpi actually used; below 150 only for very large sheets. */
  dpi: number;
}

export async function renderPdfFirstPage(file: Blob): Promise<RenderedPdf> {
  const pdfjs = await import('pdfjs-dist');
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  let document;
  try {
    document = await task.promise;
  } catch {
    await task.destroy();
    throw new Error('No se pudo abrir el PDF. Puede estar dañado o protegido con contraseña.');
  }
  try {
    const page = await document.getPage(1);
    const base = page.getViewport({ scale: 1 }); // 72 units per inch
    let dpi = PDF_DPI;
    const longest = (Math.max(base.width, base.height) / 72) * dpi;
    if (longest > MAX_SIDE) dpi = Math.floor((MAX_SIDE / longest) * dpi);
    const viewport = page.getViewport({ scale: dpi / 72 });

    const canvas = window.document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;

    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('No se pudo convertir el PDF.'))), 'image/png'),
    );
    return { blob, pages: document.numPages, dpi };
  } finally {
    await task.destroy();
  }
}
