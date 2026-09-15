// The smart calculator: "1 cm + 1 m", "5 ft 11 in to cm", "$20 + €15 in INR".
//
// Pipeline: tokenize → parse (recursive descent) → evaluate on quantities.
// A quantity is a value in its category's base unit plus a dimension vector,
// so the evaluator knows 3 m × 4 m is an area and refuses 1 kg + 1 m.
//
// No DOM here: the UI, the tests and the build step all import this module.

import { CATEGORIES, UNIT_BY_KEY, aliasesOf, convert, effectiveFactor } from '../data/units.js';
import { FIAT_CODES, CRYPTO, PREFIX_SYMBOLS, CURRENCY_WORDS, LOOSE_CODES, currencyName, SYMBOL, isCrypto } from '../data/money.js';
import { formatNumber, formatMoney, plainNumber } from './format.js';

export const PI_VALUE = 3.14159; // π to five decimals, as specified

// ---------------------------------------------------------------------------
// Dimensions

const BASE_SYMBOL = { M: 'kg', L: 'm', T: 's', K: 'K', A: 'rad', D: 'bit', C: 'USD' };
const DIM_ORDER = ['C', 'M', 'L', 'D', 'A', 'K', 'T'];

function dims(obj = {}) {
  const out = {};
  for (const k of Object.keys(obj)) if (Math.abs(obj[k]) > 1e-12) out[k] = obj[k];
  return out;
}
function mulDims(a, b, sign = 1) {
  const out = { ...a };
  for (const k of Object.keys(b)) out[k] = (out[k] ?? 0) + sign * b[k];
  return dims(out);
}
function powDims(a, n) {
  const out = {};
  for (const k of Object.keys(a)) out[k] = a[k] * n;
  return dims(out);
}
export function dimKey(d) {
  return DIM_ORDER.filter((k) => d[k]).map((k) => k + d[k]).join('');
}
function sameDims(a, b) {
  return dimKey(a) === dimKey(b);
}
function isDimless(d) {
  return dimKey(d) === '';
}

const CATEGORIES_BY_DIM = new Map();
for (const cat of CATEGORIES) {
  if (cat.calc === false) continue;
  const k = dimKey(cat.dims);
  if (!CATEGORIES_BY_DIM.has(k)) CATEGORIES_BY_DIM.set(k, []);
  CATEGORIES_BY_DIM.get(k).push(cat);
}

/** "m²", "kg·m·s⁻²" for dimension vectors with no named category. */
function siExpression(d) {
  const sup = (n) => (n === 1 ? '' : String(n).replace('-', '⁻').replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]));
  return DIM_ORDER.filter((k) => d[k])
    .map((k) => BASE_SYMBOL[k] + sup(d[k]))
    .join('·');
}

function kindName(q) {
  if (q.temp) return 'a temperature';
  if (isDimless(q.d)) return 'a plain number';
  if (dimKey(q.d) === 'C1') return 'money';
  const cats = CATEGORIES_BY_DIM.get(dimKey(q.d));
  if (cats) return `a ${cats[0].noun}`;
  return siExpression(q.d);
}

// ---------------------------------------------------------------------------
// Currency pseudo-units

const currencyUnits = new Map();
export function currencyUnit(code) {
  let unit = currencyUnits.get(code);
  if (!unit) {
    const name = currencyName(code);
    unit = {
      id: code,
      key: `currency:${code}`,
      code,
      symbol: code,
      display: SYMBOL[code] ?? code,
      name,
      plural: name,
      category: 'currency',
      dims: { C: 1 },
      currency: true,
      factor: NaN,
    };
    currencyUnits.set(code, unit);
  }
  return unit;
}

export const CURRENCY_CATEGORY = { id: 'currency', name: 'Currency', noun: 'money', dims: { C: 1 }, units: [] };

// ---------------------------------------------------------------------------
// Lexicon: every alias the tokenizer accepts

/**
 * Letters that scale a number when written straight after it: 5k, 2.5M,
 * $3B, 1.2T. With a space they are units instead ("5 B" is five bytes,
 * "2 T" two tablespoons). B, b and T are also unit symbols, so when a line
 * already uses units of that kind ("512B + 1 KB") they read as the unit.
 */
export const SCALE_SUFFIX = { k: 1e3, K: 1e3, M: 1e6, B: 1e9, b: 1e9, T: 1e12 };
const SUFFIX_NAME = { k: 'thousand', K: 'thousand', M: 'million', B: 'billion', b: 'billion', T: 'trillion' };

const SCALE_WORDS = {
  thousand: 1e3, million: 1e6, mn: 1e6, mil: null, billion: 1e9, bn: 1e9, trillion: 1e12, tn: 1e12,
  lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5, crore: 1e7, crores: 1e7, cr: 1e7,
};
delete SCALE_WORDS.mil; // "mil" is a unit (a thousandth of an inch)

const KEYWORDS = {
  to: 'to', in: 'to', into: 'to', as: 'to',
  of: 'op*', times: 'op*', plus: 'op+', minus: 'op-', mod: 'op%', x: 'opx',
  pi: 'pi', sqrt: 'sqrt', root: 'sqrt', ans: 'ans',
};

const FORMAT_WORDS = {
  hex: 'hex', hexadecimal: 'hex', binary: 'bin', bin: 'bin', octal: 'oct', oct: 'oct',
  decimal: 'dec', dec: 'dec', roman: 'roman', sci: 'sci', scientific: 'sci', percent: 'percent',
  percentage: 'percent', words: 'words',
};

