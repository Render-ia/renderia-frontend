import { beforeEach, describe, expect, it } from 'vitest';
import type { StructuralElement, StructuralElementInput } from '../../models/StructuralElement.ts';
import { CommandHistory } from './CommandHistory.ts';
import { parseSummary, confirmAssumption, type AnalysisSummary } from '../AnalysisSummary.ts';
import {
  AddElementCommand,
  CompositeCommand,
  EditElementCommand,
  RemoveElementCommand,
  type ElementChanges,
  type ElementReceiver,
} from './ElementCommand.ts';
import { UpdateSummaryCommand, type SummaryStore } from './SummaryCommand.ts';

function element(id: number, elementTypeId = 1, materialId: number | null = 1): StructuralElement {
  return {
    id, aiAnalysisId: 7, elementTypeId, materialId,
    startX: id, startY: 0, endX: id + 1, endY: 0, width: null, height: 2.4, thickness: 0.15, confidence: 0.9,
  };
}

/** In-memory receiver that behaves like the repositories: restore gives a new id. */
class FakeReceiver implements ElementReceiver {
  elements: StructuralElement[] = [element(1), element(2), element(3)];
  saved = new Map(this.elements.map((e) => [e.id, { ...e }]));
  failNext = false;
  private nextId = 100;

  async update(target: StructuralElement, changes: ElementChanges): Promise<StructuralElement> {
    this.check();
    const row = { ...this.saved.get(target.id)!, ...changes };
    this.saved.set(target.id, row);
    return row;
  }

  async remove(target: StructuralElement): Promise<void> {
    this.check();
    this.saved.delete(target.id);
  }

  async restore(input: StructuralElementInput): Promise<StructuralElement> {
    this.check();
    const row = { id: this.nextId++, aiAnalysisId: 7, ...input };
    this.saved.set(row.id, row);
    return { ...row };
  }

  private check(): void {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('Servidor caído');
    }
  }
}

describe('EditElementCommand', () => {
  let receiver: FakeReceiver;
  beforeEach(() => (receiver = new FakeReceiver()));

  it('changes the type and undo puts the old one back', async () => {
    const wall = receiver.elements[0];
    const command = new EditElementCommand(receiver, wall, { elementTypeId: 2 });

    await command.execute();
    expect(wall.elementTypeId).toBe(2);
    expect(receiver.saved.get(1)!.elementTypeId).toBe(2);

    await command.undo();
    expect(wall.elementTypeId).toBe(1);
    expect(receiver.saved.get(1)!.elementTypeId).toBe(1);
  });

  it('remembers a missing material', async () => {
    const column = receiver.elements[1];
    column.materialId = null;
    const command = new EditElementCommand(receiver, column, { materialId: 3 });

    await command.execute();
    await command.undo();
    expect(column.materialId).toBeNull();
    expect(command.label).toBe('cambio de material');
  });
});

describe('RemoveElementCommand', () => {
  it('removes the element and undo saves it again in the same place', async () => {
    const receiver = new FakeReceiver();
    const middle = receiver.elements[1];
    const command = new RemoveElementCommand(receiver, middle);

    await command.execute();
    expect(receiver.elements.map((e) => e.id)).toEqual([1, 3]);
    expect(receiver.saved.has(2)).toBe(false);

    await command.undo();
    expect(receiver.elements.map((e) => e.startX)).toEqual([1, 2, 3]);
    const restored = receiver.elements[1];
    expect(restored.id).toBe(100);
    expect(receiver.saved.has(100)).toBe(true);
  });

  it('can be redone after undo, removing the restored copy', async () => {
    const receiver = new FakeReceiver();
    const command = new RemoveElementCommand(receiver, receiver.elements[0]);

    await command.execute();
    await command.undo();
    await command.execute();
    expect(receiver.elements.map((e) => e.id)).toEqual([2, 3]);
    expect(receiver.saved.has(100)).toBe(false);
  });
});

