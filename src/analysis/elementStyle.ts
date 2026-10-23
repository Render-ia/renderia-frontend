import type { ElementTypeName } from '../models/Catalog.ts';

export interface ElementStyle {
  /** Color used in the plan overlay, the legend and the 3D model. */
  color: string;
  label: string;
}

/** One color per element type, shared by the overlay and the 3D viewer. */
export const ELEMENT_STYLES: Record<ElementTypeName, ElementStyle> = {
  Muro: { color: '#2f6f99', label: 'Muros' },
  Columna: { color: '#e8c547', label: 'Columnas' },
  Viga: { color: '#b5532f', label: 'Vigas' },
  Losa: { color: '#9aa3a0', label: 'Losas' },
  Puerta: { color: '#2f8a57', label: 'Puertas' },
  Ventana: { color: '#58b4d8', label: 'Ventanas' },
  Escalera: { color: '#7a5aa6', label: 'Escaleras' },
};

const FALLBACK: ElementStyle = { color: '#7d8a91', label: 'Otros' };

export function styleFor(typeName: string): ElementStyle {
  return ELEMENT_STYLES[typeName as ElementTypeName] ?? FALLBACK;
}

/** Order in which types are listed in legends. */
export const TYPE_ORDER: ElementTypeName[] = ['Muro', 'Columna', 'Viga', 'Losa', 'Puerta', 'Ventana', 'Escalera'];

/** Architectural model look used by the 3D viewer: white walls and columns, basswood beams. */
export const MODEL_COLORS: Record<string, string> = {
  Muro: '#e9edf1',
  Columna: '#f7f8fa',
  Viga: '#c9a979',
  Losa: '#8c9aab',
  Puerta: '#b98b5e',
  Ventana: '#9fd2ec',
  Escalera: '#c9a979',
};
