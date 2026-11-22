import test from 'node:test';
import assert from 'node:assert/strict';
import { McpReadDispatcher, discoverMcpReads, mcpSchemaDigest } from '../src/mcp-read.ts';

const schema = { type: 'object', properties: { path: { type: 'string' }, route: { type: 'string' } }, required: ['path'] };
const metadata = { name: 'mcp__fixture__read', exposure: 'deferred', parameters: schema,
  annotations: { readOnlyHint: false }, sourceInfo: { path: 'builtin:mcp', source: 'builtin', scope: 'user', origin: 'top-level' } };

function fixture() {
  const receipts = [];
  const calls = [];
  let tools = [metadata];
    const host = { taskId: 'task-1', turnId: 'turn-1', sourceIdentity: 'source-1', getWorkerTools: () => tools,
    getWorkerServerIdentity: () => 'controlled-server',
    record: receipt => receipts.push(receipt), operations: [{ name: metadata.name, serverIdentity: 'controlled-server', sourcePath: 'builtin:mcp', resourceScopes: ['file:///docs/public.txt'],
      schemaDigest: mcpSchemaDigest(schema),
      authorize: async args => {
        if (Object.keys(args).sort().join(',') !== 'path' || args.path !== 'docs/public.txt')
          throw new Error('secret resource or indirect route');
        return { resource: 'file:///docs/public.txt', args: { path: args.path } };
      },
      execute: async args => { calls.push(args); return { content: [{ type: 'text', text: 'public evidence' }] }; },
      sanitize: result => result.content[0].text,
    }] };
  return { host, receipts, calls, setTools: next => { tools = next; } };
}

test('vetted MCP operation matches worker source and schema and enforces concrete arguments', async () => {
  const { host, receipts, calls } = fixture();
  const dispatcher = new McpReadDispatcher(host);
  assert.deepEqual(discoverMcpReads(host).allowed, ['mcp__fixture__read']);
  assert.equal(await dispatcher.dispatch('mcp__fixture__read', { path: 'docs/public.txt' }), 'public evidence');
  for (const args of [{ path: 'docs/secret.txt' }, { path: 'docs/public.txt', route: 'mcp__fixture__write' },
    { path: 'docs/public.txt', nested: { tool: 'write' } }]) {
    await assert.rejects(dispatcher.dispatch('mcp__fixture__read', args), /denied by host policy/);
  }
  await assert.rejects(dispatcher.dispatch('mcp__fixture__write', { path: 'docs/public.txt' }), /denied by host policy/);
  assert.equal(calls.length, 1);
  assert.deepEqual(receipts.map(receipt => receipt.status), ['allowed', 'denied', 'denied', 'denied', 'denied']);
  assert.ok(receipts.every(receipt => !JSON.stringify(receipt).includes('secret.txt')));
  assert.ok(receipts[0].argsDigest && receipts[0].resultDigest && receipts[0].resourceDigest && receipts[0].serverDigest);
});

test('annotations, active exposure, schema drift and server errors cannot authorize a call', async () => {
  const { host, calls, receipts, setTools } = fixture();
  host.getWorkerServerIdentity = () => undefined;
  assert.deepEqual(discoverMcpReads(host).allowed, []);
  host.getWorkerServerIdentity = () => 'controlled-server';
  setTools([{ ...metadata, parameters: { type: 'object' }, annotations: { readOnlyHint: true } }]);
  assert.deepEqual(discoverMcpReads(host).allowed, []);
  await assert.rejects(new McpReadDispatcher(host).dispatch(metadata.name, { path: 'docs/public.txt' }), /denied/);
  setTools([metadata]);
  host.operations[0].execute = async () => ({ isError: true, content: [{ type: 'text', text: 'TOKEN=secret' }] });
  await assert.rejects(new McpReadDispatcher(host).dispatch(metadata.name, { path: 'docs/public.txt' }), /failed/);
  assert.equal(calls.length, 0);
  assert.ok(receipts.every(receipt => !JSON.stringify(receipt).includes('TOKEN=secret')));
});

test('host authorization cannot redirect outside an explicit resource scope', async () => {
  const { host, calls, receipts } = fixture();
  host.operations[0].authorize = async () => ({ resource: 'file:///docs/secret.txt', args: { path: 'docs/secret.txt' } });
  await assert.rejects(new McpReadDispatcher(host).dispatch(metadata.name, { path: 'docs/public.txt' }), /denied/);
  assert.equal(calls.length, 0);
  assert.equal(receipts[0].status, 'denied');
  assert.equal(receipts[0].resultDigest, undefined);
  assert.ok(receipts[0].timestamp);
});
