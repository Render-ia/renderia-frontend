import { CompositeCommand, EditElementCommand, type ElementCommand, type ElementReceiver, type MeasureField } from '../commands/ElementCommand.ts';

/** One change the copilot suggests. It is never applied until the user confirms it. */
export interface CopilotOperation {
  op: string;
  elementId: number;
  field: string;
  value: number;
}

export interface CopilotProposal {
  title: string;
  reason: string;
  operations: CopilotOperation[];
}

export interface CopilotAnswer {
  answer: string;
  proposals: CopilotProposal[];
}

const FIELDS: MeasureField[] = ['height', 'thickness', 'width'];
const MIN_METERS = 0.01;
const MAX_METERS = 50;

/**
 * The operations of a proposal that are safe to apply: an update of a measure
 * of an element that exists, with a value between 1 cm and 50 m. Anything else
 * the model returns is dropped, even if the AI service already filtered it.
 */
export function validOperations(proposal: CopilotProposal, receiver: ElementReceiver): CopilotOperation[] {
  const ids = new Set(receiver.elements.map((e) => e.id));
  return (proposal.operations ?? []).filter(
    (op) =>
      op.op === 'update' &&
      ids.has(op.elementId) &&
      FIELDS.includes(op.field as MeasureField) &&
      Number.isFinite(op.value) &&
      op.value >= MIN_METERS &&
      op.value <= MAX_METERS,
  );
}

/**
 * Turns a confirmed proposal into one undoable step: a macro command of edits.
 * Returns null when nothing in the proposal can be applied.
 */
export function proposalCommand(proposal: CopilotProposal, receiver: ElementReceiver): ElementCommand | null {
  const operations = validOperations(proposal, receiver);
  if (operations.length === 0) return null;
  const commands = operations.map((op) => {
    const element = receiver.elements.find((e) => e.id === op.elementId)!;
    return new EditElementCommand(receiver, element, { [op.field as MeasureField]: Math.round(op.value * 1000) / 1000 });
  });
  return new CompositeCommand(`propuesta del copiloto: ${proposal.title}`, commands);
}
