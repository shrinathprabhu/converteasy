import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { routePattern, parseRedirects } from '../scripts/lib/cloudflare.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const text = read('dist/_headers');
const blocks = text.split(/\n\s*\n/).map((block) => block.split('\n').filter((line) => line && !line.startsWith('#'))).filter((lines) => lines.length);

function assetHeaders(path) {
  const headers = new Headers();
  for (const [pattern, ...lines] of blocks) {
    if (!routePattern(pattern).test(path)) continue;
    for (const raw of lines) {
      const line = raw.trim();
      if (line.startsWith('! ')) headers.delete(line.slice(2));
      else {
        const colon = line.indexOf(':');
        headers.append(line.slice(0, colon), line.slice(colon + 1).trim());
      }
    }
  }
  return headers;
}

test('native Cloudflare rules are copied unchanged and retain their response policy', () => {
  for (const name of ['_headers', '_redirects']) assert.equal(read(`dist/${name}`), read(`src/static/${name}`));
  for (const path of ['/', '/cm-to-inches', '/assets/app-ABC.js', '/assets/c/chunk-XYZ.js', '/assets/f/geist-ABC.woff2', '/icons/og.png', '/sw.js', '/manifest.webmanifest', '/pages.json', '/robots.txt', '/llms.txt', '/llms-full.txt', '/humans.txt', '/sitemap.xml', '/opensearch.xml', '/.well-known/security.txt', '/404', '/404.html', '/unknown']) {
    const headers = assetHeaders(path);
    assert.equal(headers.get('X-Content-Type-Options'), 'nosniff', path);
    assert.equal(headers.get('X-Frame-Options'), 'DENY', path);
    assert.equal(headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin', path);
    assert.equal(headers.get('Cross-Origin-Opener-Policy'), 'same-origin', path);
    assert.equal((headers.get('Cache-Control').match(/max-age=/g) ?? []).length, 1, path);
  }
  for (const path of ['/robots.txt', '/llms.txt', '/llms-full.txt', '/humans.txt']) {
    assert.equal(assetHeaders(path).get('Content-Type'), 'text/plain; charset=utf-8');
    assert.equal(assetHeaders(path).get('Cache-Control'), 'public, max-age=3600, stale-while-revalidate=86400');
  }
  const redirects = parseRedirects(read('dist/_redirects'));
  assert.equal(redirects.find((rule) => rule.re.test('/')), undefined);
  assert.equal(redirects.find((rule) => rule.re.test('/index/')).dest, '/');
  const match = redirects.find((rule) => rule.re.test('/cm-to-inches/')).re.exec('/cm-to-inches/');
  assert.equal(match.groups.page, 'cm-to-inches');
});

test('Workers Static Assets build output and redirects preserve the root, clean paths and real 404s', () => {
  const config = JSON.parse(read('wrangler.jsonc'));
  assert.equal(config.assets.directory, './dist');
  assert.equal(config.assets.html_handling, 'drop-trailing-slash');
  assert.equal(config.assets.not_found_handling, '404-page');
  assert.equal(config.pages_build_output_dir, undefined);
  assert.equal(config.main, undefined);
  assert.deepEqual(config.routes, [{ pattern: 'converteasy.lowkey.tools', custom_domain: true }]);
  assert.equal(config.name, 'converteasy');
  assert.ok(blocks.length <= 100);
  assert.ok(text.split('\n').every((line) => line.length <= 2000));
  assert.equal(new Set(blocks.map(([pattern]) => pattern)).size, blocks.length);
  const redirects = read('dist/_redirects');
  assert.match(redirects, /^\/index \/ 308$/m);
  assert.match(redirects, /^\/index.html \/ 308$/m);
  assert.match(redirects, /^\/:page\/ \/:page 308$/m);
  assert.doesNotMatch(redirects, /^\/\s|\s200$|converteasy\//m);
  assert.match(read('dist/404.html'), /noindex, follow/);
  assert.equal(existsSync(new URL('../dist/_worker.js', import.meta.url)), false);
});
