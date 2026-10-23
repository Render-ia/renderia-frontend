import type { ElementCommand } from './ElementCommand.ts';

/**
 * Keeps the corrections already made so they can be undone and redone.
 * Running a new command clears the redo list, like any editor.
 */
export class CommandHistory {
  private readonly done: ElementCommand[] = [];
  private readonly undone: ElementCommand[] = [];
  private busy = false;

  constructor(private readonly limit = 50) {}

  get canUndo(): boolean {
    return !this.busy && this.done.length > 0;
  }

  get canRedo(): boolean {
    return !this.busy && this.undone.length > 0;
  }

  /** Label of the command that `undo` would revert. */
  get nextUndo(): string | null {
    return this.done.at(-1)?.label ?? null;
  }

  /** Label of the command that `redo` would apply again. */
  get nextRedo(): string | null {
    return this.undone.at(-1)?.label ?? null;
  }

  async run(command: ElementCommand): Promise<void> {
    await this.step(() => command.execute());
    this.done.push(command);
    if (this.done.length > this.limit) this.done.shift();
    this.undone.length = 0;
  }

  /** Reverts the last command. Returns it, or null when there was nothing to undo. */
  async undo(): Promise<ElementCommand | null> {
    const command = this.done.at(-1);
    if (!command || this.busy) return null;
    await this.step(() => command.undo());
    this.undone.push(this.done.pop()!);
    return command;
  }

  /** Applies again the last undone command. Returns it, or null when there was nothing to redo. */
  async redo(): Promise<ElementCommand | null> {
    const command = this.undone.at(-1);
    if (!command || this.busy) return null;
    await this.step(() => command.execute());
    this.done.push(this.undone.pop()!);
    return command;
  }

  /** Runs one step at a time; a failed step leaves both lists as they were. */
  private async step(action: () => Promise<void>): Promise<void> {
    if (this.busy) throw new Error('Espera a que termine el cambio anterior.');
    this.busy = true;
    try {
      await action();
    } finally {
      this.busy = false;
    }
  }
}
