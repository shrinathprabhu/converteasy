# ConvertEasy

A free, offline-ready converter and calculator at
**[converteasy.lowkey.tools](https://converteasy.lowkey.tools/)**. Built by
[Shrinath Prabhu](https://shrinath.me), from the makers of
[OwlEye Analytics](https://owleye.dev).

- **Smart calculator.** A text box, not a keypad: `1cm + 1 metre` → 1.01 m
  (or 101 cm from the unit dropdown), `5 ft 11 in to cm`, `$20 + €15 in INR`,
  `3 m × 4 m` → 12 m². Chips under the box suggest units of the kind already in
  play and the operators that fit next.
- **Units.** 20 categories, 208 units, exact legal factors, two-way fields
  that accept sums.
- **Currency and crypto.** Live rates for 150+ fiat currencies and 40+ coins,
  fiat ↔ crypto, with four fallback sources and an offline copy.
- **Crypto units.** ETH ↔ gwei ↔ wei, BTC ↔ sats, USDC/USDT 6 decimals, 30+
  presets and custom decimals, exact to the last digit.
- **Dates.** Days between dates, add/subtract, Unix time, time zones.
- **Cooking** cups ↔ grams for 23 ingredients, **number bases** and Roman numerals.

Plain ES modules, no framework, no runtime dependencies. esbuild bundles and
hashes; a Node script pre-renders ~557 static pages.

## Run

Node 22.18+.

```bash
npm ci
npm run dev        # build, serve like production, rebuild on change
npm test           # engine + build audit (run after a build)
npm run build      # → dist/
npm start          # serve dist/ on http://localhost:4174/
npm run assets     # re-render icons and og.png (needs Chrome; sharp is borrowed from a sibling project)
npm run preview:workers # build and preview with Cloudflare Workers (Wrangler)
npm run deploy:workers  # build and upload to Cloudflare Workers (requires login)
```

The local server reads the native Cloudflare rules in `src/static/_headers`
and `src/static/_redirects`, with caching and HTTPS-only headers relaxed for
development.
Add `?nosw` to a URL to skip the service worker while iterating.

## Hosting

Deploy to Cloudflare Workers at `https://converteasy.lowkey.tools/`.
`wrangler.jsonc` declares the custom domain and asset routing. The build
copies `src/static/_headers` and `src/static/_redirects` into `dist/`.

See [Workers settings and deployment](docs/cloudflare-workers.md) and
[hub integration](docs/hub-integration.md).

## Layout

```
src/js/app.js              boot: theme, service worker, install, ⌘K search, lazy tool
src/js/data/units.js       the unit database (dimensions, factors, aliases, definitions)
src/js/data/money.js       fiat codes, crypto assets, denomination ladders, presets
src/js/core/calc.js        calculator: tokenizer, parser, dimensional evaluator
src/js/core/suggest.js     context-aware suggestions
src/js/core/rates.js       live rates: Coinbase → CoinGecko → currency-api → Frankfurter
src/js/core/decimal.js     exact decimal-point shifts for crypto
src/js/core/dates.js       calendar maths, epochs, time zones
src/js/ui/*.js             one module per tool, loaded on demand
src/css/app.css            all styles, light and dark; Geist via Fontsource
scripts/build.mjs          bundle, render pages, write crawler/PWA/security files
scripts/lib/pages.mjs      page content: answers, formulas, tables, FAQs
scripts/lib/html.mjs       layout, JSON-LD, creator cards, footer
scripts/sw.template.js     service worker
wrangler.jsonc             Cloudflare Workers project and output directory
src/static/_headers       Cloudflare security, caching and content-type rules
src/static/_redirects     Cloudflare root and converter redirects
scripts/lib/cloudflare.mjs read native hosting rules for local development
docs/cloudflare-workers.md  Cloudflare Workers build, domain and upload settings
docs/hub-integration.md    what to add to the lowkey.tools hub
```

## How the calculator works

Every unit carries a dimension vector (length, mass, time, temperature,
angle, data, money) and a factor to its base unit. Values are quantities, so
the evaluator adds only matching dimensions, multiplies them into derived
kinds (length × length → area) and picks a display unit from what you typed:
the largest typed unit that keeps the value at least 1, then a unit derived
from the inputs (cm × cm → cm²), then a sensible default. Temperatures are
affine, so `30 °C − 20 °C` is a 10-degree difference and converts as 18 °F.
π is 3.14159 as specified. One calculation per line; `ans` is the line above.

## Rates

No key and no backend. The browser calls
[Coinbase's public exchange rates](https://api.coinbase.com/v2/exchange-rates?currency=USD)
(fiat and crypto, about every minute). Missing coins come from CoinGecko, and
if Coinbase is down the fiat table comes from
[currency-api](https://github.com/fawazahmed0/exchange-api) (jsDelivr, then
Cloudflare mirror) or [Frankfurter](https://frankfurter.dev) (ECB). All four
are CORS-open and verified. The last good table is cached for offline use
and labelled with its age. `COINGECKO_DEMO_KEY` at build time bakes in a
free Demo key; it is visible in the browser, so never use a Pro key.

## Security and caching

- Strict CSP: `script-src 'self'`, `style-src 'self'`, no inline code,
  `connect-src` limited to the four rate hosts, Trusted Types enforced
  (the app uses only `textContent`/`createElement`), `frame-ancestors 'none'`.
- HSTS with preload, COOP, CORP, nosniff, a locked-down Permissions-Policy,
  `strict-origin-when-cross-origin` referrers (so owleye.dev still sees
  where visits come from).
- Hashed assets are `immutable` for a year. HTML, the manifest and `sw.js`
  revalidate every time and carry no `s-maxage`.
- The service worker is scoped to `/` on `converteasy.lowkey.tools` and deletes only its own
  `converteasy-` caches. Pages are network-first; offline, any converter URL
  falls back to its tool page with that URL's defaults.

## SEO, AEO and GEO

- ~557 static pages: 20 category pages, 348 unit pairs, 98 currency and
  crypto pairs, 40 crypto denomination pages, 28 cooking pages, date and
  number-base pages. Every page answers its question in the first paragraph
  (`.answer`, marked speakable), then gives the formula, a worked example, a
  table, unit definitions and an FAQ.
- JSON-LD graph per page: WebPage, WebApplication, BreadcrumbList, FAQPage,
  HowTo, DefinedTermSet, with Organization (OwlEye) and Person (Shrinath)
  nodes sharing `@id`s with the hub.
- `sitemap.xml`, AI-crawler-friendly `robots.txt`, `llms.txt`,
  `llms-full.txt` (every factor and formula), OpenSearch (search the
  calculator from the address bar), `humans.txt`, `security.txt`.
- Backlinks: every page links OwlEye and shrinath.me from the creator cards,
  footer and structured data, with varied anchor text and no `nofollow`.

## Tests

`npm test` covers the calculator spec (every operator, number forms,
same-kind rule, compound units, temperatures, money, suggestions), exact
decimals, calendar and time zone maths, rate parsing and fallbacks, and audits
the build: one h1 and a unique canonical per page, JSON-LD that parses and
matches the visible FAQ, no inline script or style (CSP), every internal link
resolving, backlinks on every page, sitemap and precache coherence.

Not covered: Lighthouse and Core Web Vitals on the public URL, and install on
real devices. See `docs/hub-integration.md` for the launch checklist.

Fonts: Geist and Geist Mono by Vercel (SIL OFL 1.1), via Fontsource.
