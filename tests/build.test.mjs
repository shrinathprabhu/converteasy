// Audits the built site in dist/ (run `npm run build` first).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { parseHeaders, headersFor } from '../scripts/lib/cloudflare.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const SITE = 'https://converteasy.lowkey.tools';

if (!existsSync(dist)) throw new Error('dist/ missing: run `npm run build` first');
const htmlFiles = readdirSync(dist).filter((f) => f.endsWith('.html'));
const pages = htmlFiles.map((f) => ({ f, html: readFileSync(join(dist, f), 'utf8') }));

function resolves(path) {
  const clean = path.split(/[?#]/)[0] || '/';
  if (clean === '/') return existsSync(join(dist, 'index.html'));
  return existsSync(join(dist, clean)) || existsSync(join(dist, `${clean}.html`));
}

test('every page has one h1, a canonical on converteasy.lowkey.tools and a description', () => {
  for (const { f, html } of pages) {
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, `${f} h1 count`);
    const canonical = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];
    assert.ok(canonical && new URL(canonical).origin === SITE, `${f} canonical ${canonical}`);
    const desc = /<meta name="description" content="([^"]*)"/.exec(html)?.[1];
    assert.ok(desc && desc.length > 50, `${f} description`);
    assert.match(html, /<html lang="en"/);
  }
});

test('titles and canonicals are unique', () => {
  const seen = new Map();
  for (const { f, html } of pages) {
    if (f === '404.html') continue;
    const c = /<link rel="canonical" href="([^"]+)"/.exec(html)[1];
    assert.ok(!seen.has(c), `${f} duplicates canonical of ${seen.get(c)}`);
    seen.set(c, f);
  }
});

