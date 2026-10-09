import { styleFor } from '../analysis/elementStyle.ts';
import type { CatalogItem } from '../models/Catalog.ts';
import type { StructuralElement } from '../models/StructuralElement.ts';
import { nameOf } from '../services/CatalogService.ts';
import { formatPercent } from '../utils/format.ts';
import { escapeHtml } from '../utils/html.ts';

/**
 * SVG drawn on top of the plan image showing what the AI detected. The
 * viewBox is in meters, so elements are drawn with their stored coordinates.
 */
export function planOverlay(
  imageUrl: string,
  widthM: number,
  heightM: number,
  elements: StructuralElement[],
  types: CatalogItem[],
): string {
  const shapes = [...elements]
    // Slabs first so walls and columns are drawn over them.
    .sort((a, b) => order(nameOf(types, a.elementTypeId)) - order(nameOf(types, b.elementTypeId)))
    .map((element) => shape(element, nameOf(types, element.elementTypeId)))
    .join('');

  return `
    <svg class="overlay" viewBox="0 0 ${widthM} ${heightM}" preserveAspectRatio="xMidYMid meet" role="img"
      aria-label="Plano con los elementos detectados por la IA">
      <image href="${escapeHtml(imageUrl)}" x="0" y="0" width="${widthM}" height="${heightM}" class="overlay__image" />
      <g class="overlay__shapes">${shapes}</g>
    </svg>`;
}

function order(type: string): number {
  return type === 'Losa' ? 0 : type === 'Muro' ? 1 : type === 'Viga' ? 3 : 2;
}

function shape(element: StructuralElement, type: string): string {
  const { color } = styleFor(type);
  const title = `<title>${escapeHtml(type)} · confianza ${formatPercent(element.confidence)}</title>`;
  const common = `class="overlay__el" data-id="${element.id}" data-type="${escapeHtml(type)}"`;
  const x1 = element.startX;
  const y1 = element.startY;
  const x2 = element.endX ?? x1;
  const y2 = element.endY ?? y1;

  switch (type) {
    case 'Losa':
      return `<rect ${common} x="${Math.min(x1, x2)}" y="${Math.min(y1, y2)}" width="${Math.abs(x2 - x1)}" height="${Math.abs(y2 - y1)}"
        fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-width="0.05" stroke-dasharray="0.2 0.12">${title}</rect>`;
    case 'Columna':
    case 'Escalera': {
      const w = element.width ?? 0.3;
      const d = element.thickness ?? w;
      return `<rect ${common} x="${x1 - w / 2}" y="${y1 - d / 2}" width="${w}" height="${d}"
        fill="${color}" stroke="#22292e" stroke-width="0.04">${title}</rect>`;
    }
    case 'Viga':
      return `<line ${common} x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="0.09"
        stroke-dasharray="0.3 0.15" stroke-linecap="round">${title}</line>`;
    default: {
      const width = Math.max(0.06, (element.thickness ?? 0.15) + (type === 'Muro' ? 0 : 0.06));
      return `<line ${common} x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}"
        stroke-opacity="${type === 'Muro' ? 0.8 : 0.95}">${title}</line>`;
    }
  }
}
