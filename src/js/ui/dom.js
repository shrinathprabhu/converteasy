// Tiny DOM helpers. Everything is built with createElement and textContent:
// no innerHTML anywhere, which is what lets the CSP enforce Trusted Types.

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'selected' || k === 'disabled' || k === 'hidden') el[k] = Boolean(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}

export function replace(el, ...children) {
  clear(el);
  return append(el, children);
}

const SVGNS = 'http://www.w3.org/2000/svg';
export function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const c of children.flat()) if (c) el.append(c);
  return el;
}

let uid = 0;
export function id(prefix = 'ce') {
  uid += 1;
  return `${prefix}-${uid}`;
}

export function debounce(fn, ms = 120) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// A resolved Promise only queues a microtask; it does not let input or paint run.
export function yieldToMain() {
  return globalThis.scheduler?.yield ? scheduler.yield() : new Promise((resolve) => setTimeout(resolve, 0));
}

export const store = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(`converteasy.${key}`);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`converteasy.${key}`, JSON.stringify(value));
    } catch {
      /* private mode or full: not fatal */
    }
  },
};

export function params() {
  return new URLSearchParams(location.search);
}

/** Replace query parameters without a navigation, dropping empty ones. */
export function setParams(obj) {
  const url = new URL(location.href);
  for (const [k, v] of Object.entries(obj)) {
    if (v == null || v === '') url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  }
  history.replaceState(history.state, '', url);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = h('textarea', { value: text, readonly: true, class: 'sr-only' });
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

let toastEl;
let toastTimer;
export function toast(message, { action, onAction, ms = 2200 } = {}) {
  if (!toastEl) {
    toastEl = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(toastEl);
  }
  replace(toastEl, h('span', { text: message }), action && h('button', { type: 'button', class: 'toast-action', text: action, onclick: () => { onAction?.(); hide(); } }));
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  const hide = () => toastEl.classList.remove('show');
  if (!action) toastTimer = setTimeout(hide, ms);
}

/** Copy with a toast. */
export async function copyWithToast(text, label = 'Copied') {
  const ok = await copyText(text);
  toast(ok ? `${label}: ${text.length > 40 ? text.slice(0, 40) + '…' : text}` : 'Copy failed, select and copy manually');
}

export async function share({ title, text, url }) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }
  await copyWithToast(url, 'Link copied');
}
