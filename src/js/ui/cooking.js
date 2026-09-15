// Cups ↔ grams for real ingredients: volume and weight only convert through a
// density, so the ingredient is part of the question.

import { h, replace, params, setParams, store } from './dom.js';
import { icon } from './icons.js';
import { picker } from './picker.js';
import { readNumber } from './units.js';
import { INGREDIENTS, INGREDIENT_BY_ID, density, COOK_VOLUME, COOK_MASS } from '../data/ingredients.js';
import { getUnit } from '../data/units.js';
import { formatNumber } from '../core/format.js';

const FRACTIONS = [
  ['⅛', 0.125], ['¼', 0.25], ['⅓', 1 / 3], ['½', 0.5], ['⅔', 2 / 3], ['¾', 0.75], ['1', 1], ['2', 2],
];

function unitOf(key) {
  const [cat, uid] = key.split(':');
  return getUnit(cat, uid);
}

export function mount(root, data) {
  const q = params();
  let ing = INGREDIENT_BY_ID.get(q.get('ingredient') ?? data.ingredient ?? store.get('cook.ing')) ?? INGREDIENTS[0];
  let from = q.get('from') ?? data.from ?? 'volume:cup';
  let to = q.get('to') ?? data.to ?? 'mass:g';

  const unitOpts = [
    ...COOK_VOLUME.map((id) => getUnit('volume', id)).map((u) => ({ value: `volume:${u.id}`, label: u.symbol, short: u.symbol, hint: u.name, group: 'Volume' })),
    ...COOK_MASS.map((id) => getUnit('mass', id)).map((u) => ({ value: `mass:${u.id}`, label: u.symbol, short: u.symbol, hint: u.name, group: 'Weight' })),
  ];
  const ingOpts = INGREDIENTS.map((i) => ({ value: i.id, label: i.name, short: i.name, hint: `${formatNumber(i.gPerCup)} g per cup`, group: i.group }));

  const ingPick = picker({ label: 'Ingredient', options: ingOpts, value: ing.id, placeholder: 'Search ingredients', onChange: (v) => ((ing = INGREDIENT_BY_ID.get(v)), store.set('cook.ing', v), sync()) });
  const amount = h('input', { class: 'field-input', inputmode: 'decimal', autocomplete: 'off', 'aria-label': 'Amount', value: q.get('v') ?? data.value ?? '1' });
  const msg = h('p', { class: 'field-msg', 'aria-live': 'polite' });
  const fromPick = picker({ label: 'From unit', options: unitOpts, value: from, onChange: (v) => ((from = v), sync()) });
  const toPick = picker({ label: 'To unit', options: unitOpts, value: to, onChange: (v) => ((to = v), sync()) });
  const swapBtn = h('button', { type: 'button', class: 'swap', 'aria-label': 'Swap units' }, icon('swap', { size: 20 }));
  const big = h('output', { class: 'money-big', 'aria-live': 'polite' });
  const formula = h('p', { class: 'formula' });
  const table = h('tbody');

  replace(
    root,
    h(
      'div',
      { class: 'conv cooking' },
      h('div', { class: 'field' }, h('span', { class: 'field-label', text: 'Ingredient' }), ingPick.el),
      h(
        'div',
        { class: 'conv-fields' },
        h('div', { class: 'field' }, h('span', { class: 'field-label', text: 'Amount' }), h('div', { class: 'field-row' }, amount, fromPick.el), msg),
        swapBtn,
        h('div', { class: 'field' }, h('span', { class: 'field-label', text: 'Equals' }), h('div', { class: 'field-row' }, big, toPick.el)),
      ),
      formula,
      h('p', { class: 'note', text: 'Weights assume spoon-and-level measuring with US cups (236.6 mL). Brands, sifting and packing change the real figure by up to about 10%.' }),
      h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('caption', { class: 'mini-title cap' }), h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: 'Cups' }), h('th', { scope: 'col', text: 'Grams' }), h('th', { scope: 'col', text: 'Ounces' }))), table)),
    ),
  );

  function toGrams(value, unit) {
    if (unit.category === 'mass') return value * unit.factor * 1000;
    return value * unit.factor * 1e6 * density(ing);
  }
  function fromGrams(g, unit) {
    if (unit.category === 'mass') return g / 1000 / unit.factor;
    return g / density(ing) / 1e6 / unit.factor;
  }

  function render() {
    const n = readNumber(amount.value);
    msg.textContent = n.error ?? '';
    const fu = unitOf(from);
    const tu = unitOf(to);
    const g = toGrams(n.value ?? 0, fu);
    const out = fromGrams(g, tu);
    big.textContent = n.empty ? '0' : formatNumber(out, { sig: 5 });
    formula.textContent = `${ing.name}: 1 US cup ≈ ${formatNumber(ing.gPerCup)} g · 1 tbsp ≈ ${formatNumber(ing.gPerCup / 16, { sig: 3 })} g · density ≈ ${formatNumber(density(ing), { sig: 3 })} g/mL`;
    root.querySelector('.cap').textContent = `${ing.name} cup measures`;
    replace(
      table,
      FRACTIONS.map(([label, cups]) => {
        const grams = cups * ing.gPerCup;
        return h('tr', {}, h('th', { scope: 'row', text: `${label} cup` }), h('td', { class: 'num', text: `${formatNumber(grams, { sig: 4 })} g` }), h('td', { class: 'num', text: `${formatNumber(grams / 28.349523125, { sig: 3 })} oz` }));
      }),
    );
  }

  function sync() {
    ingPick.set(ing.id);
    fromPick.set(from);
    toPick.set(to);
    setParams({ ingredient: ing.id !== (data.ingredient ?? 'flour') ? ing.id : null, from: from !== (data.from ?? 'volume:cup') ? from : null, to: to !== (data.to ?? 'mass:g') ? to : null });
    render();
  }

  amount.addEventListener('input', render);
  swapBtn.addEventListener('click', () => {
    [from, to] = [to, from];
    sync();
  });
  render();
}
