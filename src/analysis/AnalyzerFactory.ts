import { AppConfig } from '../core/config/AppConfig.ts';
import type { AiModel } from '../models/Catalog.ts';
import { ApiClient } from '../core/http/ApiClient.ts';
import { BackendAnalyzer } from './analyzers/BackendAnalyzer.ts';
import { FallbackAnalyzer } from './analyzers/FallbackAnalyzer.ts';
import { LocalVisionAnalyzer } from './analyzers/LocalVisionAnalyzer.ts';
import { SampleResponseAnalyzer } from './analyzers/SampleResponseAnalyzer.ts';
import type { PlanAnalyzer } from './PlanAnalyzer.ts';

/** Asks the backend whether the AI service answers (it gives up quickly). */
async function aiServiceReachable(): Promise<boolean> {
  const caps = await ApiClient.getInstance().get<{ reachable?: boolean }>('/ai/capabilities');
  return caps.reachable !== false;
}

/**
 * Pattern: Factory Method — picks the analyzer strategy for the provider
 * stored in ai_models.provider.
 *
 * With the real backend every model runs in the AI service (renderia-ai):
 * the frontend asks the backend, the backend asks the AI service. If that
 * service is down, the detector runs in the browser (FallbackAnalyzer).
 * Without backend (mock data) the analyzers run in the browser.
 */
export class AnalyzerFactory {
  static create(model: AiModel): PlanAnalyzer {
    if (AppConfig.getInstance().dataSource !== 'mock') {
      // If the AI service is down, the same detector runs in the browser.
      const sample = model.provider === 'mock';
      return new FallbackAnalyzer(
        new BackendAnalyzer(model.name),
        sample ? new SampleResponseAnalyzer() : new LocalVisionAnalyzer(),
        aiServiceReachable,
        sample || model.provider === 'local-vision',
      );
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
      case 'gemini':
        return 'Gemini lee habitaciones, cotas y escala; la geometría la mide el detector. Avisa si las dos lecturas no coinciden.';
      default:
        return `Modelo del proveedor ${model.provider}.`;
    }
  }
}
