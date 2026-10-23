import type { StructuralElement, StructuralElementInput } from '../../models/StructuralElement.ts';

export type ElementChanges = { elementTypeId?: number; materialId?: number | null };

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

/** Changes the type or the material of one element. */
export class EditElementCommand implements ElementCommand {
  readonly label: string;
  private readonly before: ElementChanges;

  constructor(
    private readonly receiver: ElementReceiver,
    private readonly element: StructuralElement,
    private readonly after: ElementChanges,
  ) {
    this.before = 'elementTypeId' in after ? { elementTypeId: element.elementTypeId } : { materialId: element.materialId };
    this.label = 'elementTypeId' in after ? 'cambio de tipo' : 'cambio de material';
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
