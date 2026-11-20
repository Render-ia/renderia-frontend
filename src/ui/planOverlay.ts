import type { Room } from '../analysis/AnalysisSummary.ts';
import { confidenceLevel, levelInfo } from '../analysis/confidence.ts';
import { styleFor } from '../analysis/elementStyle.ts';
import type { CatalogItem } from '../models/Catalog.ts';
import type { StructuralElement } from '../models/StructuralElement.ts';
import { nameOf } from '../services/CatalogService.ts';
import { formatPercent } from '../utils/format.ts';
import { escapeHtml } from '../utils/html.ts';

export type OverlayColorMode = 'type' | 'confidence';

export interface OverlayOptions {
  /** Color each element by its type (default) or by its confidence level. */
  colorBy?: OverlayColorMode;
  /** Rooms read from the plan, drawn as labeled areas under the elements. */
  rooms?: Room[];
}

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
  options: OverlayOptions = {},
): string {
  const colorOf = (element: StructuralElement, type: string) =>
    options.colorBy === 'confidence' ? levelInfo(confidenceLevel(element.confidence)).color : styleFor(type).color;
  const shapes = [...elements]
    // Slabs first so walls and columns are drawn over them.
    .sort((a, b) => order(nameOf(types, a.elementTypeId)) - order(nameOf(types, b.elementTypeId)))
    .map((element) => {
      const type = nameOf(types, element.elementTypeId);
      return shape(element, type, colorOf(element, type));
    })
    .join('');
  const rooms = (options.rooms ?? []).map(roomShape).join('');

  return `
    <svg class="overlay" viewBox="0 0 ${widthM} ${heightM}" preserveAspectRatio="xMidYMid meet" role="img"
      aria-label="Plano con los elementos detectados por la IA">
      <image href="${escapeHtml(imageUrl)}" x="0" y="0" width="${widthM}" height="${heightM}" class="overlay__image" />
      <g class="overlay__rooms">${rooms}</g>
      <g class="overlay__shapes">${shapes}</g>
      <g class="overlay__draft" data-draft></g>
    </svg>`;
}

function order(type: string): number {
  return type === 'Losa' ? 0 : type === 'Muro' ? 1 : type === 'Viga' ? 3 : 2;
}

function roomShape(room: Room): string {
  const x = Math.min(room.x1, room.x2);
  const y = Math.min(room.y1, room.y2);
  const w = Math.abs(room.x2 - room.x1);
  const h = Math.abs(room.y2 - room.y1);
  const size = Math.max(0.22, Math.min(0.5, Math.min(w, h) / 6));
  return `<g class="overlay__room">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="0.08" />
      <text x="${x + w / 2}" y="${y + h / 2}" font-size="${size}" text-anchor="middle">
        <tspan x="${x + w / 2}" dy="-0.2em">${escapeHtml(room.name)}</tspan>
        <tspan x="${x + w / 2}" dy="1.2em" class="overlay__room-area">${room.areaM2.toFixed(1)} m²</tspan>
      </text>
    </g>`;
}

function shape(element: StructuralElement, type: string, color: string): string {
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
