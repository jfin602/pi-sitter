import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAgentSession, DefaultResourceLoader, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent';
import { McpClient } from '@earendil-works/pi-mcp';
import { getModel } from '@earendil-works/pi-ai/compat';
import { createInMemoryTransportPair } from '@earendil-works/pi-mcp/testing';
import { createMcpExtension } from '../node_modules/@earendil-works/pi-coding-agent/dist/extensions/mcp/index.js';
import { McpReadDispatcher, mcpSchemaDigest } from '../src/mcp-read.ts';
import { openSupervisorSession } from '../src/supervisor-session.ts';

function fixtureServer(pair, counts) {
  pair.server.onMessage(message => {
    if (!('id' in message)) return;
    let result;
    if (message.method === 'initialize') result = { protocolVersion: '2025-11-25', capabilities: { tools: {} },
      serverInfo: { name: 'controlled-fixture', version: '1.0.0' } };
    else if (message.method === 'tools/list') result = { tools: [
      { name: 'read', description: 'Read public fixture', annotations: { readOnlyHint: false },
        inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
      { name: 'write', description: 'Mutate fixture', annotations: { readOnlyHint: true },
        inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
    ] };
    else if (message.method === 'tools/call') {
      const name = message.params.name;
      counts[name] = (counts[name] ?? 0) + 1;
      result = { content: [{ type: 'text', text: name === 'read' ? 'controlled public text' : 'mutated' }] };
    } else return;
    void pair.server.send({ jsonrpc: '2.0', id: message.id, result });
  });
  return pair.server.start();
}

test('real Pi worker MCP and independent vetted host read reach the controlled server; mutation is refused', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pi-sitter-mcp-'));
  const counts = {};
  const workerPair = createInMemoryTransportPair();
  const hostPair = createInMemoryTransportPair();
  await fixtureServer(workerPair, counts);
  await fixtureServer(hostPair, counts);
  const hostClient = new McpClient({ name: 'pi-sitter-host-fixture', version: '1.0.0' });
  let session;
  try {
    const loader = new DefaultResourceLoader({ cwd: root, agentDir: join(root, 'agent'), noExtensions: true,
      noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
      extensionFactories: [createMcpExtension({
        loadConfig: () => ({ servers: [{ name: 'fixture', source: 'trusted-fixture', scope: 'global',
          config: { command: 'unused', exposure: 'direct' } }], errors: [] }),
        createTransport: () => workerPair.client,
      })] });
    await loader.reload();
    ({ session } = await createAgentSession({ cwd: root, agentDir: join(root, 'agent'), resourceLoader: loader,
      settingsManager: SettingsManager.create(root, join(root, 'agent')), sessionManager: SessionManager.inMemory(root) }));
    await session.bindExtensions({});
    await hostClient.connect(hostPair.client);
    for (let i = 0; i < 100 && !session.getAllTools().some(tool => tool.name === 'mcp__fixture__read'); i++)
      await new Promise(resolve => setTimeout(resolve, 10));
    const workerTools = session.getAllTools();
    const read = workerTools.find(tool => tool.name === 'mcp__fixture__read');
    const write = workerTools.find(tool => tool.name === 'mcp__fixture__write');
    assert.ok(read && write);
    assert.equal(write.annotations?.readOnlyHint, true);
    const workerRead = session.agent.state.tools.find(tool => tool.name === read.name);
    assert.ok(workerRead);
    const workerResult = await workerRead.execute('worker-read', { path: 'public' });
    assert.match(JSON.stringify(workerResult), /controlled public text/);
    const receipts = [];
    const dispatcher = new McpReadDispatcher({ taskId: 'task', turnId: 'turn', sourceIdentity: 'source',
      getWorkerTools: () => session.getAllTools(), getWorkerServerIdentity: () => 'trusted-fixture',
      record: receipt => receipts.push(receipt),
      operations: [{ name: read.name, serverIdentity: 'trusted-fixture', sourcePath: read.sourceInfo.path, schemaDigest: mcpSchemaDigest(read.parameters), resourceScopes: ['fixture://public'],
        authorize: async args => {
          if (Object.keys(args).join(',') !== 'path' || args.path !== 'public') throw new Error('denied');
          return { resource: 'fixture://public', args: { path: 'public' } };
        },
        execute: async (args, signal) => hostClient.callTool('read', args, { signal }),
        sanitize: result => result.content[0].text,
      }] });
    assert.equal(await dispatcher.dispatch(read.name, { path: 'public' }), 'controlled public text');
    await assert.rejects(dispatcher.dispatch(write.name, { path: 'public' }), /denied/);
    await assert.rejects(dispatcher.dispatch(read.name, { path: 'public', nested: { tool: write.name } }), /denied/);
    assert.deepEqual(counts, { read: 2 });
    assert.deepEqual(receipts.map(receipt => receipt.status), ['allowed', 'denied', 'denied']);
    assert.equal(session.agent.state.messages.length, 0);
    assert.ok(session.getAllTools().some(tool => tool.name === write.name));
    const child = await openSupervisorSession({ model: getModel('anthropic', 'claude-sonnet-4-5'),
      thinkingLevel: 'off' }, { inspect: async () => [], identity: 'source' }, {
      allowedMcpTools: [], instructions: '', mcpRead: { taskId: 'task', turnId: 'turn', sourceIdentity: 'source',
        getWorkerTools: () => session.getAllTools(), getWorkerServerIdentity: () => 'trusted-fixture',
        record: receipt => receipts.push(receipt),
        operations: [{ name: read.name, serverIdentity: 'trusted-fixture', sourcePath: read.sourceInfo.path, schemaDigest: mcpSchemaDigest(read.parameters), resourceScopes: ['fixture://public'],
          authorize: async () => ({ resource: 'fixture://public', args: { path: 'public' } }),
          execute: async (args, signal) => hostClient.callTool('read', args, { signal }),
          sanitize: result => result.content[0].text }] },
    });
    try {
      assert.deepEqual([...child.availableToolNames].sort(), ['pi_sitter_inspect', 'pi_sitter_mcp_read']);
      assert.match(child.unavailableMcpTools[write.name], /no host-vetted operation policy/);
      assert.equal(session.agent.state.messages.length, 0);
    } finally { await child.close(); }
  } finally {
    session?.dispose();
    await hostClient.close();
    await rm(root, { recursive: true, force: true });
  }
});
