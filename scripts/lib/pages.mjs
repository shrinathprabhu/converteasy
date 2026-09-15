// Page definitions and their content. Each function returns a page object
// consumed by layout() in html.mjs. Numbers in the copy are computed from the
// same unit data the converter uses, so the text can never disagree with it.

import { convert, linearFactor, CATEGORY_BY_ID, getUnit } from '../../src/js/data/units.js';
import { PRESET_BY_ID, LADDERS, currencyName, isCrypto, SYMBOL, CRYPTO, POPULAR_FIAT, PRESETS } from '../../src/js/data/money.js';
import { INGREDIENT_BY_ID, INGREDIENTS } from '../../src/js/data/ingredients.js';
import { shiftDecimal, groupPlain } from '../../src/js/core/decimal.js';
import { formatNumber, clean } from '../../src/js/core/format.js';
import { calculate } from '../../src/js/core/calc.js';
import { toRoman } from '../../src/js/core/numbase.js';
import { BASE_PAGES, CATEGORY_SLUG, CATEGORIES, TOOLS, TOOL_BY_ID, MONEY_PAIRS, CRYPTO_UNIT_PAGES, DECIMAL_PAGES, COOKING_PAGES, DATE_PAGES, allUnitPairs, pairsInCategory, SITE, AUTHOR, ORG, UNIT_PAIRS } from './site.mjs';
import { esc, href, faqHtml, linkPanel, categoryGrid, toolGrid, table, svgIcon } from './html.mjs';

