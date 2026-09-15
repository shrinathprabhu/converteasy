// Crypto denominations: exact decimal-point moves between a coin and its base
// units (ETH ↔ gwei ↔ wei, BTC ↔ sats), plus custom decimals for any token.
// Strings all the way, so 18-decimal amounts never lose a digit.

import { h, replace, params, setParams, copyWithToast, store } from './dom.js';
import { icon } from './icons.js';
import { PRESETS, PRESET_BY_ID, LADDERS } from '../data/money.js';
import { shiftDecimal, parseDecimal, groupPlain } from '../core/decimal.js';
import { ensureRates, usdValue, subscribe } from '../core/rates.js';
import { formatMoney } from '../core/format.js';

export function mount(root, data) {
  const q = params();
  let preset = PRESET_BY_ID.get(q.get('preset') ?? data.preset) ?? PRESETS[0];
  let reversed = (q.get('dir') ?? data.dir) === 'up';
  let customDecimals = Number(q.get('decimals') ?? store.get('crypto.decimals', 18)) || 18;
  let customSymbol = q.get('symbol') ?? store.get('crypto.symbol', 'TOKEN');

  const presetBar = h(
    'div',
    { class: 'preset-bar', role: 'radiogroup', 'aria-label': 'Preset' },
    PRESETS.map((p) => h('button', { type: 'button', role: 'radio', class: 'chip chip-preset', 'aria-checked': 'false', dataset: { id: p.id }, text: p.label })),
  );

  const topInput = h('input', { class: 'field-input mono', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'done' });
  const bottomInput = h('input', { class: 'field-input mono', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'done' });
  const topLabel = h('span', { class: 'unit-tag' });
  const bottomLabel = h('span', { class: 'unit-tag' });
  const topMsg = h('p', { class: 'field-msg', 'aria-live': 'polite' });
  const bottomMsg = h('p', { class: 'field-msg', 'aria-live': 'polite' });
  const swapBtn = h('button', { type: 'button', class: 'swap', 'aria-label': 'Swap direction' }, icon('swap', { size: 20 }));
  const decimalsInput = h('input', { class: 'field-input small', type: 'number', min: '0', max: '36', step: '1', inputmode: 'numeric', 'aria-label': 'Decimals', value: String(customDecimals) });
  const symbolInput = h('input', { class: 'field-input small', maxlength: '12', autocapitalize: 'characters', 'aria-label': 'Token symbol', value: customSymbol });
  const customRow = h('div', { class: 'custom-row' }, h('label', { class: 'mini' }, 'Token ', symbolInput), h('label', { class: 'mini' }, 'Decimals ', decimalsInput));
  const note = h('p', { class: 'note' });
  const fiat = h('p', { class: 'formula' });
  const ladderEl = h('div', { class: 'ladder' });
  const copyTop = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Copy top value' }, icon('copy'));
  const copyBottom = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Copy bottom value' }, icon('copy'));

  replace(
    root,
    h(
      'div',
      { class: 'conv crypto' },
      presetBar,
      customRow,
      h(
        'div',
        { class: 'conv-fields' },
        h('div', { class: 'field' }, h('div', { class: 'field-row' }, topInput, topLabel, copyTop), topMsg),
        swapBtn,
        h('div', { class: 'field' }, h('div', { class: 'field-row' }, bottomInput, bottomLabel, copyBottom), bottomMsg),
      ),
      fiat,
      note,
      ladderEl,
    ),
  );

  // Denominations for the current preset: [big, small] with exponents.
  function denoms() {
    if (preset.ladder) {
      const ladder = LADDERS[preset.ladder].units;
      const a = ladder.find((u) => u.id === preset.from);
      const b = ladder.find((u) => u.id === preset.to);
      return [
        { label: preset.big, exp: a.exp },
        { label: preset.small, exp: b.exp },
      ];
    }
    const d = preset.custom ? customDecimals : preset.decimals;
    return [
      { label: preset.custom ? customSymbol || 'TOKEN' : preset.big, exp: d },
      { label: preset.small, exp: 0 },
    ];
  }

  function order() {
    const [big, small] = denoms();
    return reversed ? [small, big] : [big, small];
  }

  let driver = 'top';

  function compute() {
    const [top, bottom] = order();
    topLabel.textContent = top.label;
    bottomLabel.textContent = bottom.label;
    topInput.setAttribute('aria-label', `Amount in ${top.label}`);
    bottomInput.setAttribute('aria-label', `Amount in ${bottom.label}`);
    const [src, dst, srcD, dstD, msg, other] = driver === 'top' ? [topInput, bottomInput, top, bottom, topMsg, bottomMsg] : [bottomInput, topInput, bottom, top, bottomMsg, topMsg];
    other.textContent = '';
    const raw = src.value.trim();
    if (!raw) {
      dst.value = '';
      msg.textContent = '';
      src.classList.remove('invalid');
      return;
    }
    const out = shiftDecimal(raw, srcD.exp, dstD.exp);
    src.classList.toggle('invalid', out == null);
    if (out == null) {
      msg.textContent = 'Enter a number like 1.5, 0.000021 or 2e-9';
      return;
    }
    dst.value = groupPlain(out);
    const p = parseDecimal(out);
    msg.textContent = dstD.exp === 0 && p && p.scale > 0 ? `Not a whole number of ${dstD.label}: the smallest unit can't be split.` : '';
    if (msg.textContent) {
      other.textContent = msg.textContent;
      msg.textContent = '';
    }
  }

  function renderFiat() {
    const [big] = denoms();
    const coin = preset.custom ? null : preset.big;
    const price = coin ? usdValue(coin) : null;
    if (!price) {
      fiat.textContent = coin ? '' : 'Custom tokens have no price feed.';
      return;
    }
    const topIsBig = !reversed;
    const bigAmountText = topIsBig ? topInput.value : bottomInput.value;
    const bigAmount = Number(String(bigAmountText).replace(/,/g, ''));
    if (!Number.isFinite(bigAmount)) {
      fiat.textContent = '';
      return;
    }
    // Ladder presets whose "big" side is not the whole coin (gwei ↔ wei).
    let coinAmount = bigAmount;
    if (preset.ladder) {
      const ladder = LADDERS[preset.ladder].units;
      const whole = ladder[ladder.length - 1].exp;
      coinAmount = bigAmount * 10 ** (big.exp - whole);
    }
    const coinName = preset.ladder ? LADDERS[preset.ladder].units.at(-1).id : coin;
    fiat.textContent = `≈ $${formatMoney(coinAmount * price)} USD at 1 ${coinName} = $${formatMoney(price)}`;
  }

  function renderLadder() {
    if (!preset.ladder) {
      replace(ladderEl);
      return;
    }
    const ladder = LADDERS[preset.ladder];
    const [top, bottom] = order();
    const srcVal = driver === 'top' ? topInput.value : bottomInput.value;
    const srcExp = driver === 'top' ? top.exp : bottom.exp;
    replace(
      ladderEl,
      h('p', { class: 'mini-title', text: `Every ${ladder.name} denomination` }),
      h(
        'div',
        { class: 'table-wrap' },
        h(
          'table',
          { class: 'table' },
          h('caption', { class: 'sr-only', text: `The amount in each ${ladder.name} denomination` }),
          h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: 'Denomination' }), h('th', { scope: 'col', text: 'Amount' }))),
          h(
            'tbody',
            {},
            ladder.units.map((u) => {
              const v = srcVal.trim() ? shiftDecimal(srcVal, srcExp, u.exp) : null;
              return h('tr', {}, h('th', { scope: 'row', text: u.label }), h('td', { class: 'num mono', text: v == null ? '—' : groupPlain(v) }));
            }),
          ),
        ),
      ),
    );
  }

  function render() {
    for (const b of presetBar.children) b.setAttribute('aria-checked', String(b.dataset.id === preset.id));
    customRow.hidden = !preset.custom;
    note.textContent = preset.note ?? (preset.custom ? 'Enter the token’s decimals from its contract (the decimals() value on ERC-20 tokens).' : `${preset.big} has ${preset.decimals} decimal places.`);
    compute();
    renderLadder();
    renderFiat();
  }

  function setPreset(p) {
    preset = p;
    reversed = false;
    driver = 'top';
    if (!topInput.value) topInput.value = '1';
    setParams({ preset: p.id === (data.preset ?? 'usdc') ? null : p.id, dir: null });
    render();
    presetBar.querySelector(`[data-id="${p.id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  presetBar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (b) setPreset(PRESET_BY_ID.get(b.dataset.id));
  });
  presetBar.addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
    const idx = PRESETS.indexOf(preset);
    const next = PRESETS[(idx + (e.key === 'ArrowRight' ? 1 : PRESETS.length - 1)) % PRESETS.length];
    setPreset(next);
    presetBar.querySelector(`[data-id="${next.id}"]`)?.focus();
  });
  topInput.addEventListener('input', () => {
    driver = 'top';
    render();
  });
  bottomInput.addEventListener('input', () => {
    driver = 'bottom';
    render();
  });
  swapBtn.addEventListener('click', () => {
    reversed = !reversed;
    const carry = bottomInput.value.replace(/,/g, '');
    topInput.value = carry || topInput.value;
    driver = 'top';
    setParams({ dir: reversed ? 'up' : null });
    swapBtn.classList.remove('spin');
    void swapBtn.offsetWidth;
    swapBtn.classList.add('spin');
    render();
  });
  decimalsInput.addEventListener('input', () => {
    const d = Math.round(Number(decimalsInput.value));
    if (d >= 0 && d <= 36) {
      customDecimals = d;
      store.set('crypto.decimals', d);
      render();
    }
  });
  symbolInput.addEventListener('input', () => {
    customSymbol = symbolInput.value.trim().toUpperCase().slice(0, 12);
    store.set('crypto.symbol', customSymbol);
    render();
  });
  copyTop.addEventListener('click', () => copyWithToast(topInput.value.replace(/,/g, '')));
  copyBottom.addEventListener('click', () => copyWithToast(bottomInput.value.replace(/,/g, '')));

  topInput.value = q.get('v') ?? data.value ?? '1';
  render();
  subscribe(() => renderFiat());
  ensureRates();
}
