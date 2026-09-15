// Exact decimal arithmetic on strings, for crypto denominations.
//
// 1 ETH is 10^18 wei. A double has 15-17 significant digits, so converting
// 1.234567890123456789 ETH to wei with floats silently corrupts the answer.
// Every conversion between denominations of one asset is a power of ten, so
// it is just a decimal point move on the digit string: exact at any size.

const NUM = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i;

/**
 * Parse a user-typed decimal ("1,234.5", "1e-9", ".5", "007") into parts.
 * Returns null when the text is not a single valid number.
 */
export function parseDecimal(text) {
  const s = String(text).trim().replace(/[,_\s]/g, '').replace(/^−/, '-');
  if (!s) return null;
  const m = NUM.exec(s);
  if (!m) return null;
  const [, sign, int = '', frac = '', exp = '0'] = m;
  if (!int && !frac) return null;
  let digits = (int + frac).replace(/^0+/, '');
  let scale = frac.length - Number(exp); // value = digits × 10^-scale
  if (!digits) return { neg: false, digits: '0', scale: 0 };
  // Trailing zeros carry no information.
  const tz = digits.match(/0+$/);
  if (tz) {
    digits = digits.slice(0, -tz[0].length);
    scale -= tz[0].length;
  }
  return { neg: sign === '-', digits, scale };
}

/** Render parts back to a plain decimal string (no exponent). */
export function toPlain({ neg, digits, scale }, { group = false } = {}) {
  if (digits === '0') return '0';
  let int;
  let frac;
  if (scale <= 0) {
    int = digits + '0'.repeat(-scale);
    frac = '';
  } else if (scale >= digits.length) {
    int = '0';
    frac = '0'.repeat(scale - digits.length) + digits;
  } else {
    int = digits.slice(0, digits.length - scale);
    frac = digits.slice(digits.length - scale);
  }
  if (group) int = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + int + (frac ? '.' + frac : '');
}

/**
 * Move a decimal value between denominations. `fromExp`/`toExp` are the
 * number of base units in each denomination as powers of ten (wei 0, gwei 9,
 * ether 18). Exact for any input size.
 */
export function shiftDecimal(text, fromExp, toExp, opts) {
  const p = parseDecimal(text);
  if (!p) return null;
  return toPlain({ ...p, scale: p.scale - (fromExp - toExp) }, opts);
}

/** Number of digits after the point in a parsed value (0 when integral). */
export function fractionDigits(text) {
  const p = parseDecimal(text);
  if (!p) return 0;
  return Math.max(0, p.scale);
}

/** Group an already-plain decimal string for display. */
export function groupPlain(s) {
  const [i, f] = s.split('.');
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f !== undefined ? '.' + f : '');
}
