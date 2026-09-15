// Unit converter: two editable fields, either can drive the other. Fields
// accept arithmetic ("12*3", "1/3") so quick sums need no calculator trip.

import { h, replace, store, params, setParams, copyWithToast, share } from './dom.js';
import { icon } from './icons.js';
import { picker } from './picker.js';
import { CATEGORY_BY_ID, getUnit, convert, linearFactor, hasDataModes, dataGroup, sizeHint, sortDataUnits } from '../data/units.js';
import { dataModeToggle, getDataMode, onDataMode } from './datamode.js';
import { calculate } from '../core/calc.js';
import { formatNumber, plainNumber } from '../core/format.js';

const SYSTEM_GROUP = { metric: 'Metric', imperial: 'Imperial & US', us: 'Imperial & US', other: 'Other' };
const PRECISIONS = [
  { value: 4, label: '4 digits' },
  { value: 6, label: '6 digits' },
  { value: 8, label: '8 digits' },
  { value: 10, label: '10 digits' },
  { value: 15, label: 'Max' },
];

/** Read a number typed into a field; arithmetic allowed. */
export function readNumber(text) {
  const s = String(text).trim();
  if (!s) return { empty: true };
  const direct = Number(s.replace(/,/g, ''));
  if (Number.isFinite(direct) && /^[-+]?[\d,]*\.?\d*(e[-+]?\d+)?$/i.test(s)) return { value: direct };
  const r = calculate(s.replace(/[x×]/g, '*'));
  if (r.ok && r.kind === 'number' && Number.isFinite(r.value)) return { value: r.value, computed: true };
  return { error: r.ok ? 'Enter a plain number' : r.error };
}

function unitOptions(cat, mode) {
  const order = ['metric', 'imperial', 'us', 'other'];
  const search = (u) => [u.name, u.plural, ...u.names, ...u.symbols].join(' ');
  if (hasDataModes(cat)) {
    return sortDataUnits(cat.units, mode).map((u) => {
      const size = sizeHint(u, mode);
      return { value: u.id, label: u.symbol, short: u.symbol, hint: size ? `${u.name} · ${size}` : u.name, group: dataGroup(u, mode), search: search(u) };
    });
  }
  return [...cat.units]
    .sort((a, b) => order.indexOf(a.system) - order.indexOf(b.system))
    .map((u) => ({ value: u.id, label: u.symbol, short: u.symbol, hint: u.name, group: SYSTEM_GROUP[u.system], search: search(u) }));
}

