/** Rows of the catalog tables: building_types, element_types and materials. */
export interface CatalogItem {
  id: number;
  name: string;
  description: string;
}

export type CatalogName = 'building-types' | 'element-types' | 'materials';

export const CATALOG_LABELS: Record<CatalogName, string> = {
  'building-types': 'Tipos de edificación',
  'element-types': 'Tipos de elemento',
  materials: 'Materiales',
};

/** Element type names seeded in element_types, used by the AI and the 3D viewer. */
export type ElementTypeName =
  | 'Muro'
  | 'Columna'
  | 'Viga'
  | 'Losa'
  | 'Puerta'
  | 'Ventana'
  | 'Escalera';

/** Row of the `ai_models` table. */
export interface AiModel {
  id: number;
  name: string;
  provider: string;
  modelIdentifier: string;
  isActive: boolean;
  isDefault: boolean;
}
