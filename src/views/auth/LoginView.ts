import { AuthService } from '../../auth/AuthService.ts';
import { AppConfig } from '../../core/config/AppConfig.ts';
import { View } from '../View.ts';
import { authLayout, passwordField, showAuthError, slowServerNote, submitWhileWaiting, wirePasswordToggles } from './AuthLayout.ts';

/**
 * Public demo accounts for the class presentation. With the real backend only
 * Ingeniero and Estudiante exist (created from DEMO_ENGINEER_PASSWORD and
 * DEMO_STUDENT_PASSWORD); the administrator is never a public demo account.
 */
const DEMO_ACCOUNTS = [
  { role: 'Administrador', email: 'admin@renderia.co', password: 'Admin123*', withBackend: false },
  { role: 'Ingeniero', email: 'ingeniero@renderia.co', password: 'Ingeniero123*', withBackend: true },
  { role: 'Estudiante', email: 'estudiante@renderia.co', password: 'Estudiante123*', withBackend: true },
];

export class LoginView extends View {
  readonly title = 'Iniciar sesión';

  constructor(private readonly onSuccess: () => void) {
    super();
  }

  protected render(): string {
    return authLayout(`
      <form class="auth__form" novalidate>
        <h1>Iniciar sesión</h1>
        <p class="auth__lead">Entra para ver tus proyectos y analizar planos.</p>

        <label class="field">
          <span class="field__label">Correo</span>
          <input class="input" type="email" name="email" autocomplete="email" required maxlength="150" />
        </label>
        ${passwordField('Contraseña', 'password', 'current-password')}

        <p class="form-error" role="alert" hidden></p>
        <button class="button auth__submit" type="submit">Iniciar sesión</button>
        ${slowServerNote}
        <p class="auth__switch">¿No tienes cuenta? <a href="#/register">Crea una</a></p>
      </form>
      ${this.demoAccounts()}`);
  }

  protected afterRender(container: HTMLElement): void {
    const form = container.querySelector<HTMLFormElement>('.auth__form')!;
    wirePasswordToggles(form);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const data = new FormData(form);

      let ok = false;
      await submitWhileWaiting(form, 'Entrando…', async () => {
        try {
          await new AuthService().login(String(data.get('email')), String(data.get('password')));
          ok = true;
        } catch (error) {
          showAuthError(form, error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
        }
      });
      if (ok) this.onSuccess();
    });

    container.querySelectorAll<HTMLButtonElement>('[data-demo]').forEach((button) => {
      button.addEventListener('click', () => {
        const account = DEMO_ACCOUNTS[Number(button.dataset.demo)];
        form.querySelector<HTMLInputElement>('[name="email"]')!.value = account.email;
        form.querySelector<HTMLInputElement>('[name="password"]')!.value = account.password;
        form.requestSubmit();
      });
    });
  }

  /** Quick access to the demo accounts that exist in the current data source. */
  private demoAccounts(): string {
    const withBackend = AppConfig.getInstance().dataSource !== 'mock';
    const buttons = DEMO_ACCOUNTS.map((account, index) => ({ account, index }))
      .filter(({ account }) => !withBackend || account.withBackend)
      .map(
        ({ account, index }) => `
        <button class="demo-account" type="button" data-demo="${index}">
          <strong>${account.role}</strong><span>${account.email}</span>
        </button>`,
      )
      .join('');
    return `
      <div class="auth__demo">
        <p>Cuentas de prueba</p>
        <div class="auth__demo-list">${buttons}</div>
      </div>`;
  }
}
