/**
 * Row of the `structural_elements` table. Coordinates and sizes are in
 * meters, measured on the floor plan (x to the right, y downwards).
 */
export interface StructuralElement {
  id: number;
  aiAnalysisId: number;
  elementTypeId: number;
  materialId: number | null;
  startX: number;
  startY: number;
  endX: number | null;
  endY: number | null;
  width: number | null;
  height: number | null;
  thickness: number | null;
  /** Value between 0 and 1. */
  confidence: number;
}

export type StructuralElementInput = Omit<StructuralElement, 'id' | 'aiAnalysisId'>;
