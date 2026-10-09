import { AuthService } from '../../auth/AuthService.ts';
import { AppConfig } from '../../core/config/AppConfig.ts';
import { View } from '../View.ts';
import { authLayout, showAuthError } from './AuthLayout.ts';

const DEMO_ACCOUNTS = [
  { role: 'Administrador', email: 'admin@renderia.co', password: 'Admin123*' },
  { role: 'Ingeniero', email: 'ingeniero@renderia.co', password: 'Ingeniero123*' },
  { role: 'Estudiante', email: 'estudiante@renderia.co', password: 'Estudiante123*' },
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
          <input class="input" type="email" name="email" autocomplete="email" required />
        </label>
        <label class="field">
          <span class="field__label">Contraseña</span>
          <input class="input" type="password" name="password" autocomplete="current-password" required />
        </label>

        <p class="form-error" role="alert" hidden></p>
        <button class="button auth__submit" type="submit">Iniciar sesión</button>
        <p class="auth__switch">¿No tienes cuenta? <a href="#/register">Crea una</a></p>
      </form>
      ${this.demoAccounts()}`);
  }

  protected afterRender(container: HTMLElement): void {
    const form = container.querySelector<HTMLFormElement>('.auth__form')!;
    const submit = form.querySelector<HTMLButtonElement>('[type="submit"]')!;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const data = new FormData(form);

      submit.disabled = true;
      submit.textContent = 'Entrando…';
      try {
        await new AuthService().login(String(data.get('email')), String(data.get('password')));
        this.onSuccess();
      } catch (error) {
        showAuthError(form, error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
        submit.disabled = false;
        submit.textContent = 'Iniciar sesión';
      }
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

  /** Quick access to the demo accounts, only when running without backend. */
  private demoAccounts(): string {
    if (AppConfig.getInstance().dataSource !== 'mock') return '';
    const buttons = DEMO_ACCOUNTS.map(
      (account, index) => `
        <button class="demo-account" type="button" data-demo="${index}">
          <strong>${account.role}</strong><span>${account.email}</span>
        </button>`,
    ).join('');
    return `
      <div class="auth__demo">
        <p>Cuentas de prueba</p>
        <div class="auth__demo-list">${buttons}</div>
      </div>`;
  }
}