const f = (x, sig = 10) => formatNumber(x, { sig });
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const titleCase = (s) => s.replace(/(^|[\s-(])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\bUs\b/g, 'US').replace(/\bPer\b/g, 'per');
const OFFLINE_A = `Yes. ConvertEasy is a progressive web app: after your first visit it keeps working with no connection, and you can install it to your home screen from the browser menu.`;
const calcLink = (q) => `${href('/calculator')}?q=${encodeURIComponent(q)}`;

function shortNumber(x) {
  const s = String(clean(x, 12));
  if (/e/.test(s)) return false;
  return s.replace(/^0\.0*|\./g, '').replace(/^-/, '').length <= 6;
}

function sideTools(exclude) {
  return linkPanel(
    'More converters',
    TOOLS.filter((t) => t.id !== exclude).map((t) => ({ name: t.name, path: t.path })),
  );
}

function prose(sections, side) {
  return `<div class="content"><article class="prose">${sections.filter(Boolean).join('\n')}</article><div class="side">${side.filter(Boolean).join('\n')}</div></div>`;
}

function section(title, body, id) {
  return `<section${id ? ` id="${id}"` : ''}><h2>${title}</h2>${body}</section>`;
}

// ---------------------------------------------------------------------------
// Unit pair pages

const TEMP_VALUES = {
  C: [-40, -30, -20, -10, -5, 0, 5, 10, 15, 20, 25, 30, 35, 37, 40, 50, 60, 70, 80, 90, 100, 150, 180, 200, 250],
  F: [-40, -20, 0, 10, 20, 32, 40, 50, 60, 68, 70, 75, 80, 90, 98.6, 100, 110, 150, 200, 212, 300, 350, 375, 400, 450],
  K: [0, 100, 200, 250, 255.37, 273.15, 283.15, 293.15, 298.15, 300, 310.15, 373.15, 400, 500, 1000],
  R: [0, 100, 200, 400, 459.67, 491.67, 500, 527.67, 600, 671.67, 1000],
};
const GENERIC_VALUES = [0.01, 0.1, 0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 100, 250, 500, 1000];
const FUEL_VALUES = [3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30, 35, 40, 50, 60];

const TEMP_HOW = {
  'C>F': ['multiply by 9/5 (or 1.8), then add 32', '°F = °C × 9/5 + 32'],
  'F>C': ['subtract 32, then multiply by 5/9', '°C = (°F − 32) × 5/9'],
  'C>K': ['add 273.15', 'K = °C + 273.15'],
  'K>C': ['subtract 273.15', '°C = K − 273.15'],
  'F>K': ['add 459.67, then multiply by 5/9', 'K = (°F + 459.67) × 5/9'],
  'K>F': ['multiply by 9/5, then subtract 459.67', '°F = K × 9/5 − 459.67'],
  'R>F': ['subtract 459.67', '°F = °R − 459.67'],
  'F>R': ['add 459.67', '°R = °F + 459.67'],
};

const FUEL_HOW = {
  'mpg>l100km': ['divide 235.215 by the mpg figure', 'L/100 km = 235.215 ÷ mpg'],
  'l100km>mpg': ['divide 235.215 by the L/100 km figure', 'mpg = 235.215 ÷ L/100 km'],
  'mpguk>l100km': ['divide 282.481 by the mpg figure', 'L/100 km = 282.481 ÷ mpg (UK)'],
  'l100km>mpguk': ['divide 282.481 by the L/100 km figure', 'mpg (UK) = 282.481 ÷ L/100 km'],
  'kmpl>l100km': ['divide 100 by the km/L figure', 'L/100 km = 100 ÷ km/L'],
  'l100km>kmpl': ['divide 100 by the L/100 km figure', 'km/L = 100 ÷ L/100 km'],
};

function pairHow(from, to, cat) {
  const k = linearFactor(from, to);
  if (k != null) {
    const inv = 1 / k;
    if (shortNumber(inv) && !shortNumber(k)) {
      return { how: `divide the value in ${from.plural} by ${f(inv, 12)}`, formula: `${to.symbol} = ${from.symbol} ÷ ${f(inv, 12)}`, k };
    }
    return { how: `multiply the value in ${from.plural} by ${f(k, 12)}`, formula: `${to.symbol} = ${from.symbol} × ${f(k, 12)}`, k };
  }
  const key = `${from.id}>${to.id}`;
  const t = cat.id === 'temperature' ? TEMP_HOW[key] : FUEL_HOW[key];
  if (t) return { how: t[0], formula: t[1], k: null };
  return { how: `convert through the base unit (${cat.base})`, formula: `${to.symbol} = f(${from.symbol})`, k: null };
}

function exampleValue(from, cat) {
  if (cat.id === 'temperature') return { C: 25, F: 100, K: 300, R: 500 }[from.id];
  if (cat.id === 'fuel') return from.id === 'l100km' ? 6 : 30;
  const one = from.factor;
  // Pick a value that reads naturally for the unit's size.
  if (['ly', 'pc', 'au'].includes(from.id)) return 1;
  return one >= 1000 || from.id === 'century' || from.id === 'decade' ? 5 : 10;
}

const CAT_FAQ = {
  length: [{ q: 'How many centimeters are in a foot?', a: 'A foot is exactly 30.48 centimeters, because an inch is defined as exactly 2.54 cm and a foot is 12 inches.' }],
  mass: [{ q: 'What is the difference between a ton and a tonne?', a: 'A tonne (metric ton) is 1,000 kg. A US short ton is 2,000 lb (907.18 kg) and an imperial long ton is 2,240 lb (1,016.05 kg).' }],
  volume: [{ q: 'Is a US gallon the same as a UK gallon?', a: 'No. A US gallon is 3.785 liters and an imperial (UK) gallon is 4.546 liters, about 20% more. US and UK pints and fluid ounces differ too.' }],
  temperature: [{ q: 'At what temperature are Celsius and Fahrenheit equal?', a: 'At −40. −40 °C and −40 °F are the same temperature.' }],
  area: [{ q: 'How big is an acre?', a: 'An acre is exactly 43,560 square feet, about 4,047 square meters or 0.405 hectares. A hectare is about 2.471 acres.' }],
  speed: [{ q: 'What is a knot?', a: 'A knot is one nautical mile per hour: exactly 1.852 km/h, or about 1.151 mph.' }],
  time: [{ q: 'How long is a month in this converter?', a: 'Months and years change length, so unit conversion uses Gregorian averages: a year of 365.2425 days and a month of 30.436875 days. For exact spans between two calendar dates, use the date calculator.' }],
  data: [
    { q: 'Is 1 GB equal to 1,000 MB or 1,024 MB?', a: 'Both are in use. In decimal (SI) counting, which drive makers, macOS, iOS and Android use, 1 GB = 1,000 MB. In binary counting, which Windows and RAM use, 1 GB = 1,024 MB; the unambiguous IEC name for that size is the gibibyte (GiB). ConvertEasy has a Decimal / Binary switch so KB, MB, GB and TB follow whichever you need, while KiB, MiB and GiB are always binary.' },
    { q: 'Are kilobits 1,000 or 1,024 bits?', a: 'ConvertEasy treats bits as decimal in both modes: 1 Kb = 1,000 b, 1 Mb = 1,000 Kb. A byte is always 8 bits, so only byte units (KB, MB, GB…) change with the switch.' },
  ],
  datarate: [
    { q: 'Why is my download speed lower than my internet plan?', a: 'Plans are sold in megabits per second (Mbps) and downloads show megabytes per second (MB/s). A byte is 8 bits, so 100 Mbps is at most 12.5 MB/s, or 11.92 MB/s if your download manager counts in binary, and protocol overhead takes a little more.' },
    { q: 'Is 1 MB/s 1,000 KB/s or 1,024 KB/s?', a: 'It depends on the app. Decimal counting gives 1 MB/s = 1,000 KB/s; binary counting (common in Windows tools and some download managers) gives 1,024 KB/s. Use the Decimal / Binary switch to match your app. Bit rates like Mbps are always decimal.' },
  ],
  pressure: [{ q: 'What tire pressure is 32 psi in bar?', a: '32 psi is about 2.21 bar, or 220.6 kPa.' }],
  energy: [{ q: 'Are Calories on food labels the same as calories?', a: 'No. The food Calorie (capital C) is a kilocalorie: 1,000 small calories, or 4.184 kilojoules.' }],
  power: [{ q: 'What is the difference between hp and PS?', a: 'Mechanical horsepower (hp) is about 745.7 W. Metric horsepower (PS, CV) is 735.5 W, about 1.4% less.' }],
  fuel: [{ q: 'Why does L/100 km go down when mpg goes up?', a: 'mpg measures distance per fuel (higher is better) while L/100 km measures fuel per distance (lower is better). One is the reciprocal of the other, so the conversion divides rather than multiplies.' }],
};

export function unitPairPage(pair) {
  const { cat, from, to, slug } = pair;
  const F = titleCase(from.plural);
  const T = titleCase(to.plural);
  const one = convert(1, from, to);
  const { how, formula, k } = pairHow(from, to, cat);
  const ex = exampleValue(from, cat);
  const exOut = convert(ex, from, to);
  const reverse = allUnitPairs().find((p) => p.from === to && p.to === from);
  const isTemp = cat.id === 'temperature';
  const isFuel = cat.id === 'fuel';
  // Byte units: KB/MB/GB mean 1,000 or 1,024 depending on the counting mode.
  const dual = Boolean(from.binaryFactor || to.binaryFactor);
  const oneBin = dual ? convert(1, from, to, 'binary') : null;
  const kBin = dual ? linearFactor(from, to, 'binary') : null;

  let answer;
  if (isTemp) {
    const zero = convert(0, from, to);
    answer = `<strong>0 ${esc(from.symbol)} = ${f(zero)} ${esc(to.symbol)}</strong>. To convert ${esc(from.plural)} to ${esc(to.plural)}, ${how}: <code>${esc(formula)}</code>.`;
  } else if (isFuel) {
    answer = `<strong>${f(ex)} ${esc(from.symbol)} = ${f(exOut, 6)} ${esc(to.symbol)}</strong>. To convert, ${how}: <code>${esc(formula)}</code>.`;
  } else if (dual) {
    answer = `<strong>1 ${esc(from.symbol)} = ${f(one)} ${esc(to.symbol)}</strong> in decimal (SI) units, or <strong>${f(oneBin)} ${esc(to.symbol)}</strong> in binary units, the way Windows and RAM count. Use the Decimal / Binary switch below to pick.`;
  } else {
    answer = `<strong>1 ${esc(from.symbol)} = ${f(one)} ${esc(to.symbol)}</strong>. To convert ${esc(from.plural)} to ${esc(to.plural)}, ${how}.`;
  }

  const values = isTemp ? TEMP_VALUES[from.id] : isFuel ? FUEL_VALUES : GENERIC_VALUES;
  const rows = values.map((v) => [`${f(v)} ${esc(from.symbol)}`, `${f(convert(v, from, to), 8)} ${esc(to.symbol)}`, ...(dual ? [`${f(convert(v, from, to, 'binary'), 8)} ${esc(to.symbol)}`] : [])]);

  const bigger = k != null ? (k >= 1 ? [from, to, k] : [to, from, 1 / k]) : null;
  const faq = [];
  if (isTemp) {
    faq.push({ q: `What is 0 ${from.symbol} in ${to.symbol}?`, a: `0 ${esc(from.symbol)} is ${f(convert(0, from, to))} ${esc(to.symbol)}.` });
    faq.push({ q: `What is 100 ${from.symbol} in ${to.symbol}?`, a: `100 ${esc(from.symbol)} is ${f(convert(100, from, to))} ${esc(to.symbol)}.` });
  } else if (!isFuel) {
    faq.push({
      q: `How many ${to.plural} are in a ${from.name}?`,
      a: dual
        ? `One ${esc(from.name)} (${esc(from.symbol)}) equals ${f(one)} ${esc(to.plural)} in decimal (SI) counting, or ${f(oneBin)} ${esc(to.plural)} in binary counting (1 KB = 1,024 B), which Windows uses.`
        : `One ${esc(from.name)} (${esc(from.symbol)}) equals ${f(one)} ${esc(to.plural)} (${esc(to.symbol)}).`,
    });
  }
  faq.push({ q: `How do I convert ${from.plural} to ${to.plural}?`, a: `To convert ${esc(from.plural)} to ${esc(to.plural)}, ${how}. The formula is ${esc(formula)}. For example, ${f(ex)} ${esc(from.symbol)} = ${f(exOut, 8)} ${esc(to.symbol)}.` });
  faq.push({ q: `What is ${f(ex)} ${from.symbol} in ${to.symbol}?`, a: `${f(ex)} ${esc(from.plural)} is ${f(exOut, 10)} ${esc(to.plural)}.` });
  if (bigger && bigger[0] !== bigger[1] && Math.abs(bigger[2] - 1) > 1e-9) {
    faq.push({ q: `Which is bigger, a ${from.name} or a ${to.name}?`, a: `A ${esc(bigger[0].name)} is bigger: 1 ${esc(bigger[0].symbol)} = ${f(bigger[2])} ${esc(bigger[1].symbol)}.` });
  }
  for (const x of CAT_FAQ[cat.id] ?? []) faq.push(x);
  faq.push({ q: `Does this ${from.symbol} to ${to.symbol} converter work offline?`, a: OFFLINE_A });

  const related = pairsInCategory(cat.id)
    .filter((p) => p.slug !== slug && (p.from === from || p.to === to || p.from === to || p.to === from))
    .slice(0, 12)
    .map((p) => ({ name: `${p.from.symbol} to ${p.to.symbol}`, path: `/${p.slug}` }));
  const moreInCat = pairsInCategory(cat.id)
    .filter((p) => p.slug !== slug && !related.some((r) => r.path === `/${p.slug}`))
    .slice(0, 16)
    .map((p) => ({ name: `${p.from.symbol} to ${p.to.symbol}`, path: `/${p.slug}` }));

  const calcExpr = isFuel ? null : `${f(ex).replace(/,/g, '')} ${from.symbol} to ${to.symbol}`;
  const sections = [
    section(
      `How to convert ${esc(from.plural)} to ${esc(to.plural)}`,
      `<p>To convert ${esc(from.plural)} (${esc(from.symbol)}) to ${esc(to.plural)} (${esc(to.symbol)}), ${how}.</p>
<p class="formula-box">${esc(formula)}${dual ? ` (decimal)<br />${esc(to.symbol)} = ${esc(from.symbol)} × ${f(kBin, 12)} (binary)` : ''}</p>
<p><strong>Example:</strong> ${f(ex)} ${esc(from.symbol)} = ${f(exOut, 10)} ${esc(to.symbol)}${dual ? `, or ${f(convert(ex, from, to, 'binary'), 10)} ${esc(to.symbol)} in binary` : ''}.</p>
${dual ? `<p>Decimal (SI) counting steps by 1,000 and is what drive makers, macOS and phones use. Binary counting steps by 1,024 and is what Windows and RAM use; its unambiguous IEC names are KiB, MiB and GiB. Bits are decimal either way.</p>` : ''}
${calcExpr ? `<p>You can also type <a href="${calcLink(calcExpr)}"><code>${esc(calcExpr)}</code></a> into the <a href="${href('/calculator')}">smart calculator</a>, or mix units: <code>${esc(`1 ${from.symbol} + 1 ${to.symbol}`)}</code>.</p>` : ''}`,
      'how',
    ),
    section(`${esc(F)} to ${esc(T)} conversion table`, table(`${F} to ${T}`, dual ? [F, `${T} (decimal)`, `${T} (binary)`] : [F, T], rows)),
    reverse
      ? section(
          `Converting ${esc(to.plural)} back to ${esc(from.plural)}`,
          `<p>${isTemp || isFuel ? `Use the reverse formula` : `1 ${esc(to.symbol)} = ${f(convert(1, to, from))} ${esc(from.symbol)}`}. See the <a href="${href('/' + reverse.slug)}">${esc(titleCase(to.plural))} to ${esc(titleCase(from.plural))} converter</a>, or press the swap button above.</p>`,
        )
      : '',
    section(
      `About the units`,
      `<h3>${esc(cap(from.name))} (${esc(from.symbol)})</h3><p>${esc(from.desc || `A unit of ${cat.noun}.`)}</p>
<h3>${esc(cap(to.name))} (${esc(to.symbol)})</h3><p>${esc(to.desc || `A unit of ${cat.noun}.`)}</p>
<p>${esc(cat.about)}</p>`,
    ),
    faqHtml(faq),
  ];
  const side = [
    linkPanel(`Related ${cat.noun} conversions`, related),
    `<section class="panel"><h2>${esc(cat.name)}</h2><p class="note">All ${cat.units.length} ${esc(cat.noun)} units in one place.</p><p><a class="btn ghost small" href="${href('/' + CATEGORY_SLUG[cat.id])}">${esc(cat.name)} converter →</a></p></section>`,
    moreInCat.length ? `<section class="panel"><h2>More ${esc(cat.noun)} pairs</h2><ul class="pill-list">${moreInCat.map((l) => `<li><a href="${href(l.path)}">${esc(l.name)}</a></li>`).join('')}</ul></section>` : '',
    sideTools('units'),
  ];

  return {
    path: `/${slug}`,
    title: `${F} to ${T} (${from.symbol} to ${to.symbol}) converter | ConvertEasy`,
    ogTitle: `${from.symbol} to ${to.symbol}: ${isTemp || isFuel ? formula : `1 ${from.symbol} = ${f(one, 8)} ${to.symbol}${dual ? ` (or ${f(oneBin, 8)} binary)` : ''}`}`,
    description: isTemp
      ? `Convert ${from.plural} to ${to.plural} with the formula ${formula}. Worked example, conversion table and a free two-way converter that works offline.`
      : dual
        ? `Convert ${from.plural} to ${to.plural}: 1 ${from.symbol} = ${f(one, 8)} ${to.symbol} in decimal (SI) or ${f(oneBin, 8)} ${to.symbol} in binary, as Windows counts. Switch modes, see both tables, works offline.`
        : `Convert ${from.plural} to ${to.plural}${isFuel ? '' : `: 1 ${from.symbol} = ${f(one, 8)} ${to.symbol}`}. Formula, worked example, conversion table and a free two-way converter that works offline.`,
    h1: `${esc(F)} to ${esc(T)} <span class="h1-sub">(${esc(from.symbol)} to ${esc(to.symbol)})</span>`,
    h1Text: `${F} to ${T}`,
    eyebrow: `${cat.name} converter`,
    lede: `Type in either box: it converts both ways, accepts sums like <code>12*3</code>, and shows every other ${esc(cat.noun)} unit too.`,
    answer,
    tool: 'units',
    toolLabel: `${from.symbol} to ${to.symbol} converter`,
    dataTool: 'units',
    data: { category: cat.id, from: from.id, to: to.id, value: String(isTemp ? convertExampleDefault(from) : isFuel ? ex : 1) },
    navActive: 'units',
    crumbs: [
      { name: 'Units', path: '/units' },
      { name: cat.name, path: '/' + CATEGORY_SLUG[cat.id] },
      { name: `${from.symbol} to ${to.symbol}`, path: `/${slug}` },
    ],
    main: prose(sections, side),
    faq,
    howto: {
      name: `How to convert ${from.plural} to ${to.plural}`,
      description: `Convert a value in ${from.plural} to ${to.plural}.`,
      steps: [
        { name: `Enter the value in ${from.plural}`, text: `Type the number of ${from.plural} into the From box.` },
        { name: 'Apply the formula', text: `${cap(how)}: ${formula}.` },
        { name: `Read the result in ${to.plural}`, text: `The To box shows the value in ${to.plural}, e.g. ${f(ex)} ${from.symbol} = ${f(exOut, 8)} ${to.symbol}.` },
      ],
    },
    about: [
      { '@type': 'Thing', name: cap(from.name), description: from.desc || undefined },
      { '@type': 'Thing', name: cap(to.name), description: to.desc || undefined },
    ],
    keywords: [`${from.symbol} to ${to.symbol}`, `${from.plural} to ${to.plural}`, `convert ${from.plural} to ${to.plural}`, `${from.name} to ${to.name}`, `how many ${to.plural} in a ${from.name}`, `${from.slug} to ${to.slug}`],
    group: cat.name,
    search: `${from.symbol} ${to.symbol} ${from.name} ${to.name} ${from.plural} ${to.plural} ${from.names.join(' ')} ${to.names.join(' ')}`,
    weight: from.popular && to.popular ? 2 : 1,
    priority: from.popular && to.popular ? 0.8 : 0.6,
  };
}

function convertExampleDefault(from) {
  return { C: 25, F: 77, K: 300, R: 500 }[from.id] ?? 1;
}

// ---------------------------------------------------------------------------
// Category pages

const CAT_FACTS = {
  temperature: ['0 °C = 32 °F', '100 °C = 212 °F', '0 K = −273.15 °C', '−40 °C = −40 °F'],
  fuel: ['30 mpg (US) ≈ 7.84 L/100 km', '5 L/100 km ≈ 47 mpg (US)', '20 km/L = 5 L/100 km'],
};

export function categoryPage(cat) {
  const pairs = pairsInCategory(cat.id);
  const firstPairs = (UNIT_PAIRS[cat.id] ?? []).slice(0, 4);
  const facts =
    CAT_FACTS[cat.id] ??
    firstPairs.map(([a, b]) => {
      const ua = getUnit(cat.id, a);
      const ub = getUnit(cat.id, b);
      const [big, small] = ua.factor >= ub.factor ? [ua, ub] : [ub, ua];
      return `1 ${big.symbol} = ${f(convert(1, big, small), 8)} ${small.symbol}`;
    });
  const linear = !['temperature', 'fuel'].includes(cat.id);
  const baseUnit = cat.units.find((u) => u.id === cat.base);
  const rows = cat.units.map((u) => [
    `${esc(cap(u.name))}`,
    `<code>${esc(u.symbol)}</code>`,
    linear ? `${f(u.factor, 10)} ${esc(baseUnit.symbol)}` : '—',
    esc(u.desc || ''),
  ]);
  const faq = [
    { q: `Which ${cat.noun} units can I convert?`, a: `All ${cat.units.length}: ${cat.units.map((u) => esc(u.plural)).join(', ')}.` },
    { q: `What is the SI unit of ${cat.noun}?`, a: `${linear ? `This converter uses the ${esc(baseUnit.name)} (${esc(baseUnit.symbol)}) as its base unit. ` : ''}${esc(cat.about)}` },
    ...(CAT_FAQ[cat.id] ?? []),
    { q: 'How precise are the results?', a: 'Factors are the exact legal definitions where one exists (an inch is exactly 2.54 cm, a pound exactly 0.45359237 kg). Results show 10 significant digits by default; the precision menu offers 4 to 15.' },
    { q: `Does the ${cat.noun} converter work offline?`, a: OFFLINE_A },
  ];
  const dualRows = cat.units
    .filter((u) => u.binaryFactor)
    .map((u) => [`<b>${esc(u.symbol)}</b> ${esc(u.name)}`, `${f(u.factor / 8, 16)} ${cat.id === 'datarate' ? 'B/s' : 'B'}`, `${f(u.binaryFactor / 8, 16)} ${cat.id === 'datarate' ? 'B/s' : 'B'}`]);
  const sections = [
    dualRows.length
      ? section(
          'Decimal or binary: two ways to count bytes',
          `<p>Byte units have two meanings. <strong>Decimal (SI)</strong> steps by 1,000, which is how drive makers, macOS, iOS, Android and network gear count. <strong>Binary</strong> steps by 1,024, which is how Windows and RAM count; the IEC gives these sizes their own names (KiB, MiB, GiB) so they cannot be confused. Bits are always decimal: 1 Kb = 1,000 b, and 1 B = 8 b. The converter above has a switch for the mode.</p>${table('Byte units in decimal and binary counting', ['Unit', 'Decimal (SI)', 'Binary'], dualRows)}`,
        )
      : '',
    section(`Popular ${esc(cat.noun)} conversions`, `<ul class="pill-list">${pairs.map((p) => `<li><a href="${href('/' + p.slug)}">${esc(p.from.symbol)} to ${esc(p.to.symbol)}</a></li>`).join('')}</ul>`),
    section(`${esc(cat.name)} units`, `<p>${esc(cat.about)}</p>${table(`${cat.name} units`, ['Unit', 'Symbol', linear ? `In ${baseUnit.plural}` : 'Scale', 'Definition'], rows)}`),
    section(
      `Calculate with ${esc(cat.noun)}`,
      `<p>The <a href="${href('/calculator')}">smart calculator</a> does arithmetic across ${esc(cat.noun)} units and picks a sensible unit for the answer. Try <a href="${calcLink(CALC_EXAMPLE[cat.id] ?? '1 m + 1 ft')}"><code>${esc(CALC_EXAMPLE[cat.id] ?? '1 m + 1 ft')}</code></a>.</p>`,
    ),
    faqHtml(faq),
  ];
  const side = [`<section class="panel"><h2>All categories</h2>${categoryGrid(cat.id)}</section>`, sideTools('units')];
  return {
    path: '/' + CATEGORY_SLUG[cat.id],
    title: `${cat.name} converter: ${cat.units.length} units | ConvertEasy`,
    description: `Free ${cat.noun} converter. ${cat.blurb} ${facts.slice(0, 2).join('; ')}. Works offline, no sign-up.`,
    h1: `${esc(cat.name)} converter`,
    h1Text: `${cat.name} converter`,
    eyebrow: `${cat.units.length} units`,
    lede: esc(cat.blurb),
    answer: `Quick facts: <strong>${facts.map(esc).join('</strong> · <strong>')}</strong>`,
    tool: 'units',
    toolLabel: `${cat.noun} converter`,
    dataTool: 'units',
    data: { category: cat.id, from: cat.pair[0], to: cat.pair[1], value: cat.id === 'temperature' ? '25' : '1' },
    navActive: 'units',
    crumbs: [
      { name: 'Units', path: '/units' },
      { name: cat.name, path: '/' + CATEGORY_SLUG[cat.id] },
    ],
    main: prose(sections, side),
    faq,
    definedTerms: cat.units.map((u) => ({ name: cap(u.name), code: u.symbol, desc: u.desc || `A unit of ${cat.noun}.` })),
    keywords: [`${cat.noun} converter`, `${cat.noun} conversion`, `${cat.noun} units`, ...pairs.slice(0, 6).map((p) => `${p.from.symbol} to ${p.to.symbol}`)],
    group: 'Unit categories',
    search: `${cat.name} ${cat.noun} ${cat.units.map((u) => u.name).join(' ')}`,
    weight: 3,
    priority: 0.8,
  };
}

const CALC_EXAMPLE = {
  length: '5 ft 11 in to cm',
  mass: '2 lb 4 oz + 300 g to kg',
  volume: '3 cups + 2 tbsp to ml',
  temperature: '98.6 °F to °C',
  area: '30 ft × 40 ft to m²',
  speed: '100 km / 1.5 h to mph',
  time: '2 h 45 min + 90 min',
  data: '1 TB / 4 to GiB',
  datarate: '500 MB / 20 s to Mbps',
  pressure: '32 psi to bar',
  energy: '2000 kcal to kJ',
  power: '150 hp to kW',
  force: '10 kg × 9.80665 m/s² to N',
  angle: '90° to rad',
  frequency: '3000 rpm to Hz',
  density: '500 g / 400 mL',
  torque: '300 N·m to lb·ft',
  acceleration: '9.81 m/s² to ft/s²',
  flow: '20 L/min to gpm',
};

// ---------------------------------------------------------------------------
// Currency pages

export function moneyPage(a, b) {
  const na = currencyName(a);
  const nb = currencyName(b);
  const cryptoA = isCrypto(a);
  const cryptoB = isCrypto(b);
  const anyCrypto = cryptoA || cryptoB;
  const others = MONEY_PAIRS.flatMap(([x, y]) => [
    [x, y],
    [y, x],
  ])
    .filter(([x, y]) => (x === a || y === b || x === b || y === a) && !(x === a && y === b))
    .slice(0, 12)
    .map(([x, y]) => ({ name: `${x} to ${y}`, path: `/${x.toLowerCase()}-to-${y.toLowerCase()}` }));
  const faq = [
    { q: `How is the ${a} to ${b} rate calculated?`, a: `ConvertEasy fetches live rates for every currency against the US dollar, then divides: ${esc(a)}→${esc(b)} = (${esc(a)} in USD) ÷ (${esc(b)} in USD). The primary source is Coinbase's public exchange-rate feed, with ${anyCrypto ? 'CoinGecko for crypto prices and ' : ''}currency-api and the European Central Bank (via Frankfurter) as fallbacks.` },
    { q: 'How often do the rates update?', a: 'Every minute while the page is open, and whenever you come back to the tab. The status line under the converter shows the source and how long ago the rates were fetched.' },
    { q: `Why is my bank's ${a} to ${b} rate different?`, a: 'These are mid-market reference rates. Banks, card networks, remittance services and exchanges add a spread and sometimes a fee, so the rate you are offered is usually a little worse.' },
    ...(anyCrypto
      ? [{ q: `Is the ${cryptoA ? na : nb} price live?`, a: 'Yes. Crypto trades around the clock, so the price is taken from Coinbase, with CoinGecko as a fallback, and refreshed every minute. Prices on individual exchanges can differ slightly.' }]
      : []),
    { q: 'Does the currency converter work offline?', a: 'Yes. The last rates fetched are stored in your browser, so conversions keep working with no connection. The converter labels them as an offline copy with the time they were fetched.' },
  ];
  const aboutCur = (code, name, crypto) =>
    crypto
      ? `<h3>${esc(name)} (${esc(code)})</h3><p>${esc(name)} is a cryptocurrency. Its price floats freely and trades 24/7, so conversions use the latest market price.${code === 'USDT' || code === 'USDC' ? ` It is a stablecoin designed to track the US dollar at close to 1:1.` : ''} See its <a href="${href('/crypto-units')}">decimals and base units</a>.</p>`
      : `<h3>${esc(name)} (${esc(code)})</h3><p>ISO 4217 code <code>${esc(code)}</code>${SYMBOL[code] && SYMBOL[code] !== code ? `, symbol <code>${esc(SYMBOL[code])}</code>` : ''}. Rates are reference mid-market rates.</p>`;
  const expr = `100 ${a} to ${b}`;
  const sections = [
    section(
      `How the ${esc(a)} to ${esc(b)} conversion works`,
      `<p>Enter an amount in ${esc(na)} and the converter shows the value in ${esc(nb)} at the live mid-market rate. The rate line below it gives both directions, and the at-a-glance list shows the same amount in other popular currencies${anyCrypto ? ' and coins' : ''}.</p>
<p>In the <a href="${href('/calculator')}">smart calculator</a> you can mix currencies with arithmetic: <a href="${calcLink(expr)}"><code>${esc(expr)}</code></a> or <a href="${calcLink(`$20 + €15 in ${b}`)}"><code>${esc(`$20 + €15 in ${b}`)}</code></a>.</p>`,
    ),
    section('About these currencies', aboutCur(a, na, cryptoA) + aboutCur(b, nb, cryptoB)),
    faqHtml(faq),
  ];
  const side = [linkPanel('Related pairs', others), linkPanel('Popular currency pairs', MONEY_PAIRS.slice(0, 10).map(([x, y]) => ({ name: `${x} to ${y}`, path: `/${x.toLowerCase()}-to-${y.toLowerCase()}` }))), sideTools('currency')];
  return {
    path: `/${a.toLowerCase()}-to-${b.toLowerCase()}`,
    title: `${a} to ${b}: live ${na} to ${nb} rate | ConvertEasy`,
    ogTitle: `${a} to ${b} converter with live rates`,
    description: `Convert ${na} (${a}) to ${nb} (${b}) at the live mid-market rate, refreshed every minute. ${anyCrypto ? 'Fiat to crypto and back. ' : ''}Free, no sign-up, works offline with the last known rate.`,
    h1: `${esc(a)} to ${esc(b)} <span class="h1-sub">${esc(na)} to ${esc(nb)}</span>`,
    h1Text: `${a} to ${b}`,
    eyebrow: anyCrypto ? 'Crypto converter' : 'Currency converter',
    lede: `Live ${esc(na)} to ${esc(nb)} rate, refreshed every minute, plus the same amount in other currencies.`,
    answer: `The live <strong>${esc(a)} → ${esc(b)}</strong> rate loads below from Coinbase's public feed${anyCrypto ? ' and CoinGecko' : ''}, with currency-api and the European Central Bank as fallbacks. These are mid-market reference rates: banks and exchanges add a spread.`,
    tool: 'currency',
    toolLabel: `${a} to ${b} converter`,
    dataTool: 'currency',
    data: { from: a, to: b, value: cryptoA ? '1' : a === 'JPY' || a === 'KRW' ? '1000' : '100' },
    navActive: 'currency',
    preconnect: ['https://api.coinbase.com'],
    crumbs: [
      { name: 'Currency', path: '/currency' },
      { name: `${a} to ${b}`, path: `/${a.toLowerCase()}-to-${b.toLowerCase()}` },
    ],
    main: prose(sections, side),
    faq,
    keywords: [`${a} to ${b}`, `${na} to ${nb}`, `${a} ${b} rate`, `convert ${a} to ${b}`, `${a.toLowerCase()} to ${b.toLowerCase()} live`],
    group: anyCrypto ? 'Crypto' : 'Currency',
    search: `${a} ${b} ${na} ${nb}`,
    weight: POPULAR_FIAT.includes(a) || cryptoA ? 2 : 1,
    priority: 0.7,
  };
}

// ---------------------------------------------------------------------------
// Crypto denomination pages

export function cryptoUnitPages() {
  const pages = [];
  for (const [presetId, bigSlug, smallSlug] of CRYPTO_UNIT_PAGES) {
    const p = PRESET_BY_ID.get(presetId);
    let bigExp;
    let smallExp;
    if (p.ladder) {
      const ladder = LADDERS[p.ladder].units;
      bigExp = ladder.find((u) => u.id === p.from).exp;
      smallExp = ladder.find((u) => u.id === p.to).exp;
    } else {
      bigExp = p.decimals;
      smallExp = 0;
    }
    const d = bigExp - smallExp;
    for (const up of [false, true]) {
      const [fromL, toL, fromE, toE, fromS, toS] = up ? [p.small, p.big, smallExp, bigExp, smallSlug, bigSlug] : [p.big, p.small, bigExp, smallExp, bigSlug, smallSlug];
      const oneOut = shiftDecimal('1', fromE, toE);
      const values = up ? ['1', '10', '100', '1000', '10000', '100000', '1000000', '21000', '50000000', `1${'0'.repeat(Math.max(d, 1))}`] : ['0.000001', '0.0001', '0.001', '0.01', '0.05', '0.1', '0.5', '1', '2', '5', '10', '100'];
      const uniq = [...new Set(values)];
      const rows = uniq.map((v) => [`${groupPlain(v)} ${esc(fromL)}`, `<span class="mono">${groupPlain(shiftDecimal(v, fromE, toE))}</span> ${esc(toL)}`]);
      const path = `/${fromS}-to-${toS}`;
      const faq = [
        { q: `How many ${toL} are in 1 ${fromL}?`, a: `1 ${esc(fromL)} = ${groupPlain(oneOut)} ${esc(toL)} (10${up ? '⁻' : ''}${superscript(d)}).` },
        { q: `How do I convert ${fromL} to ${toL}?`, a: up ? `Divide by 10^${d}, i.e. move the decimal point ${d} places to the left.` : `Multiply by 10^${d}, i.e. move the decimal point ${d} places to the right.` },
        { q: 'Is the conversion exact?', a: 'Yes. ConvertEasy moves the decimal point on the digits as text instead of using floating point numbers, so even 18-decimal amounts stay exact to the last digit.' },
        ...(p.note ? [{ q: `What should I know about ${p.big} decimals?`, a: esc(p.note) }] : []),
      ];
      const sections = [
        section(`How to convert ${esc(fromL)} to ${esc(toL)}`, `<p>${up ? `Divide the amount in ${esc(fromL)} by 10<sup>${d}</sup> (move the decimal point ${d} places left).` : `Multiply the amount in ${esc(fromL)} by 10<sup>${d}</sup> (move the decimal point ${d} places right).`}</p><p class="formula-box">1 ${esc(fromL)} = ${groupPlain(oneOut)} ${esc(toL)}</p>${p.note ? `<p>${esc(p.note)}</p>` : ''}`),
        section(`${esc(fromL)} to ${esc(toL)} table`, table(`${fromL} to ${toL}`, [fromL, toL], rows)),
        faqHtml(faq),
      ];
      const siblings = CRYPTO_UNIT_PAGES.map(([id, b, s]) => ({ name: `${PRESET_BY_ID.get(id).big} to ${PRESET_BY_ID.get(id).small}`, path: `/${b}-to-${s}` }))
        .filter((x) => x.path !== path)
        .slice(0, 14);
      pages.push({
        path,
        title: `${fromL} to ${toL} converter: 1 ${fromL} = ${groupPlain(oneOut)} ${toL} | ConvertEasy`,
        ogTitle: `1 ${fromL} = ${groupPlain(oneOut)} ${toL}`,
        description: `Convert ${fromL} to ${toL} exactly. 1 ${fromL} = ${groupPlain(oneOut)} ${toL}. No floating point rounding, with a table and every denomination.`,
        h1: `${esc(fromL)} to ${esc(toL)}`,
        h1Text: `${fromL} to ${toL}`,
        eyebrow: 'Crypto units',
        lede: `Exact, digit-for-digit conversion between ${esc(fromL)} and ${esc(toL)}.`,
        answer: `<strong>1 ${esc(fromL)} = ${groupPlain(oneOut)} ${esc(toL)}</strong>. ${p.big} has ${p.ladder ? `${LADDERS[p.ladder].units.at(-1).exp} decimals` : `${p.decimals} decimals`}.`,
        tool: 'crypto',
        toolLabel: `${fromL} to ${toL} converter`,
        dataTool: 'crypto',
        data: { preset: presetId, dir: up ? 'up' : '', value: up ? '1' : '1' },
        navActive: 'crypto-units',
        crumbs: [
          { name: 'Crypto units', path: '/crypto-units' },
          { name: `${fromL} to ${toL}`, path },
        ],
        main: prose(sections, [linkPanel('Other denominations', siblings), sideTools('crypto-units')]),
        faq,
        keywords: [`${fromL} to ${toL}`, `convert ${fromL} to ${toL}`, `${p.big} decimals`, `${fromS} to ${toS}`],
        group: 'Crypto units',
        search: `${fromL} ${toL} ${fromS} ${toS}`,
        weight: ['eth', 'btc', 'gwei'].includes(bigSlug) ? 2 : 1,
        priority: 0.6,
      });
    }
  }
  for (const id of DECIMAL_PAGES) {
    const p = PRESET_BY_ID.get(id);
    const one = shiftDecimal('1', p.decimals, 0);
    const path = `/${id}-decimals`;
    const faq = [
      { q: `How many decimals does ${p.big} have?`, a: `${p.big} uses ${p.decimals} decimals: 1 ${p.big} is ${groupPlain(one)} base units on-chain.${p.note ? ' ' + esc(p.note) : ''}` },
      { q: `How do I convert a raw ${p.big} amount to ${p.big}?`, a: `Divide the raw integer by 10^${p.decimals}. For example, ${groupPlain(shiftDecimal('2.5', p.decimals, 0))} base units = 2.5 ${p.big}.` },
      { q: 'Why do tokens use integer base units?', a: 'Blockchains store balances as integers to avoid rounding. The decimals value tells wallets where to put the decimal point when displaying the amount.' },
    ];
    pages.push({
      path,
      title: `${p.big} decimals: raw base units to ${p.big} converter | ConvertEasy`,
      description: `${p.big} has ${p.decimals} decimals: 1 ${p.big} = ${groupPlain(one)} base units. Convert raw on-chain amounts to ${p.big} and back, exactly.`,
      h1: `${esc(p.big)} decimals`,
      h1Text: `${p.big} decimals`,
      eyebrow: 'Crypto units',
      lede: `Convert raw on-chain integers to ${esc(p.big)} and back, exactly.`,
      answer: `<strong>${esc(p.big)} uses ${p.decimals} decimals</strong>: 1 ${esc(p.big)} = ${groupPlain(one)} base units.`,
      tool: 'crypto',
      toolLabel: `${p.big} decimals converter`,
      dataTool: 'crypto',
      data: { preset: id, value: '1' },
      navActive: 'crypto-units',
      crumbs: [
        { name: 'Crypto units', path: '/crypto-units' },
        { name: `${p.big} decimals`, path },
      ],
      main: prose([section(`${esc(p.big)} amount table`, table(`${p.big} to base units`, [p.big, 'Base units'], ['0.01', '0.5', '1', '10', '100', '1000', '1000000'].map((v) => [`${groupPlain(v)} ${esc(p.big)}`, `<span class="mono">${groupPlain(shiftDecimal(v, p.decimals, 0))}</span>`]))), faqHtml(faq)], [sideTools('crypto-units')]),
      faq,
      keywords: [`${p.big} decimals`, `${p.big.toLowerCase()} decimals`, `${p.big} base units`, `${p.big} raw amount`],
      group: 'Crypto units',
      search: `${p.big} decimals raw base units`,
      weight: 1,
      priority: 0.5,
    });
  }
  return pages;
}

function superscript(n) {
  return String(n).replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]);
}

