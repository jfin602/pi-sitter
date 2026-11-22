import { lstatSync, opendirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type TestDiscovery =
  | { kind: 'candidate'; command: string; source: string }
  | { kind: 'none' }
  | { kind: 'unknown'; reason: string };

const MAX_MANIFEST_BYTES = 64 * 1024;

function regularFile(root: string, name: string): boolean | 'unknown' {
  try {
    const stat = lstatSync(join(root, name));
    return stat.isSymbolicLink() ? 'unknown' : stat.isFile() ? stat.size <= MAX_MANIFEST_BYTES ? true : 'unknown' : false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    return 'unknown';
  }
}

function manifest(root: string, name: string): string | false | 'unknown' {
  const exists = regularFile(root, name);
  if (exists !== true) return exists;
  try { return readFileSync(join(root, name), 'utf8'); }
  catch { return 'unknown'; }
}

/** Read only familiar project markers. Discovery never executes a project command. */
export function discoverProjectTestCommand(root: string): TestDiscovery {
  const packageText = manifest(root, 'package.json');
  if (packageText === 'unknown') return { kind: 'unknown', reason: 'package.json could not be inspected safely' };
  if (packageText !== false) {
    let parsed: unknown;
    try { parsed = JSON.parse(packageText); }
    catch { return { kind: 'unknown', reason: 'package.json is invalid' }; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return { kind: 'unknown', reason: 'package.json is invalid' };
    const pkg = parsed as { scripts?: unknown; packageManager?: unknown };
    const scripts = pkg.scripts && typeof pkg.scripts === 'object' && !Array.isArray(pkg.scripts) ?
      pkg.scripts as Record<string, unknown> : {};
    const test = scripts.test;
    if (typeof test === 'string' && test.trim() && !/^echo\s+["']?error:\s+no test specified/i.test(test.trim())) {
      const manager = typeof pkg.packageManager === 'string' ? pkg.packageManager.split('@')[0] : 'npm';
      const command = ['npm', 'pnpm', 'yarn', 'bun'].includes(manager) ? `${manager} test` : 'npm test';
      return { kind: 'candidate', command, source: 'package.json scripts.test' };
    }
  }

  for (const [name, command] of [
    ['pytest.ini', 'pytest'], ['tox.ini', 'tox'], ['Cargo.toml', 'cargo test'], ['go.mod', 'go test ./...'],
  ] as const) {
    const found = regularFile(root, name);
    if (found === 'unknown') return { kind: 'unknown', reason: `${name} could not be inspected safely` };
    if (found) return { kind: 'candidate', command, source: name };
  }
  const pyproject = manifest(root, 'pyproject.toml');
  if (pyproject === 'unknown') return { kind: 'unknown', reason: 'pyproject.toml could not be inspected safely' };
  if (pyproject !== false && /^\[tool\.pytest\.ini_options\]/m.test(pyproject))
    return { kind: 'candidate', command: 'pytest', source: 'pyproject.toml' };

  try {
    const stat = lstatSync(join(root, 'tests'));
    if (stat.isSymbolicLink()) return { kind: 'unknown', reason: 'tests directory is a symlink' };
    if (stat.isDirectory()) {
      const directory = opendirSync(join(root, 'tests'));
      try {
        for (let count = 0; count < 256; count++) {
          const entry = directory.readSync();
          if (!entry) break;
          if (entry.isFile() && /^(?:test_.*|.*_test)\.py$/.test(entry.name))
            return { kind: 'candidate', command: 'pytest', source: 'tests/*.py' };
        }
      } finally { directory.closeSync(); }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      return { kind: 'unknown', reason: 'tests directory could not be inspected' };
  }
  return { kind: 'none' };
}

export function installedPiSitterVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version?: unknown };
    return typeof pkg.version === 'string' && /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(pkg.version) ? pkg.version : 'unknown';
  } catch { return 'unknown'; }
}
