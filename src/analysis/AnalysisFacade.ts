import { appEvents } from '../core/events/AppEvents.ts';
import { repositories } from '../data/dataSource.ts';
import type { AiAnalysis } from '../models/AiAnalysis.ts';
import type { AiModel, CatalogItem } from '../models/Catalog.ts';
import type { FloorPlan } from '../models/FloorPlan.ts';
import type { StructuralElementInput } from '../models/StructuralElement.ts';
import { logActivity } from '../services/ActivityLogger.ts';
import { CatalogService } from '../services/CatalogService.ts';
import { stateOf, type AnalysisState } from './AnalysisState.ts';
import { AnalyzerFactory } from './AnalyzerFactory.ts';
import type { DetectedElement } from './PlanAnalyzer.ts';

export interface RunOptions {
  plan: FloorPlan;
  model: AiModel;
  onProgress?: (step: string) => void;
}

/**
 * Pattern: Facade — one call (`run`) hides the whole pipeline: create the
 * analysis record, move it through its states, pick and run the analyzer,
 * translate names to catalog ids, save the elements, register the 3D model
 * and write the activity log.
 */
export class AnalysisFacade {
  private readonly analyses = repositories().analyses();
  private readonly models3d = repositories().models3d();

  async run({ plan, model, onProgress }: RunOptions): Promise<AiAnalysis> {
    const catalogs = await CatalogService.getInstance().load();
    let analysis = await this.analyses.create(plan.id, model.id);
    let state: AnalysisState = stateOf(analysis.status);
    const startedAt = performance.now();

    const move = async (next: AnalysisState, changes: Partial<AiAnalysis> = {}) => {
      state = next;
      analysis = await this.analyses.update(analysis.id, { ...changes, status: state.status });
      appEvents.emit('analysis:status', { analysisId: analysis.id, status: state.status });
    };

    await move(state.start());

    try {
      const analyzer = AnalyzerFactory.create(model);
      const output = await analyzer.analyze({
        floorPlanId: plan.id,
        imageUrl: plan.fileUrl,
        scale: plan.scale,
        aiModel: model,
        onProgress,
      });

      onProgress?.('Guardando los elementos detectados');
      const rows = this.toRows(output.elements, catalogs.elementTypes, catalogs.materials);
      await this.analyses.saveElements(analysis.id, rows);
      await this.models3d.create({
        floorPlanId: plan.id,
        aiAnalysisId: analysis.id,
        fileUrl: null,
        format: 'GLB',
        elementCount: rows.length,
      });

      await move(state.complete(), {
        durationMs: Math.round(performance.now() - startedAt),
        rawResponse: JSON.stringify(output.summary),
      });
      logActivity(
        'Análisis completado',
        `${model.name} detectó ${rows.length} elementos en el plano del piso ${plan.floorLevel}.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'El análisis falló por un error desconocido.';
      await move(state.fail(), {
        durationMs: Math.round(performance.now() - startedAt),
        errorMessage: message,
      });
      logActivity('Análisis fallido', `${model.name} no pudo analizar el plano del piso ${plan.floorLevel}: ${message}`);
    }
    return analysis;
  }

  /** Maps element and material names to the ids of the catalogs. */
  private toRows(elements: DetectedElement[], types: CatalogItem[], materials: CatalogItem[]): StructuralElementInput[] {
    const typeId = new Map(types.map((t) => [t.name, t.id]));
    const materialId = new Map(materials.map((m) => [m.name, m.id]));

    return elements
      .filter((element) => typeId.has(element.type))
      .map((element) => ({
        elementTypeId: typeId.get(element.type)!,
        materialId: element.material ? (materialId.get(element.material) ?? null) : null,
        startX: element.startX,
        startY: element.startY,
        endX: element.endX,
        endY: element.endY,
        width: element.width,
        height: element.height,
        thickness: element.thickness,
        confidence: Math.min(1, Math.max(0, element.confidence)),
      }));
  }
}