let LEX;
export function lexicon() {
  if (LEX) return LEX;
  const exact = new Map();
  const loose = new Map();
  const put = (map, alias, unit) => {
    if (alias && !map.has(alias)) map.set(alias, unit);
  };

  const symbolCounts = new Map();
  const units = [];
  for (const cat of CATEGORIES) {
    if (cat.calc === false) continue;
    for (const unit of cat.units) {
      if (unit.calc === false) continue;
      units.push(unit);
      for (const a of aliasesOf(unit).exact) {
        const l = a.toLowerCase();
        symbolCounts.set(l, (symbolCounts.get(l) ?? 0) + 1);
      }
    }
  }
  for (const unit of units) {
    const { exact: ex, loose: lo } = aliasesOf(unit);
    for (const a of ex) put(exact, a, unit);
    for (const a of lo) put(loose, a, unit);
  }
  // Symbols typed in the wrong case ("KG", "Ml") are accepted when that
  // reading is unambiguous.
  for (const unit of units) {
    for (const a of aliasesOf(unit).exact) {
      const l = a.toLowerCase();
      if (symbolCounts.get(l) === 1) put(loose, l, unit);
    }
  }

  // Money: ISO codes, curated crypto, symbols and a few words.
  for (const code of [...FIAT_CODES, ...CRYPTO.map((c) => c.code)]) put(exact, code, currencyUnit(code));
  for (const [sym, code] of Object.entries(PREFIX_SYMBOLS)) put(exact, sym, currencyUnit(code));
  for (const code of LOOSE_CODES) put(loose, code, currencyUnit(code.toUpperCase()));
  for (const [word, code] of Object.entries(CURRENCY_WORDS)) put(loose, word, currencyUnit(code));

  let maxLen = 0;
  for (const k of exact.keys()) maxLen = Math.max(maxLen, k.length);
  for (const k of loose.keys()) maxLen = Math.max(maxLen, k.length);
  LEX = { exact, loose, maxLen, units };
  return LEX;
}

// ---------------------------------------------------------------------------
// Tokenizer

export class CalcError extends Error {
  /** @param {string} message @param {{start?:number,end?:number,incomplete?:boolean}} [info] */
  constructor(message, info = {}) {
    super(message);
    this.start = info.start;
    this.end = info.end;
    this.incomplete = Boolean(info.incomplete);
  }
}

const NUM_RE = /^(?:\d{1,3}(?:,\d{3})+(?![\d])|\d+)(?:\.\d*)?(?:[eE][+-]?\d+)?|^\.\d+(?:[eE][+-]?\d+)?/;
const RADIX_RE = /^0(?:x[0-9a-f]+|b[01]+|o[0-7]+)(?![0-9a-z])/i;
const WORD_CHAR = /[\p{L}\p{N}_]/u;
const OPS = {
  '+': '+', '-': '-', '−': '-', '–': '-', '*': '*', '×': '*', '·': '*', '⋅': '*', '/': '/', '÷': '/', '∕': '/',
  '^': '^', '%': '%', '!': '!', '(': '(', ')': ')', '[': '(', ']': ')', '√': 'sqrt', 'π': 'pi', '=': '=',
  '≠': '≠', '<': '<', '>': '>', '≤': '≤', '≥': '≥', '→': 'to',
};

