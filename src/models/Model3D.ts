/** Row of the `models_3d` table. */
export interface Model3D {
  id: number;
  floorPlanId: number;
  aiAnalysisId: number;
  fileUrl: string | null;
  format: string;
  elementCount: number;
  createdAt: string;
}