describe('CommandHistory', () => {
  let receiver: FakeReceiver;
  let history: CommandHistory;
  beforeEach(() => {
    receiver = new FakeReceiver();
    history = new CommandHistory();
  });

  it('starts with nothing to undo or redo', () => {
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(history.nextUndo).toBeNull();
  });

  it('undoes and redoes in order', async () => {
    const first = receiver.elements[0];
    await history.run(new EditElementCommand(receiver, first, { elementTypeId: 2 }));
    await history.run(new EditElementCommand(receiver, first, { elementTypeId: 3 }));

    await history.undo();
    expect(first.elementTypeId).toBe(2);
    await history.undo();
    expect(first.elementTypeId).toBe(1);
    expect(history.canUndo).toBe(false);

    await history.redo();
    expect(first.elementTypeId).toBe(2);
    expect(history.nextRedo).toBe('cambio de tipo');
  });

  it('a new change clears what could be redone', async () => {
    const first = receiver.elements[0];
    await history.run(new EditElementCommand(receiver, first, { elementTypeId: 2 }));
    await history.undo();
    expect(history.canRedo).toBe(true);

    await history.run(new RemoveElementCommand(receiver, receiver.elements[2]));
    expect(history.canRedo).toBe(false);
    expect(history.nextUndo).toBe('quitar elemento');
  });

  it('keeps both lists unchanged when saving fails', async () => {
    const first = receiver.elements[0];
    await history.run(new EditElementCommand(receiver, first, { elementTypeId: 2 }));

    receiver.failNext = true;
    await expect(history.undo()).rejects.toThrow('Servidor caído');
    expect(first.elementTypeId).toBe(2);
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);

    receiver.failNext = true;
    await expect(history.run(new RemoveElementCommand(receiver, first))).rejects.toThrow();
    expect(receiver.elements).toHaveLength(3);
    expect(history.nextUndo).toBe('cambio de tipo');
  });

  it('forgets the oldest commands past its limit', async () => {
    history = new CommandHistory(2);
    const first = receiver.elements[0];
    for (const type of [2, 3, 4]) await history.run(new EditElementCommand(receiver, first, { elementTypeId: type }));

    await history.undo();
    await history.undo();
    expect(history.canUndo).toBe(false);
    expect(first.elementTypeId).toBe(2);
  });
});

describe('AddElementCommand', () => {
  it('adds a drawn element and undo removes it from the list and the store', async () => {
    const receiver = new FakeReceiver();
    const { id: _id, aiAnalysisId: _a, ...input } = element(9);
    const command = new AddElementCommand(receiver, { ...input, confidence: 1 });
    await command.execute();
    expect(receiver.elements).toHaveLength(4);
    const added = receiver.elements[3];
    expect(receiver.saved.has(added.id)).toBe(true);
    await command.undo();
    expect(receiver.elements).toHaveLength(3);
    expect(receiver.saved.has(added.id)).toBe(false);
  });
});

describe('CompositeCommand', () => {
  let receiver: FakeReceiver;
  beforeEach(() => (receiver = new FakeReceiver()));

  it('applies several edits as one step and undoes them together', async () => {
    const history = new CommandHistory();
    const all = new CompositeCommand(
      'altura de muros',
      receiver.elements.map((e) => new EditElementCommand(receiver, e, { height: 2.7 })),
    );
    await history.run(all);
    expect(receiver.elements.every((e) => e.height === 2.7)).toBe(true);
    expect(history.nextUndo).toBe('altura de muros');
    await history.undo();
    expect(receiver.elements.every((e) => e.height === 2.4)).toBe(true);
  });

  it('reverts the steps already applied when one fails', async () => {
    const [first, second] = receiver.elements;
    const failing = {
      label: 'falla',
      execute: async () => {
        throw new Error('Servidor caído');
      },
      undo: async () => undefined,
    };
    const composite = new CompositeCommand('lote', [
      new EditElementCommand(receiver, first, { thickness: 0.2 }),
      new EditElementCommand(receiver, second, { thickness: 0.2 }),
      failing,
    ]);
    await expect(composite.execute()).rejects.toThrow('Servidor caído');
    expect(first.thickness).toBe(0.15);
    expect(second.thickness).toBe(0.15);
    expect(receiver.saved.get(first.id)!.thickness).toBe(0.15);
  });
});

describe('UpdateSummaryCommand', () => {
  it('saves the new summary and undo restores the previous one', async () => {
    let current: AnalysisSummary = parseSummary(null, '1:100');
    const store: SummaryStore = {
      current: () => current,
      save: async (summary) => {
        current = summary;
      },
    };
    const command = new UpdateSummaryCommand(store, confirmAssumption(current, 'wallHeight', '2.7 m'), 'confirmar');
    await command.execute();
    expect(current.assumptions.find((a) => a.key === 'wallHeight')).toMatchObject({ value: '2.7 m', source: 'confirmed' });
    await command.undo();
    expect(current.assumptions.find((a) => a.key === 'wallHeight')).toMatchObject({ value: '2.5 m', source: 'assumed' });
  });
});
