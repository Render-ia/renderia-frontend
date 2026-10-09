/** One tab of the administration screen. */
export interface AdminPanel {
  readonly id: string;
  readonly label: string;
  mount(container: HTMLElement): void;
}