// ---------------------------------------------------------------------------
// Cooking pages

const CUPS = [
  ['⅛', 0.125], ['¼', 0.25], ['⅓', 1 / 3], ['½', 0.5], ['⅔', 2 / 3], ['¾', 0.75], ['1', 1], ['1½', 1.5], ['2', 2], ['3', 3], ['4', 4],
];

export function cookingPages() {
  const pages = [];
  for (const id of COOKING_PAGES) {
    const ing = INGREDIENT_BY_ID.get(id);
    const lower = ing.name.toLowerCase();
    for (const toGrams of [true, false]) {
      const path = toGrams ? `/${ing.slug}-cups-to-grams` : `/${ing.slug}-grams-to-cups`;
      const rows = toGrams
        ? CUPS.map(([l, c]) => [`${l} cup`, `${f(c * ing.gPerCup, 4)} g`, `${f((c * ing.gPerCup) / 28.349523125, 3)} oz`])
        : [25, 50, 100, 125, 150, 200, 250, 300, 400, 500, 1000].map((g) => [`${g} g`, `${f(g / ing.gPerCup, 3)} cups`, `${f((g / ing.gPerCup) * 16, 3)} tbsp`]);
      const faq = [
        { q: `How many grams is 1 cup of ${lower}?`, a: `About ${f(ing.gPerCup)} g (${f(ing.gPerCup / 28.349523125, 3)} oz) per US cup, measured spoon-and-level.` },
        { q: `How many cups is 100 g of ${lower}?`, a: `About ${f(100 / ing.gPerCup, 3)} US cups, or ${f((100 / ing.gPerCup) * 16, 3)} tablespoons.` },
        { q: `How many grams in a tablespoon of ${lower}?`, a: `About ${f(ing.gPerCup / 16, 3)} g. A US tablespoon is 1/16 of a cup.` },
        { q: 'Why do cup to gram conversions differ between sites?', a: 'A cup measures volume, so its weight depends on how the ingredient is packed, sifted or scooped, and on the brand. Weighing is always more accurate; these figures are common baking references.' },
      ];
      const title = toGrams ? `${ing.name} cups to grams` : `${ing.name} grams to cups`;
      pages.push({
        path,
        title: `${title}: 1 cup = ${f(ing.gPerCup)} g | ConvertEasy`,
        description: `${toGrams ? 'Convert cups of' : 'Convert grams of'} ${lower} ${toGrams ? 'to grams' : 'to cups'}. 1 US cup of ${lower} ≈ ${f(ing.gPerCup)} g. Table for ⅛ to 4 cups, tablespoons and ounces.`,
        h1: esc(title),
        h1Text: title,
        eyebrow: 'Cooking converter',
        lede: `Baking by weight is more reliable. Here is ${esc(lower)} by the cup, spoon and gram.`,
        answer: `<strong>1 US cup of ${esc(lower)} ≈ ${f(ing.gPerCup)} g</strong> (${f(ing.gPerCup / 28.349523125, 3)} oz). 1 tbsp ≈ ${f(ing.gPerCup / 16, 3)} g.`,
        tool: 'cooking',
        toolLabel: `${ing.name} converter`,
        dataTool: 'cooking',
        data: { ingredient: ing.id, from: toGrams ? 'volume:cup' : 'mass:g', to: toGrams ? 'mass:g' : 'volume:cup', value: toGrams ? '1' : '100' },
        navActive: 'cooking',
        crumbs: [
          { name: 'Cooking', path: '/cooking' },
          { name: title, path },
        ],
        main: prose([section(`${esc(title)} table`, table(title, toGrams ? ['Cups', 'Grams', 'Ounces'] : ['Grams', 'US cups', 'Tablespoons'], rows)), faqHtml(faq)], [linkPanel('Other ingredients', COOKING_PAGES.filter((x) => x !== id).map((x) => ({ name: `${INGREDIENT_BY_ID.get(x).name}: cups to grams`, path: `/${INGREDIENT_BY_ID.get(x).slug}-cups-to-grams` }))), sideTools('cooking')]),
        faq,
        keywords: [`${lower} cups to grams`, `1 cup ${lower} in grams`, `${lower} grams to cups`, `how many grams in a cup of ${lower}`],
        group: 'Cooking',
        search: `${ing.name} cups grams`,
        weight: ['flour', 'sugar', 'butter'].includes(id) ? 2 : 1,
        priority: 0.6,
      });
    }
  }
  return pages;
}

