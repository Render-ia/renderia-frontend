import { escapeHtml } from '../utils/html.ts';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
}

/** Modal dialogs built on the native <dialog> element. */
export class Dialog {
  /** Asks the user to confirm an action. Resolves true when confirmed. */
  static confirm(options: ConfirmOptions): Promise<boolean> {
    const dialog = Dialog.create(`
      <form method="dialog" class="dialog__body">
        <h2 class="dialog__title">${escapeHtml(options.title)}</h2>
        <p>${escapeHtml(options.message)}</p>
        <div class="dialog__actions">
          <button class="button button--ghost" value="cancel">Cancelar</button>
          <button class="button ${options.danger ? 'button--danger' : ''}" value="confirm">
            ${escapeHtml(options.confirmLabel)}
          </button>
        </div>
      </form>`);

    return new Promise((resolve) => {
      dialog.addEventListener('close', () => {
        resolve(dialog.returnValue === 'confirm');
        dialog.remove();
      });
      dialog.showModal();
    });
  }

  /**
   * Opens a dialog that holds a form. `onSubmit` receives the form data and
   * returns true to close the dialog (false keeps it open, e.g. on errors).
   */
  static form(
    title: string,
    fieldsHtml: string,
    submitLabel: string,
    onSubmit: (data: FormData, form: HTMLFormElement) => Promise<boolean>,
  ): HTMLDialogElement {
    const dialog = Dialog.create(`
      <form class="dialog__body" novalidate>
        <h2 class="dialog__title">${escapeHtml(title)}</h2>
        <div class="form-grid">${fieldsHtml}</div>
        <p class="form-error" role="alert" hidden></p>
        <div class="dialog__actions">
          <button class="button button--ghost" type="button" data-close>Cancelar</button>
          <button class="button" type="submit">${escapeHtml(submitLabel)}</button>
        </div>
      </form>`);

    const form = dialog.querySelector('form')!;
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    dialog.querySelector('[data-close]')!.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => dialog.remove());

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      submit.disabled = true;
      try {
        if (await onSubmit(new FormData(form), form)) dialog.close();
      } finally {
        submit.disabled = false;
      }
    });

    dialog.showModal();
    form.querySelector<HTMLElement>('input, select, textarea')?.focus();
    return dialog;
  }

  /** Shows an error message inside a form dialog. */
  static showFormError(form: HTMLFormElement, message: string): void {
    const error = form.querySelector<HTMLElement>('.form-error');
    if (!error) return;
    error.textContent = message;
    error.hidden = false;
  }

  private static create(html: string): HTMLDialogElement {
    const dialog = document.createElement('dialog');
    dialog.className = 'dialog';
    dialog.innerHTML = html;
    document.body.append(dialog);
    return dialog;
  }
}
