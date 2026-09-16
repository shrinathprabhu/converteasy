// Currency converter: fiat ↔ fiat, fiat ↔ crypto, crypto ↔ crypto, on live
// rates. The last good table is kept for offline use and labelled as such.

import { h, replace, store, params, setParams, copyWithToast, share } from './dom.js';
import { icon } from './icons.js';
import { picker } from './picker.js';
import { readNumber } from './units.js';
import { ensureRates, subscribe, autoRefresh, ago, SOURCES } from '../core/rates.js';
import { FIAT_CODES, CRYPTO, POPULAR_FIAT, POPULAR_CRYPTO, currencyName, flagOf, isCrypto, SYMBOL } from '../data/money.js';
import { formatMoney, formatNumber, plainNumber } from '../core/format.js';

const GLANCE = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CNY', 'AUD', 'CAD', 'AED', 'SGD', 'BTC', 'ETH'];

function options(available) {
  const have = new Set(available);
  const ok = (c) => !have.size || have.has(c);
  const opt = (code, group) => ({
    value: code,
    label: code,
    short: code,
    hint: currencyName(code),
    badge: flagOf(code) || (isCrypto(code) ? '◈' : ''),
    group,
    search: `${currencyName(code)} ${SYMBOL[code] ?? ''}`,
  });
  const popular = [...POPULAR_FIAT.slice(0, 10), ...POPULAR_CRYPTO.slice(0, 3)].filter(ok);
  return [
    ...popular.map((c) => opt(c, 'Popular')),
    ...CRYPTO.map((c) => c.code)
      .filter((c) => ok(c) && !popular.includes(c))
      .map((c) => opt(c, 'Crypto')),
    ...FIAT_CODES.filter((c) => ok(c) && !popular.includes(c))
      .sort((a, b) => currencyName(a).localeCompare(currencyName(b)))
      .map((c) => opt(c, 'World currencies')),
  ];
}