// ---------------------------------------------------------------------------
// Date pages

const DATE_CONTENT = {
  diff: {
    body: `<p>Pick two dates to get the span as years, months and days, plus totals in weeks, days, hours, minutes and seconds, and how many of those days are weekdays (Monday to Friday).</p>
<p>Months are counted on the calendar: from 31 January to 28 February is 28 days, not "one month", because February has no 31st. Tick <em>Include the end date</em> when you want both the first and last day counted, as with hotel nights versus days of a trip.</p>`,
    faq: [
      { q: 'How do I count the days between two dates?', a: 'Enter a start and end date. ConvertEasy counts calendar days between them; the end date is excluded unless you tick "Include the end date".' },
      { q: 'Does it count weekdays only?', a: 'The Weekdays figure counts Monday to Friday. It does not know public holidays, which vary by country.' },
      { q: 'Are leap years handled?', a: 'Yes. Dates follow the Gregorian calendar, so 29 February is counted in leap years.' },
    ],
  },
  add: {
    body: `<p>Start from any date and add or subtract years, months, weeks and days. Adding months keeps the day of the month where it can and otherwise lands on the last day: 31 January plus one month is 28 February (29 in a leap year).</p>`,
    faq: [
      { q: 'What date is 90 days from today?', a: 'Open the Add or subtract tab, keep today as the start date and enter 90 days; the result updates as you type.' },
      { q: 'What happens when I add a month to 31 January?', a: 'You get the last day of February, because February has no 31st.' },
    ],
  },
  unix: {
    body: `<p>Unix time counts seconds since 1 January 1970 00:00:00 UTC. Paste a timestamp in seconds, milliseconds, microseconds or nanoseconds: the converter guesses the unit from the number of digits (10 for seconds, 13 for milliseconds) and shows the date in UTC, your local time and ISO 8601. Or pick a local date and time to get its timestamp.</p>`,
    faq: [
      { q: 'What is a Unix timestamp?', a: 'The number of seconds since the Unix epoch, 1970-01-01T00:00:00Z, ignoring leap seconds. JavaScript and many APIs use milliseconds instead.' },
      { q: 'How do I tell seconds from milliseconds?', a: 'Present-day timestamps have 10 digits in seconds and 13 in milliseconds. ConvertEasy detects this automatically.' },
      { q: 'What is the year 2038 problem?', a: 'Signed 32-bit timestamps overflow on 19 January 2038 at 03:14:07 UTC. 64-bit systems and JavaScript are unaffected.' },
    ],
  },
  tz: {
    body: `<p>Choose a date, a time and the time zone it is in, then see the same moment in every city on your list. Daylight saving time is handled from your browser's time zone database, so the offsets are right for that specific date.</p>`,
    faq: [
      { q: 'Does the time zone converter handle daylight saving?', a: 'Yes. Offsets are calculated for the exact date and time you enter, using the IANA time zone database built into your browser.' },
      { q: 'Can I add my own cities?', a: 'Yes. Use Add zone to search every IANA time zone. Your list is saved in your browser.' },
    ],
  },
};

