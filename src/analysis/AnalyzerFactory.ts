import type { AiModel } from '../models/Catalog.ts';
import { BackendAnalyzer } from './analyzers/BackendAnalyzer.ts';
import { LocalVisionAnalyzer } from './analyzers/LocalVisionAnalyzer.ts';
import { SampleResponseAnalyzer } from './analyzers/SampleResponseAnalyzer.ts';
import type { PlanAnalyzer } from './PlanAnalyzer.ts';

/**
 * Pattern: Factory Method — picks the analyzer strategy for the provider
 * stored in ai_models.provider. Adding a provider means adding one case here.
 */
export class AnalyzerFactory {
  static create(model: AiModel): PlanAnalyzer {
    switch (model.provider) {
      case 'mock':
        return new SampleResponseAnalyzer();
      case 'local-vision':
        return new LocalVisionAnalyzer();
      default:
        return new BackendAnalyzer(model.name);
    }
  }

  /** Short explanation shown next to each model in the selector. */
  static describe(model: AiModel): string {
    switch (model.provider) {
      case 'mock':
        return 'Devuelve siempre el resultado del plano de ejemplo. Sirve para probar el flujo.';
      case 'local-vision':
        return 'Lee el plano en tu navegador: detecta muros, columnas, puertas, ventanas y vigas.';
      default:
        return `Se ejecuta en el servidor con el proveedor ${model.provider}.`;
    }
  }
}
