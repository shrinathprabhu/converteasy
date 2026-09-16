// Boot: theme, service worker, install prompt, search palette, and the tool
// for this page. Pages are static HTML; the body's data attributes say which
// tool to mount and with what defaults.

import { toast, yieldToMain } from './ui/dom.js';

// Trusted Types: the CSP requires them, and the only sink this app touches is
// the service worker URL. Everything else is textContent and createElement.
let ttPolicy = null;
if (window.trustedTypes?.createPolicy) {
  try {
    ttPolicy = window.trustedTypes.createPolicy('converteasy', {
      createScriptURL(url) {
        const u = new URL(url, location.href);
        if (u.origin === location.origin && u.pathname === `/sw.js`) return u.href;
        throw new TypeError('Blocked script URL');
      },
    });
  } catch {
    ttPolicy = null;
  }
}

const TOOLS = {
  calculator: () => import('./ui/calculator.js'),
  units: () => import('./ui/units.js'),
  currency: () => import('./ui/currency.js'),
  crypto: () => import('./ui/crypto.js'),
  date: () => import('./ui/datetime.js'),
  cooking: () => import('./ui/cooking.js'),
  numberbase: () => import('./ui/numberbase.js'),
};

/**
 * Offline, the service worker answers an uncached converter URL with its
 * tool page. Recover that URL's own defaults (kg → lb, USD → INR) from the
 * cached page index so the tool still opens on the right pair.
 */
async function offlineDefaults() {
  const canonical = document.querySelector('link[rel="canonical"]')?.href;
  if (!canonical) return {};
  const want = location.pathname.replace(/(.)\/$/, '$1');
  if (new URL(canonical).pathname === want) return {};
  try {
    const pages = await (await fetch(`/pages.json`)).json();
    return pages.find((p) => p.p === want)?.d ?? {};
  } catch {
    return {};
  }
}

async function mountTool() {
  const root = document.getElementById('tool');
  const data = { ...document.body.dataset, ...(await offlineDefaults()) };
  const load = TOOLS[data.tool];
  if (!root || !load) return;
  try {
    const mod = await load();
    // Separate module evaluation from mounting, leaving an opportunity to paint
    // the reserved shell and respond to input on slower devices.
    await yieldToMain();
    await mod.mount(root, data);
    root.classList.add('ready');
  } catch (err) {
    // A chunk from an older deploy can vanish mid-session: reload once.
    if (!sessionStorage.getItem('ce-reloaded')) {
      sessionStorage.setItem('ce-reloaded', '1');
      location.reload();
      return;
    }
    console.error(err);
    root.classList.add('failed');
  }
}

// ---- theme ------------------------------------------------------------------

function initTheme() {
  const btn = document.querySelector('[data-theme-toggle]');
  if (!btn) return;
  const order = ['system', 'light', 'dark'];
  const labels = { system: 'Theme: match system', light: 'Theme: light', dark: 'Theme: dark' };
  const apply = (mode) => {
    if (mode === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = mode;
    btn.dataset.mode = mode;
    btn.setAttribute('aria-label', `${labels[mode]}. Switch theme`);
    btn.title = labels[mode];
    const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    for (const m of document.querySelectorAll('meta[name="theme-color"]')) m.setAttribute('content', dark ? '#0f1113' : '#f7f6f2');
  };
  let mode = 'system';
  try {
    mode = localStorage.getItem('converteasy.theme') || 'system';
  } catch {
    /* default */
  }
  apply(mode);
  btn.addEventListener('click', () => {
    mode = order[(order.indexOf(mode) + 1) % order.length];
    try {
      localStorage.setItem('converteasy.theme', mode);
    } catch {
      /* fine */
    }
    apply(mode);
  });
}

// ---- PWA ----------------------------------------------------------------------

function initServiceWorker() {
  if (!('serviceWorker' in navigator) || new URLSearchParams(location.search).has('nosw')) return;
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) toast('ConvertEasy updated', { action: 'Reload', onAction: () => location.reload() });
  });
  const url = `/sw.js`;
  const scriptURL = ttPolicy ? ttPolicy.createScriptURL(url) : url;
  const register = () =>
    navigator.serviceWorker.register(scriptURL, { scope: '/' }).catch(() => {});
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

function initInstall() {
  const btn = document.querySelector('[data-install]');
  if (!btn) return;
  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    btn.hidden = false;
  });
  btn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice.catch(() => null);
    deferred = null;
    btn.hidden = true;
  });
  window.addEventListener('appinstalled', () => (btn.hidden = true));
}

function initOffline() {
  const set = () => document.documentElement.classList.toggle('is-offline', navigator.onLine === false);
  window.addEventListener('online', set);
  window.addEventListener('offline', set);
  set();
}

// ---- search palette -----------------------------------------------------------

function initPalette() {
  const btn = document.querySelector('[data-search]');
  const open = () => import('./ui/palette.js').then((m) => m.openPalette());
  btn?.addEventListener('click', open);
  document.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName ?? '');
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
      e.preventDefault();
      open();
    }
  });
}

initTheme();
initOffline();
initPalette();
initInstall();
mountTool();
initServiceWorker();
