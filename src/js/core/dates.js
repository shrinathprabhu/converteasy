// Calendar maths. Dates are handled as plain calendar days (UTC midnight) so
// daylight saving shifts never turn "one day" into 23 hours.

const DAY = 86_400_000;

/** "2026-09-10" → UTC-midnight timestamp, or null. */
export function parseISODate(s) {
  const m = /^(\d{1,6})-(\d{2})-(\d{2})$/.exec(String(s).trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return t;
}

export function toISODate(t) {
  const d = new Date(t);
  const y = d.getUTCFullYear();
  return `${String(y).padStart(4, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function todayISO(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

/** Add calendar units, clamping to month end (31 Jan + 1 month = 28/29 Feb). */
export function addToDate(t, { years = 0, months = 0, weeks = 0, days = 0 } = {}) {
  const d = new Date(t);
  const totalMonths = d.getUTCMonth() + months + years * 12;
  const y = d.getUTCFullYear() + Math.floor(totalMonths / 12);
  const m = ((totalMonths % 12) + 12) % 12;
  const day = Math.min(d.getUTCDate(), daysInMonth(y, m));
  return Date.UTC(y, m, day) + (weeks * 7 + days) * DAY;
}

/**
 * Difference between two calendar dates.
 * Returns the y/m/d breakdown plus totals in every unit.
 */
export function dateDiff(a, b, { inclusive = false } = {}) {
  let sign = 1;
  let start = a;
  let end = b;
  if (end < start) {
    [start, end] = [end, start];
    sign = -1;
  }
  if (inclusive) end += DAY;
  const totalDays = Math.round((end - start) / DAY);

  const s = new Date(start);
  const e = new Date(end);
  let years = e.getUTCFullYear() - s.getUTCFullYear();
  let months = e.getUTCMonth() - s.getUTCMonth();
  let days = e.getUTCDate() - s.getUTCDate();
  if (days < 0) {
    months -= 1;
    // Borrow the length of the month before the end month.
    const pm = (e.getUTCMonth() + 11) % 12;
    const py = pm === 11 ? e.getUTCFullYear() - 1 : e.getUTCFullYear();
    days += daysInMonth(py, pm);
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return {
    sign,
    years,
    months,
    days,
    totalDays,
    totalWeeks: Math.floor(totalDays / 7),
    weekRemainder: totalDays % 7,
    totalMonths: years * 12 + months,
    hours: totalDays * 24,
    minutes: totalDays * 1440,
    seconds: totalDays * 86400,
    businessDays: businessDays(start, end),
    weekendDays: totalDays - businessDays(start, end),
  };
}

/** Monday to Friday days in [start, end). */
export function businessDays(start, end) {
  const total = Math.round((end - start) / DAY);
  const full = Math.floor(total / 7);
  let count = full * 5;
  const startDow = new Date(start).getUTCDay();
  for (let i = 0; i < total % 7; i++) {
    const dow = (startDow + i) % 7;
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

export function weekday(t) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(t);
}

export function longDate(t) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(t);
}

export function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function dayOfYear(t) {
  const d = new Date(t);
  return Math.round((t - Date.UTC(d.getUTCFullYear(), 0, 1)) / DAY) + 1;
}

/** ISO 8601 week number. */
export function isoWeek(t) {
  const d = new Date(t);
  const dow = d.getUTCDay() || 7;
  const thursday = t + (4 - dow) * DAY;
  const yearStart = Date.UTC(new Date(thursday).getUTCFullYear(), 0, 1);
  return Math.ceil(((thursday - yearStart) / DAY + 1) / 7);
}

// ---------------------------------------------------------------------------
// Unix time

/**
 * Interpret a typed epoch number, guessing its unit from its size:
 * ≤ 11 digits seconds, 12–14 milliseconds, 15–17 microseconds, else ns.
 */
export function parseEpoch(text) {
  const s = String(text).trim().replace(/[,_\s]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const digits = s.replace(/^-/, '').split('.')[0].length;
  const n = Number(s);
  let unit = 's';
  let ms = n * 1000;
  if (digits >= 18) {
    unit = 'ns';
    ms = n / 1e6;
  } else if (digits >= 15) {
    unit = 'µs';
    ms = n / 1000;
  } else if (digits >= 12) {
    unit = 'ms';
    ms = n;
  }
  if (!Number.isFinite(ms) || Math.abs(ms) > 8.64e15) return null;
  return { ms, unit };
}

export function relativeTime(ms, now = Date.now()) {
  const diff = ms - now;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const table = [
    [60_000, 1000, 'second'],
    [3_600_000, 60_000, 'minute'],
    [DAY, 3_600_000, 'hour'],
    [30 * DAY, DAY, 'day'],
    [365 * DAY, 30.436875 * DAY, 'month'],
    [Infinity, 365.2425 * DAY, 'year'],
  ];
  for (const [limit, div, unit] of table) {
    if (abs < limit) return rtf.format(Math.round(diff / div), unit);
  }
  return '';
}

// ---------------------------------------------------------------------------
// Time zones

/** Offset of `zone` from UTC at instant `ms`, in minutes. */
export function zoneOffset(ms, zone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(ms);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);
  const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUTC - Math.floor(ms / 1000) * 1000) / 60000);
}

/** The instant when the wall clock in `zone` reads the given local time. */
export function zonedToInstant({ y, mo, d, h = 0, mi = 0 }, zone) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let off = zoneOffset(guess, zone);
  let t = guess - off * 60000;
  const off2 = zoneOffset(t, zone);
  if (off2 !== off) t = guess - off2 * 60000;
  return t;
}

export function formatInZone(ms, zone, opts = {}) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...opts,
  }).format(ms);
}

export function offsetLabel(minutes) {
  const sign = minutes < 0 ? '−' : '+';
  const a = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

export const POPULAR_ZONES = [
  'UTC', 'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York', 'America/Sao_Paulo',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Africa/Lagos', 'Africa/Johannesburg', 'Europe/Moscow',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland',
];

export function allZones() {
  try {
    const list = Intl.supportedValuesOf('timeZone');
    return list.includes('UTC') ? list : ['UTC', ...list];
  } catch {
    return POPULAR_ZONES;
  }
}

export function zoneLabel(zone) {
  if (zone === 'UTC') return 'UTC';
  const city = zone.split('/').pop().replace(/_/g, ' ');
  return `${city} (${zone.split('/')[0].replace(/_/g, ' ')})`;
}
