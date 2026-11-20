import { escapeHtml } from '../utils/html.ts';
import { reportFormValidity } from '../utils/form.ts';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
}

/**
 * Confirmations and forms shown inside the page, never as pop-up windows.
 *
 * `confirm` puts a confirmation panel at the top of the current page.
 * `form` turns the page into a full-page form until it is sent or cancelled.
 * Leaving the route closes either one.
 */
export class InPage {
  private static cancelConfirm: (() => void) | null = null;
  private static closeForm: (() => void) | null = null;

  /** Asks the user to confirm an action. Resolves true when confirmed. */
  static confirm(options: ConfirmOptions): Promise<boolean> {
    const outlet = InPage.outlet();
    if (!outlet) return Promise.resolve(false);
    InPage.cancelConfirm?.();

    const panel = document.createElement('section');
    panel.className = `confirm-panel${options.danger ? ' confirm-panel--danger' : ''}`;
    panel.setAttribute('aria-labelledby', 'confirm-panel-title');
    panel.innerHTML = `
      <h2 class="confirm-panel__title" id="confirm-panel-title">${escapeHtml(options.title)}</h2>
      <p>${escapeHtml(options.message)}</p>
      <div class="confirm-panel__actions">
        <button class="button button--ghost" type="button" data-cancel>Cancelar</button>
        <button class="button ${options.danger ? 'button--danger' : ''}" type="button" data-confirm>
          ${escapeHtml(options.confirmLabel)}
        </button>
      </div>`;
    outlet.prepend(panel);
    panel.scrollIntoView({ block: 'start' });
    panel.querySelector<HTMLButtonElement>('[data-cancel]')!.focus({ preventScroll: true });

    return new Promise((resolve) => {
      const finish = (confirmed: boolean) => {
        panel.remove();
        window.removeEventListener('hashchange', onLeave);
        InPage.cancelConfirm = null;
        resolve(confirmed);
      };
      const onLeave = () => finish(false);
      InPage.cancelConfirm = onLeave;
      window.addEventListener('hashchange', onLeave);
      panel.querySelector('[data-cancel]')!.addEventListener('click', () => finish(false));
      panel.querySelector('[data-confirm]')!.addEventListener('click', () => finish(true));
    });
  }

  /**
   * Shows a full-page form in place of the current page. `onSubmit` receives
   * the form data and returns true to go back to the page (false keeps the
   * form open, e.g. on errors).
   */
  static form(
    title: string,
    fieldsHtml: string,
    submitLabel: string,
    onSubmit: (data: FormData, form: HTMLFormElement) => Promise<boolean>,
  ): HTMLElement | null {
    const outlet = InPage.outlet();
    if (!outlet) return null;
    InPage.cancelConfirm?.();
    InPage.closeForm?.();

    const covered = Array.from(outlet.children) as HTMLElement[];
    const wasHidden = covered.map((element) => element.hidden);
    covered.forEach((element) => (element.hidden = true));

    const page = document.createElement('section');
    page.className = 'form-page';
    page.innerHTML = `
      <p class="breadcrumb"><button class="button button--ghost button--small" type="button" data-close>← Volver</button></p>
      <header class="page-header"><h1>${escapeHtml(title)}</h1></header>
      <form class="form-page__form" novalidate>
        <div class="form-grid">${fieldsHtml}</div>
        <p class="form-error" role="alert" hidden></p>
        <div class="form-page__actions">
          <button class="button button--ghost" type="button" data-close>Cancelar</button>
          <button class="button" type="submit">${escapeHtml(submitLabel)}</button>
        </div>
      </form>`;
    outlet.append(page);
    window.scrollTo({ top: 0 });

    const close = () => {
      page.remove();
      covered.forEach((element, i) => (element.hidden = wasHidden[i]));
      window.removeEventListener('hashchange', close);
      InPage.closeForm = null;
    };
    InPage.closeForm = close;
    window.addEventListener('hashchange', close);
    page.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', close));

    const form = page.querySelector('form')!;
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!reportFormValidity(form)) return;
      submit.disabled = true;
      try {
        if (await onSubmit(new FormData(form), form)) close();
      } finally {
        submit.disabled = false;
      }
    });

    form.querySelector<HTMLElement>('input, select, textarea')?.focus();
    return page;
  }

  /** Shows an error message inside a form. */
  static showFormError(form: HTMLFormElement, message: string): void {
    const error = form.querySelector<HTMLElement>('.form-error');
    if (!error) return;
    error.textContent = message;
    error.hidden = false;
  }

  private static outlet(): HTMLElement | null {
    return document.querySelector<HTMLElement>('#main');
  }
}
