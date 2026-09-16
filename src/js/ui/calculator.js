// Smart calculator UI.
//
// A multi-line editor: every line is its own calculation, and "ans" refers
// to the line above. Suggestion chips under the editor follow the caret:
// units after a number (same kind only once a unit is in play), operators
// after a value, target units after "to". The main result card follows the
// line the caret is on and has a unit dropdown for the answer.

import { h, replace, store, params, setParams, copyWithToast, share, debounce, toast, yieldToMain } from './dom.js';
import { icon } from './icons.js';
import { picker } from './picker.js';
import { calculate, describe, unitsFor, currencyUnit, unitByKey } from '../core/calc.js';
import { suggest, EXAMPLES } from '../core/suggest.js';
import { ensureRates, usdValue, availableCodes, subscribe, ago } from '../core/rates.js';
import { FIAT_CODES, CRYPTO, POPULAR_FIAT, POPULAR_CRYPTO, currencyName, flagOf } from '../data/money.js';
import { dataModeToggle, getDataMode, onDataMode } from './datamode.js';
import { dataGroup, sizeHint, sortDataUnits } from '../data/units.js';

const DEFAULT_DOC = ['1 cm + 1 m', '5 ft 11 in to cm', '3 m × 4 m', '$20 + €15 in INR'].join('\n');