export function tokenize(src) {
  const { exact, loose, maxLen } = lexicon();
  const toks = [];
  const n = src.length;
  let i = 0;
  const last = () => toks[toks.length - 1];

  while (i < n) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Numbers, including 0x/0b/0o literals and 1,234.5e3.
    if (/\d/.test(ch) || (ch === '.' && /\d/.test(src[i + 1] ?? ''))) {
      const rest = src.slice(i);
      const radix = RADIX_RE.exec(rest);
      if (radix) {
        const lit = radix[0];
        const v = Number(lit.toLowerCase().startsWith('0o') ? parseInt(lit.slice(2), 8) : lit);
        toks.push({ t: 'num', v, s: i, e: i + lit.length, raw: lit });
        i += lit.length;
        continue;
      }
      const m = NUM_RE.exec(rest);
      let end = i + m[0].length;
      // "1.1.1" is not a number. Swallow the whole run so the error points at it.
      if (src[end] === '.' && /[\d.]/.test(src[end + 1] ?? '')) {
        const bad = /^[\d.,]+/.exec(rest)[0];
        throw new CalcError(`“${bad}” isn't a valid number`, { start: i, end: i + bad.length });
      }
      let v = Number(m[0].replace(/,/g, ''));
      let raw = m[0];
      // Attached scale suffix: 5k, 2.5M, 3B, 1.2T. A longer unit starting
      // with the same letter wins ("5B/s" is bytes per second).
      const suffix = /^([kKMBbT])(?![\p{L}\p{N}_])/u.exec(src.slice(end));
      const longer = suffix && matchAlias(src, end, exact, loose, maxLen);
      let scaled = null;
      if (suffix && !(longer && longer.len > 1)) {
        scaled = { letter: suffix[1], base: v, raw, s: end, e: end + 1 };
        v *= SCALE_SUFFIX[suffix[1]];
        raw += suffix[1];
        end += 1;
      } else {
        // Scale words: 2 lakh, 3.5 crore, 4 million.
        const word = /^\s*([A-Za-z]+)/.exec(src.slice(end));
        const scale = word && SCALE_WORDS[word[1].toLowerCase()];
        if (scale && !WORD_CHAR.test(src[end + word[0].length] ?? '')) {
          v *= scale;
          raw += word[0];
          end += word[0].length;
        }
      }
      toks.push({ t: 'num', v, s: i, e: end, raw, scaled });
      i = end;
      continue;
    }

    // Two-character operators.
    const two = src.slice(i, i + 2);
    if (two === '!=' || two === '<>' || two === '=/') {
      toks.push({ t: 'cmp', v: '≠', s: i, e: i + 2 });
      i += 2;
      continue;
    }
    if (two === '==') {
      toks.push({ t: 'cmp', v: '=', s: i, e: i + 2 });
      i += 2;
      continue;
    }
    if (two === '<=' || two === '>=') {
      toks.push({ t: 'cmp', v: two === '<=' ? '≤' : '≥', s: i, e: i + 2 });
      i += 2;
      continue;
    }
    if (two === '**') {
      toks.push({ t: 'op', v: '^', s: i, e: i + 2 });
      i += 2;
      continue;
    }
    if (two === '=>' || two === '->') {
      toks.push({ t: 'to', s: i, e: i + 2 });
      i += 2;
      continue;
    }

    // Words: keywords first, then the longest unit alias that fits.
    const wordMatch = /^[A-Za-z]+/.exec(src.slice(i));
    const prev = last();
    if (wordMatch) {
      const word = wordMatch[0];
      const lw = word.toLowerCase();
      const afterTo = prev?.t === 'to';
      if (afterTo && FORMAT_WORDS[lw]) {
        toks.push({ t: 'fmt', v: FORMAT_WORDS[lw], s: i, e: i + word.length });
        i += word.length;
        continue;
      }
      const kw = KEYWORDS[lw];
      // "in" after a number is inches ("5 ft 11 in"); anywhere else it means "to".
      // "in" is inches after a number ("5 ft 11 in") or inside a conversion
      // target ("to ft in"), except after a money amount ("€15 in INR").
      const beforePrev = toks[toks.length - 2];
      const moneyAmount = prev?.t === 'num' && beforePrev?.t === 'unit' && beforePrev.unit.currency;
      const inTarget = prev?.t === 'unit' && toks.some((x) => x.t === 'to');
      const inchContext = lw === 'in' && ((prev?.t === 'num' && !moneyAmount) || inTarget || prev?.t === 'to');
      if (kw && !inchContext && !(lw === 'x' && !isMulX(prev, src, i + 1))) {
        if (kw === 'to') toks.push({ t: 'to', s: i, e: i + word.length });
        else if (kw.startsWith('op')) toks.push({ t: 'op', v: kw === 'opx' ? '*' : kw.slice(2), s: i, e: i + word.length, word: true });
        else toks.push({ t: kw, s: i, e: i + word.length });
        i += word.length;
        continue;
      }
      if (lw === 'divided' && /^\s+by\b/i.test(src.slice(i + word.length))) {
        const len = word.length + /^\s+by/i.exec(src.slice(i + word.length))[0].length;
        toks.push({ t: 'op', v: '/', s: i, e: i + len, word: true });
        i += len;
        continue;
      }
    }

    const unitMatch = matchAlias(src, i, exact, loose, maxLen);
    if (unitMatch) {
      toks.push({ t: 'unit', unit: unitMatch.unit, s: i, e: i + unitMatch.len, raw: src.slice(i, i + unitMatch.len) });
      i += unitMatch.len;
      continue;
    }

    const op = OPS[ch];
    if (op) {
      if (op === '=' || op === '≠' || op === '<' || op === '>' || op === '≤' || op === '≥') toks.push({ t: 'cmp', v: op, s: i, e: i + 1 });
      else if (op === '(') toks.push({ t: 'lp', s: i, e: i + 1 });
      else if (op === ')') toks.push({ t: 'rp', s: i, e: i + 1 });
      else if (op === 'sqrt') toks.push({ t: 'sqrt', s: i, e: i + 1 });
      else if (op === 'pi') toks.push({ t: 'pi', s: i, e: i + 1 });
      else if (op === 'to') toks.push({ t: 'to', s: i, e: i + 1 });
      else toks.push({ t: 'op', v: op, s: i, e: i + 1 });
      i++;
      continue;
    }

    // Unknown word or symbol: report the whole word.
    const bad = wordMatch ? wordMatch[0] : /^[^\s\d]+/u.exec(src.slice(i))?.[0] ?? ch;
    throw new CalcError(wordMatch ? `Unknown unit “${bad}”` : `Unexpected “${bad}”`, {
      start: i,
      end: i + bad.length,
      incomplete: Boolean(wordMatch) && i + bad.length === n,
    });
  }
  return unitOrScale(toks, exact);
}

/**
 * "512B + 1 KB": in a line that already has data units, an attached B is a
 * byte, not a billion. Same for b (bit), T (tablespoon) and K (kelvin).
 */
function unitOrScale(toks, exact) {
  const scaled = toks.filter((t) => t.scaled);
  if (!scaled.length) return toks;
  const kinds = new Set(toks.filter((t) => t.t === 'unit' && !t.unit.currency).map((t) => t.unit.category));
  if (!kinds.size) return toks;
  const out = [];
  for (const t of toks) {
    const unit = t.scaled && exact.get(t.scaled.letter);
    if (unit && !unit.currency && kinds.has(unit.category)) {
      const { base, raw, s, e, letter } = t.scaled;
      out.push({ t: 'num', v: base, s: t.s, e: s, raw });
      out.push({ t: 'unit', unit, s, e, raw: letter });
    } else out.push(t);
  }
  return out;
}

export { SUFFIX_NAME };

