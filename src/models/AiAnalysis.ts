export type AnalysisStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

/** Row of the `ai_analyses` table. */
export interface AiAnalysis {
  id: number;
  floorPlanId: number;
  aiModelId: number;
  status: AnalysisStatus;
  rawResponse: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
}
