/** One entry of the side navigation. */
export interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const icon = (d: string): string =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Panel', icon: icon('M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z') },
  { path: '/projects', label: 'Proyectos', icon: icon('M3 7h7l2 2h9v10H3z') },
  { path: '/floor-plans', label: 'Planos', icon: icon('M4 4h16v16H4zM4 12h8M12 4v16M12 15h8') },
  { path: '/analyses', label: 'Análisis IA', icon: icon('M12 3v3M12 18v3M3 12h3M18 12h3M7 7l2 2M15 15l2 2M7 17l2-2M15 9l2-2M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6') },
  { path: '/viewer', label: 'Visor 3D', icon: icon('M12 3 4 7.5v9L12 21l8-4.5v-9zM4 7.5 12 12l8-4.5M12 12v9') },
  { path: '/admin', label: 'Administración', icon: icon('M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M4 12h2M18 12h2M12 4v2M12 18v2') },
];
