export type ToastTone = 'info' | 'success' | 'error';

/** Short notifications shown in the corner of the screen. */
export class Toast {
  private static region: HTMLElement | null = null;

  static show(message: string, tone: ToastTone = 'info', durationMs = 4000): void {
    const region = Toast.getRegion();
    const toast = document.createElement('div');
    toast.className = `toast toast--${tone}`;
    toast.setAttribute('role', tone === 'error' ? 'alert' : 'status');
    toast.textContent = message;
    region.append(toast);

    window.setTimeout(() => {
      toast.classList.add('toast--leaving');
      window.setTimeout(() => toast.remove(), 200);
    }, durationMs);
  }

  static success(message: string): void {
    Toast.show(message, 'success');
  }

  static error(message: string): void {
    Toast.show(message, 'error', 6000);
  }

  private static getRegion(): HTMLElement {
    if (!Toast.region || !document.body.contains(Toast.region)) {
      Toast.region = document.createElement('div');
      Toast.region.className = 'toast-region';
      Toast.region.setAttribute('aria-live', 'polite');
      document.body.append(Toast.region);
    }
    return Toast.region;
  }
}