export function mount(root, data) {
  const cat = CATEGORY_BY_ID.get(data.category) ?? CATEGORY_BY_ID.get('length');
  const q = params();
  const has = (id) => cat.units.some((u) => u.id === id);
  let fromId = has(q.get('from')) ? q.get('from') : has(data.from) ? data.from : cat.pair[0];
  let toId = has(q.get('to')) ? q.get('to') : has(data.to) ? data.to : cat.pair[1];
  let sig = store.get('units.sig', 10) || 10;
  let driver = 'from';
  let text = { from: q.get('v') ?? data.value ?? '1', to: '' };
  const modal = hasDataModes(cat);
  let mode = modal ? getDataMode() : undefined;

  const fromInput = h('input', { class: 'field-input', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'done', 'aria-label': 'Value to convert', value: text.from });
  const toInput = h('input', { class: 'field-input', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'done', 'aria-label': 'Converted value' });
  const fromMsg = h('p', { class: 'field-msg', 'aria-live': 'polite' });
  const toMsg = h('p', { class: 'field-msg', 'aria-live': 'polite' });

  const options = unitOptions(cat, mode);
  const fromPick = picker({ label: 'From unit', options, value: fromId, placeholder: `Search ${cat.noun} units`, onChange: (v) => ((fromId = v), sync()) });
  const toPick = picker({ label: 'To unit', options, value: toId, placeholder: `Search ${cat.noun} units`, onChange: (v) => ((toId = v), sync()) });

  const swapBtn = h('button', { type: 'button', class: 'swap', 'aria-label': 'Swap units' }, icon('swap', { size: 20 }));
  const formula = h('p', { class: 'formula' });
  const sentence = h('p', { class: 'sentence', 'aria-live': 'polite' });
  const copyBtn = h('button', { type: 'button', class: 'btn ghost small' }, icon('copy', { size: 16 }), 'Copy');
  const shareBtn = h('button', { type: 'button', class: 'btn ghost small' }, icon('share', { size: 16 }), 'Share');
  const precision = h(
    'select',
    { class: 'mini-select', 'aria-label': 'Precision' },
    PRECISIONS.map((p) => h('option', { value: String(p.value), text: p.label, selected: p.value === sig })),
  );
  const tableBody = h('tbody');

  replace(
    root,
    h(
      'div',
      { class: 'conv' },
      modal && dataModeToggle(),
      h(
        'div',
        { class: 'conv-fields' },
        h('div', { class: 'field' }, h('span', { class: 'field-label', text: 'From' }), h('div', { class: 'field-row' }, fromInput, fromPick.el), fromMsg),
        swapBtn,
        h('div', { class: 'field' }, h('span', { class: 'field-label', text: 'To' }), h('div', { class: 'field-row' }, toInput, toPick.el), toMsg),
      ),
      sentence,
      formula,
      h('div', { class: 'conv-bar' }, h('label', { class: 'mini' }, 'Precision ', precision), h('span', { class: 'spacer' }), copyBtn, shareBtn),
      h(
        'details',
        { class: 'all-units', open: matchMedia('(min-width: 900px)').matches || undefined },
        h('summary', { text: `Every ${cat.noun} unit at once` }),
        h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('caption', { class: 'sr-only', text: `The value in every ${cat.noun} unit` }), h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: 'Unit' }), h('th', { scope: 'col', text: 'Value' }))), tableBody)),
      ),
    ),
  );

  function compute() {
    const src = driver === 'from' ? fromInput : toInput;
    const dst = driver === 'from' ? toInput : fromInput;
    const msg = driver === 'from' ? fromMsg : toMsg;
    const other = driver === 'from' ? toMsg : fromMsg;
    other.textContent = '';
    const from = getUnit(cat.id, driver === 'from' ? fromId : toId);
    const to = getUnit(cat.id, driver === 'from' ? toId : fromId);
    const n = readNumber(src.value);
    src.classList.toggle('invalid', Boolean(n.error));
    if (n.error) {
      msg.textContent = n.error;
      return null;
    }
    msg.textContent = n.computed ? `= ${formatNumber(n.value)}` : '';
    if (n.empty) {
      dst.value = '';
      return null;
    }
    const out = convert(n.value, from, to, mode);
    dst.value = Number.isFinite(out) ? plainNumber(out, sig) : '';
    const fromVal = driver === 'from' ? n.value : out;
    return { fromVal, toVal: driver === 'from' ? out : n.value };
  }

  function render() {
    const vals = compute();
    const from = getUnit(cat.id, fromId);
    const to = getUnit(cat.id, toId);
    const k = linearFactor(from, to, mode);
    if (k != null) formula.textContent = `1 ${from.symbol} = ${formatNumber(k, { sig: 12 })} ${to.symbol}  ·  1 ${to.symbol} = ${formatNumber(1 / k, { sig: 12 })} ${from.symbol}`;
    else if (cat.id === 'temperature') formula.textContent = temperatureFormula(from, to);
    else formula.textContent = `${from.symbol} and ${to.symbol} are inversely related, so the factor changes with the value.`;

    if (vals && Number.isFinite(vals.toVal)) {
      sentence.textContent = `${formatNumber(vals.fromVal, { sig })} ${label(from, vals.fromVal)} = ${formatNumber(vals.toVal, { sig })} ${label(to, vals.toVal)}`;
    } else sentence.textContent = '';

    const base = vals?.fromVal ?? 1;
    replace(
      tableBody,
      cat.units.map((u) => {
        const v = convert(base, from, u, mode);
        return h(
          'tr',
          { class: u.id === toId ? 'current' : '' },
          h('th', { scope: 'row' }, h('button', { type: 'button', class: 'linkish', dataset: { unit: u.id }, 'aria-label': `Convert to ${u.plural}` }, h('b', { text: u.symbol }), ' ', h('span', { text: u.name }))),
          h('td', { class: 'num', text: Number.isFinite(v) ? formatNumber(v, { sig }) : '—' }),
        );
      }),
    );
  }

  function label(u, v) {
    return Math.abs(v) === 1 ? u.name : u.plural;
  }

  function sync() {
    fromPick.set(fromId);
    toPick.set(toId);
    store.set(`units.last.${cat.id}`, { from: fromId, to: toId });
    render();
    const defaults = { from: data.from ?? cat.pair[0], to: data.to ?? cat.pair[1], v: data.value ?? '1' };
    setParams({
      from: fromId !== defaults.from ? fromId : null,
      to: toId !== defaults.to ? toId : null,
      v: fromInput.value !== defaults.v ? fromInput.value : null,
    });
  }

  fromInput.addEventListener('input', () => {
    driver = 'from';
    sync();
  });
  toInput.addEventListener('input', () => {
    driver = 'to';
    render();
  });
  swapBtn.addEventListener('click', () => {
    [fromId, toId] = [toId, fromId];
    const carried = toInput.value;
    if (carried) fromInput.value = carried;
    driver = 'from';
    swapBtn.classList.remove('spin');
    void swapBtn.offsetWidth;
    swapBtn.classList.add('spin');
    sync();
  });
  precision.addEventListener('change', () => {
    sig = Number(precision.value);
    store.set('units.sig', sig);
    render();
  });
  tableBody.addEventListener('click', (e) => {
    const b = e.target.closest('[data-unit]');
    if (!b) return;
    toId = b.dataset.unit;
    driver = 'from';
    sync();
    toInput.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  copyBtn.addEventListener('click', () => copyWithToast(toInput.value || '0'));
  shareBtn.addEventListener('click', () => {
    const url = new URL(location.href);
    url.searchParams.set('v', fromInput.value);
    url.searchParams.set('from', fromId);
    url.searchParams.set('to', toId);
    share({ title: 'ConvertEasy', text: `${sentence.textContent} · ConvertEasy`, url: url.toString() });
  });

  if (modal) {
    onDataMode((m) => {
      mode = m;
      fromPick.setOptions(unitOptions(cat, mode), fromId);
      toPick.setOptions(unitOptions(cat, mode), toId);
      render();
    });
  }

  render();
}

function temperatureFormula(from, to) {
  const f = {
    'C>F': '°F = °C × 9/5 + 32',
    'F>C': '°C = (°F − 32) × 5/9',
    'C>K': 'K = °C + 273.15',
    'K>C': '°C = K − 273.15',
    'F>K': 'K = (°F + 459.67) × 5/9',
    'K>F': '°F = K × 9/5 − 459.67',
    'R>K': 'K = °R × 5/9',
    'K>R': '°R = K × 9/5',
    'F>R': '°R = °F + 459.67',
    'R>F': '°F = °R − 459.67',
    'C>R': '°R = (°C + 273.15) × 9/5',
    'R>C': '°C = (°R − 491.67) × 5/9',
  };
  return f[`${from.id}>${to.id}`] ?? 'Same scale';
}
