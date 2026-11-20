import { MODEL_COLORS, styleFor } from '../analysis/elementStyle.ts';

/**
 * Presentation settings of the 3D studio: camera views, disciplines and
 * finish palettes. They only change how the model looks, never its geometry.
 */

export type ViewName = 'iso' | 'top' | 'front' | 'back' | 'left' | 'right';

export const VIEWS: { name: ViewName; label: string }[] = [
  { name: 'iso', label: '3D' },
  { name: 'top', label: 'Planta' },
  { name: 'front', label: 'Frente' },
  { name: 'back', label: 'Atrás' },
  { name: 'left', label: 'Izquierda' },
  { name: 'right', label: 'Derecha' },
];

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
}

/**
 * Camera pose for each view of a building of the given footprint (meters).
 * `aspect` pushes the camera back on narrow screens so the model still fits.
 */
export function cameraPose(view: ViewName, width: number, depth: number, aspect = 1.6): CameraPose {
  const reach = Math.max(width, depth) * Math.max(1, 0.9 / aspect);
  const eye = 1.4;
  switch (view) {
    case 'top':
      return { position: [0, reach * 1.6, 0.01], target: [0, 0, 0] };
    case 'front':
      return { position: [0, eye, depth / 2 + reach * 1.4], target: [0, eye, 0] };
    case 'back':
      return { position: [0, eye, -(depth / 2 + reach * 2)], target: [0, eye, 0] };
    case 'left':
      return { position: [-(width / 2 + reach * 2), eye, 0], target: [0, eye, 0] };
    case 'right':
      return { position: [width / 2 + reach * 1.4, eye, 0], target: [0, eye, 0] };
    default:
      return { position: [reach * 0.85, reach * 0.9, reach * 1.05], target: [0, 1, 0] };
  }
}

/** Disciplines group the element types like the layers of a CAD drawing. */
export type Discipline = 'architecture' | 'structure' | 'other';

export const DISCIPLINES: { id: Discipline; label: string; types: string[] }[] = [
  { id: 'architecture', label: 'Arquitectura', types: ['Muro', 'Puerta', 'Ventana'] },
  { id: 'structure', label: 'Estructura', types: ['Columna', 'Viga', 'Losa', 'Escalera'] },
  { id: 'other', label: 'Otros', types: [] },
];

export function disciplineOf(type: string): Discipline {
  return DISCIPLINES.find((d) => d.types.includes(type))?.id ?? 'other';
}

/** Technical color modes (engineer) and finish styles (client). */
export type ColorMode = 'model' | 'type' | 'material' | FinishStyle;
export type FinishStyle = 'modern' | 'tropical' | 'rustic' | 'minimalist';

export const TECHNICAL_MODES: { mode: ColorMode; label: string }[] = [
  { mode: 'model', label: 'Maqueta' },
  { mode: 'type', label: 'Por tipo' },
  { mode: 'material', label: 'Por material' },
];

export const FINISHES: { mode: FinishStyle; label: string; colors: Record<string, string> }[] = [
  {
    mode: 'modern',
    label: 'Moderno',
    colors: { Muro: '#f2f1ee', Columna: '#d9d9d6', Viga: '#bfc3c7', Losa: '#7d858c', Puerta: '#2f3336', Ventana: '#7fb4d1' },
  },
  {
    mode: 'tropical',
    label: 'Tropical',
    colors: { Muro: '#f4e9d4', Columna: '#a8744a', Viga: '#8c5a33', Losa: '#c9b48f', Puerta: '#7a4b28', Ventana: '#8fd0c4' },
  },
  {
    mode: 'rustic',
    label: 'Rústico',
    colors: { Muro: '#c98b62', Columna: '#8a8178', Viga: '#6e4a2f', Losa: '#9c8f80', Puerta: '#5c3b22', Ventana: '#a7c3c9' },
  },
  {
    mode: 'minimalist',
    label: 'Minimalista',
    colors: { Muro: '#ffffff', Columna: '#f3f3f3', Viga: '#e8e8e8', Losa: '#d6d6d6', Puerta: '#cfcac2', Ventana: '#bcd7e6' },
  },
];

/** Colors used when the model is colored by construction material. */
export const MATERIAL_COLORS: Record<string, string> = {
  'Concreto reforzado': '#a9afad',
  Ladrillo: '#b0613e',
  Acero: '#6d7b86',
  Madera: '#9a6b3e',
  Drywall: '#e6e3dc',
};
const NO_MATERIAL = '#8fc6dd';

export function isFinish(mode: ColorMode): mode is FinishStyle {
  return FINISHES.some((f) => f.mode === mode);
}

/** Color of one element for the chosen mode. */
export function colorFor(mode: ColorMode, type: string, material: string | null): string {
  switch (mode) {
    case 'type':
      return styleFor(type).color;
    case 'material':
      return (material && MATERIAL_COLORS[material]) ?? NO_MATERIAL;
    case 'model':
      return MODEL_COLORS[type] ?? MODEL_COLORS.Muro;
    default: {
      const finish = FINISHES.find((f) => f.mode === mode)!;
      return finish.colors[type] ?? finish.colors.Muro;
    }
  }
}

/** Size of a high-resolution capture: the long side reaches `longSide` pixels. */
export function captureSize(width: number, height: number, longSide = 3840): { width: number; height: number; scale: number } {
  const scale = longSide / Math.max(1, width, height);
  return { width: Math.round(width * scale), height: Math.round(height * scale), scale };
}
