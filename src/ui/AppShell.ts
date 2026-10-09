import { Session } from '../auth/Session.ts';
import { appEvents } from '../core/events/AppEvents.ts';
import type { UserWithRole } from '../models/User.ts';
import { escapeHtml } from '../utils/html.ts';
import { logoMark } from './logo.ts';
import { NAV_ITEMS } from './navigation.ts';

/**
 * Persistent frame of the app: side navigation, top bar and the outlet where
 * the router mounts each view. Public screens (login, register) use the bare
 * mode, without the sidebar.
 */
export class AppShell {
  private readonly element: HTMLElement;
  private currentPath = '/';

  constructor(
    private readonly host: HTMLElement,
    private readonly onLogout: () => void,
  ) {
    this.element = document.createElement('div');
    this.element.className = 'shell';
    this.element.innerHTML = this.template();
    this.host.replaceChildren(this.element);
    this.bindEvents();
    this.renderNav();
    this.renderUser(Session.getInstance().user);
  }

  /** Element where views are rendered. */
  get outlet(): HTMLElement {
    return this.element.querySelector<HTMLElement>('.shell__main')!;
  }

  private template(): string {
    return `
      <a class="skip-link" href="#main" data-skip>Saltar al contenido</a>
      <aside class="shell__sidebar" id="sidebar">
        <a class="brand" href="#/">
          ${logoMark}
          <span class="brand__name">Render.IA</span>
        </a>
        <nav class="nav" aria-label="Navegación principal"></nav>
        <div class="shell__footer">
          <div class="user-card"></div>
          <p class="backend-status" data-state="checking">
            <span class="backend-status__dot"></span>
            <span class="backend-status__text">Conectando con el servidor…</span>
          </p>
        </div>
      </aside>
      <div class="shell__body">
        <header class="shell__topbar">
          <button class="menu-toggle" type="button" aria-controls="sidebar" aria-expanded="false">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            <span class="sr-only">Abrir menú</span>
          </button>
          <span class="topbar__title"></span>
        </header>
        <main class="shell__main" id="main" tabindex="-1"></main>
      </div>`;
  }

  private bindEvents(): void {
    const toggle = this.element.querySelector<HTMLButtonElement>('.menu-toggle')!;
    toggle.addEventListener('click', () => {
      const open = this.element.classList.toggle('shell--menu-open');
      toggle.setAttribute('aria-expanded', String(open));
    });

    this.element.querySelector('[data-skip]')!.addEventListener('click', (event) => {
      event.preventDefault();
      this.outlet.focus();
    });

    appEvents.on('route:changed', ({ path, isPublic }) => {
      this.currentPath = path;
      this.element.classList.toggle('shell--bare', isPublic);
      this.element.classList.remove('shell--menu-open');
      toggle.setAttribute('aria-expanded', 'false');
      this.highlight();
    });

    appEvents.on('session:changed', ({ user }) => {
      this.renderNav();
      this.renderUser(user);
    });

    appEvents.on('backend:status', ({ online }) => this.showBackendStatus(online));
  }

  private renderNav(): void {
    const session = Session.getInstance();
    const items = NAV_ITEMS.filter((item) => !item.permission || session.can(item.permission));
    this.element.querySelector('.nav')!.innerHTML = items
      .map(
        (item) => `
          <a class="nav__link" href="#${item.path}" data-path="${item.path}">
            ${item.icon}<span>${item.label}</span>
          </a>`,
      )
      .join('');
    this.highlight();
  }

  private renderUser(user: UserWithRole | null): void {
    const card = this.element.querySelector<HTMLElement>('.user-card')!;
    if (!user) {
      card.innerHTML = '';
      return;
    }
    const initials = user.fullName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');

    card.innerHTML = `
      <span class="user-card__avatar" aria-hidden="true">${escapeHtml(initials)}</span>
      <span class="user-card__info">
        <strong>${escapeHtml(user.fullName)}</strong>
        <small>${escapeHtml(user.role.name)}</small>
      </span>
      <button class="user-card__logout" type="button" title="Cerrar sesión">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="sr-only">Cerrar sesión</span>
      </button>`;
    card.querySelector('button')!.addEventListener('click', () => this.onLogout());
  }

  /** Marks the nav link of the current section (also for nested paths like /projects/3). */
  private highlight(): void {
    let title = '';
    this.element.querySelectorAll<HTMLAnchorElement>('.nav__link').forEach((link) => {
      const path = link.dataset.path!;
      const active =
        path === '/' ? this.currentPath === '/' : this.currentPath === path || this.currentPath.startsWith(`${path}/`);
      link.classList.toggle('nav__link--active', active);
      if (active) {
        link.setAttribute('aria-current', 'page');
        title = link.textContent?.trim() ?? '';
      } else {
        link.removeAttribute('aria-current');
      }
    });
    this.element.querySelector('.topbar__title')!.textContent = title;
  }

  private showBackendStatus(online: boolean): void {
    const status = this.element.querySelector<HTMLElement>('.backend-status')!;
    status.dataset.state = online ? 'online' : 'offline';
    status.querySelector('.backend-status__text')!.textContent = online
      ? 'Servidor conectado'
      : 'Servidor sin conexión';
  }
}
