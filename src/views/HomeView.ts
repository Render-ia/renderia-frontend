import { Session } from '../auth/Session.ts';
import { appEvents } from '../core/events/AppEvents.ts';
import { HelloService, type HelloResponse } from '../services/HelloService.ts';
import { escapeHtml } from '../utils/html.ts';
import { DashboardSummary } from './home/DashboardSummary.ts';
import { View } from './View.ts';

/**
 * Landing panel: the latest analysis drawn on a blueprint, the user's numbers
 * and recent work. The backend's hello endpoint is still called to report the
 * connection state in the sidebar and credit the team at the bottom.
 */
export class HomeView extends View {
  readonly title = 'Panel';

  private readonly helloService = new HelloService();

  protected render(): string {
    return `
      <section class="home">
        <header class="home__header">
          <div class="home__heading">
            <p class="home__greeting">${this.greeting()}</p>
            <h1>De plano 2D a estructura 3D</h1>
          </div>
          <a class="button button--lg" href="#/analyses/new">Analizar un plano</a>
        </header>

        <div class="dashboard" data-dashboard></div>

        <p class="home__about" data-about aria-live="polite"></p>
      </section>`;
  }

  protected afterRender(container: HTMLElement): void {
    new DashboardSummary().mount(container.querySelector<HTMLElement>('[data-dashboard]')!);
    this.loadHello(container.querySelector<HTMLElement>('[data-about]')!);
  }

  private greeting(): string {
    const hour = new Date().getHours();
    const salute = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
    const name = Session.getInstance().user?.fullName.split(' ')[0] ?? '';
    return `${salute}, ${escapeHtml(name)}`;
  }

  private async loadHello(about: HTMLElement): Promise<void> {
    try {
      const data = await this.helloService.getHello();
      if (!this.root) return;
      about.innerHTML = this.credits(data);
      appEvents.emit('backend:status', { online: true });
    } catch {
      // The sidebar shows the offline state; the panel keeps working with local data.
      appEvents.emit('backend:status', { online: false });
    }
  }

  private credits(data: HelloResponse): string {
    return `${escapeHtml(data.proyecto)}, hecho por ${data.integrantes.map(escapeHtml).join(' y ')}.`;
  }
}
