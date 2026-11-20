/**
 * What the analyzers report besides the elements, saved in
 * ai_analyses.raw_response as JSON. Older analyses may have only part of it,
 * so everything is optional and read defensively.
 */
export type AssumptionSource = 'assumed' | 'detected' | 'user' | 'confirmed';

export type AssumptionKey =
  | 'scale'
  | 'wallThickness'
  | 'wallHeight'
  | 'columnHeight'
  | 'doorHeight'
  | 'windowHeight'
  | 'beamSize'
  | 'slabThickness'
  | 'slabOutline';

/** `key` is the stable id; `label` and `value` are what the user reads. */
export interface Assumption {
  key: string;
  label: string;
  value: string;
  source: AssumptionSource;
}

export const ASSUMPTION_LABELS: Record<AssumptionKey, string> = {
  scale: 'Escala',
  wallThickness: 'Espesor de muros',
  wallHeight: 'Altura de muros',
  columnHeight: 'Altura de columnas',
  doorHeight: 'Altura de puertas',
  windowHeight: 'Altura de ventanas',
  beamSize: 'Vigas',
  slabThickness: 'Espesor de losa',
  slabOutline: 'Losa',
};

/** Text shown for each source. */
export const SOURCE_LABELS: Record<AssumptionSource, string> = {
  assumed: 'Supuesto',
  detected: 'Detectado',
  user: 'Indicado por ti',
  confirmed: 'Confirmado',
};

export interface Room {
  name: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  areaM2: number;
  confidence: number;
}

export interface Validation {
  reviewedAt: string;
  reviewedBy: string;
}

export interface AnalysisSummary {
  analyzer?: string;
  provider?: string;
  note?: string;
  geometrySource?: string;
  interpretationSource?: string | null;
  scaleText?: string | null;
  warnings: string[];
  assumptions: Assumption[];
  rooms: Room[];
  dimensions: { text: string; meters: number | null }[];
  buildingSizeM?: { width: number; depth: number };
  wallThicknessM?: number;
  validation?: Validation;
  [key: string]: unknown;
}

const row = (key: AssumptionKey, value: string, source: AssumptionSource): Assumption => ({
  key,
  label: ASSUMPTION_LABELS[key],
  value,
  source,
});

/** Values the geometric analyzers use when the plan does not say them. */
export const DEFAULT_ASSUMPTIONS: Assumption[] = [
  row('scale', '', 'user'),
  row('wallHeight', '2.5 m', 'assumed'),
  row('columnHeight', '2.8 m', 'assumed'),
  row('doorHeight', '2.1 m', 'assumed'),
  row('windowHeight', '1.2 m', 'assumed'),
  row('slabThickness', '0.12 m', 'assumed'),
];

/**
 * Assumptions that map to a measure of every element of one type, so that
 * changing the value updates the model (a "Composite" edit). Element types
 * are catalog names from the database.
 */
export const ASSUMPTION_TARGETS: Partial<Record<AssumptionKey, { type: string; field: 'height' | 'thickness' }>> = {
  wallHeight: { type: 'Muro', field: 'height' },
  columnHeight: { type: 'Columna', field: 'height' },
  doorHeight: { type: 'Puerta', field: 'height' },
  windowHeight: { type: 'Ventana', field: 'height' },
  slabThickness: { type: 'Losa', field: 'thickness' },
};

const SOURCES = Object.keys(SOURCE_LABELS) as AssumptionSource[];

/** Older analyses saved Spanish labels and sources; map them to keys. */
const LEGACY_KEYS = Object.fromEntries(Object.entries(ASSUMPTION_LABELS).map(([k, v]) => [v, k]));
const LEGACY_SOURCES: Record<string, AssumptionSource> = {
  supuesto: 'assumed',
  detectado: 'detected',
  'indicado por el usuario': 'user',
  confirmado: 'confirmed',
};

function readAssumption(raw: Record<string, unknown>): Assumption | null {
  const label = typeof raw.label === 'string' ? raw.label : typeof raw.field === 'string' ? raw.field : null;
  const key = typeof raw.key === 'string' ? raw.key : label ? LEGACY_KEYS[label] ?? label : null;
  if (!key) return null;
  const rawSource = String(raw.source ?? '');
  const source = SOURCES.includes(rawSource as AssumptionSource)
    ? (rawSource as AssumptionSource)
    : LEGACY_SOURCES[rawSource] ?? 'assumed';
  return {
    key,
    label: ASSUMPTION_LABELS[key as AssumptionKey] ?? label ?? key,
    value: String(raw.value ?? ''),
    source,
  };
}

export function parseSummary(raw: string | null, scale: string): AnalysisSummary {
  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(raw ?? '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed as Record<string, unknown>;
  } catch {
    // Older or foreign responses may not be JSON.
  }

  const strings = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);
  const assumptions = Array.isArray(data.assumptions)
    ? (data.assumptions as unknown[])
        .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
        .map(readAssumption)
        .filter((a): a is Assumption => a !== null)
    : DEFAULT_ASSUMPTIONS.map((a) => ({ ...a }));
  const scaleRow = assumptions.find((a) => a.key === 'scale');
  if (scaleRow && !scaleRow.value) scaleRow.value = scale;

  const rooms = Array.isArray(data.rooms)
    ? (data.rooms as Partial<Room>[]).filter(
        (r): r is Room => !!r && typeof r.name === 'string' && [r.x1, r.y1, r.x2, r.y2].every((n) => typeof n === 'number'),
      )
    : [];
  const dimensions = Array.isArray(data.dimensions)
    ? (data.dimensions as { text?: unknown; meters?: unknown }[])
        .filter((d) => d && typeof d.text === 'string')
        .map((d) => ({ text: String(d.text), meters: typeof d.meters === 'number' ? d.meters : null }))
    : [];

  return {
    ...data,
    warnings: strings(data.warnings),
    assumptions,
    rooms,
    dimensions,
  } as AnalysisSummary;
}

export function confirmAssumption(summary: AnalysisSummary, key: string, value?: string): AnalysisSummary {
  return {
    ...summary,
    assumptions: summary.assumptions.map((a) =>
      a.key === key ? { ...a, value: value ?? a.value, source: 'confirmed' as const } : a,
    ),
  };
}

/** How many assumptions still wait for the user's confirmation. */
export function pendingAssumptions(summary: AnalysisSummary): number {
  return summary.assumptions.filter((a) => a.source === 'assumed').length;
}

/** Reads "2.5 m" or "2,5" as meters; null when it is not a number between 1 cm and 50 m. */
export function parseMeters(value: string): number | null {
  const number = Number(value.replace(',', '.').replace(/m$/i, '').trim());
  return Number.isFinite(number) && number >= 0.01 && number <= 50 ? Number(number.toFixed(3)) : null;
}
