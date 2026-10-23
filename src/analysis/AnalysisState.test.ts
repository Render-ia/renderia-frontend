import { describe, expect, it } from 'vitest';
import { CompletedState, FailedState, PendingState, ProcessingState, stateOf, statusBadge } from './AnalysisState.ts';

describe('AnalysisState (patrón State)', () => {
  it('follows the normal life cycle: pending → processing → completed', () => {
    const done = new PendingState().start().complete();
    expect(done).toBeInstanceOf(CompletedState);
    expect(done.isFinal).toBe(true);
    expect(done.hasResults).toBe(true);
  });

  it('a failed analysis can be retried and goes back to the queue', () => {
    const failed = new ProcessingState().fail();
    expect(failed).toBeInstanceOf(FailedState);
    expect(failed.hasResults).toBe(false);
    expect(failed.retry()).toBeInstanceOf(PendingState);
  });

  it('rejects invalid jumps with a clear message', () => {
    expect(() => new CompletedState().start()).toThrow('No se puede iniciar un análisis en estado "Completado".');
    expect(() => new PendingState().complete()).toThrow('completar');
    expect(() => new ProcessingState().retry()).toThrow('reintentar');
  });

  it('builds the state stored in the database', () => {
    expect(stateOf('PENDING')).toBeInstanceOf(PendingState);
    expect(stateOf('PROCESSING')).toBeInstanceOf(ProcessingState);
    expect(stateOf('COMPLETED')).toBeInstanceOf(CompletedState);
    expect(stateOf('FAILED')).toBeInstanceOf(FailedState);
  });

  it('shows each status as a badge with its tone', () => {
    expect(statusBadge('COMPLETED')).toContain('badge--success');
    expect(statusBadge('FAILED')).toContain('Falló');
  });
});
