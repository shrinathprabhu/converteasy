// Context-aware suggestions for the smart calculator.
//
// Looks at the text before the caret and offers what can validly come next:
// units after a number (only units of the kind already in play), operators
// after a value, units of the result's kind after "to", and completions for a
// half-typed unit name.

import { tokenize, lexicon, lockedCategory, calculate, unitsFor, currencyUnit, CURRENCY_CATEGORY, SCALE_SUFFIX, SUFFIX_NAME } from './calc.js';
import { CATEGORY_BY_ID, aliasesOf, sizeHint } from '../data/units.js';
import { POPULAR_FIAT, POPULAR_CRYPTO, FIAT_CODES, CRYPTO } from '../data/money.js';

const GLOBAL_UNITS = ['length:cm', 'length:m', 'length:km', 'length:in', 'length:ft', 'mass:kg', 'mass:g', 'mass:lb', 'volume:l', 'volume:ml', 'temperature:C', 'temperature:F', 'time:h', 'time:min', 'data:GB', 'data:MB'];
const GLOBAL_MONEY = ['USD', 'EUR', 'INR'];

export const EXAMPLES = [
  '1 cm + 1 m',
  '5 ft 11 in to cm',
  '$20 + €15 in INR',
  '3 m × 4 m',
  '100 km / 2 h to mph',
  '98.6 °F to °C',
  '2 lakh + 50k',
  '$2.5B + $800M',
  '√(9 + 16)',
  '1 GB to MiB',
  '0.5 ETH to USD',
  '200 g + 10%',
  '1 km = 1000 m',
];

const OPS_AFTER_VALUE = [
  { label: '+', insert: '+', kind: 'op' },
  { label: '−', insert: '−', kind: 'op' },
  { label: '×', insert: '×', kind: 'op' },
  { label: '÷', insert: '÷', kind: 'op' },
  { label: '^', insert: '^', kind: 'op', tight: true },
  { label: '%', insert: '%', kind: 'op', tight: true },
  { label: '!', insert: '!', kind: 'op', tight: true },
  { label: '=', insert: '=', kind: 'op' },
  { label: '≠', insert: '≠', kind: 'op' },
];
const OPS_BEFORE_VALUE = [
  { label: '(', insert: '(', kind: 'op', tightAfter: true },
  { label: '√', insert: '√', kind: 'op', tightAfter: true },
  { label: 'π', insert: 'π', kind: 'op' },
  { label: '−', insert: '−', kind: 'op', tightAfter: true },
];

function unitItem(unit, why, mode) {
  if (unit.currency) return { label: unit.code, insert: unit.code, hint: unit.name, kind: 'unit', why };
  const size = sizeHint(unit, mode);
  return { label: unit.symbol, insert: unit.symbol, hint: size ? `${unit.name} · ${size}` : unit.name, kind: 'unit', why };
}

function allMoneyUnits(ctx) {
  const codes = ctx?.currencies?.() ?? [...FIAT_CODES, ...CRYPTO.map((c) => c.code)];
  return codes.map(currencyUnit);
}

function candidatesFor(categoryId, ctx) {
  if (categoryId === 'currency') {
    const all = allMoneyUnits(ctx);
    const popular = [...POPULAR_FIAT.slice(0, 8), ...POPULAR_CRYPTO.slice(0, 3)];
    return [...popular.map(currencyUnit), ...all.filter((u) => !popular.includes(u.code))];
  }
  const cat = CATEGORY_BY_ID.get(categoryId);
  if (!cat) return [];
  const units = cat.units.filter((u) => u.calc !== false);
  return [...units.filter((u) => u.popular), ...units.filter((u) => !u.popular)];
}

function globalCandidates(ctx) {
  const { units } = lexicon();
  const byKey = new Map(units.map((u) => [u.key, u]));
  const top = GLOBAL_UNITS.map((k) => byKey.get(k)).filter(Boolean);
  return [...top, ...GLOBAL_MONEY.map(currencyUnit), ...units.filter((u) => !GLOBAL_UNITS.includes(u.key)), ...allMoneyUnits(ctx)];
}

/** Rank units by how well they match a half-typed word. */
function matchUnits(units, partial) {
  const p = partial.toLowerCase();
  const scored = [];
  const seen = new Set();
  for (const u of units) {
    if (seen.has(u.key)) continue;
    const sym = u.currency ? u.code : u.symbol;
    const aliases = u.currency ? { exact: [], loose: [] } : aliasesOf(u);
    const names = [u.name, u.plural, ...(u.names ?? []), ...(u.symbols ?? []), ...aliases.loose, ...aliases.exact].map((n) => n.toLowerCase());
    let score = -1;
    if (sym === partial || names.includes(p)) score = 0;
    else if (sym.startsWith(partial)) score = 1;
    else if (sym.toLowerCase().startsWith(p)) score = 2;
    else if (names.some((n) => n.startsWith(p))) score = 3;
    else if (p.length > 2 && names.some((n) => n.includes(p))) score = 5;
    if (score >= 0) {
      scored.push({ u, score });
      seen.add(u.key);
    }
  }
  return scored.sort((a, b) => a.score - b.score).map((s) => s.u);
}

function parenBalance(tokens) {
  let depth = 0;
  for (const t of tokens) {
    if (t.t === 'lp') depth++;
    else if (t.t === 'rp') depth--;
  }
  return depth;
}

/**
 * @param {string} before  text of the current line up to the caret
 * @param {object} ctx     calculator context (money, currencies, ans)
 * @returns {{ partial: string, replaceFrom: number, items: Array, context: string }}
 */
