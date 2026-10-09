/**
 * Simple floor plan drawn as SVG, as it would appear on a blueprint sheet.
 * Colors come from CSS (.plan__walls, .plan__columns...), so the same drawing
 * works on paper (home) and on cyanotype blue (login).
 */
export function planDrawing(label = 'Ejemplo de plano de planta'): string {
  return `
    <svg class="plan" viewBox="0 0 400 260" role="img" aria-label="${label}">
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
