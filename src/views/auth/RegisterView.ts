import { AuthService } from '../../auth/AuthService.ts';
import { View } from '../View.ts';
import { authLayout, passwordField, showAuthError, slowServerNote, submitWhileWaiting, wirePasswordToggles } from './AuthLayout.ts';

/** Role ids from the roles table. Administrators are only created by another admin. */
const REGISTER_ROLES = [
  { id: 2, name: 'Ingeniero', hint: 'Proyectos sin límite y exportación del modelo 3D' },
  { id: 3, name: 'Estudiante', hint: 'Hasta 3 proyectos, con fines académicos' },
];

export class RegisterView extends View {
  readonly title = 'Crear cuenta';

  constructor(private readonly onSuccess: () => void) {
    super();
  }

  protected render(): string {
    const roles = REGISTER_ROLES.map(
      (role, index) => `
        <label class="role-option">
          <input type="radio" name="roleId" value="${role.id}" ${index === 0 ? 'checked' : ''} />
          <span><strong>${role.name}</strong><small>${role.hint}</small></span>
        </label>`,
    ).join('');

    return authLayout(`
      <form class="auth__form" novalidate>
        <h1>Crear cuenta</h1>
        <p class="auth__lead">Regístrate para subir tus planos y generar modelos 3D.</p>

        <label class="field">
          <span class="field__label">Nombre completo</span>
          <input class="input" name="fullName" autocomplete="name" required minlength="3" maxlength="120" />
        </label>
        <label class="field">
          <span class="field__label">Correo</span>
          <input class="input" type="email" name="email" autocomplete="email" required maxlength="150" />
        </label>
        ${passwordField('Contraseña', 'password', 'new-password', 'minlength="8"', 'Mínimo 8 caracteres.')}
        ${passwordField('Repite la contraseña', 'confirm', 'new-password', 'minlength="8"')}

        <fieldset class="role-picker">
          <legend class="field__label">¿Cómo usarás Render.IA?</legend>
          ${roles}
        </fieldset>

        <p class="form-error" role="alert" hidden></p>
        <button class="button auth__submit" type="submit">Crear cuenta</button>
        ${slowServerNote}
        <p class="auth__switch">¿Ya tienes cuenta? <a href="#/login">Inicia sesión</a></p>
      </form>`);
  }

  protected afterRender(container: HTMLElement): void {
    const form = container.querySelector<HTMLFormElement>('.auth__form')!;
    wirePasswordToggles(form);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const data = new FormData(form);

      if (data.get('password') !== data.get('confirm')) {
        showAuthError(form, 'Las contraseñas no coinciden.');
        return;
      }

      let ok = false;
      await submitWhileWaiting(form, 'Creando cuenta…', async () => {
        try {
          await new AuthService().register({
            fullName: String(data.get('fullName')),
            email: String(data.get('email')),
            password: String(data.get('password')),
            roleId: Number(data.get('roleId')),
          });
          ok = true;
        } catch (error) {
          showAuthError(form, error instanceof Error ? error.message : 'No se pudo crear la cuenta.');
        }
      });
      if (ok) this.onSuccess();
    });
  }
}
