/** Row of the `floor_plans` table. */
export interface FloorPlan {
  id: number;
  projectId: number;
  fileName: string;
  /** Public URL of the image (a data URL when running without backend). */
  fileUrl: string;
  floorLevel: number;
  /** Drawing scale written as "1:100". */
  scale: string;
  uploadedAt: string;
}

export interface FloorPlanInput {
  projectId: number;
  fileName: string;
  fileUrl: string;
  floorLevel: number;
  scale: string;
}

export const PLAN_SCALES = ['1:50', '1:75', '1:100', '1:200'] as const;
