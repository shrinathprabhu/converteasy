// Byte counting mode, shared by the data converters and the calculator.
//
//   decimal (SI):  1 KB = 1,000 B   drives, macOS, iOS, Android, networks
//   binary:        1 KB = 1,024 B   Windows, RAM (IEC names: KiB, MiB, GiB)
//
// Bits are decimal either way (1 Kb = 1,000 b) and 1 B is always 8 b.
// The choice is remembered in this browser; ?bytes=binary in a shared link
// overrides it for that visit.

import { h, store, params, setParams } from './dom.js';

const KEY = 'dataMode';
const listeners = new Set();
let override = null;
{
  const q = params().get('bytes');
  if (q === 'binary' || q === 'decimal') override = q;
}

export function getDataMode() {
  if (override) return override;
  return store.get(KEY, 'decimal') === 'binary' ? 'binary' : 'decimal';
}

export function setDataMode(mode) {
  override = null;
  store.set(KEY, mode);
  setParams({ bytes: mode === 'binary' ? 'binary' : null });
  for (const fn of listeners) fn(mode);
}

export function onDataMode(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const OPTIONS = [
  { value: 'decimal', title: 'Decimal', sub: '1 KB = 1,000 B', hint: 'SI: drives, macOS, iOS, Android' },
  { value: 'binary', title: 'Binary', sub: '1 KB = 1,024 B', hint: 'Windows and RAM (KiB, MiB)' },
];

/**
 * A two-option switch. Every instance on the page stays in sync.
 * @param {{ compact?: boolean }} [o] compact omits the explanation line
 */
export function dataModeToggle({ compact = false } = {}) {
  const buttons = OPTIONS.map((opt) =>
    h(
      'button',
      { type: 'button', role: 'radio', class: 'seg-btn', dataset: { value: opt.value }, title: opt.hint },
      h('b', { text: opt.title }),
      h('small', { text: opt.sub }),
    ),
  );
  const group = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'How to count bytes' }, buttons);
  const note = compact ? null : h('p', { class: 'note seg-note' });
  const label = compact ? h('span', { class: 'seg-label', text: 'Bytes' }) : null;
  const root = h('div', { class: `data-mode${compact ? ' compact' : ''}` }, label, group, note);

  function render(mode) {
    for (const b of buttons) {
      const on = b.dataset.value === mode;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    if (note) {
      note.textContent =
        mode === 'binary'
          ? 'Binary: 1 KB = 1,024 B and 1 GB = 1,024 MB, the way Windows and RAM count. Bits stay decimal: 1 Kb = 1,000 b, 1 B = 8 b.'
          : 'Decimal (SI): 1 KB = 1,000 B and 1 GB = 1,000 MB, the way drives, macOS and phones count. Bits are decimal too: 1 Kb = 1,000 b, 1 B = 8 b.';
    }
  }

  group.addEventListener('click', (e) => {
    const b = e.target.closest('[data-value]');
    if (b && b.dataset.value !== getDataMode()) setDataMode(b.dataset.value);
  });
  group.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const next = getDataMode() === 'binary' ? 'decimal' : 'binary';
    setDataMode(next);
    group.querySelector(`[data-value="${next}"]`)?.focus();
  });

  render(getDataMode());
  const off = onDataMode(render);
  root.destroy = off;
  return root;
}
