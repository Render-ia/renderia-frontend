/**
 * Deterministic quantity take-off from the validated elements.
 *
 * Every number comes from a formula over the stored geometry plus a short
 * list of parameters the user can see and change. Nothing here calls an AI:
 * the copilot may explain these quantities, but never computes them.
 */

/** One element with its catalog names resolved. */
export interface TakeoffElement {
  id: number;
  type: string;
  material: string | null;
  startX: number;
  startY: number;
  endX: number | null;
  endY: number | null;
  width: number | null;
  height: number | null;
  thickness: number | null;
}

export interface TakeoffParams {
  wallHeight: number;
  wallThickness: number;
  columnHeight: number;
  doorHeight: number;
  windowHeight: number;
  beamWidth: number;
  beamDepth: number;
  slabThickness: number;
  /** Masonry units per square meter (clay block No. 5 is about 13). */
  unitsPerM2: number;
  /** Reinforcement ratios, kg of steel per m³ of concrete. */
  steelColumns: number;
  steelBeams: number;
  steelSlab: number;
  /** Waste factors as fractions (0.05 = 5 %). */
  masonryWaste: number;
  concreteWaste: number;
}

export const DEFAULT_PARAMS: TakeoffParams = {
  wallHeight: 2.5,
  wallThickness: 0.15,
  columnHeight: 2.8,
  doorHeight: 2.1,
  windowHeight: 1.2,
  beamWidth: 0.25,
  beamDepth: 0.35,
  slabThickness: 0.12,
  unitsPerM2: 13,
  steelColumns: 160,
  steelBeams: 130,
  steelSlab: 90,
  masonryWaste: 0.05,
  concreteWaste: 0.03,
};

/** Labels and units of the parameters, for the form the user edits. */
export const PARAM_FIELDS: { key: keyof TakeoffParams; label: string; unit: string; percent?: boolean }[] = [
  { key: 'unitsPerM2', label: 'Unidades de mampostería por m²', unit: 'und/m²' },
  { key: 'masonryWaste', label: 'Desperdicio de mampostería', unit: '%', percent: true },
  { key: 'concreteWaste', label: 'Desperdicio de concreto', unit: '%', percent: true },
  { key: 'steelColumns', label: 'Cuantía de acero en columnas', unit: 'kg/m³' },
  { key: 'steelBeams', label: 'Cuantía de acero en vigas', unit: 'kg/m³' },
  { key: 'steelSlab', label: 'Cuantía de acero en losa', unit: 'kg/m³' },
];

export type Unit = 'm' | 'm²' | 'm³' | 'kg' | 'und';

export interface QuantityLine {
  /** Stable id, also used to match budget prices. */
  id: QuantityId;
  chapter: string;
  item: string;
  unit: Unit;
  quantity: number;
  /** How the number was obtained, in words the user can check. */
  method: string;
}

export type QuantityId =
  | 'masonry'
  | 'masonryUnits'
  | 'plaster'
  | 'paint'
  | 'concreteColumns'
  | 'concreteBeams'
  | 'concreteSlab'
  | 'steel'
  | 'formwork'
  | 'doors'
  | 'windows';

export interface Takeoff {
  lines: QuantityLine[];
  /** Figures shown as context, not priced. */
  facts: { wallLength: number; grossWallArea: number; openingArea: number; footprint: number; elementsUsed: number };
  /** Things the user should know about the numbers. */
  notes: string[];
}

const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;
/** Numbers inside the method text, written the Colombian way (12,5). */
const fmt = (value: number, digits = 2) => round(value, digits).toLocaleString('es-CO', { maximumFractionDigits: digits });

function length(e: TakeoffElement): number {
  if (e.endX === null || e.endY === null) return 0;
  return Math.hypot(e.endX - e.startX, e.endY - e.startY);
}

