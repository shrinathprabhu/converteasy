// Number bases with BigInt, so a 256-bit hash converts as exactly as 255.

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

export const BASES = [
  { base: 2, name: 'Binary', prefix: '0b' },
  { base: 8, name: 'Octal', prefix: '0o' },
  { base: 10, name: 'Decimal', prefix: '' },
  { base: 16, name: 'Hexadecimal', prefix: '0x' },
  { base: 32, name: 'Base 32', prefix: '' },
  { base: 36, name: 'Base 36', prefix: '' },
];

/** Parse text in `base` to a BigInt, or throw with a readable reason. */
export function parseInBase(text, base) {
  let s = String(text).trim().toLowerCase().replace(/[\s_,]/g, '');
  let neg = false;
  if (s.startsWith('-')) {
    neg = true;
    s = s.slice(1);
  }
  const prefixes = { 2: '0b', 8: '0o', 16: '0x' };
  if (prefixes[base] && s.startsWith(prefixes[base])) s = s.slice(2);
  if (!s) throw new Error('Enter a number');
  let n = 0n;
  const b = BigInt(base);
  for (const ch of s) {
    const d = DIGITS.indexOf(ch);
    if (d < 0 || d >= base) throw new Error(`“${ch}” isn't a base-${base} digit`);
    n = n * b + BigInt(d);
  }
  return neg ? -n : n;
}

export function formatInBase(n, base, { group = true } = {}) {
  const neg = n < 0n;
  let s = (neg ? -n : n).toString(base);
  if (base === 16 || base > 16) s = s.toUpperCase();
  if (group) {
    const size = base === 2 ? 4 : base === 16 ? 4 : base === 10 ? 3 : 0;
    if (size) {
      const sep = base === 10 ? ',' : ' ';
      s = s.replace(new RegExp(`\\B(?=(.{${size}})+(?!.))`, 'g'), sep);
    }
  }
  return (neg ? '-' : '') + s;
}

export function bitLength(n) {
  const a = n < 0n ? -n : n;
  return a === 0n ? 1 : a.toString(2).length;
}

const ROMAN = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

export function toRoman(n) {
  if (!Number.isInteger(n) || n < 1 || n > 3999) throw new Error('Roman numerals cover 1 to 3,999');
  let out = '';
  for (const [v, s] of ROMAN) while (n >= v) (out += s), (n -= v);
  return out;
}

export function fromRoman(text) {
  const s = String(text).trim().toUpperCase();
  if (!/^[MDCLXVI]+$/.test(s)) throw new Error('Use the letters I, V, X, L, C, D and M');
  const val = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const v = val[s[i]];
    const next = val[s[i + 1]] ?? 0;
    total += v < next ? -v : v;
  }
  // Only accept canonical spellings, so "IIII" and "VX" are rejected.
  if (total < 1 || total > 3999 || toRoman(total) !== s) throw new Error(`“${s}” isn't a standard Roman numeral`);
  return total;
}
