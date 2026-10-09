import type { View } from '../../views/View.ts';
import { appEvents } from '../events/AppEvents.ts';

export type ViewFactory = () => View;

/**
 * Hash-based router (#/path). Hash routes work on any static hosting
 * without extra server rules.
 */
export class Router {
  private routes = new Map<string, ViewFactory>();
  private current: View | null = null;

  constructor(
    private readonly outlet: HTMLElement,
    private readonly notFound: ViewFactory,
  ) {}

  register(path: string, factory: ViewFactory): this {
    this.routes.set(path, factory);
    return this;
  }

  start(): void {
    window.addEventListener('hashchange', () => this.resolve());
    this.resolve();
  }

  navigate(path: string): void {
    window.location.hash = path;
  }

  private currentPath(): string {
    const path = window.location.hash.replace(/^#/, '');
    return path === '' ? '/' : path;
  }

  private resolve(): void {
    const path = this.currentPath();
    const factory = this.routes.get(path) ?? this.notFound;

    this.current?.unmount();
    this.current = factory();
    this.current.mount(this.outlet);
    document.title = `${this.current.title} · Render.IA`;

    appEvents.emit('route:changed', { path });
  }
}
