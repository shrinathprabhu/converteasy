// Date & time tools: between dates, add/subtract, Unix time, time zones.

import { h, replace, params, setParams, copyWithToast, id } from './dom.js';
import { icon } from './icons.js';
import { picker } from './picker.js';
import {
  parseISODate, toISODate, todayISO, addToDate, dateDiff, weekday, longDate, isLeapYear, dayOfYear, isoWeek,
  parseEpoch, relativeTime, zoneOffset, zonedToInstant, formatInZone, offsetLabel, POPULAR_ZONES, allZones, zoneLabel,
} from '../core/dates.js';
import { formatNumber } from '../core/format.js';

const TABS = [
  { id: 'diff', label: 'Between dates' },
  { id: 'add', label: 'Add or subtract' },
  { id: 'unix', label: 'Unix time' },
  { id: 'tz', label: 'Time zones' },
];

export function mount(root, data) {
  const q = params();
  let mode = TABS.some((t) => t.id === q.get('mode')) ? q.get('mode') : data.mode ?? 'diff';
  const tablist = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Date tools' });
  const panels = {};
  for (const t of TABS) {
    const tabId = id('tab');
    const panelId = id('panel');
    tablist.append(h('button', { type: 'button', role: 'tab', id: tabId, class: 'tab', 'aria-controls': panelId, dataset: { mode: t.id }, text: t.label }));
    panels[t.id] = h('div', { role: 'tabpanel', id: panelId, 'aria-labelledby': tabId, class: 'tabpanel', tabindex: '0' });
  }
  replace(root, h('div', { class: 'dates' }, tablist, ...Object.values(panels)));

  const builders = { diff: buildDiff, add: buildAdd, unix: buildUnix, tz: buildTz };
  const built = new Set();

  function select(next, focus) {
    mode = next;
    for (const b of tablist.children) {
      const on = b.dataset.mode === mode;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    }
    for (const [k, p] of Object.entries(panels)) p.hidden = k !== mode;
    if (!built.has(mode)) {
      builders[mode](panels[mode], data);
      built.add(mode);
    }
    setParams({ mode: mode === (data.mode ?? 'diff') ? null : mode });
  }
  tablist.addEventListener('click', (e) => {
    const b = e.target.closest('[role=tab]');
    if (b) select(b.dataset.mode);
  });
  tablist.addEventListener('keydown', (e) => {
    const idx = TABS.findIndex((t) => t.id === mode);
    if (e.key === 'ArrowRight') select(TABS[(idx + 1) % TABS.length].id, true);
    else if (e.key === 'ArrowLeft') select(TABS[(idx + TABS.length - 1) % TABS.length].id, true);
  });
  select(mode);
}

function dateField(label, value) {
  const input = h('input', { type: 'date', class: 'field-input', value, 'aria-label': label, min: '0001-01-01', max: '9999-12-31' });
  return { input, el: h('label', { class: 'field' }, h('span', { class: 'field-label', text: label }), input) };
}

function stat(label, value, sub) {
  return h('div', { class: 'stat' }, h('span', { class: 'stat-label', text: label }), h('b', { class: 'stat-value num', text: value }), sub && h('span', { class: 'stat-sub', text: sub }));
}

function plural(n, word) {
  return `${formatNumber(n)} ${word}${Math.abs(n) === 1 ? '' : 's'}`;
}

// ---------------------------------------------------------------------------

function buildDiff(panel, data) {
  const today = todayISO();
  const a = dateField(data.age ? 'Date of birth' : 'Start date', data.age ? '1995-06-15' : today);
  const b = dateField(data.age ? 'Age on' : 'End date', data.age ? today : toISODate(addToDate(parseISODate(today), { days: 100 })));
  const inclusive = h('input', { type: 'checkbox' });
  const out = h('div', { class: 'date-out', 'aria-live': 'polite' });
  const todayA = h('button', { type: 'button', class: 'btn ghost small', text: 'Today' });
  const todayB = h('button', { type: 'button', class: 'btn ghost small', text: 'Today' });
  replace(
    panel,
    h('div', { class: 'date-grid' }, h('div', {}, a.el, todayA), h('div', {}, b.el, todayB)),
    h('label', { class: 'check' }, inclusive, ' Include the end date (count both days)'),
    out,
  );

  function render() {
    const s = parseISODate(a.input.value);
    const e = parseISODate(b.input.value);
    if (s == null || e == null) {
      replace(out, h('p', { class: 'field-msg', text: 'Pick two valid dates.' }));
      return;
    }
    const d = dateDiff(s, e, { inclusive: inclusive.checked });
    const parts = [d.years && plural(d.years, 'year'), d.months && plural(d.months, 'month'), plural(d.days, 'day')].filter(Boolean).join(', ');
    replace(
      out,
      h('p', { class: 'date-headline' }, h('b', { text: parts }), d.sign < 0 ? ' (end is before start)' : ''),
      h(
        'div',
        { class: 'stats' },
        stat('Total days', formatNumber(d.totalDays)),
        stat('Weeks', formatNumber(d.totalWeeks), d.weekRemainder ? `+ ${plural(d.weekRemainder, 'day')}` : 'exactly'),
        stat('Months', formatNumber(d.totalMonths), d.days ? `+ ${plural(d.days, 'day')}` : 'exactly'),
        stat('Weekdays', formatNumber(d.businessDays), `${formatNumber(d.weekendDays)} weekend days`),
        stat('Hours', formatNumber(d.hours)),
        stat('Minutes', formatNumber(d.minutes)),
        stat('Seconds', formatNumber(d.seconds)),
      ),
      h('p', { class: 'formula', text: `${longDate(Math.min(s, e))} → ${longDate(Math.max(s, e))}` }),
    );
  }
  for (const el of [a.input, b.input, inclusive]) el.addEventListener('input', render);
  todayA.addEventListener('click', () => ((a.input.value = todayISO()), render()));
  todayB.addEventListener('click', () => ((b.input.value = todayISO()), render()));
  render();
}

