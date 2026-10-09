import { View } from './View.ts';

/** Shown when the address does not match any route. */
export class NotFoundView extends View {
  readonly title = 'Página no encontrada';

  protected render(): string {
    return `
      <section class="empty-state">
        <p class="empty-state__code">404</p>
        <h1>Esta página no existe</h1>
        <p>Revisa la dirección o vuelve al panel para seguir trabajando.</p>
        <a class="button" href="#/">Volver al panel</a>
      </section>`;
  }
}
