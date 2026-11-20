import { ApiClient } from '../../core/http/ApiClient.ts';
import type { BudgetInputs, BudgetRepository } from '../repositories.ts';

/** /analyses/{id}/budget-inputs: saved in the database, the same on every device. */
export class ApiBudgetRepository implements BudgetRepository {
  private readonly api = ApiClient.getInstance();

  find(analysisId: number): Promise<BudgetInputs | null> {
    return this.api.get<BudgetInputs>(`/analyses/${analysisId}/budget-inputs`);
  }

  async save(analysisId: number, inputs: BudgetInputs): Promise<void> {
    await this.api.put<BudgetInputs>(`/analyses/${analysisId}/budget-inputs`, inputs);
  }
}
