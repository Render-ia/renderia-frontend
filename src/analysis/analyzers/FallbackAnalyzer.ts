import type { AnalysisInput, AnalysisOutput, PlanAnalyzer } from '../PlanAnalyzer.ts';

/** Errors that mean the AI service is down or asleep, not that the plan is wrong. */
const SERVICE_DOWN = /servicio de IA|despertando|no responde|c[oó]digo (429|502|503|504)|failed to fetch|network/i;

/**
 * Pattern: Decorator — wraps the analyzer that runs on the server and keeps
 * its interface. When the AI service is down, it runs the same detector in
 * the browser instead, so a plan can always be analyzed. Errors about the
 * plan itself (blank image, no walls) are not hidden.
 */
export class FallbackAnalyzer implements PlanAnalyzer {
  readonly name: string;

  constructor(
    private readonly primary: PlanAnalyzer,
    private readonly fallback: PlanAnalyzer,
    /** Asks whether the AI service answers right now; false skips the server and its wait. */
    private readonly serviceReachable: () => Promise<boolean>,
    /** True when the fallback gives the same result as the server (same detector). */
    private readonly sameResult: boolean,
  ) {
    this.name = primary.name;
  }

  async analyze(input: AnalysisInput): Promise<AnalysisOutput> {
    const reachable = await this.serviceReachable().catch(() => false);
    if (!reachable && this.sameResult) return this.runFallback(input);
    try {
      return await this.primary.analyze(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!SERVICE_DOWN.test(message)) throw error;
      return this.runFallback(input);
    }
  }

  private async runFallback(input: AnalysisInput): Promise<AnalysisOutput> {
    input.onProgress?.('El servicio de IA no responde: se analiza en tu navegador con el mismo detector');
    const output = await this.fallback.analyze(input);
    return {
      elements: output.elements,
      summary: {
        ...output.summary,
        analyzer: `${this.fallback.name} (en el navegador)`,
        fallback: 'El servicio de IA no respondía; el plano se analizó en el navegador.',
      },
    };
  }
}