export function datePages() {
  return DATE_PAGES.map((d) => {
    const c = DATE_CONTENT[d.mode];
    const faq = d.age
      ? [
          { q: 'How is exact age calculated?', a: 'By counting whole years, then whole months, then remaining days from your date of birth to the chosen date, following the calendar.' },
          { q: 'How many days old am I?', a: 'Enter your date of birth; the Total days figure is your age in days. Weeks, hours and minutes are shown too.' },
          ...c.faq.slice(2),
        ]
      : c.faq;
    return {
      path: `/${d.slug}`,
      title: `${d.title} | ConvertEasy`,
      description: `${d.desc} Free, private and works offline.`,
      h1: esc(d.h1),
      h1Text: d.h1,
      eyebrow: 'Date & time',
      lede: esc(d.desc),
      answer: null,
      tool: 'date',
      toolLabel: d.h1,
      dataTool: 'date',
      data: { mode: d.mode, age: d.age ? '1' : '' },
      navActive: 'date-time',
      crumbs: [
        { name: 'Date & time', path: '/date-time' },
        { name: d.h1, path: `/${d.slug}` },
      ],
      main: prose([section('How it works', c.body), faqHtml(faq)], [linkPanel('Date tools', DATE_PAGES.filter((x) => x.slug !== d.slug).map((x) => ({ name: x.h1, path: `/${x.slug}` }))), linkPanel('Time units', [['yr', 'mo'], ['mo', 'd'], ['wk', 'd'], ['d', 'h']].map(([a, b]) => ({ name: `${getUnit('time', a).plural} to ${getUnit('time', b).plural}`, path: `/${getUnit('time', a).slug}-to-${getUnit('time', b).slug}` }))), sideTools('date-time')]),
      faq,
      keywords: [d.h1.toLowerCase(), d.slug.replace(/-/g, ' ')],
      group: 'Date & time',
      search: d.title,
      weight: 2,
      priority: 0.7,
    };
  });
}

// ---------------------------------------------------------------------------
// Number base pages

const BASE_NAMES = { 2: 'binary', 8: 'octal', 10: 'decimal', 16: 'hex' };

