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