function isMulX(prev, src, after) {
  if (!prev || !(prev.t === 'num' || prev.t === 'rp' || prev.t === 'unit' || prev.t === 'pi')) return false;
  return /^\s*[\d.(√π]/.test(src.slice(after));
}

function matchAlias(src, i, exact, loose, maxLen) {
  const limit = Math.min(maxLen, src.length - i);
  for (let len = limit; len >= 1; len--) {
    const sub = src.substr(i, len);
    const unit = exact.get(sub) ?? loose.get(sub.toLowerCase());
    if (!unit) continue;
    const lastCh = sub[len - 1];
    const next = src[i + len] ?? '';
    // Aliases ending in a letter or digit must end on a word boundary.
    if (WORD_CHAR.test(lastCh) && WORD_CHAR.test(next)) continue;
    return { unit, len };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Parser

const OPERAND_START = new Set(['num', 'lp', 'pi', 'sqrt', 'ans', 'unit']);

export function parse(tokens, srcLength) {
  let p = 0;
  const peek = (o = 0) => tokens[p + o];
  const eofError = (msg) => new CalcError(msg, { start: srcLength, end: srcLength, incomplete: true });

  function line() {
    let expr = expression();
    let cmp = null;
    let right = null;
    let target = null;
    if (peek()?.t === 'cmp' && peek().v === '=' && p === tokens.length - 1) p++; // trailing "="
    else if (peek()?.t === 'cmp') {
      cmp = tokens[p++];
      if (!peek()) throw eofError(`Add something to compare after “${cmp.v}”`);
      right = expression();
    }
    if (peek()?.t === 'to') {
      const kw = tokens[p++];
      target = conversionTarget(kw);
    }
    if (peek()?.t === 'cmp' && peek().v === '=' && p === tokens.length - 1) p++;
    if (p < tokens.length) {
      const t = tokens[p];
      if (t.t === 'num' || t.t === 'unit') throw new CalcError(`Missing an operator before “${textOf(t)}”`, { start: t.s, end: t.e });
      if (t.t === 'rp') throw new CalcError('This “)” has no matching “(”', { start: t.s, end: t.e });
      throw new CalcError(`Unexpected “${textOf(t)}”`, { start: t.s, end: t.e });
    }
    return { expr, cmp, right, target };
  }

  function conversionTarget(kw) {
    const units = [];
    let fmt = null;
    while (peek()) {
      const t = peek();
      if (t.t === 'unit') {
        units.push(t.unit);
        p++;
      } else if (t.t === 'fmt' && !units.length && !fmt) {
        fmt = t.v;
        p++;
      } else if (t.t === 'op' && t.v === '%' && !units.length && !fmt) {
        fmt = 'percent';
        p++;
      } else break;
    }
    if (!units.length && !fmt) {
      if (!peek()) throw eofError('Add a unit to convert to');
      const t = peek();
      throw new CalcError(`“${textOf(t)}” isn't a unit I can convert to`, { start: t.s, end: t.e });
    }
    return { units, fmt, s: kw.s };
  }

  function expression() {
    let left = term();
    while (peek()?.t === 'op' && (peek().v === '+' || peek().v === '-')) {
      const op = tokens[p++];
      if (!peek()) throw eofError(`Add a value after “${op.v === '-' ? '−' : '+'}”`);
      left = { type: 'bin', op: op.v, left, right: term() };
    }
    return left;
  }

  function term() {
    let left = unary();
    for (;;) {
      const t = peek();
      if (t?.t === 'op' && (t.v === '*' || t.v === '/' || t.v === '%')) {
        p++;
        if (!peek()) throw eofError(`Add a value after “${t.v === '*' ? '×' : t.v === '/' ? '÷' : 'mod'}”`);
        left = { type: 'bin', op: t.v === '%' ? 'mod' : t.v, left, right: unary() };
      } else if (t && (t.t === 'lp' || t.t === 'pi' || t.t === 'sqrt' || t.t === 'ans')) {
        left = { type: 'bin', op: '*', left, right: unary(), implicit: true };
      } else break;
    }
    return left;
  }

  function unary() {
    const t = peek();
    if (t?.t === 'op' && (t.v === '-' || t.v === '+')) {
      p++;
      if (!peek()) throw eofError('Add a number');
      const arg = unary();
      return t.v === '-' ? { type: 'neg', arg } : arg;
    }
    if (t?.t === 'sqrt') {
      p++;
      if (!peek()) throw eofError('Add a number after √');
      return { type: 'sqrt', arg: unary() };
    }
    return power();
  }

  function power() {
    const base = postfix();
    if (peek()?.t === 'op' && peek().v === '^') {
      p++;
      if (!peek()) throw eofError('Add an exponent after ^');
      return { type: 'pow', base, exp: unary() };
    }
    return base;
  }

  function postfix() {
    let node = primary();
    for (;;) {
      const t = peek();
      if (t?.t === 'op' && t.v === '!') {
        p++;
        node = { type: 'fact', arg: node };
      } else if (t?.t === 'op' && t.v === '%' && !(peek(1) && OPERAND_START.has(peek(1).t) && !t.word)) {
        p++;
        node = { type: 'percent', arg: node };
      } else break;
    }
    return node;
  }

  function primary() {
    const t = tokens[p++];
    if (!t) throw eofError('Add a number');
    switch (t.t) {
      case 'num': {
        let node = { type: 'num', v: t.v };
        if (peek()?.t === 'unit') {
          node = { type: 'qty', v: t.v, unit: tokens[p++].unit };
          // Compound quantities: 5 ft 11 in, 1 h 30 min, 2 lb 4 oz.
          while (peek()?.t === 'num' && peek(1)?.t === 'unit' && compoundable(node, peek(1).unit)) {
            const n2 = tokens[p++];
            const u2 = tokens[p++].unit;
            node = { type: 'bin', op: '+', left: node, right: { type: 'qty', v: n2.v, unit: u2 }, compound: true, unit: u2 };
          }
        }
        return node;
      }
      case 'unit': {
        // "$20" (prefix symbol) or a bare unit, which counts as one of it.
        if (t.unit.currency && peek()?.t === 'num' && !(peek(1)?.t === 'unit')) {
          const n = tokens[p++];
          return { type: 'qty', v: n.v, unit: t.unit };
        }
        return { type: 'qty', v: 1, unit: t.unit, bare: true };
      }
      case 'lp': {
        if (!peek()) throw eofError('Add something inside the brackets');
        const e = expression();
        if (!peek()) throw eofError('Missing a closing “)”');
        if (peek().t !== 'rp') {
          const bad = peek();
          if (bad.t === 'num' || bad.t === 'unit') throw new CalcError(`Missing an operator before “${textOf(bad)}”`, { start: bad.s, end: bad.e });
          throw new CalcError(`Expected “)” but found “${textOf(bad)}”`, { start: bad.s, end: bad.e });
        }
        p++;
        if (peek()?.t === 'unit') return { type: 'applyUnit', e, unit: tokens[p++].unit };
        return { type: 'group', e };
      }
      case 'pi':
        return { type: 'num', v: PI_VALUE, pi: true };
      case 'ans':
        return { type: 'ans' };
      case 'rp':
        throw new CalcError('This “)” has no matching “(”', { start: t.s, end: t.e });
      case 'to':
        throw new CalcError('Put a value before “to”', { start: t.s, end: t.e });
      case 'cmp':
        throw new CalcError(`Put a value before “${t.v}”`, { start: t.s, end: t.e });
      default:
        throw new CalcError(`Unexpected “${textOf(t)}”`, { start: t.s, end: t.e });
    }
  }

  return line();
}

function compoundable(node, unit) {
  const first = node.type === 'qty' ? node.unit : node.unit;
  if (!first || first.currency || unit.currency) return false;
  return first.category === unit.category && first.category !== 'temperature' && first.factor > unit.factor;
}

function textOf(t) {
  if (t.t === 'num') return t.raw;
  if (t.t === 'unit') return t.raw ?? t.unit.symbol;
  if (t.t === 'op') return { '*': '×', '/': '÷', '-': '−' }[t.v] ?? t.v;
  if (t.t === 'cmp') return t.v;
  if (t.t === 'lp') return '(';
  if (t.t === 'rp') return ')';
  if (t.t === 'to') return 'to';
  if (t.t === 'pi') return 'π';
  if (t.t === 'sqrt') return '√';
  return t.t;
}

// ---------------------------------------------------------------------------
// Evaluator

/** A unit's factor under the current byte counting mode (ctx.dataMode). */
const fac = (unit, ctx) => effectiveFactor(unit, ctx?.dataMode);

function num(v) {
  return { v, d: {} };
}

function makeQty(v, unit, ctx) {
  ctx.used.push(unit);
  if (unit.currency) {
    const rate = ctx.money?.(unit.code);
    if (!rate) throw new CalcError(ctx.money ? `No live rate for ${unit.code} right now` : 'Currency rates are still loading');
    return { v: v * rate, d: { C: 1 } };
  }
  if (unit.toBase) return { v, d: { K: 1 }, temp: { unit, delta: false } };
  return { v: v * fac(unit, ctx), d: unit.dims };
}

function tempIn(q, unit, asDelta) {
  if (q.temp.unit === unit) return q.v;
  if (asDelta) return (q.v * q.temp.unit.deltaFactor) / unit.deltaFactor;
  return convert(q.v, q.temp.unit, unit);
}

function add(a, b, sign) {
  if (b.pct && !a.pct) return { ...a, v: a.v * (1 + sign * b.v), pct: false };
  if (a.temp || b.temp) {
    if (!(a.temp && b.temp)) throw new CalcError(`Can't ${sign > 0 ? 'add' : 'subtract'} ${kindName(a)} and ${kindName(b)}`);
    const unit = a.temp.unit;
    if (sign > 0) {
      return { v: a.v + tempIn(b, unit, true), d: a.d, temp: { unit, delta: a.temp.delta && b.temp.delta } };
    }
    if (!a.temp.delta && !b.temp.delta) return { v: a.v - tempIn(b, unit, false), d: a.d, temp: { unit, delta: true } };
    return { v: a.v - tempIn(b, unit, true), d: a.d, temp: { unit, delta: a.temp.delta } };
  }
  if (!sameDims(a.d, b.d)) {
    const verb = sign > 0 ? 'add' : 'subtract';
    if (isDimless(b.d) || isDimless(a.d)) {
      throw new CalcError(`Can't ${verb} a plain number and ${kindName(isDimless(a.d) ? b : a)}. Give the number a unit.`);
    }
    throw new CalcError(`Can't ${verb} ${kindName(a)} and ${kindName(b)}`);
  }
  return { v: a.v + sign * b.v, d: a.d };
}

function mul(a, b, div) {
  if (a.temp || b.temp) {
    const [t, s] = a.temp ? [a, b] : [b, a];
    if (!isDimless(s.d) || (div && b.temp)) throw new CalcError('Temperatures can only be added, subtracted or scaled by a number');
    if (div && s.v === 0) throw new CalcError('Division by zero');
    return { ...t, v: div ? t.v / s.v : t.v * s.v };
  }
  if (div) {
    if (b.v === 0) throw new CalcError('Division by zero');
    return { v: a.v / b.v, d: mulDims(a.d, b.d, -1) };
  }
  return { v: a.v * b.v, d: mulDims(a.d, b.d) };
}

function pow(a, b) {
  if (!isDimless(b.d)) throw new CalcError("An exponent can't have a unit");
  if (a.temp) throw new CalcError("Temperatures can't be raised to a power");
  const e = b.v;
  for (const k of Object.keys(a.d)) {
    const r = a.d[k] * e;
    if (Math.abs(r - Math.round(r)) > 1e-9) throw new CalcError(`That power of ${kindName(a)} has no unit`);
  }
  if (a.v < 0 && !Number.isInteger(e)) throw new CalcError('A negative number has no real root');
  return { v: a.v ** e, d: powDims(a.d, Math.round(e * 1e9) / 1e9) };
}

function factorial(a) {
  if (!isDimless(a.d)) throw new CalcError('Factorial works on plain numbers');
  const n = a.v;
  if (!Number.isInteger(n) || n < 0) throw new CalcError('Factorial needs a whole number of 0 or more');
  if (n > 170) return num(Infinity);
  let r = 1;
  for (let k = 2; k <= n; k++) r *= k;
  return num(r);
}

function evaluate(node, ctx) {
  switch (node.type) {
    case 'num':
      return num(node.v);
    case 'qty':
      return makeQty(node.v, node.unit, ctx);
    case 'applyUnit': {
      const x = evaluate(node.e, ctx);
      if (!isDimless(x.d) || x.temp) throw new CalcError(`Can't attach ${node.unit.symbol} to ${kindName(x)}`);
      return makeQty(x.v, node.unit, ctx);
    }
    case 'group':
      return evaluate(node.e, ctx);
    case 'neg': {
      const x = evaluate(node.arg, ctx);
      return { ...x, v: -x.v };
    }
    case 'sqrt': {
      const x = evaluate(node.arg, ctx);
      if (x.v < 0) throw new CalcError("A negative number has no real square root");
      return pow(x, num(0.5));
    }
    case 'pow':
      return pow(evaluate(node.base, ctx), evaluate(node.exp, ctx));
    case 'fact':
      return factorial(evaluate(node.arg, ctx));
    case 'percent': {
      const x = evaluate(node.arg, ctx);
      if (!isDimless(x.d) || x.temp) throw new CalcError('A percentage needs a plain number');
      return { v: x.v / 100, d: {}, pct: true };
    }
    case 'ans':
      if (!ctx.ans) throw new CalcError('There is no previous line for “ans”');
      if (ctx.ans.unit) ctx.used.push(ctx.ans.unit);
      return ctx.ans.q;
    case 'bin': {
      const a = evaluate(node.left, ctx);
      const b = evaluate(node.right, ctx);
      switch (node.op) {
        case '+':
          return add(a, b, 1);
        case '-':
          return add(a, b, -1);
        case '*':
          return mul(a, b, false);
        case '/':
          return mul(a, b, true);
        case 'mod': {
          if (!sameDims(a.d, b.d) && !isDimless(b.d)) throw new CalcError(`Can't take ${kindName(a)} modulo ${kindName(b)}`);
          if (b.v === 0) throw new CalcError('Modulo by zero');
          return { v: a.v % b.v, d: a.d };
        }
      }
    }
  }
  throw new CalcError('Something went wrong reading that');
}

function compare(a, b, op) {
  let x = a.v;
  let y = b.v;
  if (a.temp || b.temp) {
    if (!(a.temp && b.temp)) throw new CalcError(`Can't compare ${kindName(a)} with ${kindName(b)}`);
    x = a.temp.delta ? a.v * a.temp.unit.deltaFactor : a.temp.unit.toBase(a.v);
    y = b.temp.delta ? b.v * b.temp.unit.deltaFactor : b.temp.unit.toBase(b.v);
  } else if (!sameDims(a.d, b.d)) {
    throw new CalcError(`Can't compare ${kindName(a)} with ${kindName(b)}`);
  }
  const eq = Math.abs(x - y) <= 1e-9 * Math.max(Math.abs(x), Math.abs(y), 1e-300);
  switch (op) {
    case '=':
      return eq;
    case '≠':
      return !eq;
    case '<':
      return x < y && !eq;
    case '>':
      return x > y && !eq;
    case '≤':
      return x < y || eq;
    case '≥':
      return x > y || eq;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Results

/** Which category a quantity belongs to, preferring ones the user typed in. */
function categoryFor(q, used) {
  if (q.temp) return CATEGORIES.find((c) => c.id === 'temperature');
  if (dimKey(q.d) === 'C1') return CURRENCY_CATEGORY;
  const cats = CATEGORIES_BY_DIM.get(dimKey(q.d));
  if (!cats) return null;
  return cats.find((c) => used.some((u) => u.category === c.id)) ?? cats[0];
}

/** Units the result can be shown in. */
export function unitsFor(category, ctx) {
  if (category.id === 'currency') {
    const codes = ctx?.currencies?.() ?? [];
    return codes.map(currencyUnit);
  }
  return category.units.filter((u) => u.calc !== false);
}

/** Value of quantity `q` expressed in `unit`. */
export function expressIn(q, unit, ctx) {
  if (q.temp) return tempIn(q, unit, q.temp.delta);
  if (unit.currency) {
    const rate = ctx?.money?.(unit.code);
    return rate ? q.v / rate : NaN;
  }
  return q.v / fac(unit, ctx);
}

/**
 * Pick the display unit for a result. Typed units win: of those, the largest
 * that still gives a value of at least 1 (1 cm + 1 m → 1.01 m). Otherwise a
 * unit derived from what was typed (cm × cm → cm²), then a sensible default.
 */
function defaultUnit(q, category, used, ctx) {
  const units = unitsFor(category, ctx);
  const inCat = used.filter((u) => u.category === category.id);
  if (category.id === 'currency') return inCat[0] ?? currencyUnit('USD');
  if (q.temp) return q.temp.unit;
  const pickByMagnitude = (list) => {
    const uniq = [...new Set(list)].sort((a, b) => fac(b, ctx) - fac(a, ctx));
    const ok = uniq.find((u) => Math.abs(expressIn(q, u, ctx)) >= 1 - 1e-9);
    return ok ?? uniq[uniq.length - 1];
  };
  if (inCat.length) return pickByMagnitude(inCat);

  const ids = new Set(used.map((u) => u.id));
  let best = null;
  let bestScore = 0;
  for (const u of units) {
    if (!u.uses) continue;
    const score = u.uses.filter((id) => ids.has(id)).length;
    if (score === u.uses.length && score > bestScore) {
      best = u;
      bestScore = score;
    }
  }
  if (best) return best;

  const imperial = used.filter((u) => u.system === 'imperial' || u.system === 'us').length > used.length / 2;
  const pool = units.filter((u) => u.popular && (imperial ? u.system !== 'metric' : u.system === 'metric'));
  return pickByMagnitude(pool.length ? pool : units);
}

function breakdown(q, targetUnits, ctx) {
  const units = [...targetUnits].sort((a, b) => fac(b, ctx) - fac(a, ctx));
  const neg = q.v < 0;
  let rest = Math.abs(q.v);
  const parts = [];
  units.forEach((u, idx) => {
    const isLast = idx === units.length - 1;
    let n = rest / fac(u, ctx);
    if (!isLast) {
      n = Math.floor(n + 1e-9);
      rest -= n * fac(u, ctx);
      if (rest < 0) rest = 0;
    } else {
      n = Math.round(n * 1000) / 1000;
    }
    parts.push({ unit: u, n });
  });
  // Carry rounding overflow: 5 ft 12 in → 6 ft 0 in.
  for (let k = parts.length - 1; k > 0; k--) {
    const ratio = Math.round(fac(parts[k - 1].unit, ctx) / fac(parts[k].unit, ctx));
    if (parts[k].n >= ratio - 1e-9) {
      parts[k].n -= ratio;
      parts[k - 1].n += 1;
    }
  }
  const text = parts
    .filter((p, i) => p.n !== 0 || i === parts.length - 1)
    .map((p) => `${formatNumber(p.n, { sig: 8 })} ${p.unit.symbol}`)
    .join(' ');
  return (neg ? '−' : '') + text;
}

function formatAs(q, fmt) {
  if (!isDimless(q.d) || q.temp) throw new CalcError(`Only plain numbers convert to ${fmt}`);
  const v = q.v;
  if (fmt === 'percent') return `${formatNumber(v * 100)}%`;
  if (fmt === 'sci') return v.toExponential(6).replace('e', ' × 10^').replace('^+', '^');
  if (fmt === 'dec') return formatNumber(v, { sig: 15 });
  if (!Number.isInteger(v)) throw new CalcError(`Only whole numbers convert to ${fmt === 'roman' ? 'Roman numerals' : fmt}`);
  if (fmt === 'roman') {
    if (v < 1 || v > 3999) throw new CalcError('Roman numerals cover 1 to 3,999');
    return toRoman(v);
  }
  const big = BigInt(v);
  const sign = big < 0n ? '-' : '';
  const abs = big < 0n ? -big : big;
  if (fmt === 'hex') return `${sign}0x${abs.toString(16).toUpperCase()}`;
  if (fmt === 'bin') return `${sign}0b${abs.toString(2)}`;
  if (fmt === 'oct') return `${sign}0o${abs.toString(8)}`;
  return String(v);
}

/** 5e9 → ["5 billion", "500 crore"]: big results read the way people say them. */
export function scaleWords(v) {
  const abs = Math.abs(v);
  const out = [];
  const intl = [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']].find(([n]) => abs >= n);
  if (intl) out.push(`${formatNumber(v / intl[0], { sig: 6 })} ${intl[1]}`);
  const indian = abs >= 1e7 ? [1e7, 'crore'] : abs >= 1e5 ? [1e5, 'lakh'] : null;
  if (indian) out.push(`${formatNumber(v / indian[0], { sig: 6 })} ${indian[1]}`);
  return out;
}

export function toRoman(n) {
  const map = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  for (const [v, s] of map) while (n >= v) (out += s), (n -= v);
  return out;
}

/** A readable echo of the input: "1 centimeter + 1 meter". */
function interpret(tokens) {
  const out = [];
  tokens.forEach((t, i) => {
    const prev = tokens[i - 1];
    const next = tokens[i + 1];
    if (t.t === 'num') out.push(formatNumber(t.v, { sig: 15 }));
    else if (t.t === 'unit') {
      if (t.unit.currency) out.push(t.unit.code);
      else {
        const amount = prev?.t === 'num' ? prev.v : 1;
        const inTarget = tokens.slice(0, i).some((x) => x.t === 'to');
        out.push(Math.abs(amount) === 1 && !inTarget ? t.unit.name : t.unit.plural);
      }
    } else if (t.t === 'op') out.push({ '*': '×', '/': '÷', '-': '−', '%': prev && next && OPERAND_START.has(next.t) ? 'mod' : '%', '^': '^', '!': '!', '+': '+' }[t.v]);
    else if (t.t === 'pi') out.push(String(PI_VALUE));
    else if (t.t === 'sqrt') out.push('√');
    else if (t.t === 'lp') out.push('(');
    else if (t.t === 'rp') out.push(')');
    else if (t.t === 'cmp') out.push(t.v);
    else if (t.t === 'to') out.push('→');
    else if (t.t === 'fmt') out.push(t.v);
    else if (t.t === 'ans') out.push('ans');
  });
  return out
    .join(' ')
    .replace(/\( /g, '(')
    .replace(/ \)/g, ')')
    .replace(/√ /g, '√')
    .replace(/ !/g, '!')
    .replace(/ %/g, '%');
}

/**
 * Evaluate one line. Never throws: returns { ok:false, error } instead.
 *
 * ctx: {
 *   money(code) → USD value of one unit, or null,
 *   currencies() → codes available for display,
 *   ans → { q, unit } from the previous line,
 * }
 */
export function calculate(src, ctx = {}) {
  const text = src.replace(/\s+$/, '');
  if (!text.trim()) return { ok: true, empty: true };
  if (/^\s*(\/\/|#)/.test(text)) return { ok: true, empty: true, comment: true };
  const used = [];
  const c = { ...ctx, used };
  let tokens = [];
  try {
    tokens = tokenize(text);
    if (!tokens.length) return { ok: true, empty: true };
    const ast = parse(tokens, text.length);
    const q = evaluate(ast.expr, c);
    const interpretation = interpret(tokens);

    if (ast.cmp) {
      const r = evaluate(ast.right, c);
      const value = compare(q, r, ast.cmp.v);
      return { ok: true, kind: 'bool', value, text: value ? 'True' : 'False', interpretation, tokens };
    }

    if (!Number.isFinite(q.v)) {
      return { ok: true, kind: 'number', q, value: q.v, text: formatNumber(q.v), plain: String(q.v), interpretation, tokens };
    }

    const target = ast.target;
    if (target?.fmt) {
      const out = formatAs(q, target.fmt);
      return { ok: true, kind: 'text', q, text: out, plain: out, interpretation, tokens };
    }

    if (isDimless(q.d) && !q.temp) {
      if (target?.units.length) throw new CalcError(`Can't convert a plain number to ${target.units[0].symbol}`, { start: target.s });
      const result = { ok: true, kind: 'number', q, value: q.v, text: formatNumber(q.v), plain: plainNumber(q.v), interpretation, tokens };
      if (q.pct) result.alt = [{ text: `${formatNumber(q.v * 100)}%` }];
      else if (Math.abs(q.v) >= 1e5) result.alt = scaleWords(q.v).map((text) => ({ text }));
      return result;
    }

    const category = categoryFor(q, used);
    if (!category) {
      if (target?.units.length) throw new CalcError(`Can't convert ${siExpression(q.d)} to ${target.units[0].symbol}`);
      return { ok: true, kind: 'number', q, value: q.v, text: `${formatNumber(q.v)} ${siExpression(q.d)}`, plain: plainNumber(q.v), unitless: siExpression(q.d), interpretation, tokens };
    }

    if (target?.units.length) {
      for (const u of target.units) {
        const ok = q.temp ? u.category === 'temperature' : sameDims(u.dims, q.d);
        if (!ok) throw new CalcError(`Can't convert ${kindName(q)} to ${u.plural}`, { start: target.s });
      }
      if (target.units.length > 1) {
        if (q.temp || category.id === 'currency') throw new CalcError('Split results work for lengths, weights and times');
        const out = breakdown(q, target.units, c);
        return { ok: true, kind: 'text', q, category, text: out, plain: out, interpretation, tokens, unit: target.units[0] };
      }
    }

    const unit = target?.units[0] ?? defaultUnit(q, category, used, c);
    return describe({ ok: true, kind: 'quantity', q, category, interpretation, tokens, fixed: Boolean(target?.units.length) }, unit, c);
  } catch (err) {
    if (err instanceof CalcError) {
      // "2 g + 5" or "2 g + 5 k" is usually a unit still being typed: report it
      // softly instead of as a hard error.
      const last = tokens[tokens.length - 1];
      const typing = !/\s$/.test(src) && last && (last.t === 'num' || (last.t === 'unit' && last.e === text.length)) && /^Can't (add|subtract|compare)/.test(err.message);
      return { ok: false, error: err.message, start: err.start, end: err.end, incomplete: err.incomplete || typing };
    }
    throw err;
  }
}

/** Fill in the display fields of a quantity result for a given unit. */
export function describe(result, unit, ctx = {}) {
  const value = expressIn(result.q, unit, ctx);
  const symbol = unit.currency ? unit.code : unit.symbol;
  const delta = result.q.temp?.delta;
  const units = unitsFor(result.category, ctx);
  const alt = units
    .filter((u) => u !== unit && (u.popular || u.currency) && !(u.currency && !['USD', 'EUR', 'GBP', 'INR', 'BTC'].includes(u.code)))
    .slice(0, 5)
    .map((u) => {
      const v = expressIn(result.q, u, ctx);
      return { unit: u, value: v, text: `${u.currency ? formatMoney(v, { crypto: isCrypto(u.code) }) : formatNumber(v, { sig: 8 })} ${u.currency ? u.code : u.symbol}` };
    })
    .filter((a) => Number.isFinite(a.value));
  return {
    ...result,
    unit,
    value,
    text: `${unit.currency ? formatMoney(value, { crypto: isCrypto(unit.code) }) : formatNumber(value)} ${symbol}`,
    number: unit.currency ? formatMoney(value, { crypto: isCrypto(unit.code) }) : formatNumber(value),
    symbol,
    plain: plainNumber(value),
    note: delta ? 'temperature difference' : undefined,
    alt,
  };
}

/** Category a line is "about": the first unit typed, for suggestions. */
export function lockedCategory(tokens) {
  const t = tokens.find((x) => x.t === 'unit');
  if (!t) return null;
  return t.unit.currency ? 'currency' : t.unit.category;
}

export function unitByKey(key) {
  if (key?.startsWith('currency:')) return currencyUnit(key.slice(9));
  return UNIT_BY_KEY.get(key);
}
