import type { AiModel, ElementTypeName } from '../models/Catalog.ts';

/**
 * Element found by an analyzer, before it is saved. Coordinates and sizes are
 * in meters on the plan (x to the right, y downwards, origin at the top-left
 * corner of the image).
 */
export interface DetectedElement {
  type: ElementTypeName;
  /** Material name from the materials catalog, or null when unknown. */
  material: string | null;
  startX: number;
  startY: number;
  endX: number | null;
  endY: number | null;
  /** Size across the element (columns: side along x; beams: section width). */
  width: number | null;
  /** Vertical size in the 3D model. */
  height: number | null;
  /** Wall or slab thickness; for columns, side along y. */
  thickness: number | null;
  confidence: number;
}

export interface AnalysisInput {
  floorPlanId: number;
  imageUrl: string;
  scale: string;
  aiModel: AiModel;
  /** Reports the current step, so the screen can show progress. */
  onProgress?: (step: string) => void;
}

export interface AnalysisOutput {
  elements: DetectedElement[];
  /** Technical details saved in ai_analyses.raw_response. */
  summary: Record<string, unknown>;
}

/**
 * Pattern: Strategy — every AI provider (local vision, sample response,
 * backend models) reads a plan in its own way behind this same interface.
 */
export interface PlanAnalyzer {
  readonly name: string;
  analyze(input: AnalysisInput): Promise<AnalysisOutput>;
}
