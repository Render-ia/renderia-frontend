import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/components.css';
import './styles/home.css';

import { Router } from './core/router/Router.ts';
import { AppShell } from './ui/AppShell.ts';
import { HomeView } from './views/HomeView.ts';
import { NotFoundView } from './views/NotFoundView.ts';
import { PlaceholderView } from './views/PlaceholderView.ts';

const host = document.querySelector<HTMLDivElement>('#app');

if (host) {
  const shell = new AppShell(host);

  new Router(shell.outlet, () => new NotFoundView())
    .register('/', () => new HomeView())
    .register('/projects', () => new PlaceholderView('Proyectos'))
    .register('/floor-plans', () => new PlaceholderView('Planos'))
    .register('/analyses', () => new PlaceholderView('Análisis IA'))
    .register('/viewer', () => new PlaceholderView('Visor 3D'))
    .register('/admin', () => new PlaceholderView('Administración'))
    .start();
}