function buildAdd(panel) {
  const start = dateField('Start date', todayISO());
  const sign = h('select', { class: 'mini-select', 'aria-label': 'Add or subtract' }, h('option', { value: '1', text: 'Add' }), h('option', { value: '-1', text: 'Subtract' }));
  const nums = {};
  const fields = ['years', 'months', 'weeks', 'days'].map((k) => {
    nums[k] = h('input', { type: 'number', class: 'field-input', inputmode: 'numeric', value: k === 'days' ? '30' : '0', 'aria-label': k, min: '0', max: '100000' });
    return h('label', { class: 'field' }, h('span', { class: 'field-label', text: k[0].toUpperCase() + k.slice(1) }), nums[k]);
  });
  const out = h('div', { class: 'date-out', 'aria-live': 'polite' });
  replace(panel, h('div', { class: 'date-grid' }, start.el, h('label', { class: 'field' }, h('span', { class: 'field-label', text: 'Operation' }), sign)), h('div', { class: 'date-grid four' }, fields), out);

  function render() {
    const s = parseISODate(start.input.value);
    if (s == null) return replace(out, h('p', { class: 'field-msg', text: 'Pick a valid start date.' }));
    const k = Number(sign.value);
    const v = (n) => k * (Math.trunc(Number(nums[n].value)) || 0);
    const t = addToDate(s, { years: v('years'), months: v('months'), weeks: v('weeks'), days: v('days') });
    if (!Number.isFinite(t) || new Date(t).getUTCFullYear() > 275000) return replace(out, h('p', { class: 'field-msg', text: 'That date is out of range.' }));
    const y = new Date(t).getUTCFullYear();
    const iso = toISODate(t);
    const copy = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Copy date' }, icon('copy'));
    copy.addEventListener('click', () => copyWithToast(iso));
    replace(
      out,
      h('p', { class: 'date-headline' }, h('b', { text: longDate(t) }), ' ', copy),
      h('div', { class: 'stats' }, stat('ISO date', iso), stat('Day of year', String(dayOfYear(t))), stat('ISO week', String(isoWeek(t))), stat('Leap year', isLeapYear(y) ? 'Yes' : 'No')),
      h('p', { class: 'formula', text: 'Adding months keeps the day of the month where it can; 31 January plus one month is the last day of February.' }),
    );
  }
  for (const el of [start.input, sign, ...Object.values(nums)]) el.addEventListener('input', render);
  render();
}

