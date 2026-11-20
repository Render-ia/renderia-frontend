import { describe, expect, it } from 'vitest';
import type { ElementChanges, ElementReceiver } from '../commands/ElementCommand.ts';
import type { StructuralElement } from '../../models/StructuralElement.ts';
import { proposalCommand, validOperations, type CopilotProposal } from './proposals.ts';

function wall(id: number, thickness: number): StructuralElement {
  return { id, aiAnalysisId: 1, elementTypeId: 1, materialId: null, startX: 0, startY: 0, endX: 1, endY: 0, width: null, height: 2.5, thickness, confidence: 0.8 };
}

function receiver(elements: StructuralElement[]): ElementReceiver {
  return {
    elements,
    async update(element: StructuralElement, changes: ElementChanges) {
      Object.assign(element, changes);
      return element;
    },
    async remove() {},
    async restore(input) {
      return { ...input, id: 99, aiAnalysisId: 1 };
    },
  };
}

const proposal = (operations: CopilotProposal['operations']): CopilotProposal => ({ title: 'Engrosar muros', reason: 'Muy delgados', operations });

describe('copilot proposals', () => {
  it('keeps only measure updates of real elements within 1 cm and 50 m', () => {
    const r = receiver([wall(1, 0.1)]);
    const ops = validOperations(
      proposal([
        { op: 'update', elementId: 1, field: 'thickness', value: 0.15 },
        { op: 'update', elementId: 2, field: 'thickness', value: 0.15 },
        { op: 'update', elementId: 1, field: 'startX', value: 3 },
        { op: 'delete', elementId: 1, field: 'thickness', value: 0.15 },
        { op: 'update', elementId: 1, field: 'height', value: 120 },
      ]),
      r,
    );
    expect(ops).toEqual([{ op: 'update', elementId: 1, field: 'thickness', value: 0.15 }]);
  });

  it('applies a confirmed proposal as one undoable step', async () => {
    const elements = [wall(1, 0.1), wall(2, 0.1)];
    const command = proposalCommand(
      proposal([
        { op: 'update', elementId: 1, field: 'thickness', value: 0.15 },
        { op: 'update', elementId: 2, field: 'thickness', value: 0.15 },
      ]),
      receiver(elements),
    )!;
    await command.execute();
    expect(elements.map((e) => e.thickness)).toEqual([0.15, 0.15]);
    await command.undo();
    expect(elements.map((e) => e.thickness)).toEqual([0.1, 0.1]);
  });

  it('returns nothing to apply when every operation is invalid', () => {
    expect(proposalCommand(proposal([{ op: 'update', elementId: 7, field: 'width', value: 1 }]), receiver([]))).toBeNull();
  });
});
