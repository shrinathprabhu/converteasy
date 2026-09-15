// Site model: identity, URLs, navigation and the list of pre-rendered pages.
// Every SEO page is generated from the same data the app uses at runtime.

import { CATEGORIES, CATEGORY_BY_ID, getUnit } from '../../src/js/data/units.js';
import { PRESETS } from '../../src/js/data/money.js';
import { INGREDIENTS } from '../../src/js/data/ingredients.js';

// ConvertEasy is its own origin: converteasy.lowkey.tools, served from the
// root. ORIGIN is the lowkey.tools hub it belongs to, linked but not hosting.
export const ORIGIN = 'https://lowkey.tools';
export const SITE_URL = 'https://converteasy.lowkey.tools';

export const SITE = {
  name: 'ConvertEasy',
  repository: 'https://github.com/shrinathprabhu/converteasy',
  tagline: 'Convert anything. Calculate with units.',
  description:
    'Free unit, currency and crypto converter with a smart calculator that understands units. Live exchange rates, exact crypto decimals, dates and time zones. No account, works offline.',
  launched: '2026-09-10',
  version: '1.0.0',
  themeLight: '#f7f6f2',
  themeDark: '#0f1113',
};

export const AUTHOR = {
  name: 'Shrinath Prabhu',
  url: 'https://shrinath.me',
  id: 'https://shrinath.me/#person',
  x: 'https://x.com/shrinath_prabhu',
  handle: '@shrinath_prabhu',
  jobTitle: 'Senior Staff Frontend Engineer',
  bio: 'Senior Staff Frontend Engineer with 8+ years shipping Web3 products, Chrome extensions and scalable frontend infrastructure.',
};

export const ORG = {
  name: 'OwlEye Analytics',
  short: 'OwlEye',
  url: 'https://owleye.dev',
  id: 'https://owleye.dev/#organization',
  tagline: 'Hosted, cookie-free web analytics',
  description:
    'Hosted, cookie-free web analytics with a dependency-free TypeScript SDK, privacy-preserving ingestion, funnels, and dashboards for modern product teams.',
};

export const HUB = { name: 'lowkey.tools', url: ORIGIN, id: `${ORIGIN}/#website` };

/**
 * The rest of the lowkey.tools family. `pitch` is the nudge shown in the
 * cross-promo card; each page picks one app, with a stable selection across builds.
 */