export function basePages() {
  const pages = BASE_PAGES.map((b) => {
    const fromN = BASE_NAMES[b.from];
    const toN = BASE_NAMES[b.to];
    const val = parseInt(b.sample, b.from);
    const out = val.toString(b.to).toUpperCase();
    const rows = [...Array(17).keys()].concat([32, 64, 100, 128, 255, 256, 1000, 1024]).map((n) => [n.toString(b.from).toUpperCase(), `<span class="mono">${n.toString(b.to).toUpperCase()}</span>`]);
    const title = `${cap(fromN)} to ${toN}`;
    const faq = [
      { q: `How do I convert ${fromN} to ${toN}?`, a: b.to === 10 ? `Multiply each digit by ${b.from} raised to its position (counting from 0 on the right) and add them up. ${b.sample} in ${fromN} is ${val}.` : b.from === 10 ? `Divide by ${b.to} repeatedly and read the remainders from last to first. ${b.sample} is ${out} in ${toN}.` : `Go through decimal, or group digits: each hex digit is exactly four binary digits. ${b.sample} → ${out}.` },
      { q: 'How big a number can I convert?', a: 'Any size. ConvertEasy uses arbitrary-precision integers (BigInt), so 256-bit hashes and addresses convert exactly.' },
    ];
    return {
      path: `/${b.slug}`,
      title: `${title} converter | ConvertEasy`,
      description: `Convert ${fromN} to ${toN} instantly, for numbers of any size. ${b.sample} (${fromN}) = ${out} (${toN}). Includes every other base and a table.`,
      h1: esc(`${title} converter`),
      h1Text: `${title} converter`,
      eyebrow: 'Number bases',
      lede: `Paste a ${esc(fromN)} number to see it in ${esc(toN)} and every other base.`,
      answer: `<strong>${esc(b.sample)} in ${esc(fromN)} = ${esc(out)} in ${esc(toN)}</strong>.`,
      tool: 'numberbase',
      toolLabel: `${title} converter`,
      dataTool: 'numberbase',
      data: { base: String(b.from), value: b.sample },
      navActive: 'number-base',
      crumbs: [
        { name: 'Number bases', path: '/number-base' },
        { name: title, path: `/${b.slug}` },
      ],
      main: prose([section(`${esc(title)} table`, table(title, [cap(fromN), cap(toN)], rows)), faqHtml(faq)], [linkPanel('Other bases', BASE_PAGES.filter((x) => x !== b).map((x) => ({ name: `${cap(BASE_NAMES[x.from])} to ${BASE_NAMES[x.to]}`, path: `/${x.slug}` })).concat([{ name: 'Roman numerals', path: '/roman-numeral-converter' }])), sideTools('number-base')]),
      faq,
      keywords: [`${fromN} to ${toN}`, `${fromN} to ${toN} converter`, `convert ${fromN} to ${toN}`],
      group: 'Number bases',
      search: `${fromN} ${toN} base`,
      weight: 1,
      priority: 0.6,
    };
  });
  const romanRows = [1, 2, 3, 4, 5, 9, 10, 14, 19, 40, 50, 90, 100, 400, 500, 900, 1000, 1999, 2000, 2025, 2026, 3999].map((n) => [String(n), `<span class="mono">${toRoman(n)}</span>`]);
  pages.push({
    path: '/roman-numeral-converter',
    title: 'Roman numeral converter (1 to 3,999) | ConvertEasy',
    description: 'Convert numbers to Roman numerals and Roman numerals to numbers, with validation for standard forms. 2026 = MMXXVI.',
    h1: 'Roman numeral converter',
    h1Text: 'Roman numeral converter',
    eyebrow: 'Number bases',
    lede: 'Type a number or a Roman numeral in the Roman numerals box below the base converter.',
    answer: '<strong>2026 = MMXXVI</strong>. I = 1, V = 5, X = 10, L = 50, C = 100, D = 500, M = 1,000.',
    tool: 'numberbase',
    toolLabel: 'Roman numeral converter',
    dataTool: 'numberbase',
    data: { base: '10', value: '2026' },
    navActive: 'number-base',
    crumbs: [
      { name: 'Number bases', path: '/number-base' },
      { name: 'Roman numerals', path: '/roman-numeral-converter' },
    ],
    main: prose([section('Roman numerals table', table('Numbers and Roman numerals', ['Number', 'Roman'], romanRows)), faqHtml([
      { q: 'How do Roman numerals work?', a: 'Symbols are added from largest to smallest (VI = 6), except that a smaller symbol before a larger one is subtracted (IV = 4, IX = 9, XL = 40, XC = 90, CD = 400, CM = 900).' },
      { q: 'What is the largest Roman numeral?', a: 'In standard form, 3,999 (MMMCMXCIX). Larger values need a bar over the letters, which is not part of the standard set.' },
    ])], [sideTools('number-base')]),
    faq: [
      { q: 'How do Roman numerals work?', a: 'Symbols are added from largest to smallest (VI = 6), except that a smaller symbol before a larger one is subtracted (IV = 4, IX = 9, XL = 40, XC = 90, CD = 400, CM = 900).' },
      { q: 'What is the largest Roman numeral?', a: 'In standard form, 3,999 (MMMCMXCIX). Larger values need a bar over the letters, which is not part of the standard set.' },
    ],
    keywords: ['roman numeral converter', 'roman numerals', 'number to roman numerals', 'roman numerals to numbers'],
    group: 'Number bases',
    search: 'roman numerals',
    weight: 2,
    priority: 0.6,
  });
  return pages;
}

// ---------------------------------------------------------------------------
// Tool pages

const SYNTAX = [
  ['Numbers', '<code>1</code> <code>1.5</code> <code>001</code> <code>.25</code> <code>1,000</code> <code>2e-3</code> <code>0xFF</code> <code>0b1010</code>', '1.1.1 is rejected as an invalid number'],
  ['Scale', '<code>5k</code> <code>2.5M</code> <code>$3B</code> <code>1.2T</code> <code>3 lakh</code> <code>2 crore</code> <code>4 million</code> <code>1 bn</code> <code>2 tn</code>', 'k, M, B (billion) and T (trillion) when attached to the number. With a space, or in a line that already has bytes or spoons, B is a byte and T a tablespoon'],
  ['Operators', '<code>+</code> <code>-</code> <code>*</code> <code>×</code> <code>/</code> <code>÷</code> <code>^</code> <code>( )</code>', 'Usual precedence; 2(3+4) and 2π multiply'],
  ['Roots and π', '<code>√16</code> <code>√(9+16)</code> <code>sqrt 2</code> <code>π</code> <code>pi</code>', 'π is 3.14159 (five decimals)'],
  ['Percent', '<code>50%</code> <code>200 g + 10%</code> <code>10% of 200</code> <code>10 % 3</code>', 'a + b% adds b percent of a; % between numbers is modulo'],
  ['Factorial', '<code>5!</code> <code>(3+2)!</code>', 'Whole numbers from 0 to 170'],
  ['Compare', '<code>1 km = 1000 m</code> <code>1 kg ≠ 1 lb</code> <code>&lt;</code> <code>&gt;</code> <code>≤</code> <code>≥</code>', 'Returns True or False; != and == work too'],
  ['Units', '<code>1cm + 1 metre</code> <code>5 ft 11 in</code> <code>5\'11"</code> <code>3 m × 4 m</code>', 'Symbols, names, plurals, US and UK spellings'],
  ['Convert', '<code>… to cm</code> <code>… in km/h</code> <code>… as GiB</code> <code>… to ft in</code>', 'Split results for feet and inches, hours and minutes'],
  ['Money', '<code>$20 + €15 in INR</code> <code>0.5 ETH to USD</code> <code>$2.5B + $800M</code>', 'Live rates, fiat and crypto'],
  ['Bytes', '<code>1 GB to MB</code> <code>512B + 1 KB</code> <code>1 Kb to bit</code> <code>2 GiB to MB</code>', 'KB, MB, GB and TB follow the Decimal / Binary switch (1,000 or 1,024). Bits are always 1,000-based; KiB, MiB and GiB always 1,024'],
  ['Formats', '<code>255 to hex</code> <code>2026 to roman</code> <code>0.25 to %</code> <code>12 to binary</code>', ''],
  ['Lines', 'One calculation per line; <code>ans</code> is the line above; <code>#</code> or <code>//</code> starts a comment', ''],
];

