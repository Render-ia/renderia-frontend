import type { View } from '../../views/View.ts';
import { appEvents } from '../events/AppEvents.ts';

export type RouteParams = Record<string, string>;
export type ViewFactory = (params: RouteParams) => View;

export interface RouteOptions {
  /** Public routes (login, register) are reachable without a session. */
  isPublic?: boolean;
  /** Permission required to open the route. */
  permission?: string;
}

export interface ResolvedRoute {
  path: string;
  pattern: string;
  params: RouteParams;
  options: RouteOptions;
}

/**
 * Decides whether a route can be opened. Returns null to allow it, or the
 * path the user must be redirected to.
 */
export type RouteGuard = (route: ResolvedRoute) => string | null;

interface RouteDefinition {
  pattern: string;
  regex: RegExp;
  keys: string[];
  factory: ViewFactory;
  options: RouteOptions;
}

/**
 * Hash-based router (#/path). Hash routes work on any static hosting without
 * extra server rules. Supports parameters such as `/projects/:id`.
 */
export class Router {
  private routes: RouteDefinition[] = [];
  private guards: RouteGuard[] = [];
  private current: View | null = null;

  constructor(
    private readonly outlet: () => HTMLElement,
    private readonly notFound: ViewFactory,
  ) {}

  register(pattern: string, factory: ViewFactory, options: RouteOptions = {}): this {
    const keys: string[] = [];
    const source = pattern.replace(/:([a-zA-Z]+)/g, (_match, key: string) => {
      keys.push(key);
      return '([^/]+)';
    });
    this.routes.push({ pattern, regex: new RegExp(`^${source}$`), keys, factory, options });
    return this;
  }

  useGuard(guard: RouteGuard): this {
    this.guards.push(guard);
    return this;
  }

  start(): void {
    window.addEventListener('hashchange', () => this.resolve());
    this.resolve();
  }

  navigate(path: string): void {
    if (this.currentPath() === path) {
      this.resolve();
    } else {
      window.location.hash = path;
    }
  }

  /** Re-renders the current route (e.g. after logging in or out). */
  refresh(): void {
    this.resolve();
  }

  private currentPath(): string {
    const path = window.location.hash.replace(/^#/, '').split('?')[0];
    return path === '' ? '/' : path;
  }

  private match(path: string): { definition: RouteDefinition; params: RouteParams } | null {
    for (const definition of this.routes) {
      const result = definition.regex.exec(path);
      if (result) {
        const params: RouteParams = {};
        definition.keys.forEach((key, index) => {
          params[key] = decodeURIComponent(result[index + 1]);
        });
        return { definition, params };
      }
    }
    return null;
  }

  private resolve(): void {
    const path = this.currentPath();
    const found = this.match(path);

    if (found) {
      const route: ResolvedRoute = {
        path,
        pattern: found.definition.pattern,
        params: found.params,
        options: found.definition.options,
      };
      for (const guard of this.guards) {
        const redirect = guard(route);
        if (redirect && redirect !== path) {
          window.location.hash = redirect;
          return;
        }
      }
    }

    const view = found ? found.definition.factory(found.params) : this.notFound({});
    const isPublic = found?.definition.options.isPublic ?? false;

    this.current?.unmount();
    appEvents.emit('route:changed', { path, pattern: found?.definition.pattern ?? '', isPublic });

    this.current = view;
    this.current.mount(this.outlet());
    document.title = `${this.current.title} · Render.IA`;
    window.scrollTo(0, 0);
  }
}