export const SIBLINGS = [
  {
    name: 'FuseLLM',
    url: 'https://fusellm.lowkey.tools',
    desc: 'Bring your own API keys, chat with leading AI models, and connect them into automated multi-model workflows called Fuses.',
    pitch: 'API keys gathering dust? FuseLLM chains the big models into one workflow.',
  },
  {
    name: 'SuperBrain',
    url: 'https://superbrain.lowkey.tools',
    desc: 'A private, local-first workspace for capturing notes, links and ideas, like Notion and Obsidian had a beautifully simple baby.',
    pitch: 'Thought about to escape? Park it in SuperBrain before it does.',
  },
  {
    name: 'SuperSplit',
    url: 'https://supersplit.lowkey.tools',
    desc: 'Split complex group expenses, track who paid and settle debts fairly, without accounts, ads or artificial limits.',
    pitch: 'Dinner bill turned into algebra? SuperSplit works out who owes whom.',
  },
  {
    name: 'SuperFocus',
    url: 'https://superfocus.lowkey.tools',
    desc: 'Your offline focus space for Pomodoro sessions, tasks, goals and quiet, uplifting music.',
    pitch: 'Need a quiet hour? SuperFocus runs the timer and the music.',
  },
  {
    name: 'StreakFreak',
    url: 'https://streakfreak.lowkey.tools',
    desc: 'A private, offline habit tracker with ready-made templates, flexible goals and motivating streak visualizations.',
    pitch: 'Day three of the new habit? StreakFreak keeps the chain going.',
  },
  {
    name: 'Credo',
    url: 'https://credo.lowkey.tools',
    desc: 'Share passwords, secrets and small files through encrypted, password-protected links that automatically expire.',
    pitch: 'Sending a password over chat? Credo sends a link that self-destructs instead.',
  },
  {
    name: 'Favigen',
    url: 'https://favigen.lowkey.tools',
    desc: 'Upload one SVG or PNG and instantly generate every favicon, app icon, manifest and HTML tag your website needs.',
    pitch: 'One image in, every favicon and manifest tag out. That is Favigen.',
  },
  {
    name: 'Billgen',
    url: 'https://billgen.lowkey.tools',
    desc: 'Create polished invoices, receipts, memos and bills locally, then export, print or share them without signing up.',
    pitch: 'Invoice due tonight? Billgen makes it look professional in a minute.',
  },
  {
    name: 'MathMagician',
    url: 'https://mathmagician.lowkey.tools',
    desc: 'Race against the clock to solve as many arithmetic problems as possible and share your fastest score.',
    pitch: 'This app does your math. MathMagician checks whether you still can.',
  },
  {
    name: 'Chesscape',
    url: 'https://chesscape.lowkey.tools',
    desc: 'Escape today’s near-checkmate position with the one saving move before the 30-second timer runs out.',
    pitch: 'One move from checkmate, thirty seconds on the clock: Chesscape.',
  },
  {
    name: 'SpotFast',
    url: 'https://spotfast.lowkey.tools',
    desc: 'Memorize a grid of objects in seconds, then find the hidden targets before you lose all three lives.',
    pitch: 'Thirty-six things, three seconds. SpotFast bets you cannot.',
  },
];

/** One sibling per page, spread across the family. */
export function siblingsFor(path) {
  let hash = 0;
  for (const c of String(path)) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  const start = hash % SIBLINGS.length;
  return [SIBLINGS[start]];
}

export const TOOLS = [
  { id: 'calculator', kind: 'calculator', path: '/calculator', name: 'Smart calculator', nav: 'Calculator', icon: 'calc', desc: 'Type 1 cm + 1 m or $20 + €15 in INR. Math that understands units, with suggestions as you type.' },
  { id: 'units', kind: 'units', path: '/units', name: 'Unit converter', nav: 'Units', icon: 'ruler', desc: '20 categories and 200+ units: length, weight, volume, temperature, area, speed, data and more.' },
  { id: 'currency', kind: 'currency', path: '/currency', name: 'Currency & crypto converter', nav: 'Currency', icon: 'coins', desc: 'Live rates for 150+ currencies and 40+ cryptocurrencies, fiat to crypto and back.' },
  { id: 'crypto-units', kind: 'crypto', path: '/crypto-units', name: 'Crypto units & decimals', nav: 'Crypto units', icon: 'chain', desc: 'Exact ETH, gwei and wei, BTC and sats, USDC base units, and custom token decimals.' },
  { id: 'date-time', kind: 'date', path: '/date-time', name: 'Date & time calculator', nav: 'Date & time', icon: 'calendar', desc: 'Days between dates, add or subtract time, Unix timestamps and time zones.' },
  { id: 'cooking', kind: 'cooking', path: '/cooking', name: 'Cooking converter', nav: 'Cooking', icon: 'whisk', desc: 'Cups to grams for flour, sugar, butter and 20 more ingredients.' },
  { id: 'number-base', kind: 'numberbase', path: '/number-base', name: 'Number base converter', nav: 'Bases', icon: 'hash', desc: 'Binary, octal, decimal, hex, any base to 36, and Roman numerals.' },
];

export const TOOL_BY_ID = new Map(TOOLS.map((t) => [t.id, t]));