export function toolPage(id, extra = {}) {
  const t = TOOL_BY_ID.get(id);
  const common = { navActive: id, crumbs: [{ name: t.nav, path: t.path }], tool: t.kind, dataTool: t.kind, toolLabel: t.name, group: 'Tools', weight: 4, priority: 0.9 };
  switch (id) {
    case 'calculator': {
      const examples = calcExamples();
      const faq = [
        { q: 'Can I add different units, like centimeters and meters?', a: 'Yes. 1 cm + 1 m gives 1.01 m, and the dropdown next to the answer switches it to 101 cm, inches or any other length unit. Units must be the same kind: 1 kg + 1 m is rejected with an explanation.' },
        { q: 'What does the calculator do with 3 m × 4 m?', a: 'It tracks dimensions, so length × length is an area: 12 m². Distance ÷ time is a speed, mass ÷ volume a density, power × time an energy.' },
        { q: 'How do I pick the unit of the answer?', a: 'Use the unit dropdown on the result, or end the line with "to", "in" or "as" and a unit: 180 cm to ft in gives 5 ft 10.866 in.' },
        { q: 'Is 1 GB 1,000 MB or 1,024 MB in the calculator?', a: 'Your choice. When a line involves bytes, a Decimal / Binary switch appears on the result: decimal counts 1 KB = 1,000 B (drives, macOS, phones) and binary counts 1 KB = 1,024 B (Windows, RAM). Bits stay decimal, so 1 Kb = 1,000 b, and 1 B is always 8 b. The same switch drives the data converters.' },
        { q: 'Can I type 5B for five billion?', a: 'Yes. k, M, B and T written straight after a number mean thousand, million, billion and trillion: $2.5B + $800M = $3.3 billion. Written with a space (5 B) or in a line that already has data units (512B + 1 KB), B means bytes instead.' },
        { q: 'Does it work with currency?', a: 'Yes. $20 + €15 in INR uses live exchange rates, and crypto such as BTC and ETH works the same way.' },
        { q: 'Is my calculation history private?', a: 'Yes. Everything stays in your browser. Nothing you type is sent anywhere; only exchange rates are fetched.' },
      ];
      return {
        ...common,
        path: t.path,
        title: 'Smart calculator with units: 1 cm + 1 m = 1.01 m | ConvertEasy',
        description: 'A calculator that understands units and currencies. Type 1 cm + 1 m, 5 ft 11 in to cm or $20 + €15 in INR. Suggestions as you type, any answer unit, offline.',
        h1: 'Smart calculator <span class="accent">that understands units</span>',
        h1Text: 'Smart calculator that understands units',
        eyebrow: 'Quick math',
        lede: 'Not a keypad: a text box. Type math with units, currencies, percentages and roots; suggestions below the box offer the units and operators that make sense next.',
        answer: '<strong>1 cm + 1 m = 1.01 m</strong> (or 101 cm, your choice). Units of the same kind mix freely; the answer unit is a dropdown away.',
        data: { variant: 'full' },
        main: prose(
          [
            section('What you can type', table('Calculator syntax', ['Feature', 'Examples', 'Notes'], SYNTAX)),
            section('Examples with answers', table('Example calculations', ['You type', 'You get'], examples)),
            section('How suggestions work', `<p>As you type, the chips under the box follow your cursor. After a number they offer units; once a line has a unit, only units of the same kind appear (type <code>2 g +</code> and you will see grams, kilograms, pounds and ounces, not meters). After a value they offer operators, and after <code>to</code> the units your answer can be shown in. Press <kbd>Tab</kbd> to take the first unit suggestion while typing.</p>`),
            faqHtml(faq),
          ],
          [linkPanel('Unit categories', CATEGORIES.slice(0, 12).map((c) => ({ name: c.name, path: '/' + CATEGORY_SLUG[c.id] }))), sideTools('calculator')],
        ),
        faq,
        keywords: ['calculator with units', 'unit calculator', 'smart calculator', 'natural language calculator', 'cm plus m', 'feet and inches calculator'],
        search: 'calculator math units expression',
      };
    }
    case 'units': {
      const faq = [
        { q: 'How many units does ConvertEasy support?', a: `${CATEGORIES.reduce((n, c) => n + c.units.length, 0)} units across ${CATEGORIES.length} categories, from nanometers to light-years and from bits to pebibytes.` },
        { q: 'Can I convert weight to volume?', a: 'Only for a known substance, because it depends on density. Use the cooking converter for cups to grams of flour, sugar, butter and more.' },
        { q: 'Does the unit converter work offline?', a: OFFLINE_A },
      ];
      return {
        ...common,
        path: t.path,
        title: `Unit converter: ${CATEGORIES.length} categories, 200+ units | ConvertEasy`,
        description: 'Convert length, weight, volume, temperature, area, speed, time, data, pressure, energy and more. Exact factors, two-way fields, works offline.',
        h1: 'Unit converter',
        h1Text: 'Unit converter',
        eyebrow: `${CATEGORIES.length} categories`,
        lede: 'Pick a category below, or start with length. Both boxes are editable and accept sums.',
        answer: null,
        data: { category: 'length', from: 'cm', to: 'in', value: '1' },
        main: prose(
          [
            section('All categories', categoryGrid()),
            section('Most searched conversions', `<ul class="pill-list">${popularUnitPairs().map((p) => `<li><a href="${href('/' + p.slug)}">${esc(p.from.symbol)} to ${esc(p.to.symbol)}</a></li>`).join('')}</ul>`),
            ...CATEGORIES.map((c) => section(`<a href="${href('/' + CATEGORY_SLUG[c.id])}">${esc(c.name)}</a>`, `<p>${esc(c.blurb)}</p>`)),
            faqHtml(faq),
          ],
          [sideTools('units')],
        ),
        faq,
        keywords: ['unit converter', 'measurement converter', 'metric converter', 'imperial to metric'],
        search: 'unit converter measurement',
      };
    }
    case 'currency': {
      const faq = [
        { q: 'Where do the exchange rates come from?', a: "Coinbase's public exchange-rate feed is the primary source for both fiat and crypto, refreshed every minute. CoinGecko fills in crypto prices, and currency-api (jsDelivr) and the European Central Bank via Frankfurter are fallbacks. No API key or account is involved." },
        { q: 'Can I convert fiat to crypto and crypto to fiat?', a: 'Yes. Any pair works: USD to BTC, ETH to INR, SOL to EUR, or BTC to ETH.' },
        { q: 'Are these the rates my bank will give me?', a: 'No. They are mid-market reference rates. Banks, card networks and exchanges add a spread and fees.' },
        { q: 'Does it work offline?', a: 'Yes, using the last rates fetched, clearly labelled with when they were fetched.' },
      ];
      return {
        ...common,
        path: t.path,
        title: 'Currency & crypto converter with live rates | ConvertEasy',
        description: 'Live exchange rates for 150+ currencies and 40+ cryptocurrencies. Convert USD, EUR, INR, GBP, BTC, ETH and more, fiat to crypto and back. Free, no sign-up.',
        h1: 'Currency & crypto converter',
        h1Text: 'Currency & crypto converter',
        eyebrow: 'Live rates',
        lede: 'Fiat to fiat, fiat to crypto, crypto to crypto. Rates refresh every minute and keep working offline.',
        answer: 'Rates are <strong>live mid-market rates</strong> from Coinbase, with CoinGecko, currency-api and the ECB as fallbacks. The status line shows the source and age of every rate.',
        data: { from: 'USD', to: 'EUR', value: '100' },
        preconnect: ['https://api.coinbase.com'],
        main: prose(
          [
            section('Popular currency pairs', `<ul class="pill-list">${MONEY_PAIRS.filter(([a, b]) => !isCrypto(a) && !isCrypto(b)).map(([a, b]) => `<li><a href="${href(`/${a.toLowerCase()}-to-${b.toLowerCase()}`)}">${a} to ${b}</a></li>`).join('')}</ul>`),
            section('Popular crypto pairs', `<ul class="pill-list">${MONEY_PAIRS.filter(([a, b]) => isCrypto(a) || isCrypto(b)).map(([a, b]) => `<li><a href="${href(`/${a.toLowerCase()}-to-${b.toLowerCase()}`)}">${a} to ${b}</a></li>`).join('')}</ul>`),
            section('Supported cryptocurrencies', `<p>${CRYPTO.map((c) => `${esc(c.name)} (${c.code})`).join(', ')}.</p>`),
            section('How the rates work', `<p>Every rate is fetched as the value of one unit in US dollars. Converting A to B divides the two, so every pair, including obscure crosses, is consistent. The browser fetches rates directly from the providers: there is no ConvertEasy server in between, and nothing you type is sent anywhere.</p>`),
            faqHtml(faq),
          ],
          [sideTools('currency')],
        ),
        faq,
        keywords: ['currency converter', 'crypto converter', 'exchange rate', 'usd to inr', 'btc to usd', 'fiat to crypto'],
        search: 'currency money exchange rate crypto',
      };
    }
    case 'crypto-units': {
      const rows = PRESETS.filter((p) => !p.custom).map((p) => [esc(p.big), esc(p.small), String(p.ladder ? '' : p.decimals) || '—', esc(p.note ?? '')]);
      const faq = [
        { q: 'What is a gwei?', a: 'One billionth of an ether (10⁻⁹ ETH), or 1,000,000,000 wei. Ethereum gas prices are quoted in gwei.' },
        { q: 'How many satoshis are in a bitcoin?', a: '100,000,000. One satoshi is 0.00000001 BTC.' },
        { q: 'How many decimals does USDC have?', a: '6 on Ethereum, Solana, Base, Arbitrum and most chains, so 1 USDC is 1,000,000 base units. Bridged USDC on BNB Chain uses 18.' },
        { q: 'Why not just use a normal calculator?', a: 'Normal calculators use floating point numbers with about 16 significant digits, which silently corrupts 18-decimal amounts. ConvertEasy shifts the decimal point on the digits themselves, so every digit survives.' },
      ];
      return {
        ...common,
        path: t.path,
        title: 'Crypto unit converter: ETH, gwei, wei, BTC, sats, decimals | ConvertEasy',
        description: 'Exact crypto denomination converter. ETH ↔ gwei ↔ wei, BTC ↔ sats ↔ mBTC, SOL ↔ lamports, USDC/USDT 6 decimals, and custom token decimals. No rounding.',
        h1: 'Crypto units & decimals',
        h1Text: 'Crypto units & decimals',
        eyebrow: 'Exact, no rounding',
        lede: 'Presets for the denominations developers and traders actually use, plus custom decimals for any token.',
        answer: '<strong>1 ETH = 1,000,000,000 gwei = 10¹⁸ wei</strong> · <strong>1 BTC = 100,000,000 sats</strong> · <strong>1 USDC = 1,000,000 base units</strong>.',
        data: { preset: 'usdc', value: '1' },
        main: prose(
          [
            section('Presets', table('Crypto presets', ['Asset', 'Small unit', 'Decimals', 'Notes'], rows)),
            section('Denomination pages', `<ul class="pill-list">${CRYPTO_UNIT_PAGES.flatMap(([id, b, s]) => { const pr = PRESET_BY_ID.get(id); return [`<li><a href="${href(`/${b}-to-${s}`)}">${esc(pr.big)} to ${esc(pr.small)}</a></li>`, `<li><a href="${href(`/${s}-to-${b}`)}">${esc(pr.small)} to ${esc(pr.big)}</a></li>`]; }).join('')}${DECIMAL_PAGES.map((d) => `<li><a href="${href(`/${d}-decimals`)}">${d.toUpperCase()} decimals</a></li>`).join('')}</ul>`),
            section('Why base units exist', `<p>Blockchains store balances as whole numbers of a smallest unit (wei, satoshis, lamports) and a <code>decimals</code> value tells wallets where the decimal point goes. An ERC-20 transfer of 1 USDC is the integer 1000000 on-chain. Getting the decimals wrong by a few places is how people send 1,000× too much, so this tool is exact to the last digit.</p>`),
            faqHtml(faq),
          ],
          [sideTools('crypto-units')],
        ),
        faq,
        keywords: ['gwei to eth', 'wei to eth', 'sats to btc', 'crypto decimals', 'erc20 decimals', 'usdc decimals', 'lamports to sol'],
        search: 'crypto units decimals gwei wei sats',
      };
    }
    case 'date-time': {
      const faq = DATE_CONTENT.diff.faq.concat(DATE_CONTENT.unix.faq.slice(0, 1), DATE_CONTENT.tz.faq.slice(0, 1));
      return {
        ...common,
        path: t.path,
        title: 'Date & time calculator: days between dates, Unix time, time zones | ConvertEasy',
        description: 'Days between two dates, add or subtract days and months, Unix timestamp converter and time zone converter. Private, free and offline.',
        h1: 'Date & time calculator',
        h1Text: 'Date & time calculator',
        eyebrow: 'Four tools in one',
        lede: 'Between dates, add or subtract, Unix time and time zones. For durations like years to months, use the <a href="' + href('/time-converter') + '">time converter</a>.',
        answer: null,
        data: { mode: 'diff' },
        main: prose(
          [
            section('Date tools', `<ul class="link-list">${DATE_PAGES.map((d) => `<li><a href="${href('/' + d.slug)}">${esc(d.h1)}</a></li>`).join('')}</ul>`),
            section('Duration conversions', `<ul class="pill-list">${pairsInCategory('time').map((p) => `<li><a href="${href('/' + p.slug)}">${esc(p.from.plural)} to ${esc(p.to.plural)}</a></li>`).join('')}</ul>`),
            section('Between dates', DATE_CONTENT.diff.body),
            section('Unix time', DATE_CONTENT.unix.body),
            faqHtml(faq),
          ],
          [sideTools('date-time')],
        ),
        faq,
        keywords: ['date calculator', 'days between dates', 'unix timestamp', 'time zone converter', 'age calculator'],
        search: 'date time calendar days timestamp timezone',
      };
    }
    case 'cooking': {
      const rows = INGREDIENTS.map((i) => [esc(i.name), `${f(i.gPerCup)} g`, `${f(i.gPerCup / 16, 3)} g`, `${f(i.gPerCup / 48, 2)} g`]);
      const faq = [
        { q: 'Why can’t I convert cups to grams without an ingredient?', a: 'Cups measure volume and grams measure weight. A cup of flour weighs about 120 g while a cup of honey weighs about 340 g, so the ingredient’s density is needed.' },
        { q: 'Which cup does ConvertEasy use?', a: 'The US customary cup (236.6 mL) for ingredient weights. The metric cup (250 mL) is available as a unit too.' },
      ];
      return {
        ...common,
        path: t.path,
        title: 'Cooking converter: cups to grams for 20+ ingredients | ConvertEasy',
        description: 'Convert cups, tablespoons and teaspoons to grams and ounces for flour, sugar, butter, rice, honey and more. Baking references in one place.',
        h1: 'Cooking converter: cups to grams',
        h1Text: 'Cooking converter',
        eyebrow: 'Baking by weight',
        lede: 'Pick an ingredient, then convert between cups, spoons, milliliters, grams and ounces.',
        answer: '<strong>1 cup of flour ≈ 120 g</strong> · <strong>sugar ≈ 200 g</strong> · <strong>butter ≈ 227 g</strong> · <strong>water ≈ 237 g</strong>.',
        data: { ingredient: 'flour', from: 'volume:cup', to: 'mass:g', value: '1' },
        main: prose(
          [
            section('Ingredient weights', table('Ingredient weights per US cup, tablespoon and teaspoon', ['Ingredient', 'Per cup', 'Per tbsp', 'Per tsp'], rows)),
            section('Ingredient pages', `<ul class="pill-list">${COOKING_PAGES.map((id) => `<li><a href="${href(`/${INGREDIENT_BY_ID.get(id).slug}-cups-to-grams`)}">${esc(INGREDIENT_BY_ID.get(id).name)}</a></li>`).join('')}</ul>`),
            section('Kitchen volume conversions', `<ul class="pill-list">${[['cup', 'ml'], ['tbsp', 'ml'], ['tsp', 'ml'], ['cup', 'tbsp'], ['tbsp', 'tsp'], ['cup', 'floz']].map(([a, b]) => `<li><a href="${href(`/${getUnit('volume', a).slug}-to-${getUnit('volume', b).slug}`)}">${a} to ${b}</a></li>`).join('')}</ul>`),
            faqHtml(faq),
          ],
          [sideTools('cooking')],
        ),
        faq,
        keywords: ['cups to grams', 'cooking converter', 'baking conversions', 'flour cups to grams'],
        search: 'cooking baking cups grams',
      };
    }
    case 'number-base': {
      const faq = [
        { q: 'Which bases are supported?', a: 'Any base from 2 to 36, with binary, octal, decimal, hexadecimal, base 32 and base 36 shown side by side, plus Roman numerals.' },
        { q: 'Can it handle very large numbers?', a: 'Yes. Arbitrary-precision integers mean 256-bit values, hashes and addresses convert exactly.' },
      ];
      return {
        ...common,
        path: t.path,
        title: 'Number base converter: binary, hex, octal, decimal | ConvertEasy',
        description: 'Convert between binary, octal, decimal, hexadecimal and any base up to 36, for numbers of any size. Roman numerals too.',
        h1: 'Number base converter',
        h1Text: 'Number base converter',
        eyebrow: 'Binary · hex · any base',
        lede: 'Type a number, choose its base, read it in every other base.',
        answer: '<strong>255 = 0xFF = 0b11111111 = 0o377</strong>.',
        data: { base: '10', value: '255' },
        main: prose([section('Conversions', `<ul class="link-list">${BASE_PAGES.map((b) => `<li><a href="${href('/' + b.slug)}">${cap(BASE_NAMES[b.from])} to ${BASE_NAMES[b.to]}</a></li>`).join('')}<li><a href="${href('/roman-numeral-converter')}">Roman numeral converter</a></li></ul>`), faqHtml(faq)], [sideTools('number-base')]),
        faq,
        keywords: ['number base converter', 'binary converter', 'hex converter', 'base converter'],
        search: 'number base binary hex octal',
      };
    }
  }
  return extra;
}

