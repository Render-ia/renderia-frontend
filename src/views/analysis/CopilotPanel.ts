import { proposalCommand, validOperations, type CopilotProposal } from '../../analysis/copilot/proposals.ts';
import type { ElementCommand, ElementReceiver } from '../../analysis/commands/ElementCommand.ts';
import { AiAssistantService, type ChatTurn } from '../../services/AiAssistantService.ts';
import { errorMessage } from '../../ui/states.ts';
import { escapeHtml } from '../../utils/html.ts';

const FIELD_LABELS: Record<string, string> = { height: 'altura', thickness: 'espesor', width: 'ancho' };

const SUGGESTIONS = [
  '¿Qué muros tienen menos de 12 cm de espesor?',
  '¿Qué supuestos debería confirmar antes de presupuestar?',
  '¿Hay columnas con medidas poco comunes?',
];

export interface CopilotHost {
  analysisId: number;
  receiver: () => ElementReceiver;
  /** Element name for the user, such as "Muro #12". */
  describe: (elementId: number) => string;
  canApply: boolean;
  /** Runs the command through the undo history; true when it was applied. */
  apply: (command: ElementCommand, message: string) => Promise<boolean>;
}

interface Turn extends ChatTurn {
  proposals?: CopilotProposal[];
}

/**
 * Engineering copilot beside the analysis. It answers questions and may propose
 * changes, but never applies them: each proposal waits for the user's
 * "Aplicar", and then runs as one undoable step.
 */
export class CopilotPanel {
  private readonly service = new AiAssistantService();
  private turns: Turn[] = [];
  private busy = false;
  private remaining: number | null = null;
  private enabled = true;

  constructor(
    private readonly root: HTMLElement,
    private readonly host: CopilotHost,
  ) {}

  async mount(): Promise<void> {
    if (!this.service.available) {
      this.root.innerHTML = this.shell('<p class="field__hint">El copiloto funciona con el servidor de Render.IA. En la versión de demostración del navegador no está disponible.</p>');
      return;
    }
    this.render();
    try {
      const caps = await this.service.capabilities();
      this.enabled = caps.gemini.configured;
      this.remaining = caps.remaining.copilot;
    } catch {
      // Without capabilities the panel still works; the backend answers with a clear error if needed.
    }
    try {
      // The conversation is saved in the database, so it is still here on the next visit.
      this.turns = await this.service.conversation(this.host.analysisId);
    } catch {
      // An old backend without saved conversations: start empty.
    }
    this.render();
  }

  private shell(body: string): string {
    return `
      <div class="section__header"><h2>Copiloto de ingeniería</h2></div>
      <p class="field__hint">Pregunta sobre este plano y su modelo. Sus respuestas son orientativas: no certifica la NSR-10 y ningún cambio se aplica sin que tú lo confirmes.</p>
      ${body}`;
  }

  private render(): void {
    if (!this.enabled) {
      this.root.innerHTML = this.shell('<p class="field__hint">El copiloto todavía no está activo en el servidor. Pídele al administrador que configure Gemini.</p>');
      return;
    }
    const conversation = this.turns.length
      ? this.turns.map((turn, index) => this.turnHtml(turn, index)).join('')
      : `<div class="copilot__suggestions">${SUGGESTIONS.map(
          (s) => `<button type="button" class="chip" data-suggest>${escapeHtml(s)}</button>`,
        ).join('')}</div>`;
    this.root.innerHTML = this.shell(`
      <div class="copilot__log" aria-live="polite">${conversation}${this.busy ? '<p class="copilot__thinking">Pensando…</p>' : ''}</div>
      <form class="copilot__form" data-ask novalidate>
        <label class="sr-only" for="copilot-question">Pregunta al copiloto</label>
        <textarea class="input copilot__input" id="copilot-question" name="question" rows="2" maxlength="1000" required
          placeholder="Escribe tu pregunta…" ${this.busy ? 'disabled' : ''}></textarea>
        <div class="copilot__actions">
          <label class="copilot__deep"><input type="checkbox" name="deep" /> Respuesta detallada</label>
          ${this.remaining !== null ? `<small class="field__hint">Te quedan ${this.remaining} preguntas hoy.</small>` : ''}
          <button class="button" type="submit" ${this.busy ? 'disabled' : ''}>Preguntar</button>
        </div>
      </form>`);
    this.bind();
  }

  private turnHtml(turn: Turn, index: number): string {
    if (turn.role === 'user') {
      return `<p class="copilot__msg copilot__msg--user">${escapeHtml(turn.text)}</p>`;
    }
    const proposals = (turn.proposals ?? [])
      .map((proposal, p) => {
        const ops = validOperations(proposal, this.host.receiver());
        if (ops.length === 0) return '';
        const list = ops
          .map((op) => `<li>${escapeHtml(this.host.describe(op.elementId))}: ${FIELD_LABELS[op.field]} a ${op.value.toLocaleString('es-CO')} m</li>`)
          .join('');
        return `
          <article class="copilot__proposal">
            <h4>${escapeHtml(proposal.title)}</h4>
            <p>${escapeHtml(proposal.reason)}</p>
            <ul>${list}</ul>
            ${this.host.canApply ? `<button type="button" class="button button--small" data-apply="${index}:${p}">Aplicar</button>` : '<small class="field__hint">Solo el dueño del proyecto puede aplicar cambios.</small>'}
          </article>`;
      })
      .join('');
    return `<div class="copilot__msg copilot__msg--model"><p>${escapeHtml(turn.text).replace(/\n/g, '<br />')}</p>${proposals}</div>`;
  }

  private bind(): void {
    const form = this.root.querySelector<HTMLFormElement>('[data-ask]');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const question = String(data.get('question') ?? '').trim();
      if (question) void this.ask(question, data.get('deep') === 'on');
    });
    form?.querySelector('textarea')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
      }
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-suggest]').forEach((button) =>
      button.addEventListener('click', () => void this.ask(button.textContent ?? '', false)),
    );
    this.root.querySelectorAll<HTMLButtonElement>('[data-apply]').forEach((button) =>
      button.addEventListener('click', () => {
        const [turn, proposal] = button.dataset.apply!.split(':').map(Number);
        void this.applyProposal(this.turns[turn].proposals![proposal], button);
      }),
    );
  }

  private async ask(question: string, deep: boolean): Promise<void> {
    if (this.busy) return;
    const history: ChatTurn[] = this.turns.map(({ role, text }) => ({ role, text }));
    this.turns.push({ role: 'user', text: question });
    this.busy = true;
    this.render();
    try {
      const answer = await this.service.ask(this.host.analysisId, question, history, deep);
      this.turns.push({ role: 'model', text: answer.answer, proposals: answer.proposals ?? [] });
      if (this.remaining !== null) this.remaining = Math.max(0, this.remaining - 1);
    } catch (error) {
      this.turns.push({ role: 'model', text: errorMessage(error) });
    }
    this.busy = false;
    this.render();
    this.root.querySelector<HTMLTextAreaElement>('textarea')?.focus();
  }

  private async applyProposal(proposal: CopilotProposal, button: HTMLButtonElement): Promise<void> {
    const command = proposalCommand(proposal, this.host.receiver());
    if (!command) return;
    button.disabled = true;
    const applied = await this.host.apply(command, 'Propuesta aplicada. Puedes deshacerla.');
    button.textContent = applied ? 'Aplicada' : 'Aplicar';
    button.disabled = applied;
  }
}