/** URL slug of each category page. */
export const CATEGORY_SLUG = {
  length: 'length-converter',
  mass: 'weight-converter',
  volume: 'volume-converter',
  temperature: 'temperature-converter',
  area: 'area-converter',
  speed: 'speed-converter',
  time: 'time-converter',
  data: 'data-storage-converter',
  datarate: 'data-transfer-rate-converter',
  pressure: 'pressure-converter',
  energy: 'energy-converter',
  power: 'power-converter',
  force: 'force-converter',
  angle: 'angle-converter',
  frequency: 'frequency-converter',
  fuel: 'fuel-economy-converter',
  density: 'density-converter',
  torque: 'torque-converter',
  acceleration: 'acceleration-converter',
  flow: 'flow-rate-converter',
};

/** Unit pairs that get their own page, in both directions. */
export const UNIT_PAIRS = {
  length: [['cm', 'in'], ['m', 'ft'], ['km', 'mi'], ['mm', 'in'], ['cm', 'ft'], ['m', 'yd'], ['mm', 'cm'], ['m', 'cm'], ['km', 'm'], ['ft', 'in'], ['nmi', 'km'], ['mi', 'ft'], ['yd', 'ft'], ['m', 'in'], ['mm', 'ft'], ['ly', 'km'], ['um', 'mm'], ['nmi', 'mi']],
  mass: [['kg', 'lb'], ['g', 'oz'], ['lb', 'oz'], ['kg', 'g'], ['st', 'kg'], ['st', 'lb'], ['mg', 'g'], ['t', 'kg'], ['ton', 'kg'], ['ct', 'g'], ['tola', 'g'], ['ozt', 'g'], ['g', 'lb'], ['kg', 'oz'], ['quintal', 'kg'], ['ug', 'mg'], ['t', 'lb']],
  volume: [['l', 'gal'], ['ml', 'floz'], ['cup', 'ml'], ['l', 'cup'], ['tbsp', 'ml'], ['tsp', 'ml'], ['ml', 'l'], ['impgal', 'l'], ['m3', 'l'], ['ft3', 'm3'], ['pt', 'ml'], ['qt', 'l'], ['tbsp', 'tsp'], ['cup', 'floz'], ['cm3', 'ml'], ['bbl', 'l'], ['gal', 'impgal'], ['cup', 'tbsp'], ['floz', 'l'], ['m3', 'gal']],
  temperature: [['C', 'F'], ['C', 'K'], ['F', 'K'], ['R', 'F']],
  area: [['sqft', 'm2'], ['ac', 'ha'], ['ac', 'sqft'], ['m2', 'ha'], ['km2', 'mi2'], ['cm2', 'in2'], ['yd2', 'm2'], ['ac', 'm2'], ['km2', 'ha'], ['sqft', 'ac']],
  speed: [['kmh', 'mph'], ['mps', 'kmh'], ['kn', 'kmh'], ['kn', 'mph'], ['mps', 'mph'], ['mach', 'kmh'], ['fps', 'mps'], ['mach', 'mph']],
  time: [['yr', 'mo'], ['mo', 'd'], ['wk', 'd'], ['d', 'h'], ['h', 'min'], ['min', 's'], ['yr', 'd'], ['yr', 'wk'], ['mo', 'wk'], ['s', 'ms'], ['h', 's'], ['decade', 'yr'], ['century', 'yr'], ['d', 'min'], ['wk', 'h'], ['yr', 'h'], ['mo', 'h'], ['d', 's']],
  data: [['GB', 'MB'], ['MB', 'KB'], ['TB', 'GB'], ['KB', 'B'], ['GB', 'GiB'], ['MB', 'MiB'], ['TB', 'TiB'], ['B', 'bit'], ['GB', 'KB'], ['MB', 'Mb'], ['PB', 'TB'], ['GiB', 'MiB'], ['MB', 'B'], ['GB', 'Gb'], ['TB', 'MB']],
  datarate: [['Mbps', 'MBps'], ['Gbps', 'Mbps'], ['kbps', 'Mbps'], ['Gbps', 'GBps'], ['KBps', 'kbps'], ['MBps', 'GBps']],
  pressure: [['psi', 'bar'], ['psi', 'kPa'], ['bar', 'kPa'], ['atm', 'psi'], ['atm', 'Pa'], ['mmHg', 'kPa'], ['hPa', 'inHg'], ['bar', 'atm'], ['MPa', 'psi'], ['mmHg', 'psi'], ['hPa', 'mmHg']],
  energy: [['kcal', 'kJ'], ['cal', 'J'], ['kWh', 'J'], ['kWh', 'BTU'], ['J', 'eV'], ['kcal', 'cal'], ['BTU', 'J'], ['therm', 'kWh'], ['kJ', 'kWh'], ['kcal', 'kWh']],
  power: [['hp', 'kW'], ['W', 'hp'], ['PS', 'kW'], ['BTUh', 'W'], ['TR', 'kW'], ['hp', 'PS'], ['TR', 'BTUh']],
  force: [['N', 'lbf'], ['kgf', 'N'], ['kN', 'lbf'], ['N', 'dyn'], ['kN', 'kgf']],
  angle: [['deg', 'rad'], ['deg', 'grad'], ['arcmin', 'deg'], ['turn', 'deg'], ['arcsec', 'deg']],
  frequency: [['Hz', 'rpm'], ['kHz', 'Hz'], ['GHz', 'MHz'], ['MHz', 'kHz']],
  fuel: [['mpg', 'l100km'], ['kmpl', 'mpg'], ['mpguk', 'l100km'], ['kmpl', 'l100km'], ['mpg', 'mpguk']],
  density: [['gcm3', 'kgm3'], ['lbft3', 'kgm3'], ['gml', 'lbgal']],
  torque: [['Nm', 'lbft'], ['lbin', 'Nm'], ['kgfm', 'Nm']],
  acceleration: [['g0', 'mps2'], ['fps2', 'mps2']],
  flow: [['lpm', 'gpm'], ['m3h', 'cfm'], ['ls', 'gpm'], ['m3h', 'lpm']],
};

