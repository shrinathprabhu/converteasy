// Renders the raster icons, favicon.ico and the social card from the SVG
// sources in src/static/icons and scripts/og.html. Output is committed, so
// deploys need neither sharp nor Chrome.
//
//   npm run assets                 icons + og.png
//   npm run assets -- --screens    also PWA screenshots (needs `npm run build`
//                                  and a local server on :4174)
//
// sharp is borrowed from a sibling project when it is not installed here, the
// same trick spotfast.lowkey.tools uses, so this repo keeps zero runtime deps.

import { execFile } from 'node:child_process';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const icons = join(root, 'src/static/icons');

function loadSharp() {
  const here = createRequire(join(root, 'package.json'));
  try {
    return here('sharp');
  } catch {
    const parent = resolve(root, '..');
    for (const dir of readdirSync(parent)) {
      const pkg = join(parent, dir, 'package.json');
      if (!existsSync(join(parent, dir, 'node_modules/sharp'))) continue;
      try {
        return createRequire(pkg)('sharp');
      } catch {
        /* try next */
      }
    }
  }
  throw new Error('sharp not found. Run `npm i -D sharp` or install it in a sibling project.');
}

const CHROME = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', '/usr/bin/google-chrome', '/usr/bin/chromium'];
const chrome = CHROME.find((p) => existsSync(p));

/** A PNG-in-ICO container: one 32×32 entry, supported by every browser. */
function ico(png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(32, 0);
  entry.writeUInt8(32, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}

async function shot(target, out, w, h, scale = 1) {
  const tmp = join(root, 'scripts', `.shot-${Date.now()}.png`);
  await run(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', `--force-device-scale-factor=${scale}`, `--window-size=${w},${h}`, '--virtual-time-budget=4000', `--screenshot=${tmp}`, target]);
  const sharp = loadSharp();
  await sharp(tmp).resize(w * scale === w ? w : w, h).png({ compressionLevel: 9 }).toFile(out);
  await rm(tmp, { force: true });
  console.log(`${out.replace(root + '/', '')} ${w}x${h}`);
}

/**
 * Screenshot through the DevTools protocol with device emulation, because
 * headless Chrome will not open a window narrower than 500px.
 */
async function cdpShot(url, out, width, height, { mobile = false } = {}) {
  const { spawn } = await import('node:child_process');
  const port = 9300 + Math.floor(Math.random() * 500);
  const profile = join(root, 'scripts', `.chrome-${port}`);
  const proc = spawn(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  try {
    let target;
    for (let i = 0; i < 50 && !target; i++) {
      await new Promise((r) => setTimeout(r, 150));
      try {
        target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page');
      } catch {
        /* not up yet */
      }
    }
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r, { once: true }));
    let id = 0;
    const pending = new Map();
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && pending.has(msg.id)) pending.get(msg.id)(msg.result);
    });
    const send = (method, params = {}) =>
      new Promise((r) => {
        id += 1;
        pending.set(id, r);
        ws.send(JSON.stringify({ id, method, params }));
      });
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
    if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true });
    await send('Page.enable');
    await send('Page.navigate', { url });
    await new Promise((r) => setTimeout(r, 4000));
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    ws.close();
    await loadSharp()(Buffer.from(data, 'base64')).png({ compressionLevel: 9 }).toFile(out);
    console.log(`${out.replace(root + '/', '')} ${width}x${height}`);
  } finally {
    proc.kill();
    await new Promise((r) => setTimeout(r, 300));
    await rm(profile, { recursive: true, force: true });
  }
}

const sharp = loadSharp();
const fav = await readFile(join(icons, 'favicon.svg'));
const mask = await readFile(join(icons, 'maskable.svg'));
for (const [src, name, size] of [
  [fav, 'icon-192.png', 192],
  [fav, 'icon-512.png', 512],
  [fav, 'apple-touch-icon.png', 180],
  [mask, 'maskable-512.png', 512],
]) {
  await sharp(src, { density: 512 }).resize(size, size).png({ compressionLevel: 9 }).toFile(join(icons, name));
  console.log(`${name} ${size}x${size}`);
}
const png32 = await sharp(fav, { density: 256 }).resize(32, 32).png().toBuffer();
await writeFile(join(icons, 'favicon.ico'), ico(png32));
console.log('favicon.ico 32x32');

if (!chrome) console.log('no Chrome found: skipped og.png and screenshots');
else {
  await shot(`file://${join(root, 'scripts/og.html')}`, join(icons, 'og.png'), 1200, 630);
  if (process.argv.includes('--screens')) {
    await cdpShot('http://localhost:4174/calculator?nosw', join(icons, 'screenshot-wide.png'), 1280, 800);
    await cdpShot('http://localhost:4174/?nosw', join(icons, 'screenshot-narrow.png'), 390, 844, { mobile: true });
  }
}
