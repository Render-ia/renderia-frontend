import { AppConfig } from '../core/config/AppConfig.ts';
import type { AiModel } from '../models/Catalog.ts';
import { BackendAnalyzer } from './analyzers/BackendAnalyzer.ts';
import { LocalVisionAnalyzer } from './analyzers/LocalVisionAnalyzer.ts';
import { SampleResponseAnalyzer } from './analyzers/SampleResponseAnalyzer.ts';
import type { PlanAnalyzer } from './PlanAnalyzer.ts';

/**
 * Pattern: Factory Method — picks the analyzer strategy for the provider
 * stored in ai_models.provider.
 *
 * With the real backend every model runs in the AI service (renderia-ai):
 * the frontend asks the backend, the backend asks the AI service. Without
 * backend (mock data) the analyzers run in the browser.
 */
export class AnalyzerFactory {
  static create(model: AiModel): PlanAnalyzer {
    if (AppConfig.getInstance().dataSource !== 'mock') {
      return new BackendAnalyzer(model.name);
    }
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
        return 'Visión por computador: detecta muros, columnas, puertas, ventanas y vigas.';
      default:
        return `Modelo del proveedor ${model.provider}.`;
    }
  }
}
