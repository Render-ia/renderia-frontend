import { appEvents } from '../core/events/AppEvents.ts';
import { ApiError } from '../core/http/ApiError.ts';
import { HelloService, type HelloResponse } from '../services/HelloService.ts';
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
          <div class="sheet__drawing">${this.planDrawing()}</div>
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

  /** Simple floor plan drawn as an SVG, as it would appear on a blueprint sheet. */
  private planDrawing(): string {
    return `
      <svg class="plan" viewBox="0 0 400 260" role="img" aria-label="Ejemplo de plano de planta">
        <g class="plan__walls">
          <path d="M40 30h320v200H40z"/>
          <path d="M180 30v80M180 150v80M40 130h90M230 130h130M290 130v100"/>
        </g>
        <g class="plan__openings">
          <path d="M180 110a40 40 0 0 1 40 40"/>
          <path d="M130 130a30 30 0 0 0 30 30"/>
          <path d="M100 230h50M300 30h40"/>
        </g>
        <g class="plan__columns">
          <rect x="34" y="24" width="12" height="12"/><rect x="174" y="24" width="12" height="12"/>
          <rect x="354" y="24" width="12" height="12"/><rect x="34" y="224" width="12" height="12"/>
          <rect x="174" y="224" width="12" height="12"/><rect x="354" y="224" width="12" height="12"/>
          <rect x="174" y="124" width="12" height="12"/><rect x="284" y="124" width="12" height="12"/>
        </g>
        <g class="plan__dimension">
          <path d="M40 252h320M40 246v12M360 246v12"/>
          <text x="200" y="248" text-anchor="middle">12,00 m</text>
        </g>
      </svg>`;
  }
}
