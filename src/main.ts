import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/components.css';
import './styles/forms.css';
import './styles/tables.css';
import './styles/dialog.css';
import './styles/toast.css';
import './styles/home.css';
import './styles/auth.css';

import { AuthService } from './auth/AuthService.ts';
import { Session } from './auth/Session.ts';
import type { Permission } from './auth/RolePolicy.ts';
import { Router } from './core/router/Router.ts';
import { ActivityLogger } from './services/ActivityLogger.ts';
import { AppShell } from './ui/AppShell.ts';
import { Toast } from './ui/Toast.ts';
import { LoginView } from './views/auth/LoginView.ts';
import { RegisterView } from './views/auth/RegisterView.ts';
import { HomeView } from './views/HomeView.ts';
import { NotFoundView } from './views/NotFoundView.ts';
import { PlaceholderView } from './views/PlaceholderView.ts';

async function bootstrap(host: HTMLElement): Promise<void> {
  const session = Session.getInstance();
  new ActivityLogger().start();
  await session.restore();

  let router: Router;
  const goHome = () => router.navigate('/');
  const shell = new AppShell(host, () => {
    new AuthService().logout();
    router.navigate('/login');
  });

  router = new Router(() => shell.outlet, () => new NotFoundView())
    .register('/login', () => new LoginView(goHome), { isPublic: true })
    .register('/register', () => new RegisterView(goHome), { isPublic: true })
    .register('/', () => new HomeView())
    .register('/projects', () => new PlaceholderView('Proyectos'))
    .register('/floor-plans', () => new PlaceholderView('Planos'))
    .register('/analyses', () => new PlaceholderView('Análisis IA'))
    .register('/viewer', () => new PlaceholderView('Visor 3D'))
    .register('/admin', () => new PlaceholderView('Administración'), { permission: 'admin:access' })
    // Not logged in: only public screens. Logged in: public screens send you home.
    .useGuard(({ options }) => {
      if (options.isPublic) return session.isLoggedIn ? '/' : null;
      return session.isLoggedIn ? null : '/login';
    })
    // Screens that need a permission the current role does not have.
    .useGuard(({ options }) => {
      if (options.permission && !session.can(options.permission as Permission)) {
        Toast.error('Tu rol no tiene acceso a esa sección.');
        return '/';
      }
      return null;
    });

  router.start();
}

const host = document.querySelector<HTMLDivElement>('#app');
if (host) {
  bootstrap(host);
}