function buildUnix(panel) {
  const now = Math.floor(Date.now() / 1000);
  const epoch = h('input', { class: 'field-input mono', inputmode: 'numeric', value: String(now), 'aria-label': 'Unix timestamp' });
  const nowBtn = h('button', { type: 'button', class: 'btn ghost small', text: 'Now' });
  const localIn = h('input', { type: 'datetime-local', class: 'field-input', step: '1', 'aria-label': 'Local date and time' });
  const out = h('div', { class: 'date-out', 'aria-live': 'polite' });
  const live = h('p', { class: 'formula mono' });
  replace(
    panel,
    h('div', { class: 'date-grid' }, h('label', { class: 'field' }, h('span', { class: 'field-label', text: 'Timestamp (s, ms, µs or ns)' }), epoch), h('label', { class: 'field' }, h('span', { class: 'field-label', text: 'Or a local date and time' }), localIn)),
    nowBtn,
    out,
    live,
  );
  function row(label, value) {
    const btn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Copy ${label}` }, icon('copy', { size: 16 }));
    btn.addEventListener('click', () => copyWithToast(value));
    return h('tr', {}, h('th', { scope: 'row', text: label }), h('td', { class: 'mono', text: value }), h('td', {}, btn));
  }
  function render(fromLocal = false) {
    let ms;
    let unit = 's';
    if (fromLocal) {
      ms = new Date(localIn.value).getTime();
      if (!Number.isFinite(ms)) return;
      epoch.value = String(Math.floor(ms / 1000));
    } else {
      const p = parseEpoch(epoch.value);
      if (!p) {
        replace(out, h('p', { class: 'field-msg', text: 'Enter a whole number of seconds, milliseconds, microseconds or nanoseconds.' }));
        return;
      }
      ({ ms, unit } = p);
      const d = new Date(ms);
      const pad = (n) => String(n).padStart(2, '0');
      localIn.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
    const d = new Date(ms);
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    replace(
      out,
      h('p', { class: 'date-headline' }, h('b', { text: relativeTime(ms) }), ` · read as ${unit === 's' ? 'seconds' : unit === 'ms' ? 'milliseconds' : unit === 'µs' ? 'microseconds' : 'nanoseconds'}`),
      h(
        'div',
        { class: 'table-wrap' },
        h(
          'table',
          { class: 'table' },
          h('tbody', {},
            row('UTC', d.toUTCString()),
            row(`Local (${zone})`, formatInZone(ms, zone, { year: 'numeric', second: '2-digit', timeZoneName: 'short' })),
            row('ISO 8601', d.toISOString()),
            row('Seconds', String(Math.floor(ms / 1000))),
            row('Milliseconds', String(Math.round(ms))),
          ),
        ),
      ),
    );
  }
  epoch.addEventListener('input', () => render(false));
  localIn.addEventListener('input', () => render(true));
  nowBtn.addEventListener('click', () => {
    epoch.value = String(Math.floor(Date.now() / 1000));
    render(false);
  });
  const tick = () => {
    if (!panel.isConnected) return;
    live.textContent = `Now: ${Math.floor(Date.now() / 1000)}`;
  };
  tick();
  setInterval(tick, 1000);
  render(false);
}

function buildTz(panel) {
  const here = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zones = allZones();
  const zoneOptions = zones.map((z) => ({ value: z, label: zoneLabel(z), short: zoneLabel(z).split(' (')[0], hint: offsetLabel(zoneOffset(Date.now(), z)), group: POPULAR_ZONES.includes(z) ? 'Popular' : 'All time zones', search: z.replace(/[_/]/g, ' ') }));
  zoneOptions.sort((a, b) => (a.group === b.group ? 0 : a.group === 'Popular' ? -1 : 1));
  let fromZone = here;
  let targets = JSON.parse(localStorage.getItem('converteasy.tz.targets') ?? 'null') || ['UTC', 'America/New_York', 'Europe/London', 'Asia/Kolkata', 'Asia/Tokyo'].filter((z) => z !== here);
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const when = h('input', { type: 'datetime-local', class: 'field-input', 'aria-label': 'Date and time', value: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}` });
  const fromPick = picker({ label: 'Time zone of that time', options: zoneOptions, value: fromZone, placeholder: 'Search cities or zones', onChange: (v) => ((fromZone = v), render()) });
  const addPick = picker({ label: 'Add a time zone', options: zoneOptions, value: '', placeholder: 'Search cities or zones', renderValue: () => [icon('plus', { size: 16 }), h('b', { text: 'Add zone' })], onChange: (v) => {
    if (!targets.includes(v)) targets.push(v);
    save();
    render();
  } });
  const list = h('ul', { class: 'tz-list', 'aria-live': 'polite' });
  replace(panel, h('div', { class: 'date-grid' }, h('label', { class: 'field' }, h('span', { class: 'field-label', text: 'Date and time' }), when), h('div', { class: 'field' }, h('span', { class: 'field-label', text: 'In time zone' }), fromPick.el)), list, addPick.el);

  function save() {
    try {
      localStorage.setItem('converteasy.tz.targets', JSON.stringify(targets));
    } catch {
      /* fine */
    }
  }
  function render() {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(when.value);
    if (!m) return;
    const t = zonedToInstant({ y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5] }, fromZone);
    const baseOff = zoneOffset(t, fromZone);
    replace(
      list,
      targets.map((z) => {
        const off = zoneOffset(t, z);
        const diff = (off - baseOff) / 60;
        const rm = h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Remove ${zoneLabel(z)}` }, icon('close', { size: 16 }));
        rm.addEventListener('click', () => {
          targets = targets.filter((x) => x !== z);
          save();
          render();
        });
        return h(
          'li',
          { class: 'tz-item' },
          h('span', { class: 'tz-name' }, h('b', { text: zoneLabel(z).split(' (')[0] }), h('small', { text: `${offsetLabel(off)} · ${diff === 0 ? 'same time' : `${diff > 0 ? '+' : '−'}${formatNumber(Math.abs(diff))} h`}` })),
          h('span', { class: 'tz-time num', text: formatInZone(t, z) }),
          rm,
        );
      }),
    );
  }
  when.addEventListener('input', render);
  render();
}