/** Currency pair pages, generated in both directions. */
export const MONEY_PAIRS = [
  ['USD', 'INR'], ['EUR', 'USD'], ['GBP', 'USD'], ['EUR', 'INR'], ['GBP', 'INR'], ['AED', 'INR'], ['USD', 'JPY'], ['USD', 'CAD'],
  ['USD', 'AUD'], ['EUR', 'GBP'], ['USD', 'CNY'], ['SGD', 'INR'], ['CAD', 'INR'], ['AUD', 'INR'], ['USD', 'MXN'], ['USD', 'PHP'],
  ['USD', 'PKR'], ['SAR', 'INR'], ['USD', 'KRW'], ['JPY', 'INR'], ['USD', 'BRL'], ['USD', 'TRY'], ['USD', 'CHF'], ['USD', 'SGD'],
  ['USD', 'AED'], ['USD', 'NGN'], ['USD', 'ZAR'], ['EUR', 'CHF'],
  ['BTC', 'USD'], ['ETH', 'USD'], ['SOL', 'USD'], ['BTC', 'INR'], ['ETH', 'INR'], ['USDT', 'INR'], ['BTC', 'EUR'], ['DOGE', 'USD'],
  ['XRP', 'USD'], ['ETH', 'BTC'], ['BNB', 'USD'], ['ADA', 'USD'], ['LTC', 'USD'], ['TRX', 'USD'], ['USDC', 'USD'], ['SOL', 'INR'],
  ['BTC', 'GBP'], ['ETH', 'EUR'], ['TON', 'USD'], ['SHIB', 'USD'], ['PEPE', 'USD'],
];

