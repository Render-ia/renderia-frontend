/**
 * Safe wrapper around localStorage. Some browsers (private mode, blocked
 * cookies) throw on access, so every call is guarded and falls back to memory.
 */
export class LocalStore {
  private static memory = new Map<string, string>();

  static read<T>(key: string, fallback: T): T {
    try {
      const raw = window.localStorage.getItem(key) ?? LocalStore.memory.get(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      const raw = LocalStore.memory.get(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    }
  }

  /** Returns false when the browser storage is full. */
  static write(key: string, value: unknown): boolean {
    const raw = JSON.stringify(value);
    LocalStore.memory.set(key, raw);
    try {
      window.localStorage.setItem(key, raw);
      return true;
    } catch (error) {
      return !(error instanceof DOMException && error.name === 'QuotaExceededError');
    }
  }

  static remove(key: string): void {
    LocalStore.memory.delete(key);
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Storage not available: memory copy already removed.
    }
  }
}