test('JSON-LD parses and ties the page to OwlEye and Shrinath', () => {
  for (const { f, html } of pages) {
    const raw = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1];
    assert.ok(raw, `${f} has JSON-LD`);
    const data = JSON.parse(raw);
    const types = data['@graph'].map((n) => n['@type']).flat();
    for (const t of ['WebPage', 'WebApplication', 'Organization', 'Person', 'BreadcrumbList']) assert.ok(types.includes(t), `${f} lacks ${t}`);
    const faq = data['@graph'].find((n) => n['@type'] === 'FAQPage');
    if (faq) for (const q of faq.mainEntity) assert.ok(html.includes(q.name.replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')), `${f} FAQ "${q.name}" not visible`);
  }
});

test('CSP-safe markup: no inline scripts, handlers or style attributes', () => {
  for (const { f, html } of pages) {
    const scripts = html.match(/<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>/g) ?? [];
    assert.deepEqual(scripts, [], `${f} inline script`);
    assert.doesNotMatch(html, /\son[a-z]+="/, `${f} inline handler`);
    assert.doesNotMatch(html, /\sstyle="/, `${f} style attribute`);
  }
});

test('every internal link and asset resolves', () => {
  const broken = new Set();
  for (const { f, html } of pages) {
    for (const [, url] of html.matchAll(/(?:href|src)="(\/(?!\/)[^"]*)"/g)) if (!resolves(url)) broken.add(`${f} → ${url}`);
  }
  assert.deepEqual([...broken], []);
});

test('backlinks to owleye.dev and shrinath.me on every page, followed', () => {
  for (const { f, html } of pages) {
    assert.ok((html.match(/href="https:\/\/owleye\.dev"/g) ?? []).length >= 4, `${f} owleye links`);
    assert.ok((html.match(/href="https:\/\/shrinath\.me"/g) ?? []).length >= 4, `${f} shrinath links`);
    assert.doesNotMatch(html, /nofollow/, `${f} nofollow`);
  }
});

test('sitemap lists every indexable page and nothing else', () => {
  const xml = readFileSync(join(dist, 'sitemap.xml'), 'utf8');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((l) => !l.endsWith('.png'));
  assert.equal(locs.length, htmlFiles.length - 1);
  for (const l of locs) assert.ok(new URL(l).origin === SITE && resolves(new URL(l).pathname), `sitemap ${l}`);
});

test('crawler, PWA and security files exist and are coherent', () => {
  for (const f of ['robots.txt', 'llms.txt', 'llms-full.txt', 'manifest.webmanifest', 'sw.js', 'opensearch.xml', 'humans.txt', '.well-known/security.txt', 'pages.json', 'icons/og.png', 'icons/favicon.ico', 'icons/maskable-512.png']) {
    assert.ok(existsSync(join(dist, f)), `missing ${f}`);
  }
  const m = JSON.parse(readFileSync(join(dist, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.scope, '/');
  assert.equal(m.id, '/');
  assert.equal(m.start_url, '/');
  for (const icon of m.icons) assert.ok(resolves(icon.src), icon.src);
  assert.match(readFileSync(join(dist, 'robots.txt'), 'utf8'), /Sitemap: https:\/\/converteasy\.lowkey\.tools\/sitemap\.xml/);
  const llms = readFileSync(join(dist, 'llms.txt'), 'utf8');
  assert.ok(llms.includes(`Canonical URL: ${SITE}/\n`));
  assert.match(llms, /owleye\.dev/);
  assert.match(llms, /shrinath\.me/);
  const sw = readFileSync(join(dist, 'sw.js'), 'utf8');
  assert.doesNotMatch(sw, /__\w+__/);
  for (const url of JSON.parse(/const PRECACHE = (\[[\s\S]*?\]);/.exec(sw)[1])) assert.ok(resolves(url), `precache ${url}`);
  assert.match(sw, /k\.startsWith\(PREFIX\)/, 'sw only deletes its own caches');
});

test('Cloudflare headers preserve the security policy', () => {
  const rules = parseHeaders(readFileSync(join(dist, '_headers'), 'utf8'));
  const headers = headersFor(rules, '/');
  for (const key of ['Content-Security-Policy', 'Strict-Transport-Security', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy', 'Cross-Origin-Opener-Policy']) assert.ok(headers.has(key), key);
  const csp = headers.get('Content-Security-Policy');
  for (const host of ['api.coinbase.com', 'api.coingecko.com', 'cdn.jsdelivr.net', 'api.frankfurter.dev']) assert.ok(csp.includes(host), host);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
});

test('social metadata, crawler references and sibling links use app subdomains', () => {
  for (const { f, html } of pages) {
    const canonical = /<link rel="canonical" href="([^"]+)"/.exec(html)[1];
    assert.ok(html.includes(`<meta property="og:url" content="${canonical}"`), f);
    for (const tag of ['property="og:image"', 'name="twitter:image"']) {
      assert.ok(html.includes(`${tag} content="${SITE}/icons/og.png"`), `${f} ${tag}`);
    }
    const siblingHosts = new Set([...html.matchAll(/href="https:\/\/([a-z]+)\.lowkey\.tools\/?"/g)]
      .map((m) => m[1]).filter((host) => host !== 'converteasy'));
    assert.equal(siblingHosts.size, 1, `${f} promotes one sibling app`);
    for (const link of ['https://owleye.dev', 'https://shrinath.me', 'https://lowkey.tools', 'https://x.com/shrinath_prabhu']) {
      assert.ok(html.includes(`href="${link}"`), `${f} missing ${link}`);
    }
    assert.doesNotMatch(html, /https:\/\/lowkey\.tools\/(?!["#])|["']\/converteasy(?:[\/"'?#])|<html[^>]*data-base=/, f);
    const graph = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1])['@graph'];
    assert.equal(graph.find((n) => n['@type'] === 'WebPage').url, canonical, f);
    assert.equal(graph.find((n) => n['@type'] === 'WebPage').isPartOf['@id'], `${SITE}/#website`, f);
    assert.equal(graph.find((n) => n['@id'] === `${SITE}/#website`).url, `${SITE}/`, f);
    assert.equal(graph.find((n) => n['@type'] === 'WebApplication').url, `${SITE}/`, f);
    assert.equal(graph.find((n) => n['@type'] === 'WebApplication')['@id'], `${SITE}/#app`, f);
  }
  for (const f of ['robots.txt', 'llms.txt', 'llms-full.txt', 'sitemap.xml', 'opensearch.xml', '.well-known/security.txt']) {
    const text = readFileSync(join(dist, f), 'utf8');
    assert.ok(text.includes(SITE), f);
    assert.doesNotMatch(text, /https:\/\/lowkey\.tools\/[a-z]/, f);
  }
  const png = readFileSync(join(dist, 'icons/og.png'));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
});

test('root routes retain cache rules and service worker scope', () => {
  const rules = parseHeaders(readFileSync(join(dist, '_headers'), 'utf8'));
  const header = (path, key) => headersFor(rules, path).get(key);
  assert.equal(header('/sw.js', 'Service-Worker-Allowed'), '/');
  assert.equal(header('/sw.js', 'Cache-Control'), 'no-cache, max-age=0, must-revalidate');
  assert.equal(header('/assets/app-ABC123.js', 'Cache-Control'), 'public, max-age=31536000, immutable');
  assert.equal(header('/assets/f/font.woff2', 'Access-Control-Allow-Origin'), '*');
  assert.equal(header('/assets/f/font.woff2', 'Cross-Origin-Resource-Policy'), 'cross-origin');
  assert.equal(header('/cm-to-inches', 'Cache-Control'), 'public, max-age=0, must-revalidate');
  assert.equal(header('/icons/og.png', 'Cache-Control'), 'public, max-age=86400, stale-while-revalidate=604800');
});

test('service worker precaches root and finds home and converter fallbacks offline', async () => {
  const sw = readFileSync(join(dist, 'sw.js'), 'utf8');
  const precache = JSON.parse(/const PRECACHE = (\[[\s\S]*?\]);/.exec(sw)[1]);
  assert.ok(precache.includes('/'));
  assert.ok(precache.every((url) => url.startsWith('/') && !url.startsWith('//')));
  const entries = new Map([
    ['/', new Response('home')],
    ['/units', new Response('units')],
    ['/pages.json', new Response(readFileSync(join(dist, 'pages.json'), 'utf8'))],
  ]);
  const worker = runInNewContext(`${sw}\n({ normalize, fallbackFor, inScope })`, {
    self: { location: { origin: SITE }, addEventListener() {} },
    caches: { open: async () => ({ match: async (path) => entries.get(path)?.clone() }) },
    Response,
  });
  for (const path of ['/', '/index', '/index.html']) assert.equal(worker.normalize(path), '/');
  assert.equal(await (await worker.fallbackFor('/')).text(), 'home');
  assert.equal(await (await worker.fallbackFor('/cm-to-inches')).text(), 'units');
  assert.equal(await (await worker.fallbackFor('/unknown')).text(), 'home');
  assert.ok(worker.inScope(new URL(`${SITE}/cm-to-inches`)));
  assert.equal(worker.inScope(new URL('https://superbrain.lowkey.tools/')), false);
});