export function mount(root, data) {
  const q = params();
  const last = store.get('currency.last', null);
  let from = (q.get('from') ?? data.from ?? last?.from ?? 'USD').toUpperCase();
  let to = (q.get('to') ?? data.to ?? last?.to ?? 'EUR').toUpperCase();
  let rates = null;
  let state = null;

  const amount = h('input', { class: 'field-input', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'done', 'aria-label': 'Amount', value: q.get('v') ?? data.value ?? '1' });
  const amountMsg = h('p', { class: 'field-msg', 'aria-live': 'polite' });
  const initialOptions = options([]);
  const fromPick = picker({ label: 'From currency', options: initialOptions, value: from, placeholder: 'Search currencies or crypto', onChange: (v) => ((from = v), sync()) });
  const toPick = picker({ label: 'To currency', options: initialOptions, value: to, placeholder: 'Search currencies or crypto', onChange: (v) => ((to = v), sync()) });
  const swapBtn = h('button', { type: 'button', class: 'swap', 'aria-label': 'Swap currencies' }, icon('swap', { size: 20 }));

  const big = h('output', { class: 'money-big', 'aria-live': 'polite' });
  const rateLine = h('p', { class: 'formula' });
  const statusDot = h('span', { class: 'dot-status', 'aria-hidden': 'true' });
  const statusText = h('span', {});
  const refreshBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Refresh rates' }, icon('refresh'));
  const copyBtn = h('button', { type: 'button', class: 'btn ghost small' }, icon('copy', { size: 16 }), 'Copy');
  const shareBtn = h('button', { type: 'button', class: 'btn ghost small' }, icon('share', { size: 16 }), 'Share');
  const glance = h('ul', { class: 'glance' });

  replace(
    root,
    h(
      'div',
      { class: 'conv money' },
      h(
        'div',
        { class: 'conv-fields' },
        h('div', { class: 'field' }, h('span', { class: 'field-label', text: 'Amount' }), h('div', { class: 'field-row' }, amount, fromPick.el), amountMsg),
        swapBtn,
        h('div', { class: 'field' }, h('span', { class: 'field-label', text: 'Converted to' }), h('div', { class: 'field-row' }, big, toPick.el)),
      ),
      rateLine,
      h('div', { class: 'conv-bar' }, h('p', { class: 'rate-status' }, statusDot, statusText), h('span', { class: 'spacer' }), refreshBtn, copyBtn, shareBtn),
      h('div', { class: 'glance-wrap' }, h('p', { class: 'mini-title', text: 'At a glance' }), glance),
    ),
  );

  function usd(code) {
    return rates?.[code] ?? null;
  }

  function fmt(v, code) {
    return formatMoney(v, { crypto: isCrypto(code) });
  }

  function render() {
    const n = readNumber(amount.value);
    amount.classList.toggle('invalid', Boolean(n.error));
    amountMsg.textContent = n.error ?? (n.computed ? `= ${formatNumber(n.value)}` : '');
    const a = usd(from);
    const b = usd(to);
    // Keep ten real slots while rates load or fail, including partial feeds.
    // This preserves the grid's geometry and communicates unavailable values.
    replace(glance, GLANCE.filter((c) => c !== from).slice(0, 10).map((c) =>
      h('li', {}, h('button', {
        type: 'button', class: 'glance-item', dataset: { code: c },
        disabled: !a || !usd(c), 'aria-label': `Convert to ${currencyName(c)}`,
      }, h('span', { class: 'glance-code' }, flagOf(c) || '◈', ' ', c),
      h('span', { class: 'glance-val num', text: a && usd(c) ? fmt(((n.value ?? 0) * a) / usd(c), c) : '—' }))),
    ));
    if (!rates) {
      big.textContent = '…';
      rateLine.textContent = state?.error ? "Couldn't reach any rate source. Check your connection and try again." : 'Loading live rates…';
      return;
    }
    if (!a || !b) {
      big.textContent = '—';
      rateLine.textContent = `No rate for ${!a ? from : to} from the current source.`;
      return;
    }
    const value = n.value ?? 0;
    const out = (value * a) / b;
    big.textContent = `${n.empty ? '0' : fmt(out, to)}`;
    big.dataset.plain = plainNumber(out, 12);
    const r1 = a / b;
    rateLine.textContent = `1 ${from} = ${fmt(r1, to)} ${to}  ·  1 ${to} = ${fmt(1 / r1, from)} ${from}`;
  }

  function renderStatus() {
    if (!state) return;
    const live = state.rates && !state.stale;
    statusDot.className = `dot-status ${state.loading ? 'loading' : live ? 'live' : 'stale'}`;
    if (!state.rates) statusText.textContent = state.loading ? 'Loading rates…' : 'Rates unavailable';
    else {
      const names = (state.sources ?? []).map((s) => SOURCES[s]?.name ?? s).join(' + ');
      statusText.textContent = `${live ? 'Live' : navigator.onLine === false ? 'Offline copy' : 'Cached'} · ${names} · ${ago(state.at)}`;
    }
    refreshBtn.classList.toggle('spinning', Boolean(state.loading));
  }

  function sync() {
    fromPick.set(from);
    toPick.set(to);
    store.set('currency.last', { from, to });
    setParams({ from: from !== (data.from ?? 'USD') ? from : null, to: to !== (data.to ?? 'EUR') ? to : null, v: amount.value !== (data.value ?? '1') ? amount.value : null });
    render();
  }

  subscribe((st) => {
    state = st;
    if (st?.rates) {
      const first = !rates;
      rates = st.rates;
      if (first) {
        const opts = options(Object.keys(rates));
        fromPick.setOptions(opts, from);
        toPick.setOptions(opts, to);
      }
    }
    render();
    renderStatus();
  });
  setInterval(renderStatus, 15_000);

  amount.addEventListener('input', sync);
  swapBtn.addEventListener('click', () => {
    [from, to] = [to, from];
    swapBtn.classList.remove('spin');
    void swapBtn.offsetWidth;
    swapBtn.classList.add('spin');
    sync();
  });
  refreshBtn.addEventListener('click', () => ensureRates({ force: true }));
  copyBtn.addEventListener('click', () => copyWithToast(big.dataset.plain ?? big.textContent));
  shareBtn.addEventListener('click', () => {
    const url = new URL(location.href);
    url.searchParams.set('v', amount.value);
    url.searchParams.set('from', from);
    url.searchParams.set('to', to);
    share({ title: 'ConvertEasy', text: `${amount.value} ${from} = ${big.textContent} ${to} · ConvertEasy`, url: url.toString() });
  });
  glance.addEventListener('click', (e) => {
    const b = e.target.closest('[data-code]');
    if (!b) return;
    to = b.dataset.code;
    sync();
  });

  render();
  ensureRates();
  autoRefresh();
}
