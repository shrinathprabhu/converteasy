// Lightweight local server using native Cloudflare headers and redirects.
// Use npm run preview:workers for the full Workers Static Assets runtime.
//
//   node scripts/serve.mjs [port]        → http://localhost:4174/
//
// Serves the app at the root, like converteasy.lowkey.tools.

import { createServer } from 'node:http';
import { stat } from 'node:fs/promises';
import { createReadStream, readFileSync } from 'node:fs';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';
import { parseHeaders, parseRedirects, headersFor } from './lib/cloudflare.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const config = JSON.parse(readFileSync(join(root, 'wrangler.jsonc'), 'utf8'));
const loadRules = () => ({
  headers: parseHeaders(readFileSync(join(root, 'src/static/_headers'), 'utf8')),
  redirects: parseRedirects(readFileSync(join(root, 'src/static/_redirects'), 'utf8')),
});

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

function fill(dest, m) {
  return dest.replace(/:(\w+)\*?/g, (_, name) => m.groups?.[name] ?? '');
}

async function fileFor(pathname) {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const candidates = clean === '/' ? ['index.html'] : [clean, `${clean}.html`, join(clean, 'index.html')];
  for (const c of candidates) {
    const full = join(dist, c);
    if (!full.startsWith(dist)) continue;
    try {
      const s = await stat(full);
      if (s.isFile()) return full;
    } catch {
      /* next */
    }
  }
  return null;
}

export function start(port = Number(process.argv[2] ?? 4174)) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let path = url.pathname;
    const original = path;
    const rules = loadRules();

    if (config.assets.html_handling !== 'none' && /\.html$/.test(path) && !path.endsWith('/404.html')) {
      res.writeHead(308, { Location: (path.replace(/(\/index)?\.html$/, '') || '/') + url.search });
      return res.end();
    }
    if (config.assets.html_handling === 'drop-trailing-slash' && path.length > 1 && path.endsWith('/')) {
      res.writeHead(308, { Location: path.replace(/\/+$/, '') + url.search });
      return res.end();
    }
    for (const r of rules.redirects) {
      const m = r.re.exec(path);
      if (m) {
        res.writeHead(r.code, { Location: fill(r.dest, m) + url.search });
        return res.end();
      }
    }

    let file = await fileFor(path);

    const headers = headersFor(rules.headers, original);
    headers.set('Cache-Control', 'no-store'); // dev: avoid stale builds
    headers.delete('Strict-Transport-Security');
    const csp = headers.get('Content-Security-Policy');
    if (csp) headers.set('Content-Security-Policy', csp.replace('upgrade-insecure-requests; ', ''));

    let status = 200;
    if (!file) {
      status = 404;
      file = join(dist, '404.html');
    }
    const type = headers.get('Content-Type') ?? TYPES[extname(file)] ?? 'application/octet-stream';
    const compress = /gzip/.test(req.headers['accept-encoding'] ?? '') && /text|json|javascript|xml|svg|manifest/.test(type);
    res.writeHead(status, { ...Object.fromEntries(headers), 'Content-Type': type, ...(compress ? { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' } : {}) });
    if (req.method === 'HEAD') return res.end();
    const stream = createReadStream(file);
    (compress ? stream.pipe(createGzip()) : stream).pipe(res);
    if (process.env.SERVE_LOG) console.log(status, original);
  });
  server.listen(port, () => console.log(`serving dist/ on http://localhost:${port}/`));
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) start();

