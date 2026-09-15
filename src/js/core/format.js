// Number formatting shared by every tool. Results are shown with grouping and
// a sensible number of significant digits; copies are plain numbers that
// paste straight into a spreadsheet or another calculator.

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

const cache = new Map();
function nf(sig, grouping = true) {
  const key = `${sig}:${grouping}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat('en-US', { maximumSignificantDigits: sig, useGrouping: grouping });
    cache.set(key, f);
  }
  return f;
}

/** Strip binary floating point noise: 0.1 + 0.2 → 0.3. */
export function clean(x, sig = 12) {
  if (!Number.isFinite(x) || x === 0) return x === 0 ? 0 : x;
  return Number(x.toPrecision(sig));
}

/**
 * Human display: grouped digits, up to `sig` significant digits, and
 * scientific notation with superscripts for very large or small values.
 */
export function formatNumber(x, { sig = 10, grouping = true } = {}) {
  if (Number.isNaN(x)) return 'NaN';
  if (x === Infinity) return '∞';
  if (x === -Infinity) return '−∞';
  if (x === 0) return '0';
  const abs = Math.abs(x);
  if (abs >= 1e15 || abs < 1e-7) {
    const [m, e] = clean(x, sig).toExponential(Math.min(sig, 10) - 1).split('e');
    const mant = String(Number(m));
    const exp = String(Number(e))
      .split('')
      .map((c) => SUP[c])
      .join('');
    return `${mant.replace('-', '−')} × 10${exp}`;
  }
  return nf(sig, grouping).format(clean(x, 15)).replace('-', '−');
}

/** Plain machine-friendly string for copying: no grouping, e-notation when huge. */
export function plainNumber(x, sig = 12) {
  if (!Number.isFinite(x)) return String(x);
  if (x === 0) return '0';
  const abs = Math.abs(x);
  const c = clean(x, sig);
  if (abs >= 1e21 || abs < 1e-7) return String(c);
  // toPrecision can leave e-notation for mid-size numbers; Intl never does.
  return nf(sig, false).format(c);
}

/**
 * Money: fiat gets two decimals like a price tag, tiny fiat amounts and
 * crypto keep significant digits instead (0.00032 BTC, 0.0042 USD).
 */
export function formatMoney(x, { crypto = false } = {}) {
  if (!Number.isFinite(x)) return '—';
  const abs = Math.abs(x);
  if (abs === 0) return crypto ? '0' : '0.00';
  if (crypto) return formatNumber(x, { sig: abs >= 1 ? 10 : 6 });
  if (abs >= 1) {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(x).replace('-', '−');
  }
  return formatNumber(x, { sig: 4 });
}

export function superscript(n) {
  return String(n)
    .split('')
    .map((c) => SUP[c] ?? c)
    .join('');
}

/** "1 kilogram" / "2.5 kilograms" */
export function unitLabel(unit, value) {
  return Math.abs(value) === 1 ? unit.name : unit.plural;
}
