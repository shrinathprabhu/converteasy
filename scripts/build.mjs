// Build: bundle + hash the app with esbuild, render every page to static HTML,
// and write the crawler, PWA and security files. Output: dist/
//
//   node scripts/build.mjs            production build
//   COINGECKO_DEMO_KEY=... npm run build   bake in an optional CoinGecko Demo key

import { build } from 'esbuild';
import { mkdir, rm, writeFile, readFile, cp, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import { SITE_URL, SITE, AUTHOR, ORG, ORIGIN, TOOLS, CATEGORIES, CATEGORY_SLUG, MONEY_PAIRS, allUnitPairs, SIBLINGS } from './lib/site.mjs';
import { layout, url } from './lib/html.mjs';
import * as P from './lib/pages.mjs';
import { convert, linearFactor } from '../src/js/data/units.js';
import { PRESETS, CRYPTO, LADDERS } from '../src/js/data/money.js';
import { INGREDIENTS } from '../src/js/data/ingredients.js';
import { formatNumber } from '../src/js/core/format.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const buildDate = new Date().toISOString().slice(0, 10);
const quiet = process.argv.includes('--quiet');
const log = (...a) => !quiet && console.log(...a);

export async function runBuild() {
  const t0 = Date.now();
  await rm(dist, { recursive: true, force: true });
  await mkdir(join(dist, 'assets'), { recursive: true });

  // ---- bundle ----------------------------------------------------------------
  const key = process.env.COINGECKO_DEMO_KEY ?? '';
  const configPlugin = {
    name: 'config',
    setup(b) {
      b.onLoad({ filter: /src[\\/]js[\\/]config\.js$/ }, () => ({
        contents: `export const COINGECKO_DEMO_KEY = ${JSON.stringify(key)};`,
        loader: 'js',
      }));
    },
  };
  const common = {
    bundle: true,
    minify: true,
    legalComments: 'none',
    target: ['es2022', 'chrome105', 'safari15.4', 'firefox110'],
    metafile: true,
    logLevel: 'warning',
  };
  const app = await build({
    ...common,
    entryPoints: { app: join(root, 'src/js/app.js'), styles: join(root, 'src/css/app.css') },
    outdir: join(dist, 'assets'),
    splitting: true,
    format: 'esm',
    entryNames: '[name]-[hash]',
    chunkNames: 'c/[name]-[hash]',
    assetNames: 'f/[name]-[hash]',
    publicPath: `/assets`,
    loader: { '.woff2': 'file', '.woff': 'file' },
    plugins: [configPlugin],
  });
  const theme = await build({
    ...common,
    entryPoints: { theme: join(root, 'src/static/theme.js') },
    outdir: join(dist, 'assets'),
    format: 'iife',
    entryNames: '[name]-[hash]',
  });

  const outputs = { ...app.metafile.outputs, ...theme.metafile.outputs };
  const pub = (file) => `/${relative(dist, resolve(root, file)).split('\\').join('/')}`;
  const find = (pred) => Object.keys(outputs).find(pred);
  const assets = {
    js: pub(find((f) => /assets\/app-[\w]+\.js$/.test(f))),
    css: pub(find((f) => /assets\/styles-[\w]+\.css$/.test(f))),
    theme: pub(find((f) => /assets\/theme-[\w]+\.js$/.test(f))),
    fonts: Object.keys(outputs)
      .filter((f) => /(geist|geist-mono)-latin-wght-normal-[\w]+\.woff2$/.test(f))
      .map(pub),
    buildDate,
    popular: [
      { name: 'cm to inches', path: '/cm-to-inches' },
      { name: 'kg to lbs', path: '/kg-to-lbs' },
      { name: 'Celsius to Fahrenheit', path: '/celsius-to-fahrenheit' },
      { name: 'km to miles', path: '/km-to-miles' },
      { name: 'USD to INR', path: '/usd-to-inr' },
      { name: 'BTC to USD', path: '/btc-to-usd' },
      { name: 'gwei to ETH', path: '/gwei-to-eth' },
      { name: 'GB to MB', path: '/gb-to-mb' },
      { name: 'Days between dates', path: '/days-between-dates' },
      { name: 'Flour cups to grams', path: '/flour-cups-to-grams' },
    ],
  };
  if (!assets.js || !assets.css || !assets.theme) throw new Error('Missing bundle outputs');

  // Per-tool modulepreload lists: the tool chunk and everything it imports,
  // so the converter does not wait on an import waterfall after app.js.
  const TOOL_FILES = { calculator: 'calculator', units: 'units', currency: 'currency', crypto: 'crypto', date: 'datetime', cooking: 'cooking', numberbase: 'numberbase' };
  const deps = (file, acc = new Set()) => {
    for (const imp of outputs[file]?.imports ?? []) {
      if (imp.kind !== 'import-statement' || acc.has(imp.path)) continue;
      acc.add(imp.path);
      deps(imp.path, acc);
    }
    return acc;
  };
  const appFile = find((f) => /assets\/app-[\w]+\.js$/.test(f));
  assets.preload = {};
  for (const [kind, name] of Object.entries(TOOL_FILES)) {
    const chunk = Object.keys(outputs).find((f) => outputs[f].entryPoint?.endsWith(`src/js/ui/${name}.js`));
    if (!chunk) throw new Error(`No chunk for ${name}`);
    assets.preload[kind] = [...new Set([...deps(appFile), chunk, ...deps(chunk)])].map(pub);
  }

  // ---- pages -------------------------------------------------------------------
  const pages = [
    P.homePage(),
    ...TOOLS.map((t) => P.toolPage(t.id)),
    ...CATEGORIES.map((c) => P.categoryPage(c)),
    ...allUnitPairs().map((p) => P.unitPairPage(p)),
    ...MONEY_PAIRS.flatMap(([a, b]) => [P.moneyPage(a, b), P.moneyPage(b, a)]),
    ...P.cryptoUnitPages(),
    ...P.cookingPages(),
    ...P.datePages(),
    ...P.basePages(),
  ];
  const seen = new Map();
  for (const p of pages) {
    if (seen.has(p.path)) throw new Error(`Duplicate page path ${p.path}`);
    seen.set(p.path, p);
  }

  for (const p of pages) {
    const file = p.path === '' ? 'index.html' : `${p.path.slice(1)}.html`;
    await writeFile(join(dist, file), layout(p, assets));
  }
  await writeFile(join(dist, '404.html'), layout(P.notFoundPage(), assets));

  // ---- static files ----------------------------------------------------------
  const iconsSrc = join(root, 'src/static/icons');
  if (existsSync(iconsSrc)) await cp(iconsSrc, join(dist, 'icons'), { recursive: true });
  else console.warn('! src/static/icons missing: run npm run assets');

  const indexable = pages.filter((p) => !p.noindex);
  await writeFile(join(dist, 'pages.json'), JSON.stringify(indexable.map((p) => ({ t: p.h1Text ?? p.title, p: p.path, g: p.group, k: p.search ?? '', w: p.weight ?? 1, x: p.dataTool ?? '', d: p.data ?? {} }))));
  await writeFile(join(dist, 'sitemap.xml'), sitemap(indexable));
  await writeFile(join(dist, 'robots.txt'), robots());
  await writeFile(join(dist, 'llms.txt'), llms(indexable));
  await writeFile(join(dist, 'llms-full.txt'), llmsFull());
  await writeFile(join(dist, 'manifest.webmanifest'), JSON.stringify(manifest(), null, 2));
  await writeFile(join(dist, 'opensearch.xml'), opensearch());
  await writeFile(join(dist, 'humans.txt'), humans());
  await mkdir(join(dist, '.well-known'), { recursive: true });
  await writeFile(join(dist, '.well-known/security.txt'), securityTxt());

  for (const file of ['_headers', '_redirects']) {
    await cp(join(root, 'src/static', file), join(dist, file));
  }

  // ---- service worker --------------------------------------------------------
  const assetFiles = (await walk(join(dist, 'assets'))).map((f) => `/${relative(dist, f).split('\\').join('/')}`);
  const precacheAssets = assetFiles.filter((f) => !/\.woff2?$/.test(f) || /-(latin|latin-ext)-wght-normal-/.test(f));
  const precachePages = ['/', ...TOOLS.map((t) => t.path), ...CATEGORIES.map((c) => `/${CATEGORY_SLUG[c.id]}`)];
  const precacheMisc = ['/pages.json', '/manifest.webmanifest', '/icons/favicon.svg', '/icons/icon-192.png', '/icons/apple-touch-icon.png'];
  const precache = [...precachePages, ...precacheAssets, ...precacheMisc];
  const version = createHash('sha256').update(precache.join('\n')).update(await readFile(join(dist, 'index.html'))).digest('hex').slice(0, 12);
  const toolPaths = Object.fromEntries(TOOLS.map((t) => [t.kind, t.path]));
  const swTemplate = await readFile(join(root, 'scripts/sw.template.js'), 'utf8');
  await writeFile(
    join(dist, 'sw.js'),
    swTemplate
      .replace('__VERSION__', version)
      .replace('__PRECACHE__', JSON.stringify(precache, null, 2))
      .replace('__TOOL_PATHS__', JSON.stringify(toolPaths)),
  );

  const size = await dirSize(dist);
  log(`✓ built ${pages.length} pages + 404 in ${Date.now() - t0} ms · ${(size / 1024 / 1024).toFixed(2)} MB · sw ${version}`);
  log(`  js ${assets.js}\n  css ${assets.css}\n  fonts ${assets.fonts.length} preloaded`);
  return { pages, assets, version };
}

// ---------------------------------------------------------------------------

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

async function dirSize(dir) {
  let n = 0;
  for (const f of await walk(dir)) n += (await stat(f)).size;
  return n;
}

const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function sitemap(pages) {
  const urls = pages.map((p) => {
    const img =
      p.path === ''
        ? `
    <image:image>
      <image:loc>${SITE_URL}/icons/og.png</image:loc>
      <image:title>ConvertEasy: convert anything, calculate with units</image:title>
    </image:image>`
        : '';
    return `  <url>
    <loc>${xmlEsc(SITE_URL + (p.path || '/'))}</loc>
    <lastmod>${buildDate}</lastmod>
    <changefreq>${p.dataTool === 'currency' ? 'daily' : 'monthly'}</changefreq>
    <priority>${(p.priority ?? 0.5).toFixed(1)}</priority>${img}
  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join('\n')}
</urlset>
`;
}

function robots() {
  const bots = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Googlebot', 'Bingbot', 'Applebot', 'Applebot-Extended', 'Amazonbot', 'meta-externalagent', 'DuckAssistBot', 'CCBot', 'cohere-ai', 'YouBot', 'Diffbot', 'MistralAI-User'];
  return `# ConvertEasy, ${url()}
# Everything here is public and safe to index, including by AI crawlers.
# There are no accounts and no server-side user data.

User-agent: *
Allow: /

# Answer engines and model crawlers are welcome.
${bots.map((b) => `User-agent: ${b}\nAllow: /`).join('\n\n')}

Sitemap: ${SITE_URL}/sitemap.xml
`;
}

function llms(pages) {
  const byGroup = (g) => pages.filter((p) => p.group === g);
  const line = (p) => `- [${p.h1Text ?? p.title}](${url(p.path)})${p.description ? `: ${p.description}` : ''}`;
  return `# ConvertEasy

> ConvertEasy (${url()}) is a free unit, currency and crypto converter with a smart calculator that understands units. Type "1 cm + 1 m" and get 1.01 m; "5 ft 11 in to cm" gives 180.34 cm; "$20 + €15 in INR" uses live exchange rates. It is built by Shrinath Prabhu (${AUTHOR.url}) and published by OwlEye Analytics (${ORG.url}), makers of hosted, cookie-free web analytics. Part of lowkey.tools.

Canonical URL: ${url()}
Full reference for language models: ${SITE_URL}/llms-full.txt
Cost: free. Account: none. Platform: any modern browser, installable PWA, works offline.

## Tools

${TOOLS.map((t) => `- [${t.name}](${SITE_URL}${t.path}): ${t.desc}`).join('\n')}

## Unit categories

${byGroup('Unit categories').map(line).join('\n')}

## Popular conversions

${P.popularUnitPairs().map((p) => `- [${p.from.plural} to ${p.to.plural}](${SITE_URL}/${p.slug}): 1 ${p.from.symbol} = ${fmt(convert(1, p.from, p.to))} ${p.to.symbol}`).join('\n')}

## Currency and crypto

${byGroup('Currency').slice(0, 20).map(line).join('\n')}
${byGroup('Crypto').slice(0, 16).map(line).join('\n')}

## Crypto units

${byGroup('Crypto units').map(line).join('\n')}

## Dates, cooking and number bases

${[...byGroup('Date & time'), ...byGroup('Cooking').slice(0, 8), ...byGroup('Number bases')].map(line).join('\n')}

## Facts

- Exchange rates: Coinbase public exchange-rate feed (live, fiat and crypto), with CoinGecko, fawazahmed0 currency-api and the European Central Bank (via Frankfurter) as fallbacks. Mid-market reference rates, refreshed every minute, cached for offline use.
- Unit factors use exact legal definitions where they exist (1 in = 2.54 cm, 1 lb = 0.45359237 kg, 1 US gal = 3.785411784 L).
- Months and years in unit conversion are Gregorian averages (30.436875 and 365.2425 days).
- Data units: GB/MB are decimal (1000), GiB/MiB are binary (1024).
- Crypto denominations are converted exactly with decimal string arithmetic, not floating point.
- Privacy: no cookies, no account, no analytics of what users type. Preferences stay in browser storage.

## About the makers

- [OwlEye Analytics](${ORG.url}): ${ORG.description}
- [Shrinath Prabhu](${AUTHOR.url}): ${AUTHOR.bio} Creator of ConvertEasy.
- [lowkey.tools](${ORIGIN}): twelve small, free, single purpose web tools from the makers of OwlEye Analytics.
${SIBLINGS.map((s) => `  - [${s.name}](${s.url}): ${s.desc}`).join('\n')}
- [Shrinath Prabhu on X](${AUTHOR.x}) (${AUTHOR.handle}): where new lowkey tools are announced.
`;
}

function fmt(x) {
  return formatNumber(x, { sig: 10 });
}

function llmsFull() {
  const cats = CATEGORIES.map((c) => {
    const base = c.units.find((u) => u.id === c.base);
    const rows = c.units.map((u) => {
      const k = linearFactor(u, base);
      const factor = k != null ? `1 ${u.symbol} = ${fmt(k)} ${base.symbol}` : 'non-linear scale (see formula)';
      return `- ${u.name} (${u.symbol}): ${factor}.${u.desc ? ' ' + u.desc : ''}`;
    });
    return `### ${c.name}\n\n${c.about}\n\nConverter: ${SITE_URL}/${CATEGORY_SLUG[c.id]}\n\n${rows.join('\n')}`;
  }).join('\n\n');
  const presets = PRESETS.filter((p) => !p.custom).map((p) => `- ${p.label}: ${p.big} → ${p.small}, ${p.ladder ? `exponent ${LADDERS[p.ladder].units.find((u) => u.id === p.from).exp - LADDERS[p.ladder].units.find((u) => u.id === p.to).exp}` : `${p.decimals} decimals`}.${p.note ? ' ' + p.note : ''}`);
  return `# ConvertEasy: full reference

> Complete reference data behind ConvertEasy (${url()}), a free converter and smart calculator by Shrinath Prabhu (${AUTHOR.url}), from the makers of OwlEye Analytics (${ORG.url}). Generated ${buildDate}. Quote freely; please link the page you used.

## Temperature formulas

- °F = °C × 9/5 + 32
- °C = (°F − 32) × 5/9
- K = °C + 273.15
- °R = °F + 459.67
- A temperature difference of 1 °C = 1 K = 1.8 °F.

## Fuel economy formulas

- L/100 km = 235.215 ÷ mpg (US)
- L/100 km = 282.481 ÷ mpg (UK)
- L/100 km = 100 ÷ km/L

## Unit factors

${cats}

## Byte counting modes

- Decimal (SI): 1 KB = 1,000 B, 1 MB = 1,000 KB, 1 GB = 1,000 MB. Used by drive makers, macOS, iOS, Android and networking.
- Binary (JEDEC, as Windows and RAM count): 1 KB = 1,024 B, 1 MB = 1,024 KB, 1 GB = 1,024 MB. The IEC names for these sizes are KiB, MiB, GiB.
- ConvertEasy has a Decimal / Binary switch; it changes KB, MB, GB, TB, PB, EB and KB/s, MB/s, GB/s. KiB, MiB, GiB are always binary.
- Bits are always decimal: 1 Kb = 1,000 b, 1 Mb = 1,000 Kb. 1 B = 8 b in both modes.
- Unit factors listed below are the decimal ones.

## Crypto denominations

- Ethereum: 1 ETH = 10^3 finney = 10^6 szabo = 10^9 gwei = 10^18 wei.
- Bitcoin: 1 BTC = 1,000 mBTC = 1,000,000 μBTC (bits) = 100,000,000 sats.
${presets.join('\n')}

## Cooking weights (US cup, spoon-and-level)

${INGREDIENTS.map((i) => `- ${i.name}: 1 cup ≈ ${i.gPerCup} g; 1 tbsp ≈ ${(i.gPerCup / 16).toFixed(1)} g`).join('\n')}

## Supported crypto assets

${CRYPTO.map((c) => `${c.name} (${c.code})`).join(', ')}

## Smart calculator syntax

- Numbers: 1, 1.5, 001, .25, 1,000, 2e-3, 0xFF, 0b1010. "1.1.1" is invalid.
- Scale: 5k, 2.5M, 3B (billion), 1.2T (trillion) when attached to the number; 3 lakh, 2 crore, 4 million, 1 bn, 2 tn. "5 B" with a space is five bytes, and in a line with data units "512B" is bytes.
- Bytes: KB, MB, GB, TB follow the Decimal / Binary switch (1,000 or 1,024). Bits are always decimal; KiB, MiB, GiB always binary.
- Operators: + − × ÷ * / ^ ( ) √ π % ! = ≠ < > ≤ ≥. π = 3.14159.
- Percent: "200 g + 10%" = 220 g; "10% of 200" = 20; "10 % 3" (between numbers) = 1 (modulo).
- Units: any symbol, name, plural, US or UK spelling. Compound: "5 ft 11 in", "5'11\\"", "1 h 30 min".
- Same-kind rule: units of the same kind add and subtract; different kinds multiply or divide into derived kinds (m × m = m², km ÷ h = km/h).
- Conversion: end a line with "to", "in", "as" or "→" and a unit. Split results: "to ft in", "to h min s".
- Money: "$20 + €15 in INR", "0.5 ETH to USD". Live rates.
- Formats: "to hex", "to binary", "to octal", "to roman", "to %", "to sci".
- One calculation per line; "ans" is the previous line; "#" or "//" starts a comment.
`;
}

function manifest() {
  const icon = (src, sizes, type, purpose = 'any') => ({ src: `/icons/${src}`, sizes, type, purpose });
  return {
    id: `/`,
    name: 'ConvertEasy: units, currency & crypto converter',
    short_name: 'ConvertEasy',
    description: SITE.description,
    start_url: `/`,
    scope: `/`,
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'any',
    background_color: SITE.themeLight,
    theme_color: SITE.themeLight,
    lang: 'en',
    dir: 'ltr',
    categories: ['utilities', 'productivity', 'finance', 'education'],
    icons: [icon('icon-192.png', '192x192', 'image/png'), icon('icon-512.png', '512x512', 'image/png'), icon('maskable-512.png', '512x512', 'image/png', 'maskable'), icon('favicon.svg', 'any', 'image/svg+xml')],
    shortcuts: [
      { name: 'Smart calculator', short_name: 'Calculator', url: `/calculator`, icons: [{ src: `/icons/icon-192.png`, sizes: '192x192' }] },
      { name: 'Currency & crypto', short_name: 'Currency', url: `/currency`, icons: [{ src: `/icons/icon-192.png`, sizes: '192x192' }] },
      { name: 'Unit converter', short_name: 'Units', url: `/units`, icons: [{ src: `/icons/icon-192.png`, sizes: '192x192' }] },
      { name: 'Crypto units', short_name: 'Crypto', url: `/crypto-units`, icons: [{ src: `/icons/icon-192.png`, sizes: '192x192' }] },
    ],
    share_target: { action: `/calculator`, method: 'GET', params: { text: 'q' } },
    screenshots: [
      { src: `/icons/screenshot-wide.png`, sizes: '1280x800', type: 'image/png', form_factor: 'wide', label: 'Smart calculator with units' },
      { src: `/icons/screenshot-narrow.png`, sizes: '390x844', type: 'image/png', form_factor: 'narrow', label: 'ConvertEasy on a phone' },
    ],
    prefer_related_applications: false,
  };
}

function opensearch() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>ConvertEasy</ShortName>
  <Description>Calculate and convert with units: 5 kg to lb, $20 in INR</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Image height="16" width="16" type="image/x-icon">${SITE_URL}/icons/favicon.ico</Image>
  <Url type="text/html" method="get" template="${SITE_URL}/calculator?q={searchTerms}" />
  <moz:SearchForm xmlns:moz="http://www.mozilla.org/2006/browser/search/">${SITE_URL}/calculator</moz:SearchForm>
</OpenSearchDescription>
`;
}

function humans() {
  return `/* TEAM */
Creator: ${AUTHOR.name}
Role: ${AUTHOR.jobTitle}
Site: ${AUTHOR.url}
From: Mumbai, India

/* PUBLISHER */
${ORG.name}: ${ORG.url}
${ORG.tagline}

/* SITE */
Last update: ${buildDate}
Standards: HTML, CSS, ES modules, Web App Manifest, Service Worker
Fonts: Geist and Geist Mono by Vercel (SIL OFL 1.1), via Fontsource
Components: none, hand-written
Part of: ${ORIGIN}
`;
}

function securityTxt() {
  const expires = new Date(Date.now() + 365 * 86400000).toISOString();
  return `Contact: ${AUTHOR.url}
Expires: ${expires}
Preferred-Languages: en
Canonical: ${SITE_URL}/.well-known/security.txt
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runBuild().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
