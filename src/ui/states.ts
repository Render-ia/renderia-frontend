import { escapeHtml } from '../utils/html.ts';

/** Placeholder shown while data loads. */
export function loadingState(text = 'Cargando…'): string {
  return `<p class="state state--loading" role="status"><span class="spinner" aria-hidden="true"></span>${escapeHtml(text)}</p>`;
}

/** Explains what failed and, optionally, offers a retry button (data-retry). */
export function errorState(message: string, retry = true): string {
  return `
    <div class="state state--error" role="alert">
      <p>${escapeHtml(message)}</p>
      ${retry ? '<button class="button button--ghost button--small" type="button" data-retry>Reintentar</button>' : ''}
    </div>`;
}

/** Invitation to act when a list has nothing yet. `actionHtml` is trusted markup. */
export function emptyState(title: string, text: string, actionHtml = ''): string {
  return `
    <div class="state state--empty">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(text)}</p>
      ${actionHtml}
    </div>`;
}

/** Message for any thrown value. */
export function errorMessage(error: unknown, fallback = 'Ocurrió un error inesperado.'): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