/** True when the opening lies on a wall segment (drawn inside the wall) instead of in a gap between walls. */
export function isInsideWall(opening: TakeoffElement, walls: TakeoffElement[]): boolean {
  const len = length(opening);
  if (len === 0) return false;
  const ox = (opening.startX + (opening.endX ?? opening.startX)) / 2;
  const oy = (opening.startY + (opening.endY ?? opening.startY)) / 2;
  return walls.some((wall) => {
    const wl = length(wall);
    if (wl === 0) return false;
    // Distance from the opening center to the wall line, and position along it.
    const dx = (wall.endX! - wall.startX) / wl;
    const dy = (wall.endY! - wall.startY) / wl;
    const along = (ox - wall.startX) * dx + (oy - wall.startY) * dy;
    const across = Math.abs((ox - wall.startX) * dy - (oy - wall.startY) * dx);
    const tolerance = Math.max(0.1, (wall.thickness ?? 0.15) / 2 + 0.05);
    return across <= tolerance && along > 0.05 && along < wl - 0.05;
  });
}

export function computeTakeoff(elements: TakeoffElement[], params: TakeoffParams = DEFAULT_PARAMS): Takeoff {
  const p = params;
  const of = (type: string) => elements.filter((e) => e.type === type);
  const walls = of('Muro');
  const columns = of('Columna');
  const beams = of('Viga');
  const slabs = of('Losa');
  const doors = of('Puerta');
  const windows = of('Ventana');
  const notes: string[] = [];

  // Walls: gross area of the drawn segments.
  let wallLength = 0;
  let grossWallArea = 0;
  let wallVolume = 0;
  for (const wall of walls) {
    const l = length(wall);
    const h = wall.height ?? p.wallHeight;
    wallLength += l;
    grossWallArea += l * h;
    wallVolume += l * h * (wall.thickness ?? p.wallThickness);
  }

  // Openings: inside a wall they are subtracted; in a gap the wall above (and
  // below, for windows) is added, because that masonry is not in any segment.
  let openingArea = 0;
  let deducted = 0;
  let added = 0;
  for (const opening of [...doors, ...windows]) {
    const isDoor = opening.type === 'Puerta';
    const w = opening.width ?? length(opening);
    const h = opening.height ?? (isDoor ? p.doorHeight : p.windowHeight);
    openingArea += w * h;
    if (isInsideWall(opening, walls)) {
      deducted += w * h;
    } else {
      added += w * Math.max(0, p.wallHeight - h);
    }
  }
  const masonry = Math.max(0, grossWallArea - deducted + added);
  if (walls.length === 0) notes.push('No hay muros en el análisis: la mampostería, el pañete y la pintura salen en cero.');

  // Concrete.
  let columnVolume = 0;
  let columnForm = 0;
  for (const c of columns) {
    const w = c.width ?? 0.3;
    const t = c.thickness ?? w;
    const h = c.height ?? p.columnHeight;
    columnVolume += w * t * h;
    columnForm += 2 * (w + t) * h;
  }
  let beamVolume = 0;
  let beamForm = 0;
  for (const b of beams) {
    const l = length(b);
    const w = b.width ?? p.beamWidth;
    const d = b.height ?? p.beamDepth;
    beamVolume += l * w * d;
    beamForm += l * (2 * d + w);
  }
  let slabArea = 0;
  let slabVolume = 0;
  for (const s of slabs) {
    const area = Math.abs((s.endX ?? s.startX) - s.startX) * Math.abs((s.endY ?? s.startY) - s.startY);
    slabArea += area;
    slabVolume += area * (s.thickness ?? p.slabThickness);
  }
  if (slabs.length === 0) notes.push('No hay losa en el análisis: el concreto de losa sale en cero.');

  const waste = 1 + p.concreteWaste;
  const steel = columnVolume * p.steelColumns + beamVolume * p.steelBeams + slabVolume * p.steelSlab;
  const pct = (v: number) => `${fmt(v * 100, 1)} %`;

  const lines: QuantityLine[] = [
    {
      id: 'masonry',
      chapter: 'Mampostería',
      item: 'Muro en mampostería',
      unit: 'm²',
      quantity: round(masonry * (1 + p.masonryWaste)),
      method: `Σ largo × alto de ${walls.length} muros (${fmt(grossWallArea)} m²), − vanos dentro de muros (${fmt(deducted)} m²), + dinteles y antepechos sobre vanos en huecos (${fmt(added)} m²), + ${pct(p.masonryWaste)} de desperdicio.`,
    },
    {
      id: 'masonryUnits',
      chapter: 'Mampostería',
      item: 'Unidades de mampostería',
      unit: 'und',
      quantity: Math.ceil(masonry * (1 + p.masonryWaste) * p.unitsPerM2),
      method: `Área de mampostería × ${p.unitsPerM2} und/m², con desperdicio.`,
    },
    {
      id: 'plaster',
      chapter: 'Acabados',
      item: 'Pañete en muros (dos caras)',
      unit: 'm²',
      quantity: round(masonry * 2),
      method: 'Área neta de mampostería × 2 caras.',
    },
    {
      id: 'paint',
      chapter: 'Acabados',
      item: 'Pintura en muros (dos caras)',
      unit: 'm²',
      quantity: round(masonry * 2),
      method: 'Igual al pañete: área neta × 2 caras.',
    },
    {
      id: 'concreteColumns',
      chapter: 'Estructura',
      item: 'Concreto en columnas',
      unit: 'm³',
      quantity: round(columnVolume * waste, 3),
      method: `Σ ancho × espesor × alto de ${columns.length} columnas (${fmt(columnVolume, 3)} m³), + ${pct(p.concreteWaste)}.`,
    },
    {
      id: 'concreteBeams',
      chapter: 'Estructura',
      item: 'Concreto en vigas',
      unit: 'm³',
      quantity: round(beamVolume * waste, 3),
      method: `Σ largo × ancho × peralte de ${beams.length} vigas (${fmt(beamVolume, 3)} m³), + ${pct(p.concreteWaste)}.`,
    },
    {
      id: 'concreteSlab',
      chapter: 'Estructura',
      item: 'Concreto en losa',
      unit: 'm³',
      quantity: round(slabVolume * waste, 3),
      method: `Área de losa (${fmt(slabArea)} m²) × espesor, + ${pct(p.concreteWaste)}.`,
    },
    {
      id: 'steel',
      chapter: 'Estructura',
      item: 'Acero de refuerzo (estimado)',
      unit: 'kg',
      quantity: Math.round(steel),
      method: `Estimación por cuantía: columnas ${p.steelColumns}, vigas ${p.steelBeams} y losa ${p.steelSlab} kg/m³. Se reemplaza por el despiece del diseño estructural.`,
    },
    {
      id: 'formwork',
      chapter: 'Estructura',
      item: 'Formaleta',
      unit: 'm²',
      quantity: round(columnForm + beamForm + slabArea),
      method: 'Perímetro × alto en columnas, fondo y costados en vigas, y área de losa.',
    },
    {
      id: 'doors',
      chapter: 'Carpintería',
      item: 'Puertas',
      unit: 'und',
      quantity: doors.length,
      method: 'Conteo de puertas del análisis.',
    },
    {
      id: 'windows',
      chapter: 'Carpintería',
      item: 'Ventanas',
      unit: 'm²',
      quantity: round(windows.reduce((sum, w) => sum + (w.width ?? length(w)) * (w.height ?? p.windowHeight), 0)),
      method: `Σ ancho × alto de ${windows.length} ventanas.`,
    },
  ];

  return {
    lines,
    facts: {
      wallLength: round(wallLength),
      grossWallArea: round(grossWallArea),
      openingArea: round(openingArea),
      footprint: round(slabArea),
      elementsUsed: elements.length,
    },
    notes,
  };
}
