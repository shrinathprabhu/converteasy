// ⌘K / "/" search across every converter page, backed by the build-time
// pages.json index. Loaded only when opened.

import { h, replace } from './dom.js';
import { icon } from './icons.js';

let dialog;
let pages = null;

async function loadIndex() {
  if (pages) return pages;
  try {
    const res = await fetch(`/pages.json`, { credentials: 'omit' });
    pages = await res.json();
  } catch {
    pages = [];
  }
  return pages;
}

function rank(page, words) {
  const title = page.t.toLowerCase();
  const hay = `${title} ${page.k ?? ''}`.toLowerCase();
  let score = 0;
  for (const w of words) {
    if (!hay.includes(w)) return 0;
    score += title.startsWith(w) ? 6 : new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(hay) ? 3 : 1;
  }
  return score + (page.w ?? 0);
}

export async function openPalette() {
  if (!dialog) {
    const input = h('input', { type: 'search', class: 'palette-input', placeholder: 'Search converters: kg to lb, usd to inr, gwei…', 'aria-label': 'Search converters', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'palette-list', autocomplete: 'off', spellcheck: 'false' });
    const list = h('ul', { class: 'palette-list', id: 'palette-list', role: 'listbox', 'aria-label': 'Results' });
    dialog = h('dialog', { class: 'palette', 'aria-label': 'Search converters' }, h('div', { class: 'palette-head' }, icon('search'), input, h('kbd', { text: 'esc' })), list);
    document.body.append(dialog);
    let active = 0;
    let shown = [];
    const render = () => {
      const words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
      shown = (pages ?? [])
        .map((p) => ({ p, s: words.length ? rank(p, words) : p.w ?? 0 }))
        .filter((x) => x.s > 0 || !words.length)
        .sort((a, b) => b.s - a.s)
        .slice(0, 12)
        .map((x) => x.p);
      active = 0;
      replace(
        list,
        shown.length
          ? shown.map((p, i) => h('li', { role: 'option', id: `pal-${i}`, 'aria-selected': String(i === active) }, h('a', { href: p.p || '/', tabindex: '-1' }, h('span', { text: p.t }), h('small', { text: p.g ?? '' }))))
          : [h('li', { class: 'palette-empty', text: 'No converter matches. Try the smart calculator.' })],
      );
      input.setAttribute('aria-activedescendant', shown.length ? 'pal-0' : '');
    };
    const move = (d) => {
      if (!shown.length) return;
      active = (active + d + shown.length) % shown.length;
      for (const [i, li] of [...list.children].entries()) li.setAttribute('aria-selected', String(i === active));
      input.setAttribute('aria-activedescendant', `pal-${active}`);
      list.children[active]?.scrollIntoView({ block: 'nearest' });
    };
    input.addEventListener('input', render);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') (e.preventDefault(), move(1));
      else if (e.key === 'ArrowUp') (e.preventDefault(), move(-1));
      else if (e.key === 'Enter' && shown[active]) location.href = shown[active].p || '/';
    });
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
    dialog._render = render;
    dialog._input = input;
  }
  dialog.showModal();
  dialog._input.value = '';
  await loadIndex();
  dialog._render();
  dialog._input.focus();
}
