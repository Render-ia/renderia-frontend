import { LocalStore } from '../../core/storage/LocalStore.ts';
import type { BudgetInputs, BudgetRepository } from '../repositories.ts';

/** In the demo without a backend, the browser storage is the database. */
export class MockBudgetRepository implements BudgetRepository {
  async find(analysisId: number): Promise<BudgetInputs | null> {
    return LocalStore.read<BudgetInputs | null>(this.key(analysisId), null);
  }

  async save(analysisId: number, inputs: BudgetInputs): Promise<void> {
    if (!LocalStore.write(this.key(analysisId), inputs)) {
      throw new Error('El navegador no dejó guardar el presupuesto. Revisa el espacio disponible.');
    }
  }

  private key(analysisId: number): string {
    return `renderia.budget.${analysisId}`;
  }
}
