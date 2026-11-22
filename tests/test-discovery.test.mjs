import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverProjectTestCommand, installedPiSitterVersion } from '../src/test-discovery.ts';

test('read-only discovery identifies project test candidates without granting execution', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pi-sitter-test-discovery-'));
  try {
    assert.deepEqual(discoverProjectTestCommand(root), { kind: 'none' });
    await writeFile(join(root, 'package.json'), JSON.stringify({ scripts: { test: 'vitest run' } }));
    assert.deepEqual(discoverProjectTestCommand(root),
      { kind: 'candidate', command: 'npm test', source: 'package.json scripts.test' });
    await writeFile(join(root, 'package.json'), JSON.stringify({ packageManager: 'pnpm@9.0.0', scripts: { test: 'vitest run' } }));
    assert.deepEqual(discoverProjectTestCommand(root).command, 'pnpm test');
    await writeFile(join(root, 'package.json'), JSON.stringify({ scripts: { test: 'echo "Error: no test specified" && exit 1' } }));
    assert.deepEqual(discoverProjectTestCommand(root), { kind: 'none' });
    await writeFile(join(root, 'package.json'), '{');
    assert.equal(discoverProjectTestCommand(root).kind, 'unknown');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Python and compiled project markers are candidates; links and unreadable manifests are unknown', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pi-sitter-test-markers-'));
  try {
    await mkdir(join(root, 'tests'));
    await writeFile(join(root, 'tests', 'test_slug.py'), 'def test_slug(): pass\n');
    assert.deepEqual(discoverProjectTestCommand(root), { kind: 'candidate', command: 'pytest', source: 'tests/*.py' });
    await rm(join(root, 'tests'), { recursive: true, force: true });
    await writeFile(join(root, 'Cargo.toml'), '[package]\nname="fixture"\n');
    assert.deepEqual(discoverProjectTestCommand(root), { kind: 'candidate', command: 'cargo test', source: 'Cargo.toml' });
    await rm(join(root, 'Cargo.toml'));
    await symlink('/etc', join(root, 'tests'));
    assert.equal(discoverProjectTestCommand(root).kind, 'unknown');
    await rm(join(root, 'tests'));
    await symlink('/etc/passwd', join(root, 'package.json'));
    assert.equal(discoverProjectTestCommand(root).kind, 'unknown');
    assert.match(installedPiSitterVersion(), /^\d+\.\d+\.\d+$/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
