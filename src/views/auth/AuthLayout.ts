import { logoMark } from '../../ui/logo.ts';
import { planDrawing } from '../../ui/planDrawing.ts';

/**
 * Two-panel layout shared by login and registration: a cyanotype blueprint on
 * one side and the form on the other.
 */
export function authLayout(formHtml: string): string {
  return `
    <div class="auth">
      <aside class="auth__blueprint" aria-hidden="true">
        <div class="auth__brand">${logoMark}<span>Render.IA</span></div>
        <div class="auth__drawing">${planDrawing()}</div>
        <p class="auth__tagline">
          Planos 2D convertidos en modelos estructurales 3D con inteligencia artificial.
        </p>
      </aside>
      <section class="auth__panel">${formHtml}</section>
    </div>`;
}

/** Reads the form fields and turns errors into a message inside the form. */
export function showAuthError(form: HTMLFormElement, message: string): void {
  const error = form.querySelector<HTMLElement>('.form-error')!;
  error.textContent = message;
  error.hidden = false;
}

/** After this long the form explains that the free server may be waking up. */
const SLOW_SERVER_MS = 4000;

/** A password input with a button to show or hide what was typed. */
export function passwordField(label: string, name: string, autocomplete: string, extra = '', hint = ''): string {
  return `
    <label class="field">
      <span class="field__label">${label}</span>
      <span class="password">
        <input class="input" type="password" name="${name}" autocomplete="${autocomplete}" required ${extra} />
        <button class="password__toggle" type="button" aria-pressed="false" aria-label="Mostrar la contraseña">Ver</button>
      </span>
      ${hint ? `<span class="field__hint">${hint}</span>` : ''}
    </label>`;
}

export function wirePasswordToggles(form: HTMLFormElement): void {
  form.querySelectorAll<HTMLButtonElement>('.password__toggle').forEach((button) => {
    const input = button.previousElementSibling as HTMLInputElement;
    button.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.textContent = show ? 'Ocultar' : 'Ver';
      button.setAttribute('aria-pressed', String(show));
      button.setAttribute('aria-label', show ? 'Ocultar la contraseña' : 'Mostrar la contraseña');
    });
  });
}

/**
 * Disables the form while `task` runs. The backend sleeps when nobody uses it,
 * so if the answer takes a while the form says why instead of looking frozen.
 */
export async function submitWhileWaiting(form: HTMLFormElement, busyText: string, task: () => Promise<void>): Promise<void> {
  const submit = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
  const idleText = submit.textContent;
  const error = form.querySelector<HTMLElement>('.form-error')!;
  const note = form.querySelector<HTMLElement>('[data-slow]')!;

  error.hidden = true;
  submit.disabled = true;
  submit.textContent = busyText;
  form.setAttribute('aria-busy', 'true');
  const timer = window.setTimeout(() => {
    submit.textContent = 'Despertando el servidor…';
    note.hidden = false;
  }, SLOW_SERVER_MS);

  try {
    await task();
  } finally {
    window.clearTimeout(timer);
    note.hidden = true;
    submit.disabled = false;
    submit.textContent = idleText;
    form.removeAttribute('aria-busy');
  }
}

/** Note shown by `submitWhileWaiting` when the server is slow to answer. */
export const slowServerNote = `
  <p class="auth__slow" data-slow role="status" hidden>
    El servidor gratuito se duerme cuando nadie lo usa. La primera vez puede tardar hasta un minuto en despertar.
  </p>`;
