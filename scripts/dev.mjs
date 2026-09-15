// Dev loop: build, serve like production, rebuild when src/ or scripts/ change.
//
//   npm run dev   → http://localhost:4174/
//
// Add ?nosw to a URL to skip the service worker while iterating.

import { watch } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { start } from './serve.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function rebuild() {
  return new Promise((ok) => {
    const p = spawn(process.execPath, [join(root, 'scripts/build.mjs')], { stdio: 'inherit' });
    p.on('exit', ok);
  });
}

await rebuild();
start(Number(process.argv[2] ?? 4174));

let timer;
let running = false;
let again = false;
const trigger = () => {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    if (running) return (again = true);
    running = true;
    await rebuild();
    running = false;
    if (again) (again = false), trigger();
  }, 150);
};
for (const dir of ['src', 'scripts']) watch(join(root, dir), { recursive: true }, trigger);
