// Inline SVG icons, 24×24, stroke-based so they inherit currentColor.

import { svg } from './dom.js';

const PATHS = {
  swap: ['M7 4 3 8l4 4', 'M3 8h14', 'M17 20l4-4-4-4', 'M21 16H7'],
  copy: ['M9 9h11v11H9z', 'M5 15H4V4h11v1'],
  share: ['M12 3v13', 'M7 8l5-5 5 5', 'M5 13v7h14v-7'],
  refresh: ['M20 11a8 8 0 1 0-2.3 5.7', 'M20 4v7h-7'],
  chevron: ['M6 9l6 6 6-6'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M20 20l-4-4'],
  sun: ['M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M12 2v2', 'M12 20v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M2 12h2', 'M20 12h2', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4'],
  moon: ['M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z'],
  plus: ['M12 5v14', 'M5 12h14'],
  trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13'],
  check: ['M5 12l5 5 9-10'],
  info: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 11v6', 'M12 7.5v.5'],
  wifiOff: ['M2 8.8a15 15 0 0 1 4.2-2.6', 'M10.7 5.1A15 15 0 0 1 22 8.8', 'M5 12.6a10 10 0 0 1 5.2-2.6', 'M16.8 10.7A10 10 0 0 1 19 12.6', 'M8.5 16.4a5 5 0 0 1 7 0', 'M12 20h.01', 'M3 3l18 18'],
  download: ['M12 3v12', 'M7 10l5 5 5-5', 'M5 21h14'],
  keyboard: ['M3 6h18v12H3z', 'M7 10h.01', 'M11 10h.01', 'M15 10h.01', 'M7 14h10'],
  history: ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v5h5', 'M12 7v5l3 2'],
  sparkle: ['M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z'],
  arrowRight: ['M5 12h14', 'M13 6l6 6-6 6'],
  calc: ['M6 3h12v18H6z', 'M9 7h6', 'M9 11h.01', 'M12 11h.01', 'M15 11h.01', 'M9 15h.01', 'M12 15h.01', 'M15 15h.01'],
};

export function icon(name, { size = 18, label } = {}) {
  const el = svg(
    'svg',
    {
      viewBox: '0 0 24 24',
      width: size,
      height: size,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 1.8,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': label ? 'false' : 'true',
      focusable: 'false',
      class: 'icon',
    },
    ...(PATHS[name] ?? []).map((d) => svg('path', { d })),
  );
  if (label) {
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', label);
  }
  return el;
}
