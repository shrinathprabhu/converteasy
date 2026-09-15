// Live exchange rates with layered fallbacks. No keys, no backend.
//
//  1. Coinbase public exchange rates: fiat and crypto in one call, refreshed
//     about every minute. CORS open, no key.
//  2. CoinGecko simple price: crypto prices, keyless (or a free Demo key if
//     one is configured at build time). Fills coins Coinbase lacks.
//  3. fawazahmed0 currency-api on jsDelivr, mirrored on Cloudflare Pages:
//     200+ fiat and crypto, updated daily.
//  4. Frankfurter: ECB reference rates, daily, fiat only.
//
// Rates are stored as "USD value of one unit" so any pair is a division.
// The last good table is cached in localStorage, so the converter still
// works offline with a clearly labelled timestamp.

import { CRYPTO } from '../data/money.js';
import { COINGECKO_DEMO_KEY } from '../config.js';

const CACHE_KEY = 'converteasy.rates.v1';
const FRESH_MS = 60_000;
const TIMEOUT_MS = 7000;

export const SOURCES = {
  coinbase: { name: 'Coinbase', url: 'https://www.coinbase.com', live: true },
  coingecko: { name: 'CoinGecko', url: 'https://www.coingecko.com', live: true },
  currencyapi: { name: 'currency-api', url: 'https://github.com/fawazahmed0/exchange-api', live: false },
  frankfurter: { name: 'Frankfurter (ECB)', url: 'https://frankfurter.dev', live: false },
};

async function getJSON(url, { headers } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Coinbase returns "units of X per 1 USD". */
export function fromCoinbase(json) {
  const rates = json?.data?.rates;
  if (!rates) throw new Error('bad coinbase payload');
  const out = { USD: 1 };
  for (const [code, perUsd] of Object.entries(rates)) {
    const n = Number(perUsd);
    if (n > 0 && Number.isFinite(n)) out[code.toUpperCase()] = 1 / n;
  }
  return out;
}

/** currency-api returns { usd: { eur: 0.85, btc: 0.0000129 } }. */
export function fromCurrencyApi(json) {
  const table = json?.usd;
  if (!table) throw new Error('bad currency-api payload');
  const out = { USD: 1 };
  for (const [code, perUsd] of Object.entries(table)) {
    const n = Number(perUsd);
    if (n > 0 && Number.isFinite(n)) out[code.toUpperCase()] = 1 / n;
  }
  return out;
}

/** Frankfurter returns { base: 'USD', rates: { EUR: 0.85 } }. */
export function fromFrankfurter(json) {
  if (!json?.rates) throw new Error('bad frankfurter payload');
  const out = { USD: 1 };
  for (const [code, perUsd] of Object.entries(json.rates)) out[code] = 1 / Number(perUsd);
  return out;
}

/** CoinGecko returns { bitcoin: { usd: 77000 } }: already USD per coin. */
export function fromCoinGecko(json) {
  const out = {};
  for (const c of CRYPTO) {
    const usd = json?.[c.cg]?.usd;
    if (usd > 0) out[c.code] = usd;
  }
  return out;
}

const fetchers = {
  coinbase: async () => fromCoinbase(await getJSON('https://api.coinbase.com/v2/exchange-rates?currency=USD')),
  coingecko: async (ids) => {
    const q = new URLSearchParams({ ids: ids.join(','), vs_currencies: 'usd' });
    const headers = COINGECKO_DEMO_KEY ? { 'x-cg-demo-api-key': COINGECKO_DEMO_KEY } : undefined;
    return fromCoinGecko(await getJSON(`https://api.coingecko.com/api/v3/simple/price?${q}`, { headers }));
  },
  currencyapi: async () => {
    try {
      return fromCurrencyApi(await getJSON('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json'));
    } catch {
      return fromCurrencyApi(await getJSON('https://latest.currency-api.pages.dev/v1/currencies/usd.min.json'));
    }
  },
  frankfurter: async () => fromFrankfurter(await getJSON('https://api.frankfurter.dev/v1/latest?base=USD')),
};

/**
 * Fetch a fresh table. Resolves with { rates, source, sources, at } or throws
 * when every source failed.
 */
export async function fetchRates(fetch = fetchers) {
  const at = Date.now();
  const sources = [];
  let rates = null;

  try {
    rates = await fetch.coinbase();
    sources.push('coinbase');
  } catch {
    /* fall through */
  }

  const missingCrypto = CRYPTO.filter((c) => !rates?.[c.code]).map((c) => c.cg);
  if (missingCrypto.length) {
    try {
      const cg = await fetch.coingecko(missingCrypto);
      if (Object.keys(cg).length) {
        rates = { USD: 1, ...cg, ...(rates ?? {}) };
        sources.push('coingecko');
      }
    } catch {
      /* optional */
    }
  }

  const hasFiat = rates && rates.EUR && rates.INR && rates.JPY;
  if (!hasFiat) {
    try {
      rates = { ...(await fetch.currencyapi()), ...(rates ?? {}) };
      sources.push('currencyapi');
    } catch {
      try {
        rates = { ...(await fetch.frankfurter()), ...(rates ?? {}) };
        sources.push('frankfurter');
      } catch {
        /* nothing left */
      }
    }
  }

  if (!rates || !rates.EUR) throw new Error('All rate sources failed');
  return { rates, sources, source: sources[0], at };
}

// ---------------------------------------------------------------------------
// Store with cache, refresh and subscribers (browser only)

let state = null; // { rates, sources, source, at, stale, error }
let inflight = null;
const listeners = new Set();

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.rates?.USD) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ rates: data.rates, sources: data.sources, source: data.source, at: data.at }));
  } catch {
    /* storage full or blocked: fine */
  }
}

function emit() {
  for (const fn of listeners) fn(state);
}

export function subscribe(fn) {
  listeners.add(fn);
  if (state) fn(state);
  return () => listeners.delete(fn);
}

export function current() {
  if (!state) {
    const cached = readCache();
    if (cached) state = { ...cached, stale: Date.now() - cached.at > FRESH_MS, cached: true };
  }
  return state;
}

/** Load rates: cached table immediately, network refresh when stale. */
export function ensureRates({ force = false } = {}) {
  current();
  if (!force && state && Date.now() - state.at < FRESH_MS && !state.cached) return Promise.resolve(state);
  if (inflight) return inflight;
  if (state) {
    state = { ...state, loading: true };
    emit();
  }
  inflight = fetchRates()
    .then((data) => {
      state = { ...data, stale: false, cached: false, loading: false };
      writeCache(state);
      emit();
      return state;
    })
    .catch((err) => {
      state = state ? { ...state, stale: true, loading: false, error: err.message } : { rates: null, error: err.message, loading: false };
      emit();
      return state;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** USD value of one unit of `code`, or null. */
export function usdValue(code) {
  return current()?.rates?.[code] ?? null;
}

export function availableCodes() {
  return Object.keys(current()?.rates ?? {});
}

/** Keep a page's rates fresh while it is visible. */
export function autoRefresh(intervalMs = FRESH_MS) {
  let timer = null;
  const tick = () => {
    if (document.visibilityState === 'visible' && navigator.onLine !== false) ensureRates({ force: true });
  };
  const start = () => {
    stop();
    timer = setInterval(tick, intervalMs);
  };
  const stop = () => timer && clearInterval(timer);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (Date.now() - (state?.at ?? 0) > FRESH_MS) tick();
      start();
    } else stop();
  });
  window.addEventListener('online', tick);
  start();
  return stop;
}

export function ago(ts, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}