/** Crypto denomination pages: [preset id, big slug, small slug]. */
export const CRYPTO_UNIT_PAGES = [
  ['gwei', 'eth', 'gwei'],
  ['wei', 'eth', 'wei'],
  ['gwei-wei', 'gwei', 'wei'],
  ['sat', 'btc', 'sats'],
  ['mbtc', 'btc', 'mbtc'],
  ['ubtc', 'btc', 'bits'],
  ['lamports', 'sol', 'lamports'],
  ['doge', 'doge', 'koinu'],
  ['xrp', 'xrp', 'drops'],
  ['ada', 'ada', 'lovelace'],
  ['trx', 'trx', 'sun'],
  ['dot', 'dot', 'planck'],
  ['near', 'near', 'yoctonear'],
  ['sui', 'sui', 'mist'],
  ['apt', 'apt', 'octas'],
  ['ton', 'ton', 'nanoton'],
  ['xlm', 'xlm', 'stroops'],
  ['ltc', 'ltc', 'litoshi'],
];
export const DECIMAL_PAGES = ['usdc', 'usdt', 'dai', 'wbtc'];

export const COOKING_PAGES = ['flour', 'sugar', 'butter', 'brown-sugar', 'powdered-sugar', 'rice', 'oats', 'honey', 'milk', 'water', 'cocoa', 'oil', 'bread-flour', 'almond-flour'];

export const DATE_PAGES = [
  { slug: 'days-between-dates', mode: 'diff', title: 'Days between dates calculator', h1: 'Days between two dates', desc: 'Count the days, weeks, months and years between two dates, including weekdays only.' },
  { slug: 'age-calculator', mode: 'diff', age: true, title: 'Age calculator: exact age in years, months and days', h1: 'Age calculator', desc: 'Your exact age in years, months and days, plus total days, weeks and hours lived.' },
  { slug: 'add-days-to-date', mode: 'add', title: 'Add or subtract days from a date', h1: 'Add or subtract days, weeks, months or years', desc: 'Find the date a number of days, weeks, months or years before or after any date.' },
  { slug: 'unix-timestamp-converter', mode: 'unix', title: 'Unix timestamp converter (epoch to date)', h1: 'Unix timestamp converter', desc: 'Convert Unix epoch time in seconds, milliseconds, microseconds or nanoseconds to a date, and back.' },
  { slug: 'time-zone-converter', mode: 'tz', title: 'Time zone converter', h1: 'Time zone converter', desc: 'See what time it is in other cities for any date and time, with daylight saving handled.' },
];

export const BASE_PAGES = [
  { slug: 'binary-to-decimal', from: 2, to: 10, sample: '101010' },
  { slug: 'decimal-to-binary', from: 10, to: 2, sample: '42' },
  { slug: 'hex-to-decimal', from: 16, to: 10, sample: 'FF' },
  { slug: 'decimal-to-hex', from: 10, to: 16, sample: '255' },
  { slug: 'binary-to-hex', from: 2, to: 16, sample: '11111111' },
  { slug: 'hex-to-binary', from: 16, to: 2, sample: 'A5' },
  { slug: 'octal-to-decimal', from: 8, to: 10, sample: '777' },
  { slug: 'decimal-to-octal', from: 10, to: 8, sample: '511' },
];

export function unitPairSlug(from, to) {
  return `${from.slug}-to-${to.slug}`;
}

/** All unit pairs as [category, fromUnit, toUnit], both directions, deduped. */
export function allUnitPairs() {
  const out = [];
  const seen = new Set();
  for (const [catId, pairs] of Object.entries(UNIT_PAIRS)) {
    for (const [a, b] of pairs) {
      for (const [f, t] of [
        [a, b],
        [b, a],
      ]) {
        const from = getUnit(catId, f);
        const to = getUnit(catId, t);
        if (!from || !to) throw new Error(`Unknown unit in pair ${catId}:${f}/${t}`);
        const slug = unitPairSlug(from, to);
        if (seen.has(slug)) continue;
        seen.add(slug);
        out.push({ cat: CATEGORY_BY_ID.get(catId), from, to, slug });
      }
    }
  }
  return out;
}

export function pairsInCategory(catId) {
  return allUnitPairs().filter((p) => p.cat.id === catId);
}

export { CATEGORIES, CATEGORY_BY_ID, PRESETS, INGREDIENTS };
