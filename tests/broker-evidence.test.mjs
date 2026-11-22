import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EvidenceBroker } from '../src/broker.ts';

function provider(inspect = async (root, request) => ({ capability: request.capability, path: request.path,
  ok: true, trust: 'untrusted_project_evidence', evidence: { text: await readFile(join(root, request.path), 'utf8') } })) {
  return { capabilities: new Set(['read_source']), resourceScopes: { read_source: ['main.py'] },
    acceptSnapshotPath: () => true, inspect, validate: async () => ({ facts: {}, errors: [] }) };
}

test('snapshot refuses links, oversized copies and stale source identities', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sitter-custody-'));
  try {
    await writeFile(join(root, 'main.py'), 'first');
    const broker = new EvidenceBroker(root, provider());
    const first = await broker.openSnapshot();
    await first.close();
    assert.throws(() => first.inspect([{ capability: 'read_source', path: 'main.py' }]), /snapshot closed/);
    await writeFile(join(root, 'main.py'), 'second');
    await assert.rejects(broker.inspectSnapshot(first.identity, [{ capability: 'read_source', path: 'main.py' }]), /project changed/);
    await symlink('/etc/passwd', join(root, 'outside'));
    const linkProvider = provider();
    linkProvider.resourceScopes.read_source.push('outside');
    await assert.rejects(new EvidenceBroker(root, linkProvider).openSnapshot(), /symlink/);
    await rm(join(root, 'outside'));
    await writeFile(join(root, 'main.py'), Buffer.alloc(2_000_001));
    await assert.rejects(broker.openSnapshot(), /file too large/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('scopes, output bounds and error results cannot become source evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sitter-scope-'));
  try {
    await writeFile(join(root, 'main.py'), 'public');
    await writeFile(join(root, 'secret.py'), 'secret');
    const broker = new EvidenceBroker(root, provider());
    const snapshot = await broker.openSnapshot();
    try {
      await assert.rejects(snapshot.inspect([{ capability: 'read_source', path: '../secret.py' }]), /path traversal/);
      await assert.rejects(broker.inspectSnapshot(snapshot.identity,
        [{ capability: 'read_source', path: 'secret.py' }], undefined,
        { taskId: 'task', turnId: 'turn' }), /outside approved scope/);
      assert.equal(broker.receipts.at(-1).status, 'denied');
      assert.equal(broker.receipts.at(-1).evidenceRef, undefined);
      const [result] = await broker.inspectSnapshot(snapshot.identity,
        [{ capability: 'read_source', path: 'main.py' }], undefined, { taskId: 'task', turnId: 'turn' });
      assert.equal(result.evidence.text, 'public');
      assert.equal(result.receipt.sourceIdentity, snapshot.identity);
      assert.equal(result.receipt.taskId, 'task');
    } finally { await snapshot.close(); }
    const flood = new EvidenceBroker(root, provider(async (_root, request) => ({ capability: request.capability,
      path: request.path, ok: true, trust: 'untrusted_project_evidence', evidence: { text: 'x'.repeat(65_000) } })));
    await assert.rejects(flood.executeRequests([{ capability: 'read_source', path: 'main.py' }]), /output limit/);
    const failed = new EvidenceBroker(root, provider(async (_root, request) => ({ capability: request.capability,
      path: request.path, ok: true, trust: 'untrusted_project_evidence', error: 'provider failed' })));
    await assert.rejects(failed.executeRequests([{ capability: 'read_source', path: 'main.py' }]), /missing provenance/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
