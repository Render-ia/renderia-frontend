import type { AnalysisSummary } from '../AnalysisSummary.ts';
import type { ElementCommand } from './ElementCommand.ts';

/** Where the analysis summary (assumptions, review state) is read and saved. */
export interface SummaryStore {
  current(): AnalysisSummary;
  save(summary: AnalysisSummary): Promise<void>;
}

/**
 * Replaces the analysis summary, for example to confirm an assumption or
 * mark the analysis as reviewed. Undo puts the previous summary back.
 * It usually travels inside a CompositeCommand with the element edits that
 * the same decision causes.
 */
export class UpdateSummaryCommand implements ElementCommand {
  private before: AnalysisSummary | null = null;

  constructor(
    private readonly store: SummaryStore,
    private readonly next: AnalysisSummary,
    readonly label: string,
  ) {}

  async execute(): Promise<void> {
    this.before = this.store.current();
    await this.store.save(this.next);
  }

  async undo(): Promise<void> {
    if (this.before) await this.store.save(this.before);
  }
}