function calcExamples() {
  const rates = { USD: 1, EUR: 1.165, INR: 0.01051 };
  const ctx = { money: (c) => rates[c] ?? null, currencies: () => Object.keys(rates) };
  const list = ['1 cm + 1 m', '1 cm + 1 m to cm', '5 ft 11 in to cm', '180 cm to ft in', '3 m × 4 m', '100 km / 2 h to mph', '98.6 °F to °C', '200 g + 10%', '2^10', '√(9 + 16)', '5!', '2π', '1 km = 1000 m', '2 lakh + 50k', '$2.5B + $800M', '1.2T / 8B', '1 GB to MB', '1 GB to MiB', '255 to hex', '100000 s to d h min s'];
  return list.map((q) => {
    const r = calculate(q, ctx);
    return [`<a href="${calcLink(q)}"><code>${esc(q)}</code></a>`, `<span class="mono">${esc(r.ok ? r.text : r.error)}</span>`];
  });
}

export function popularUnitPairs() {
  const want = ['cm-to-inches', 'kg-to-lbs', 'celsius-to-fahrenheit', 'km-to-miles', 'meters-to-feet', 'inches-to-cm', 'lbs-to-kg', 'fahrenheit-to-celsius', 'feet-to-meters', 'miles-to-km', 'grams-to-ounces', 'liters-to-gallons', 'gb-to-mb', 'mph-to-kmh', 'sq-ft-to-sq-m', 'ml-to-fl-oz', 'years-to-months', 'mbps-to-mb-s', 'psi-to-bar', 'kcal-to-kj', 'hp-to-kw', 'acres-to-hectares', 'stone-to-kg', 'cups-to-ml'];
  const all = new Map(allUnitPairs().map((p) => [p.slug, p]));
  return want.map((s) => all.get(s)).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Home

export function homePage() {
  const faq = [
    { q: 'What is ConvertEasy?', a: `A free converter and calculator from <a href="https://lowkey.tools">lowkey.tools</a>: units, live currency and crypto rates, exact crypto decimals, dates and time zones, cooking measures and number bases, plus a smart calculator that understands units. It is built by <a href="${AUTHOR.url}">Shrinath Prabhu</a>, from the makers of <a href="${ORG.url}">OwlEye Analytics</a>.` },
    { q: 'Is ConvertEasy free?', a: 'Yes, completely. There is no account, no adverts and no paid tier.' },
    { q: 'What makes the calculator different?', a: 'You type math with units: 1 cm + 1 m = 1.01 m, 5 ft 11 in to cm, $20 + €15 in INR. Suggestions under the box offer units of the same kind and valid operators as you type, and the answer unit is a dropdown.' },
    { q: 'Where do exchange rates come from?', a: "Coinbase's public feed (live, fiat and crypto), with CoinGecko, currency-api and the European Central Bank as fallbacks. Your browser fetches them directly; there is no ConvertEasy server." },
    { q: 'Does it work offline?', a: OFFLINE_A },
    { q: 'Does ConvertEasy track me?', a: 'No cookies and no account. Preferences, history and the last exchange rates are kept in your own browser storage.' },
  ];
  return {
    path: '',
    title: 'ConvertEasy: unit, currency & crypto converter with a smart calculator',
    ogTitle: 'ConvertEasy: convert anything, calculate with units',
    description: SITE.description,
    h1: 'Convert anything.<br /><span class="accent">Calculate with units.</span>',
    h1Text: 'Convert anything. Calculate with units.',
    eyebrow: 'Smart calculator · units · currency · crypto',
    lede: 'Type <code>1 cm + 1 m</code>, <code>5 ft 11 in to cm</code> or <code>$20 + €15 in INR</code>. Units, live currency and crypto rates, exact crypto decimals, dates and more, in one fast app.',
    answer: null,
    tool: 'calculator',
    toolLabel: 'Smart calculator',
    toolHead: {
      icon: 'calc',
      title: 'Smart calculator',
      sub: 'Math with units, currency and crypto, one calculation per line. Try an example below, or type your own.',
      link: { path: '/calculator', text: 'Full page and syntax guide' },
    },
    dataTool: 'calculator',
    data: { variant: 'hero' },
    navActive: null,
    bodyClass: 'home',
    crumbs: [],
    faqMain: false,
    main: `<section class="band" aria-labelledby="h-tools"><div class="section-head"><h2 id="h-tools">Every converter</h2><a href="${href('/units')}">All units →</a></div>${toolGrid('calculator')}</section>
<section class="band" aria-labelledby="h-cats"><div class="section-head"><h2 id="h-cats">Unit categories</h2></div>${categoryGrid()}</section>
<section class="band" aria-labelledby="h-pop"><div class="section-head"><h2 id="h-pop">Popular conversions</h2></div><ul class="pill-list">${popularUnitPairs().map((p) => `<li><a href="${href('/' + p.slug)}">${esc(p.from.symbol)} to ${esc(p.to.symbol)}</a></li>`).join('')}${MONEY_PAIRS.slice(0, 6).map(([a, b]) => `<li><a href="${href(`/${a.toLowerCase()}-to-${b.toLowerCase()}`)}">${a} to ${b}</a></li>`).join('')}<li><a href="${href('/gwei-to-eth')}">gwei to ETH</a></li><li><a href="${href('/sats-to-btc')}">sats to BTC</a></li><li><a href="${href('/flour-cups-to-grams')}">flour cups to grams</a></li><li><a href="${href('/days-between-dates')}">days between dates</a></li></ul></section>
${prose(
  [
    section(
      'Why ConvertEasy',
      `<ul>
<li><strong>A calculator that knows units.</strong> Lengths add to lengths, length × length is an area, distance ÷ time is a speed. Mixed units like <code>5 ft 11 in</code> just work.</li>
<li><strong>Smart suggestions.</strong> After a number you get units; once a unit is in play you only get units of the same kind; after <code>to</code>, the units your answer can take.</li>
<li><strong>Live money.</strong> 150+ currencies and 40+ coins, fiat to crypto and back, refreshed every minute with four independent sources.</li>
<li><strong>Exact crypto maths.</strong> ETH, gwei and wei, BTC and sats, USDC's 6 decimals and any token's custom decimals, without floating point errors.</li>
<li><strong>Fast and private.</strong> Static pages, no framework, no cookies, no account. Installs as an app and works offline.</li>
</ul>`,
    ),
    faqHtml(faq),
  ],
  [linkPanel('Start here', [{ name: 'cm to inches', path: '/cm-to-inches' }, { name: 'kg to lbs', path: '/kg-to-lbs' }, { name: 'Celsius to Fahrenheit', path: '/celsius-to-fahrenheit' }, { name: 'USD to INR', path: '/usd-to-inr' }, { name: 'gwei to ETH', path: '/gwei-to-eth' }, { name: 'Days between dates', path: '/days-between-dates' }])],
)}`,
    faq,
    keywords: ['unit converter', 'currency converter', 'crypto converter', 'calculator with units', 'gwei to eth', 'cm to inches', 'kg to lbs'],
    group: 'Home',
    search: 'home convert easy',
    weight: 5,
    priority: 1.0,
  };
}

export function notFoundPage() {
  return {
    path: '/404',
    noindex: true,
    title: 'Page not found | ConvertEasy',
    description: 'That converter does not exist. Search every converter or use the smart calculator.',
    h1: 'That page isn’t here',
    h1Text: 'Page not found',
    lede: `Try the search (<kbd>⌘K</kbd>), the <a href="${href('/calculator')}">smart calculator</a>, or pick a converter below.`,
    tool: null,
    dataTool: '',
    crumbs: [],
    main: `<section class="band">${toolGrid()}</section><section class="band">${categoryGrid()}</section>`,
  };
}

export { svgIcon };
