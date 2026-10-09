import { appEvents } from '../core/events/AppEvents.ts';
import { logoMark } from './logo.ts';
import { NAV_ITEMS } from './navigation.ts';

/**
 * Persistent frame of the app: side navigation, top bar and the outlet
 * where the router mounts each view.
 */
export class AppShell {
  private readonly element: HTMLElement;

  constructor(private readonly host: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'shell';
    this.element.innerHTML = this.template();
    this.host.replaceChildren(this.element);
    this.bindEvents();
  }

  /** Element where views are rendered. */
  get outlet(): HTMLElement {
    return this.element.querySelector<HTMLElement>('.shell__main')!;
  }

  private template(): string {
    const links = NAV_ITEMS.map(
      (item) => `
        <a class="nav__link" href="#${item.path}" data-path="${item.path}">
          ${item.icon}<span>${item.label}</span>
        </a>`,
    ).join('');

    return `
      <aside class="shell__sidebar" id="sidebar">
        <a class="brand" href="#/">
          ${logoMark}
          <span class="brand__name">Render.IA</span>
        </a>
        <nav class="nav" aria-label="Navegación principal">${links}</nav>
        <p class="backend-status" data-state="checking">
          <span class="backend-status__dot"></span>
          <span class="backend-status__text">Conectando con el servidor…</span>
        </p>
      </aside>
      <div class="shell__body">
        <header class="shell__topbar">
          <button class="menu-toggle" type="button" aria-controls="sidebar" aria-expanded="false">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            <span class="sr-only">Abrir menú</span>
          </button>
          <span class="topbar__title"></span>
        </header>
        <main class="shell__main" id="main"></main>
      </div>`;
  }

  private bindEvents(): void {
    const toggle = this.element.querySelector<HTMLButtonElement>('.menu-toggle')!;
    toggle.addEventListener('click', () => {
      const open = this.element.classList.toggle('shell--menu-open');
      toggle.setAttribute('aria-expanded', String(open));
    });

    appEvents.on('route:changed', ({ path }) => {
      this.element.classList.remove('shell--menu-open');
      toggle.setAttribute('aria-expanded', 'false');
      this.highlight(path);
    });

    appEvents.on('backend:status', ({ online }) => this.showBackendStatus(online));
  }

  private highlight(path: string): void {
    let title = '';
    this.element.querySelectorAll<HTMLAnchorElement>('.nav__link').forEach((link) => {
      const active = link.dataset.path === path;
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
