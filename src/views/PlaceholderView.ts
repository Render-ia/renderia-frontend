import { View } from './View.ts';

/** Temporary screen for sections that are not built yet. */
export class PlaceholderView extends View {
  constructor(readonly title: string) {
    super();
  }

  protected render(): string {
    return `
      <section class="empty-state">
        <h1>${this.title}</h1>
        <p>Esta sección todavía no está disponible.</p>
        <a class="button" href="#/">Volver al panel</a>
      </section>`;
  }
}
