import type { StructuralElement, StructuralElementInput } from '../../models/StructuralElement.ts';

/** Measures that a person can correct; coordinates stay as detected. */
export type MeasureField = 'height' | 'thickness' | 'width';

export type ElementChanges = {
  elementTypeId?: number;
  materialId?: number | null;
  height?: number | null;
  thickness?: number | null;
  width?: number | null;
};

const CHANGE_LABELS: Record<keyof ElementChanges, string> = {
  elementTypeId: 'cambio de tipo',
  materialId: 'cambio de material',
  height: 'cambio de altura',
  thickness: 'cambio de espesor',
  width: 'cambio de ancho',
};

/** What the commands act on: the analysis' element list and where it is saved. */
export interface ElementReceiver {
  readonly elements: StructuralElement[];
  update(element: StructuralElement, changes: ElementChanges): Promise<StructuralElement>;
  remove(element: StructuralElement): Promise<void>;
  /** Saves the element again; the store gives it a new id. */
  restore(input: StructuralElementInput): Promise<StructuralElement>;
}

/**
 * A correction made to the detected elements.
 *
 * Pattern: Command — each correction is an object that knows how to apply
 * and how to revert itself, so the inspector can undo and redo them.
 */
export interface ElementCommand {
  /** Short description shown in the undo/redo buttons. */
  readonly label: string;
  execute(): Promise<void>;
  undo(): Promise<void>;
}

/** Changes the type, the material or a measure of one element. */
export class EditElementCommand implements ElementCommand {
  readonly label: string;
  private readonly before: ElementChanges;

  constructor(
    private readonly receiver: ElementReceiver,
    private readonly element: StructuralElement,
    private readonly after: ElementChanges,
  ) {
    const keys = Object.keys(after) as (keyof ElementChanges)[];
    this.before = Object.fromEntries(keys.map((key) => [key, element[key]])) as ElementChanges;
    this.label = keys.length === 1 ? CHANGE_LABELS[keys[0]] : 'corrección del elemento';
  }

  execute(): Promise<void> {
    return this.apply(this.after);
  }

  undo(): Promise<void> {
    return this.apply(this.before);
  }

  private async apply(changes: ElementChanges): Promise<void> {
    const updated = await this.receiver.update(this.element, changes);
    Object.assign(this.element, updated);
  }
}

/** Removes one element; undoing saves it again in the same place of the list. */
export class RemoveElementCommand implements ElementCommand {
  readonly label = 'quitar elemento';
  private index = -1;

  constructor(
    private readonly receiver: ElementReceiver,
    private element: StructuralElement,
  ) {}

  async execute(): Promise<void> {
    await this.receiver.remove(this.element);
    this.index = this.receiver.elements.indexOf(this.element);
    if (this.index >= 0) this.receiver.elements.splice(this.index, 1);
  }

  async undo(): Promise<void> {
    const { id: _id, aiAnalysisId: _analysis, ...input } = this.element;
    this.element = await this.receiver.restore(input);
    const at = this.index >= 0 ? Math.min(this.index, this.receiver.elements.length) : this.receiver.elements.length;
    this.receiver.elements.splice(at, 0, this.element);
  }
}

/** Adds an element the AI missed (drawn by the user on the plan). */
export class AddElementCommand implements ElementCommand {
  readonly label = 'agregar elemento';
  private element: StructuralElement | null = null;

  constructor(
    private readonly receiver: ElementReceiver,
    private readonly input: StructuralElementInput,
  ) {}

  async execute(): Promise<void> {
    this.element = await this.receiver.restore(this.input);
    this.receiver.elements.push(this.element);
  }

  async undo(): Promise<void> {
    if (!this.element) return;
    await this.receiver.remove(this.element);
    const index = this.receiver.elements.indexOf(this.element);
    if (index >= 0) this.receiver.elements.splice(index, 1);
    this.element = null;
  }
}

/**
 * Several commands that the user sees as one step, for example "set every
 * wall to 2.7 m" or applying a copilot proposal.
 *
 * Pattern: Composite (macro command) — it is undone and redone as a unit.
 * If a step fails, the steps already applied are reverted.
 */
export class CompositeCommand implements ElementCommand {
  constructor(
    readonly label: string,
    private readonly commands: ElementCommand[],
  ) {}

  get size(): number {
    return this.commands.length;
  }

  async execute(): Promise<void> {
    const applied: ElementCommand[] = [];
    try {
      for (const command of this.commands) {
        await command.execute();
        applied.push(command);
      }
    } catch (error) {
      for (const command of applied.reverse()) await command.undo().catch(() => undefined);
      throw error;
    }
  }

  async undo(): Promise<void> {
    for (const command of [...this.commands].reverse()) await command.undo();
  }
}
