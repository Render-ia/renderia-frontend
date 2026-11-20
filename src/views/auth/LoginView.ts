import { AuthService } from '../../auth/AuthService.ts';
import { AppConfig } from '../../core/config/AppConfig.ts';
import { View } from '../View.ts';
import { authLayout, passwordField, showAuthError, slowServerNote, submitWhileWaiting, wirePasswordToggles } from './AuthLayout.ts';

/**
 * One demo account per role, for the teacher and the jury. "Usar" asks the
 * backend to open the session (POST /auth/demo): no password exists in this
 * code, in the page or in the network traffic.
 */
const DEMO_ACCOUNTS = [
  { role: 'Administrador', email: 'admin.prueba@renderia.co', mockEmail: 'admin@renderia.co', hint: 'Ve todo el sistema y el panel de administración. En la cuenta de prueba no puede cambiar datos de otros.' },
  { role: 'Ingeniero', email: 'ingeniero@renderia.co', hint: 'Crea proyectos, analiza planos con IA, corrige el modelo y exporta.' },
  { role: 'Revisor', email: 'revisor@renderia.co', hint: 'Revisa y valida los proyectos de todos, sin borrar ni editar.' },
  { role: 'Cliente', email: 'cliente@renderia.co', hint: 'Ve los proyectos que le comparten, en modo cliente.' },
  { role: 'Estudiante', email: 'estudiante@renderia.co', hint: 'Hasta 3 proyectos, con fines académicos.' },
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
      button.addEventListener('click', async () => {
        const account = DEMO_ACCOUNTS[Number(button.dataset.demo)];
        const demoButtons = container.querySelectorAll<HTMLButtonElement>('[data-demo]');
        if (button.disabled) return;
        demoButtons.forEach((b) => (b.disabled = true));
        let ok = false;
        await submitWhileWaiting(form, 'Entrando…', async () => {
          try {
            await new AuthService().demoLogin(account.role);
            ok = true;
          } catch (error) {
            showAuthError(form, error instanceof Error ? error.message : 'No se pudo entrar con la cuenta de prueba.');
          }
        });
        demoButtons.forEach((b) => (b.disabled = false));
        if (ok) this.onSuccess();
      });
    });
  }

  /** "Cuentas de prueba" panel: one row per role with a "Usar" button. */
  private demoAccounts(): string {
    const mock = AppConfig.getInstance().dataSource === 'mock';
    const rows = DEMO_ACCOUNTS.map(
      (account, index) => `
        <li class="demo-account">
          <div class="demo-account__text">
            <strong>${account.role}</strong>
            <span class="demo-account__email">${mock && account.mockEmail ? account.mockEmail : account.email}</span>
            <small>${account.hint}</small>
          </div>
          <button class="button button--small" type="button" data-demo="${index}" aria-label="Entrar como ${account.role}">Usar</button>
        </li>`,
    ).join('');
    return `
      <section class="auth__demo" aria-labelledby="demo-title">
        <p id="demo-title">Cuentas de prueba</p>
        <small class="auth__demo-note">Entra con un rol sin escribir contraseña.</small>
        <ul class="auth__demo-list">${rows}</ul>
      </section>`;
  }
}
