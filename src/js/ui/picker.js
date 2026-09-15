// A searchable picker for units and currencies.
//
// A button shows the current choice; activating it opens a popover (a bottom
// sheet on phones) with a search box and a grouped listbox. Keyboard: arrows
// move, Enter picks, Escape closes, typing filters. ARIA combobox pattern.

import { h, id, replace } from './dom.js';
import { icon } from './icons.js';

/**
 * @param {object} o
 * @param {Array<{value:string,label:string,hint?:string,group?:string,badge?:string,search?:string}>} o.options
 * @param {string} o.value
 * @param {(v:string)=>void} o.onChange
 * @param {string} o.label  accessible name, e.g. "From unit"
 * @param {(opt)=>Node|string} [o.renderValue]
 */
export function picker(o) {
  let options = o.options;
  let value = o.value;
  let open = false;
  let active = 0;
  let filtered = [];
  const listId = id('list');

  const valueEl = h('span', { class: 'picker-value' });
  const button = h('button', { type: 'button', class: 'picker-btn', 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-label': o.label }, valueEl, icon('chevron', { size: 16 }));
  const input = h('input', {
    type: 'search',
    class: 'picker-search',
    placeholder: o.placeholder ?? 'Search',
    role: 'combobox',
    'aria-autocomplete': 'list',
    'aria-controls': listId,
    'aria-expanded': 'true',
    'aria-label': `Search ${o.label.toLowerCase()}`,
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    enterkeyhint: 'go',
  });
  const list = h('ul', { class: 'picker-list', role: 'listbox', id: listId, 'aria-label': o.label });
  const closeBtn = h('button', { type: 'button', class: 'picker-close icon-btn', 'aria-label': 'Close' }, icon('close'));
  const pop = h('div', { class: 'picker-pop', hidden: true }, h('div', { class: 'picker-head' }, icon('search', { size: 16 }), input, closeBtn), list);
  const root = h('div', { class: 'picker' }, button, pop);

  function current() {
    return options.find((x) => x.value === value);
  }

  function renderValue() {
    const opt = current();
    replace(valueEl, opt ? (o.renderValue ? o.renderValue(opt) : [h('b', { text: opt.short ?? opt.label }), opt.hint && h('small', { text: opt.hint })]) : '—');
    button.title = opt ? `${opt.label}${opt.hint ? ` · ${opt.hint}` : ''}` : '';
  }

  function score(opt, q) {
    if (!q) return 1;
    const hay = `${opt.label} ${opt.hint ?? ''} ${opt.search ?? ''}`.toLowerCase();
    const label = opt.label.toLowerCase();
    if (label === q) return 100;
    if (label.startsWith(q)) return 50;
    if (hay.split(/[\s(),/·]+/).some((w) => w.startsWith(q))) return 20;
    if (hay.includes(q)) return 5;
    return 0;
  }

  function renderList() {
    const q = input.value.trim().toLowerCase();
    filtered = options
      .map((opt, i) => ({ opt, s: score(opt, q), i }))
      .filter((x) => x.s > 0)
      .sort((a, b) => (q ? b.s - a.s || a.i - b.i : a.i - b.i))
      .map((x) => x.opt);
    const items = [];
    let lastGroup = null;
    filtered.forEach((opt, idx) => {
      if (!q && opt.group && opt.group !== lastGroup) {
        items.push(h('li', { class: 'picker-group', role: 'presentation', text: opt.group }));
        lastGroup = opt.group;
      }
      items.push(
        h(
          'li',
          {
            role: 'option',
            id: `${listId}-${idx}`,
            class: 'picker-opt',
            'aria-selected': String(opt.value === value),
            dataset: { idx: String(idx) },
          },
          opt.badge && h('span', { class: 'picker-badge', 'aria-hidden': 'true', text: opt.badge }),
          h('span', { class: 'picker-label', text: opt.label }),
          opt.hint && h('span', { class: 'picker-hint', text: opt.hint }),
        ),
      );
    });
    if (!filtered.length) items.push(h('li', { class: 'picker-empty', role: 'presentation', text: 'No matches' }));
    replace(list, items);
    active = Math.max(0, filtered.findIndex((x) => x.value === value));
    if (q) active = 0;
    highlight();
  }

  function highlight() {
    for (const li of list.querySelectorAll('.picker-opt')) li.classList.toggle('active', Number(li.dataset.idx) === active);
    const el = list.querySelector(`[data-idx="${active}"]`);
    if (el) {
      input.setAttribute('aria-activedescendant', el.id);
      el.scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  }

  function choose(opt) {
    if (!opt) return;
    const changed = opt.value !== value;
    value = opt.value;
    renderValue();
    close(true);
    if (changed) o.onChange(value);
  }

  function onDocPointer(e) {
    if (!root.contains(e.target)) close(false);
  }

  function openPop() {
    if (open) return;
    open = true;
    pop.hidden = false;
    root.classList.add('open');
    button.setAttribute('aria-expanded', 'true');
    input.value = '';
    renderList();
    document.addEventListener('pointerdown', onDocPointer, true);
    // Phones get a sheet; focusing the search would pop the keyboard over it.
    if (matchMedia('(pointer: fine)').matches) input.focus();
    else list.focus?.();
    document.body.classList.toggle('sheet-open', !matchMedia('(min-width: 640px)').matches);
  }

  function close(refocus) {
    if (!open) return;
    open = false;
    pop.hidden = true;
    root.classList.remove('open');
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onDocPointer, true);
    document.body.classList.remove('sheet-open');
    if (refocus) button.focus();
  }

  button.addEventListener('click', () => (open ? close(true) : openPop()));
  button.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openPop();
    }
  });
  closeBtn.addEventListener('click', () => close(true));
  input.addEventListener('input', renderList);
  list.setAttribute('tabindex', '-1');
  const keys = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = Math.min(filtered.length - 1, active + 1);
      highlight();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = Math.max(0, active - 1);
      highlight();
    } else if (e.key === 'Home' && e.target === list) {
      active = 0;
      highlight();
    } else if (e.key === 'End' && e.target === list) {
      active = filtered.length - 1;
      highlight();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(filtered[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    } else if (e.key === 'Tab') close(false);
  };
  input.addEventListener('keydown', keys);
  list.addEventListener('keydown', keys);
  list.addEventListener('click', (e) => {
    const li = e.target.closest('.picker-opt');
    if (li) choose(filtered[Number(li.dataset.idx)]);
  });

  renderValue();

  return {
    el: root,
    get value() {
      return value;
    },
    set(v, { silent = true } = {}) {
      value = v;
      renderValue();
      if (!silent) o.onChange(value);
    },
    setOptions(next, v = value) {
      options = next;
      value = v;
      renderValue();
      if (open) renderList();
    },
    focus() {
      button.focus();
    },
  };
}
