import { appEvents } from '../core/events/AppEvents.ts';
import { ApiError } from '../core/http/ApiError.ts';
import { HelloService, type HelloResponse } from '../services/HelloService.ts';
import { planDrawing } from '../ui/planDrawing.ts';
import { escapeHtml } from '../utils/html.ts';
import { View } from './View.ts';

/**
 * Landing panel. Shows a drawing sheet whose title block is filled with the
 * data returned by the backend, proving frontend and backend talk to each other.
 */
export class HomeView extends View {
  readonly title = 'Panel';

  private readonly helloService = new HelloService();

  protected render(): string {
    return `
      <section class="home">
        <header class="page-header">
          <h1>De plano 2D a estructura 3D</h1>
          <p class="page-header__lead">
            Sube el plano de una edificación, deja que la IA detecte muros, columnas y vigas,
            y revisa el modelo estructural en tres dimensiones.
          </p>
        </header>

        <figure class="sheet">
          <div class="sheet__drawing">${planDrawing()}</div>
          <figcaption class="title-block" aria-live="polite">
            ${this.titleBlockLoading()}
          </figcaption>
        </figure>
      </section>`;
  }

  protected afterRender(container: HTMLElement): void {
    const block = container.querySelector<HTMLElement>('.title-block')!;
    this.loadHello(block);
  }

  private async loadHello(block: HTMLElement): Promise<void> {
    try {
      const data = await this.helloService.getHello();
      if (!this.root) return;
      block.innerHTML = this.titleBlock(data);
      appEvents.emit('backend:status', { online: true });
    } catch (error) {
      if (!this.root) return;
      const message = error instanceof ApiError ? error.message : 'Ocurrió un error inesperado.';
      block.innerHTML = this.titleBlockError(message);
      block.querySelector('button')?.addEventListener('click', () => {
        block.innerHTML = this.titleBlockLoading();
        this.loadHello(block);
      });
      appEvents.emit('backend:status', { online: false });
    }
  }

  private titleBlock(data: HelloResponse): string {
    const today = new Date().toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    return `
      <dl class="title-block__grid">
        <div class="title-block__cell title-block__cell--wide">
          <dt>Proyecto</dt><dd class="title-block__project">${escapeHtml(data.proyecto)}</dd>
        </div>
        <div class="title-block__cell title-block__cell--wide">
          <dt>Descripción</dt><dd>${escapeHtml(data.descripcion)}</dd>
        </div>
        <div class="title-block__cell">
          <dt>Integrantes</dt><dd>${data.integrantes.map(escapeHtml).join('<br>')}</dd>
        </div>
        <div class="title-block__cell">
          <dt>Fecha</dt><dd>${today}</dd>
        </div>
        <div class="title-block__cell title-block__cell--wide title-block__cell--ok">
          <dt>Respuesta del servidor</dt><dd>${escapeHtml(data.mensaje)}</dd>
        </div>
      </dl>`;
  }

  private titleBlockLoading(): string {
    return `<p class="title-block__message">Consultando el servidor…</p>`;
  }

  private titleBlockError(message: string): string {
    return `
      <div class="title-block__message title-block__message--error">
        <p><strong>Sin conexión con el servidor.</strong> ${message}</p>
        <p>Revisa que el backend esté encendido y que <code>VITE_API_URL</code> apunte a él.</p>
        <button class="button button--ghost" type="button">Reintentar</button>
      </div>`;
  }
}