export async function mount(root, opts = {}) {
  const hero = opts.variant === 'hero';
  const urlQ = params().get('q');
  const saved = store.get('calc.doc');
  const initial = urlQ ?? saved ?? (opts.initial || DEFAULT_DOC);

  /** line index → chosen unit key, remembered per category */
  let choices = store.get('calc.choices', {}) || {};
  let results = [];
  let activeLine = 0;
  let lastSuggest = null;
  let ratesRequested = false;
  let revision = 0;
  let ratesRevision = 0;
  let evaluatedKey = '';
  let evaluating = false;

  const ctx = {
    get dataMode() {
      return getDataMode();
    },
    money: (code) => usdValue(code),
    currencies: () => {
      const have = new Set(availableCodes());
      const pool = [...POPULAR_FIAT, ...POPULAR_CRYPTO, ...FIAT_CODES, ...CRYPTO.map((c) => c.code)];
      return [...new Set(pool)].filter((c) => have.size === 0 || have.has(c));
    },
  };

  // ---- elements ----------------------------------------------------------
  const ta = h('textarea', {
    class: 'calc-input',
    id: 'calc-input',
    rows: '1',
    spellcheck: 'false',
    autocapitalize: 'off',
    autocomplete: 'off',
    autocorrect: 'off',
    enterkeyhint: 'enter',
    'aria-label': 'Calculation. One per line.',
    'aria-describedby': 'calc-help',
    placeholder: 'Type a calculation, like 1 cm + 1 m',
    value: initial,
  });
  const help = h('p', { id: 'calc-help', class: 'sr-only', text: 'Suggestions appear below as buttons. Press Tab to accept the first unit suggestion while typing a unit.' });
  const chips = h('div', { class: 'chips', role: 'toolbar', 'aria-label': 'Suggestions' });
  const hint = h('p', { class: 'calc-hint', 'aria-live': 'off' });

  const valueEl = h('output', { class: 'result-value', for: 'calc-input' });
  const unitSlot = h('div', { class: 'result-unit' });
  const exprEl = h('p', { class: 'result-expr' });
  const altEl = h('p', { class: 'result-alt' });
  const statusEl = h('p', { class: 'result-status' });
  // Shown only when the line is about bytes, where KB can mean 1,000 or 1,024 B.
  const modeSlot = h('div', { class: 'result-mode', hidden: true }, dataModeToggle({ compact: true }));
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  const copyBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Copy result' }, icon('copy'));
  const shareBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Share this calculation' }, icon('share'));
  const resultCard = h(
    'div',
    { class: 'result-card' },
    h('div', { class: 'result-top' }, h('span', { class: 'result-label', text: 'Result' }), h('span', { class: 'result-actions' }, copyBtn, shareBtn)),
    h('div', { class: 'result-main' }, valueEl, unitSlot),
    exprEl,
    altEl,
    modeSlot,
    statusEl,
    live,
  );
  const linesEl = h('ol', { class: 'lines', 'aria-label': 'All lines' });
  const clearBtn = h('button', { type: 'button', class: 'btn ghost small' }, icon('trash', { size: 16 }), 'Clear');
  const exampleBtn = h('button', { type: 'button', class: 'btn ghost small' }, icon('sparkle', { size: 16 }), 'Examples');
  const historyBtn = h('button', { type: 'button', class: 'btn ghost small', 'aria-expanded': 'false' }, icon('history', { size: 16 }), 'Recent');
  const historyEl = h('div', { class: 'history', hidden: true });

  replace(
    root,
    h(
      'div',
      { class: `calc${hero ? ' calc-hero' : ''}` },
      h('div', { class: 'calc-editor' }, h('div', { class: 'ruler', 'aria-hidden': 'true' }), ta),
      help,
      chips,
      hint,
      resultCard,
      h('div', { class: 'calc-bar' }, h('div', { class: 'lines-wrap' }, linesEl), h('div', { class: 'calc-tools' }, historyBtn, exampleBtn, clearBtn)),
      historyEl,
    ),
  );

  // ---- evaluation ---------------------------------------------------------
  async function evaluateAll(ticket) {
    const lines = ta.value.split('\n');
    let ans = null;
    let needsRates = false;
    const next = [];
    let started = performance.now();
    for (const [i, line] of lines.entries()) {
      let r = calculate(line, { ...ctx, ans });
      if (r.tokens?.some((t) => t.t === 'unit' && t.unit.currency)) needsRates = true;
      if (!r.ok && /rates are still loading|No live rate/.test(r.error)) {
        needsRates = true;
        // Before the first rates arrive this is a wait, not a mistake.
        if (!subscribeState?.rates) r = { ...r, incomplete: true, error: 'Loading live exchange rates…' };
      }
      if (r.ok && r.kind === 'quantity') {
        const chosen = choices[i];
        if (chosen && !r.fixed && chosen.cat === r.category.id) {
          const unit = unitByKey(chosen.key);
          if (unit) r = describe(r, unit, ctx);
        }
      }
      if (r.ok && r.q && !r.empty) ans = { q: r.q, unit: r.unit };
      next.push({ line, r, i });
      // Preserve sequential "ans" semantics while allowing edits to supersede
      // a long paste. Never publish results from an abandoned calculation.
      if (performance.now() - started >= 8) {
        await yieldToMain();
        if (ticket !== revision) return null;
        started = performance.now();
      }
    }
    if (needsRates && !ratesRequested) {
      ratesRequested = true;
      setTimeout(() => ensureRates(), 0);
    }
    return next;
  }

  function caretLine() {
    const pos = ta.selectionStart ?? ta.value.length;
    return ta.value.slice(0, pos).split('\n').length - 1;
  }

  function unitOptions(r) {
    if (r.category.id === 'currency') {
      const codes = ctx.currencies();
      return codes.map((code) => ({
        value: `currency:${code}`,
        label: code,
        short: code,
        hint: currencyName(code),
        badge: flagOf(code) || (CRYPTO.some((c) => c.code === code) ? '◈' : ''),
        group: POPULAR_FIAT.includes(code) ? 'Popular' : CRYPTO.some((c) => c.code === code) ? 'Crypto' : 'All currencies',
        search: currencyName(code),
      }));
    }
    const mode = getDataMode();
    const isData = r.category.id === 'data' || r.category.id === 'datarate';
    const units = unitsFor(r.category, ctx);
    return (isData ? sortDataUnits(units, mode) : units).map((u) => {
      const size = sizeHint(u, mode);
      return {
        value: u.key,
        label: u.symbol,
        short: u.symbol,
        hint: size ? `${u.name} · ${size}` : u.name,
        group: isData ? dataGroup(u, mode) : u.popular ? 'Common' : 'More units',
        search: [u.name, u.plural, ...u.names].join(' '),
      };
    });
  }

  let unitPicker = null;
  let pickerCat = null;

  function renderResult() {
    const entry = results[activeLine] ?? results.find((x) => !x.r.empty) ?? null;
    const r = entry?.r;
    resultCard.classList.remove('is-error', 'is-pending', 'is-bool', 'is-empty');
    // The byte switch shows whenever any line depends on it, so switching it
    // never changes a result you cannot see the control for.
    modeSlot.hidden = !results.some((x) => usesBytes(x.r));
    altEl.textContent = '';
    statusEl.textContent = '';
    if (!r || r.empty) {
      resultCard.classList.add('is-empty');
      valueEl.textContent = '0';
      exprEl.textContent = 'Type a calculation above, one per line.';
      replace(unitSlot);
      pickerCat = null;
      return;
    }
    if (!r.ok) {
      resultCard.classList.add(r.incomplete ? 'is-pending' : 'is-error');
      valueEl.textContent = r.incomplete ? '…' : '!';
      exprEl.textContent = r.error;
      replace(unitSlot);
      pickerCat = null;
      live.textContent = r.incomplete ? '' : `Error: ${r.error}`;
      return;
    }
    if (r.kind === 'bool') resultCard.classList.add('is-bool');
    valueEl.textContent = r.kind === 'quantity' ? r.number : r.text;
    exprEl.textContent = r.interpretation;
    if (r.note) statusEl.textContent = `Shown as a ${r.note}.`;
    if (r.alt?.length) altEl.textContent = '= ' + r.alt.map((a) => a.text).join(' · ');

    if (r.kind === 'quantity') {
      const catKey = r.category.id;
      const opts = unitOptions(r);
      if (!unitPicker || pickerCat !== catKey) {
        unitPicker = picker({
          label: 'Result unit',
          options: opts,
          value: r.unit.key,
          placeholder: 'Search units',
          onChange: (key) => {
            const line = activeLine;
            choices[line] = { cat: results[line].r.category.id, key };
            store.set('calc.choices', choices);
            update();
          },
        });
        pickerCat = catKey;
        replace(unitSlot, unitPicker.el);
      } else {
        unitPicker.setOptions(opts, r.unit.key);
      }
    } else {
      replace(unitSlot);
      pickerCat = null;
    }
    if (r.category?.id === 'currency') {
      const st = subscribeState;
      if (st?.at) statusEl.textContent = `Live rate${st.sources?.length > 1 ? 's' : ''} via ${st.sources.map(sourceName).join(' + ')}, updated ${ago(st.at)}${st.stale ? ' (offline copy)' : ''}.`;
    }
    announce(r);
  }

  const announce = debounce((r) => {
    live.textContent = r.kind === 'quantity' ? `Result ${r.number} ${r.unit.plural ?? r.symbol}` : `Result ${r.text}`;
  }, 700);

  let renderedResults = null;
  async function renderLines(ticket) {
    if (renderedResults === results) {
      for (const row of linesEl.children) row.classList.toggle('active', Number(row.firstElementChild.dataset.line) === activeLine);
      return;
    }
    const nonEmpty = results.filter((x) => !x.r.empty);
    const fragment = document.createDocumentFragment();
    let started = performance.now();
    for (const { line, r, i } of nonEmpty) {
      const output = r.ok ? (r.kind === 'quantity' ? `${r.number} ${r.symbol}` : r.text) : r.incomplete ? '…' : '⚠';
      fragment.append(h(
        'li',
        { class: `line${i === activeLine ? ' active' : ''}${!r.ok ? (r.incomplete ? ' pending' : ' error') : ''}` },
        h(
          'button',
          { type: 'button', class: 'line-btn', dataset: { line: String(i) }, 'aria-label': `Go to line ${i + 1}: ${line}` },
          h('span', { class: 'line-no', text: String(i + 1) }),
          h('span', { class: 'line-src', text: line }),
          h('span', { class: 'line-out', title: output, text: output }),
        ),
      ));
      if (performance.now() - started >= 8) {
        await yieldToMain();
        if (ticket !== revision) return;
        started = performance.now();
      }
    }
    if (ticket !== revision) return;
    root.querySelector('.calc-bar').classList.toggle('single', nonEmpty.length <= 1);
    replace(linesEl, fragment);
    renderedResults = results;
  }

  function renderSuggest() {
    const pos = ta.selectionStart ?? ta.value.length;
    const lineStart = ta.value.lastIndexOf('\n', pos - 1) + 1;
    const before = ta.value.slice(lineStart, pos);
    const prevResult = results[activeLine - 1]?.r;
    // Until the editor is focused, the caret position is meaningless: offer examples.
    const s = document.activeElement === ta ? suggest(before, { ...ctx, ans: prevResult?.ok && prevResult.q ? prevResult : null }) : suggest('', ctx);
    lastSuggest = { ...s, lineStart };
    let items = s.items;
    if (s.context === 'start') {
      const recent = (store.get('calc.history', []) || []).slice(0, 4);
      items = [...recent.map((e) => ({ label: e, insert: e, kind: 'example', recent: true })), ...items.filter((x) => !recent.includes(x.insert))].slice(0, 10);
    }
    replace(
      chips,
      items.slice(0, 16).map((item, idx) =>
        h(
          'button',
          {
            type: 'button',
            class: `chip chip-${item.kind}${item.recent ? ' chip-recent' : ''}${idx === 0 && s.partial ? ' chip-first' : ''}`,
            title: item.hint ? `${item.label} · ${item.hint}` : undefined,
            'aria-label': item.hint ? `${item.label}, ${item.hint}` : item.kind === 'example' ? `Example: ${item.label}` : `Insert ${item.label}`,
            dataset: { idx: String(idx) },
          },
          item.label,
          item.hint && item.kind === 'unit' && h('small', { text: item.hint }),
        ),
      ),
    );
    chips.dataset.context = s.context;
    chips._items = items;
    const firstUnit = items.find((x) => x.kind === 'unit');
    hint.textContent = s.partial && firstUnit && items[0] === firstUnit ? `Tab to use ${firstUnit.label}` : '';
  }

  function autosize() {
    if (CSS.supports('field-sizing', 'content')) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight + 2, hero ? 360 : 420)}px`;
  }

  async function update() {
    const ticket = ++revision;
    activeLine = caretLine();
    const key = JSON.stringify([ta.value, choices, getDataMode(), ratesRevision]);
    if (key !== evaluatedKey) {
      evaluating = true;
      copyBtn.disabled = shareBtn.disabled = true;
      chips.inert = true;
      lastSuggest = null;
      resultCard.setAttribute('aria-busy', 'true');
      const next = await evaluateAll(ticket);
      if (!next || ticket !== revision) return;
      results = next;
      evaluatedKey = key;
    }
    evaluating = false;
    copyBtn.disabled = shareBtn.disabled = false;
    chips.inert = false;
    resultCard.removeAttribute('aria-busy');
    renderResult();
    renderSuggest();
    autosize();
    await renderLines(ticket);
  }

  const persist = debounce(() => {
    store.set('calc.doc', ta.value);
    if (params().has('q')) setParams({ q: null });
  }, 400);

  // ---- insertion ----------------------------------------------------------
  function insert(item) {
    if (evaluating || !item) return;
    const v = ta.value;
    const pos = ta.selectionStart ?? v.length;
    if (item.kind === 'example') {
      const lineStart = v.lastIndexOf('\n', pos - 1) + 1;
      let lineEnd = v.indexOf('\n', pos);
      if (lineEnd < 0) lineEnd = v.length;
      ta.value = v.slice(0, lineStart) + item.insert + v.slice(lineEnd);
      const caret = lineStart + item.insert.length;
      ta.setSelectionRange(caret, caret);
    } else {
      const from = lastSuggest ? lastSuggest.lineStart + lastSuggest.replaceFrom : pos;
      const prev = v[from - 1] ?? '';
      const next = v[pos] ?? '';
      let text = item.insert;
      const spaced = item.kind === 'unit' || item.kind === 'kw' || (item.kind === 'op' && !item.tight);
      if (spaced && prev && !/[\s(√]/.test(prev) && !(item.tightAfter && /[(√−-]/.test(prev))) text = ' ' + text;
      if (!item.tightAfter && !item.tight && next !== ' ') text += ' ';
      if (item.tight && item.insert !== '^' && next && next !== ' ') text += ' ';
      ta.value = v.slice(0, from) + text + v.slice(pos);
      const caret = from + text.length;
      ta.setSelectionRange(caret, caret);
    }
    ta.focus({ preventScroll: true });
    persist();
    update();
  }

  // ---- events ---------------------------------------------------------------
  ta.addEventListener('input', () => {
    persist();
    update();
  });
  for (const ev of ['click', 'keyup', 'focus']) ta.addEventListener(ev, (e) => {
    if (ev === 'keyup' && !/Arrow|Home|End|Page/.test(e.key)) return;
    const line = caretLine();
    if (line !== activeLine || ev !== 'keyup') update();
    else renderSuggest();
  });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && !e.shiftKey && lastSuggest?.partial && chips._items?.[0]?.kind === 'unit') {
      e.preventDefault();
      insert(chips._items[0]);
    } else if (e.key === 'Enter' && !e.shiftKey && !evaluating) {
      const r = results[caretLine()]?.r;
      if (r?.ok && !r.empty) remember(results[caretLine()].line);
    }
  });
  ta.addEventListener('blur', () => {
    if (evaluating) return;
    const r = results[activeLine];
    if (r?.r.ok && !r.r.empty) remember(r.line);
  });

  // Chips keep the editor focused (and the phone keyboard up).
  chips.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.chip') && document.activeElement === ta) e.preventDefault();
  });
  chips.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (btn) insert(chips._items[Number(btn.dataset.idx)]);
  });
  linesEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.line-btn');
    if (!btn) return;
    const n = Number(btn.dataset.line);
    const lines = ta.value.split('\n');
    const pos = lines.slice(0, n + 1).join('\n').length;
    ta.focus();
    ta.setSelectionRange(pos, pos);
    update();
  });

  copyBtn.addEventListener('click', () => {
    const r = results[activeLine]?.r;
    if (r?.ok && !r.empty) copyWithToast(r.plain ?? r.text);
  });
  shareBtn.addEventListener('click', () => {
    const url = new URL(location.href);
    url.search = '';
    url.hash = '';
    const doc = ta.value.trim();
    if (doc) url.searchParams.set('q', doc);
    if (getDataMode() === 'binary' && results.some((x) => usesBytes(x.r))) url.searchParams.set('bytes', 'binary');
    const r = results[activeLine]?.r;
    const text = r?.ok && !r.empty ? `${results[activeLine].line} = ${r.text}` : 'Calculate with units';
    share({ title: 'ConvertEasy calculation', text: `${text} · ConvertEasy by OwlEye`, url: url.toString() });
  });
  clearBtn.addEventListener('click', () => {
    const prev = ta.value;
    ta.value = '';
    choices = {};
    store.set('calc.choices', choices);
    persist();
    update();
    ta.focus();
    if (prev) toast('Cleared', { action: 'Undo', onAction: () => ((ta.value = prev), persist(), update()) });
  });
  exampleBtn.addEventListener('click', () => {
    const lines = ta.value.trim() ? ta.value.replace(/\s+$/, '') + '\n' : '';
    const pick = EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)];
    ta.value = lines + pick;
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    persist();
    update();
  });
  historyBtn.addEventListener('click', () => {
    const open = historyEl.hidden;
    historyEl.hidden = !open;
    historyBtn.setAttribute('aria-expanded', String(open));
    if (open) renderHistory();
  });

  function remember(line) {
    const text = line.trim();
    if (!text || text.length > 200) return;
    const list = (store.get('calc.history', []) || []).filter((x) => x !== text);
    list.unshift(text);
    store.set('calc.history', list.slice(0, 30));
  }

  function renderHistory() {
    const list = store.get('calc.history', []) || [];
    replace(
      historyEl,
      h('p', { class: 'history-title', text: list.length ? 'Recent calculations, stored only in this browser' : 'Nothing yet. Press Enter after a calculation to keep it here.' }),
      list.length &&
        h(
          'ul',
          { class: 'history-list' },
          list.map((item) => h('li', {}, h('button', { type: 'button', class: 'chip chip-example', text: item, onclick: () => insert({ kind: 'example', insert: item }) }))),
        ),
      list.length && h('button', { type: 'button', class: 'btn ghost small', text: 'Forget history', onclick: () => (store.set('calc.history', []), renderHistory()) }),
    );
  }

  onDataMode(() => update());

  // Rates arrive → re-evaluate currency lines.
  let subscribeState = null;
  subscribe((st) => {
    subscribeState = st;
    ratesRevision += 1;
    if (ratesRequested) update();
  });

  if (urlQ) ta.setSelectionRange(ta.value.length, ta.value.length);
  await update();
  if (opts.autofocus && matchMedia('(pointer: fine)').matches) ta.focus({ preventScroll: true });
  return { update };
}

/** Does this line involve a unit whose size depends on the byte mode? */
function usesBytes(r) {
  if (!r?.ok || !r.tokens) return false;
  return r.tokens.some((t) => t.t === 'unit' && t.unit.binaryFactor) || Boolean(r.unit?.binaryFactor) || ['data', 'datarate'].includes(r.category?.id);
}

function sourceName(id) {
  return { coinbase: 'Coinbase', coingecko: 'CoinGecko', currencyapi: 'currency-api', frankfurter: 'Frankfurter' }[id] ?? id;
}
