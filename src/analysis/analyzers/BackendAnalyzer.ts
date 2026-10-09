import { ApiClient } from '../../core/http/ApiClient.ts';
import type { AnalysisInput, AnalysisOutput, DetectedElement, PlanAnalyzer } from '../PlanAnalyzer.ts';

interface BackendResponse {
  elements: DetectedElement[];
  summary?: Record<string, unknown>;
}

/**
 * Models that run on the server (for example a vision LLM called by the Java
 * backend). The frontend sends which plan and model to use, and receives the
 * elements already measured in meters. See docs/API.md, "POST /ai/analyze".
 */
export class BackendAnalyzer implements PlanAnalyzer {
  readonly name: string;

  constructor(modelName: string) {
    this.name = modelName;
  }

  async analyze(input: AnalysisInput): Promise<AnalysisOutput> {
    input.onProgress?.(`Enviando el plano a ${input.aiModel.name}`);
    const response = await ApiClient.getInstance().post<BackendResponse>('/ai/analyze', {
      floorPlanId: input.floorPlanId,
      aiModelId: input.aiModel.id,
      scale: input.scale,
    });
    if (!Array.isArray(response.elements)) {
      throw new Error('El servidor respondió sin la lista de elementos detectados.');
    }
    return {
      elements: response.elements,
      summary: { analyzer: this.name, provider: input.aiModel.provider, ...response.summary },
    };
  }
}
