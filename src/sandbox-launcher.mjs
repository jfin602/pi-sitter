// Trusted, shell-free launcher inside the bubblewrap PID and mount namespaces.
// The outer verifier owns the executable and literal arguments.
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';

const [file, ...args] = process.argv.slice(2);
const MAX_FILES = 1024;
let scanPromise, breached = false, finished = false;
const child = spawn(file, args, { stdio: 'inherit' });

function countScratch() {
  if (finished) return Promise.resolve();
  if (scanPromise) return scanPromise;
  scanPromise = (async () => {
    try {
    const pending = ['/scratch', '/tmp'];
    let count = 0;
    while (pending.length) {
      const dir = pending.pop();
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (++count > MAX_FILES) {
          breached = true;
          child.kill('SIGKILL');
          return;
        }
        if (entry.isDirectory()) pending.push(`${dir}/${entry.name}`);
      }
    }
    } catch {
      breached = true;
      child.kill('SIGKILL');
    }
  })().finally(() => { scanPromise = undefined; });
  return scanPromise;
}

const interval = setInterval(countScratch, 10);
child.on('error', () => { breached = true; });
child.on('close', async (code, signal) => {
  clearInterval(interval);
  await countScratch();
  await countScratch();
  finished = true;
  process.exit(breached ? 70 : signal ? 71 : code ?? 72);
});