export function suggest(before, ctx = {}) {
  const trimmedEnd = before.replace(/\s+$/, '');
  const endsWithSpace = trimmedEnd.length !== before.length;

  if (!trimmedEnd) {
    return { partial: '', replaceFrom: before.length, context: 'start', items: EXAMPLES.map((e) => ({ label: e, insert: e, kind: 'example' })) };
  }

  // A half-typed word at the caret: "5 k", "3 kilo", "20 °".
  const pm = endsWithSpace ? null : /([\p{L}°µμ$€£¥₹][\p{L}\p{N}°/²³^.$]*)$/u.exec(trimmedEnd);
  const partial = pm ? pm[1] : '';
  const head = partial ? trimmedEnd.slice(0, -partial.length) : trimmedEnd;

  let tokens = [];
  try {
    tokens = tokenize(head);
  } catch {
    return { partial, replaceFrom: before.length - partial.length, context: 'error', items: [] };
  }
  const last = tokens[tokens.length - 1];
  const locked = lockedCategory(tokens);
  const items = [];
  let context = 'value';

  const toIndex = tokens.findIndex((t) => t.t === 'to');
  if (toIndex >= 0 && (last?.t === 'to' || last?.t === 'unit')) {
    // After "to": units the result can be shown in.
    context = 'target';
    const res = calculate(head.slice(0, tokens[toIndex].s), ctx);
    let units = [];
    if (res.ok && res.category) units = unitsFor(res.category, ctx);
    else if (res.ok && (res.kind === 'number' || res.kind === 'text')) {
      for (const f of ['hex', 'binary', 'octal', 'roman', 'percent', 'sci']) items.push({ label: f, insert: f, kind: 'kw' });
    } else if (locked) units = candidatesFor(locked, ctx);
    if (res.ok && res.category?.id !== 'currency' && res.category) {
      units = [...units.filter((u) => u.popular), ...units.filter((u) => !u.popular)];
    }
    const list = partial ? matchUnits(units, partial) : units;
    for (const u of list.slice(0, 12)) items.push(unitItem(u, 'target', ctx.dataMode));
    return { partial, replaceFrom: before.length - partial.length, context, items };
  }

  const afterNumber = last?.t === 'num';
  const afterValue = last && (last.t === 'unit' || last.t === 'rp' || last.t === 'pi' || last.t === 'ans' || (last.t === 'op' && (last.v === '!' || last.v === '%')));

  // "5 GB to" (no space yet): the conversion keyword is complete, so offer
  // the target units rather than units that merely start with "to".
  if (partial && afterValue && /^(to|as|into|in)$/i.test(partial)) {
    const next = suggest(`${before} `, ctx);
    return { ...next, replaceFrom: before.length };
  }

  if (partial) {
    // Completing a word: units first, then keywords that fit.
    context = 'complete';
    // "5B": a letter stuck to a number scales it (billion); say so up front.
    if (SCALE_SUFFIX[partial] && /\d$/.test(head)) {
      items.push({ label: `${partial} = ${SUFFIX_NAME[partial]}`, insert: partial, kind: 'scale', tight: true, hint: `×${SCALE_SUFFIX[partial].toLocaleString('en-US')}` });
    }
    const pool = locked ? candidatesFor(locked, ctx) : globalCandidates(ctx);
    let list = matchUnits(pool, partial);
    if (!list.length && locked) list = matchUnits(globalCandidates(ctx), partial);
    for (const u of list.slice(0, 10)) items.push(unitItem(u, locked ? 'same-kind' : 'unit', ctx.dataMode));
    const lp = partial.toLowerCase();
    if (afterValue || afterNumber) {
      if ('to'.startsWith(lp) && lp.length) items.push({ label: 'to', insert: 'to', kind: 'kw', hint: 'convert' });
    }
    if (!afterNumber && !afterValue) {
      if ('pi'.startsWith(lp)) items.push({ label: 'π', insert: 'π', kind: 'op' });
      if ('sqrt'.startsWith(lp)) items.push({ label: '√', insert: '√', kind: 'op', tightAfter: true });
      if ('ans'.startsWith(lp) && ctx.ans) items.push({ label: 'ans', insert: 'ans', kind: 'kw', hint: 'previous answer' });
    }
    return { partial, replaceFrom: before.length - partial.length, context, items };
  }

  if (afterNumber) {
    context = 'unit';
    if (parenBalance(tokens) > 0) items.push({ label: ')', insert: ')', kind: 'op', tight: true });
    const pool = locked ? candidatesFor(locked, ctx) : globalCandidates(ctx);
    for (const u of pool.slice(0, locked ? 10 : 12)) items.push(unitItem(u, locked ? 'same-kind' : 'unit', ctx.dataMode));
    items.push(...OPS_AFTER_VALUE);
  } else if (afterValue) {
    context = 'operator';
    items.push(...OPS_AFTER_VALUE);
    if (parenBalance(tokens) > 0) items.push({ label: ')', insert: ')', kind: 'op', tight: true });
    if (tokens.some((t) => t.t === 'unit' || t.t === 'num')) items.push({ label: 'to …', insert: 'to', kind: 'kw', hint: 'convert the result' });
  } else {
    context = 'value';
    items.push(...OPS_BEFORE_VALUE);
    if (ctx.ans) items.push({ label: 'ans', insert: 'ans', kind: 'kw', hint: 'previous answer' });
  }

  return { partial: '', replaceFrom: before.length, context, items };
}

export { CURRENCY_CATEGORY };
