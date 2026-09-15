// Number bases (binary, octal, decimal, hex, any base 2–36) and Roman numerals.

import { h, replace, params, setParams, copyWithToast } from './dom.js';
import { icon } from './icons.js';
import { BASES, parseInBase, formatInBase, bitLength, toRoman, fromRoman } from '../core/numbase.js';
import { formatNumber } from '../core/format.js';

export function mount(root, data) {
  const q = params();
  let base = Number(q.get('base') ?? data.base ?? 10);
  const input = h('input', { class: 'field-input mono', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'off', 'aria-label': 'Number', value: q.get('v') ?? data.value ?? '255' });
  const baseSel = h(
    'select',
    { class: 'mini-select', 'aria-label': 'Input base' },
    [...BASES, { base: 3, name: 'Base 3' }, { base: 5, name: 'Base 5' }, { base: 12, name: 'Base 12' }, { base: 20, name: 'Base 20' }]
      .sort((a, b) => a.base - b.base)
      .map((b) => h('option', { value: String(b.base), text: `${b.name} (${b.base})`, selected: b.base === base })),
  );
  const msg = h('p', { class: 'field-msg', 'aria-live': 'polite' });
  const out = h('tbody');
  const meta = h('p', { class: 'formula' });
  const romanIn = h('input', { class: 'field-input mono', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'characters', 'aria-label': 'Number or Roman numeral', value: 'MMXXVI' });
  const romanOut = h('output', { class: 'money-big', 'aria-live': 'polite' });
  const romanMsg = h('p', { class: 'field-msg' });

  replace(
    root,
    h(
      'div',
      { class: 'conv bases' },
      h('div', { class: 'field' }, h('span', { class: 'field-label', text: 'Number' }), h('div', { class: 'field-row' }, input, baseSel), msg),
      h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('caption', { class: 'sr-only', text: 'The number in each base' }), out)),
      meta,
      h('h3', { class: 'mini-title', text: 'Roman numerals' }),
      h('div', { class: 'field' }, h('div', { class: 'field-row' }, romanIn, romanOut), romanMsg),
    ),
  );

  function render() {
    let n;
    try {
      n = parseInBase(input.value, base);
      msg.textContent = '';
      input.classList.remove('invalid');
    } catch (err) {
      msg.textContent = err.message;
      input.classList.add('invalid');
      replace(out);
      meta.textContent = '';
      return;
    }
    const rows = [...BASES];
    if (!rows.some((b) => b.base === base)) rows.push({ base, name: `Base ${base}`, prefix: '' });
    replace(
      out,
      rows.map((b) => {
        const text = formatInBase(n, b.base);
        const plainText = (b.prefix ?? '') + formatInBase(n, b.base, { group: false });
        const btn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Copy ${b.name}` }, icon('copy', { size: 16 }));
        btn.addEventListener('click', () => copyWithToast(plainText));
        return h('tr', { class: b.base === base ? 'current' : '' }, h('th', { scope: 'row', text: `${b.name}` }), h('td', { class: 'mono wrap', text: text }), h('td', {}, btn));
      }),
    );
    const bits = bitLength(n);
    meta.textContent = `${formatNumber(bits)} bit${bits === 1 ? '' : 's'} · ${formatNumber(Math.ceil(bits / 8))} byte${Math.ceil(bits / 8) === 1 ? '' : 's'}${n >= 0n && n <= 0x10ffffn && n > 31n ? ` · Unicode U+${n.toString(16).toUpperCase().padStart(4, '0')}` : ''}`;
    setParams({ v: input.value !== (data.value ?? '255') ? input.value : null, base: base !== Number(data.base ?? 10) ? String(base) : null });
  }

  function renderRoman() {
    const s = romanIn.value.trim();
    romanMsg.textContent = '';
    if (!s) return (romanOut.textContent = '');
    try {
      if (/^\d+$/.test(s)) romanOut.textContent = toRoman(Number(s));
      else romanOut.textContent = formatNumber(fromRoman(s));
    } catch (err) {
      romanOut.textContent = '—';
      romanMsg.textContent = err.message;
    }
  }

  input.addEventListener('input', render);
  baseSel.addEventListener('change', () => {
    // Re-express the current value in the new base so the number is kept.
    let n = null;
    try {
      n = parseInBase(input.value, base);
    } catch {
      /* keep text */
    }
    base = Number(baseSel.value);
    if (n != null) input.value = formatInBase(n, base, { group: false });
    render();
  });
  romanIn.addEventListener('input', renderRoman);
  render();
  renderRoman();
}
