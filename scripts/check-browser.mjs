// Optional real-browser regression check. Build first; no browser dependency is
// installed. Uses Chrome/Chromium from CHROME_BIN or the macOS default location.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { start } from './serve.mjs';
import { FIAT_CODES, CRYPTO } from '../src/js/data/money.js';

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profile = await mkdtemp(join(tmpdir(), 'converteasy-browser-'));
const server = start(0);
await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
const chrome = spawn(process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
let launchError;
chrome.on('error', (error) => { launchError = error; });
let socket;
try {
  let port;
  for (let i = 0; i < 100 && !port; i++) {
    if (launchError) throw launchError;
    await pause(100);
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch { /* starting */ }
  }
  assert.ok(port, 'Chrome did not start. Set CHROME_BIN to a Chrome/Chromium executable.');
  const target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await once(socket, 'open');
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const task = pending.get(message.id);
      pending.delete(message.id);
      message.error ? task.reject(new Error(JSON.stringify(message.error))) : task.resolve(message.result);
    } else listeners.get(message.method)?.(message.params);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const next = ++id;
    pending.set(next, { resolve, reject });
    socket.send(JSON.stringify({ id: next, method, params }));
  });
  const evaluate = async (expression) => {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    assert.ok(!response.exceptionDetails, JSON.stringify(response.exceptionDetails));
    return response.result.value;
  };
  const until = async (expression) => {
    for (let i = 0; i < 200; i++) {
      if (await evaluate(expression)) return;
      await pause(50);
    }
    throw new Error(`Timed out: ${expression}`);
  };
  await send('Page.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const rates = Object.fromEntries([...FIAT_CODES, ...CRYPTO.map((c) => c.code)].map((code, i) => [code, String(i + 1)]));
  rates.USD = '1';
  // Delayed, deterministic fixtures: no requests to production rate providers.
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    localStorage.clear();
    window.metrics = { shifts: [], tasks: [], errors: [] };
    addEventListener('error', e => metrics.errors.push(e.message));
    addEventListener('unhandledrejection', e => metrics.errors.push(String(e.reason)));
    new PerformanceObserver(l => l.getEntries().forEach(e => {
      if (!e.hadRecentInput) metrics.shifts.push(e.value);
    })).observe({type:'layout-shift', buffered:true});
    new PerformanceObserver(l => l.getEntries().forEach(e => metrics.tasks.push(e.duration)))
      .observe({type:'longtask', buffered:true});
    const nativeFetch = window.fetch;
    window.fetch = (url, options) => String(url).startsWith('https://')
      ? new Promise((resolve, reject) => setTimeout(() => {
        if (location.search.includes('failrates')) return reject(new Error('Offline fixture'));
        resolve(new Response(JSON.stringify({data:{rates:${JSON.stringify(rates)}}}),
          {headers:{'content-type':'application/json'}}));
      }, 650)) : nativeFetch(url, options);
  ` });
  const navigate = async (path) => {
    await send('Page.navigate', { url: origin + path + (path.includes('?') ? '&' : '?') + 'nosw' });
    await until(`location.pathname === ${JSON.stringify(path.split('?')[0])} && !!document.querySelector('#tool.ready')`);
    await pause(1600);
  };
  const measure = async (label) => {
    const result = await evaluate(`(() => {
      const boxes = ['main','.top-inner','.foot-inner'].map(s => {
        const r = document.querySelector(s).getBoundingClientRect(); return [r.x, r.width];
      });
      return {...metrics, boxes, width: innerWidth,
        overflow: document.documentElement.scrollWidth > innerWidth,
        cls: metrics.shifts.reduce((a,b) => a+b, 0)};
    })()`);
    assert.deepEqual(result.errors, [], label);
    assert.equal(result.overflow, false, `${label}: horizontal overflow`);
    assert.deepEqual(result.boxes[0], result.boxes[1], `${label}: header width`);
    assert.deepEqual(result.boxes[0], result.boxes[2], `${label}: footer width`);
    assert.ok(result.cls < 0.01, `${label}: CLS ${result.cls}`);
    console.log(`${label}: CLS ${result.cls.toFixed(4)}, longest task ${Math.max(0, ...result.tasks)} ms`);
  };
  const paths = ['/', '/calculator', '/units', '/currency', '/crypto-units', '/date-time', '/cooking', '/number-base'];
  for (const width of [390, 600, 768, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    for (const path of paths) {
      await navigate(path);
      await measure(`${width} ${path}`);
      if (process.env.BROWSER_SHOTS_DIR && ['/', '/currency', '/units'].includes(path)) {
        await mkdir(process.env.BROWSER_SHOTS_DIR, { recursive: true });
        const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
        await writeFile(join(process.env.BROWSER_SHOTS_DIR, `${width}-${path.slice(1) || 'home'}.png`), Buffer.from(shot.data, 'base64'));
      }
    }
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 900, deviceScaleFactor: 1, mobile: false });
  for (const path of paths) { await navigate(path); await measure(`320 ${path}`); }

  // Font requests finishing late must not change text metrics after first paint.
  listeners.set('Fetch.requestPaused', ({ requestId }) => {
    setTimeout(() => send('Fetch.continueRequest', { requestId }).catch(() => {}), 1200);
  });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*.woff2*' }] });
  await navigate('/');
  await measure('slow fonts');
  await send('Fetch.disable');
  await navigate('/currency?failrates');
  await measure('failed rates');
  assert.equal(await evaluate(`document.querySelectorAll('.glance-item:disabled').length`), 10);

  await navigate('/calculator');
  const input = (value) => evaluate(`(() => {
    const t = document.querySelector('textarea'); t.value = ${JSON.stringify(value)};
    t.setSelectionRange(t.value.length, t.value.length);
    t.dispatchEvent(new Event('input', {bubbles:true}));
  })()`);
  await evaluate(`document.querySelector('textarea').focus(); document.querySelector('textarea').select()`);
  await send('Input.insertText', { text: '1 cm + 1 m' });
  await until(`document.querySelector('.result-value').textContent === '1.01'`);
  await input('2\nans * 3\nans + 4');
  await until(`document.querySelector('.result-value').textContent === '10'`);
  await evaluate('window.ticks = 0; window.tickTimer = setInterval(() => ticks++, 10); metrics.tasks = []');
  await input(['1', ...Array(499).fill('ans + 1')].join('\n'));
  await until(`document.querySelector('.result-value').textContent === '500' && document.querySelectorAll('.line').length === 500`);
  await pause(150); // Include the subsequent layout/paint in long-task measurements.
  assert.ok(await evaluate('ticks > 0'), 'Long document blocked every timer');
  console.log('500-line calculation:', await evaluate('({ticks, longestTask: Math.max(0, ...metrics.tasks)})'));
  await input(Array(1000).fill('1 cm + 1 m').join('\n'));
  assert.ok(await evaluate(`!document.querySelector('.result-card[aria-busy="true"]') ||
    [...document.querySelectorAll('.result-actions button')].every(b => b.disabled)`), 'Pending result actions must be disabled');
  await input('7 * 8');
  await until(`document.querySelector('.result-value').textContent === '56' && document.querySelectorAll('.line').length === 1`);
  await pause(250);
  assert.equal(await evaluate(`document.querySelector('.result-value').textContent`), '56', 'Stale calculation replaced newer input');
  assert.ok(await evaluate(`[...document.querySelectorAll('.result-actions button')].every(b => !b.disabled)`), 'Result actions must re-enable');
  await evaluate('clearInterval(tickTimer)');

  await navigate('/date-time');
  for (const mode of ['add', 'unix', 'tz', 'diff']) {
    await evaluate(`document.querySelector('[data-mode="${mode}"]').click()`);
    assert.equal(await evaluate(`document.querySelectorAll('.tabpanel:not([hidden])').length`), 1);
  }
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.tabpanel:not([hidden])')).animationName`), 'none');
  assert.deepEqual(await evaluate('metrics.errors'), []);
  console.log('Passed: widths, layout, delayed/failed rates, delayed fonts, calculator cancellation, date tabs and reduced motion.');
} finally {
  socket?.close();
  chrome.kill();
  server.closeAllConnections();
  server.close();
  await pause(250);
  await rm(profile, { recursive: true, force: true });
}
