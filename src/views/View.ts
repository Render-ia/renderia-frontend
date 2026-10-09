/**
 * Base class for every screen of the app.
 *
 * Pattern: Template Method — `mount` defines the fixed steps (render the
 * markup, then wire the behaviour); subclasses fill in each step.
 */
export abstract class View {
  protected root: HTMLElement | null = null;

  /** Title shown in the browser tab. */
  abstract readonly title: string;

  mount(container: HTMLElement): void {
    this.root = container;
    container.innerHTML = this.render();
    this.afterRender(container);
  }

  /** Releases timers or listeners when the user leaves the screen. */
  unmount(): void {
    this.root = null;
  }

  protected abstract render(): string;

  protected afterRender(_container: HTMLElement): void {
    // Optional hook for subclasses.
  }
}
