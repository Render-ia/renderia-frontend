import type { AnalysisStatus } from '../models/AiAnalysis.ts';

export type StateTone = 'neutral' | 'info' | 'success' | 'danger';

/**
 * Pattern: State — the life cycle of an analysis (ai_analyses.status). Each
 * state knows how it is shown and which transitions are allowed, so invalid
 * jumps (e.g. COMPLETED → PROCESSING) are rejected in one place.
 */
export abstract class AnalysisState {
  abstract readonly status: AnalysisStatus;
  abstract readonly label: string;
  abstract readonly tone: StateTone;
  abstract readonly description: string;

  /** The analysis finished (well or badly) and will not change by itself. */
  get isFinal(): boolean {
    return false;
  }

  /** Detected elements and the 3D model are available. */
  get hasResults(): boolean {
    return false;
  }

  start(): AnalysisState {
    throw this.invalid('iniciar');
  }

  complete(): AnalysisState {
    throw this.invalid('completar');
  }

  fail(): AnalysisState {
    throw this.invalid('marcar como fallido');
  }

  retry(): AnalysisState {
    throw this.invalid('reintentar');
  }

  private invalid(action: string): Error {
    return new Error(`No se puede ${action} un análisis en estado "${this.label}".`);
  }
}

export class PendingState extends AnalysisState {
  readonly status = 'PENDING' as const;
  readonly label = 'En cola';
  readonly tone = 'neutral' as const;
  readonly description = 'El análisis está esperando su turno.';

  start(): AnalysisState {
    return new ProcessingState();
  }

  fail(): AnalysisState {
    return new FailedState();
  }
}

export class ProcessingState extends AnalysisState {
  readonly status = 'PROCESSING' as const;
  readonly label = 'Analizando';
  readonly tone = 'info' as const;
  readonly description = 'La IA está leyendo el plano y detectando elementos.';

  complete(): AnalysisState {
    return new CompletedState();
  }

  fail(): AnalysisState {
    return new FailedState();
  }
}

export class CompletedState extends AnalysisState {
  readonly status = 'COMPLETED' as const;
  readonly label = 'Completado';
  readonly tone = 'success' as const;
  readonly description = 'Los elementos detectados y el modelo 3D están listos.';

  get isFinal(): boolean {
    return true;
  }

  get hasResults(): boolean {
    return true;
  }
}

export class FailedState extends AnalysisState {
  readonly status = 'FAILED' as const;
  readonly label = 'Falló';
  readonly tone = 'danger' as const;
  readonly description = 'El análisis no terminó. Revisa el mensaje de error e inténtalo de nuevo.';

  get isFinal(): boolean {
    return true;
  }

  retry(): AnalysisState {
    return new PendingState();
  }
}

/** Builds the state object for a status stored in the database. */
export function stateOf(status: AnalysisStatus): AnalysisState {
  switch (status) {
    case 'PENDING':
      return new PendingState();
    case 'PROCESSING':
      return new ProcessingState();
    case 'COMPLETED':
      return new CompletedState();
    case 'FAILED':
      return new FailedState();
  }
}

/** Badge markup for a status. */
export function statusBadge(status: AnalysisStatus): string {
  const state = stateOf(status);
  return `<span class="badge badge--${state.tone}" title="${state.description}">${state.label}</span>`;
}
