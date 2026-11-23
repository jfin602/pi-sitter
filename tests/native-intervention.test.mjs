import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Type } from 'typebox';
import { createAgentSession, DefaultResourceLoader, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent';
import { createFauxCore, fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai/providers/faux';
import { createPiSitter } from '../src/index.ts';
import { piSitterLimits } from '../src/config.ts';

test('native Pi inserts one loop directive into the next Worker model context', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pi-sitter-native-intervention-'));
  const agentDir = join(root, 'agent');
  const oldMode = process.env.PI_SITTER_MODE;
  const oldStage = process.env.PI_SITTER_STAGE;
  process.env.PI_SITTER_MODE = 'active';
  process.env.PI_SITTER_STAGE = 'fixture';
  const faux = createFauxCore({ provider: 'native-intervention-fixture' });
  faux.setResponses([...Array.from({ length: 7 }, (_, index) =>
    fauxAssistantMessage(fauxToolCall('fixture_read', {}, { id: `read-${index}` }), { stopReason: 'toolUse' })),
    fauxAssistantMessage('I stopped the repeated read and report the blocker.')]);
  const fixtureTool = pi => pi.registerTool({ name: 'fixture_read', label: 'Fixture read',
    description: 'Returns the same read-only fixture state', parameters: Type.Object({}),
    execute: async () => ({ content: [{ type: 'text', text: '{"state":"unchanged"}' }] }) });
  let session;
  try {
    const loader = new DefaultResourceLoader({ cwd: root, agentDir, noExtensions: true, noSkills: true,
      noPromptTemplates: true, noThemes: true, noContextFiles: true,
      extensionFactories: [createPiSitter({ limits: { ...piSitterLimits(), maxInferenceAttempts: 0 } }), fixtureTool] });
    await loader.reload();
    ({ session } = await createAgentSession({ cwd: root, agentDir, model: faux.getModel(), resourceLoader: loader,
      settingsManager: SettingsManager.create(root, agentDir), sessionManager: SessionManager.inMemory(root) }));
    const contexts = [];
    session.agent.streamFunction = (model, context, options) => {
      contexts.push(context.messages);
      return faux.streamSimple(model, context, options);
    };
    await session.bindExtensions({});
    await session._startRun({ messageType: 'user', prompt: 'Inspect this fixture and finish the task' });
    const branch = session.sessionManager.getBranch();
    const advisories = branch.filter(entry => entry.type === 'custom_message' && entry.customType === 'pi-sitter-advisory');
    assert.equal(advisories.length, 1);
    assert.equal(contexts.length, 8);
    assert.match(advisories[0].content, /Stop calling fixture_read with \{\}/);
    assert.match(advisories[0].content, /Next: Stop this loop and report the blocker/);
    const copies = messages => messages.filter(message => message.role === 'user' &&
      message.content?.some(part => part.type === 'text' && part.text === advisories[0].content)).length;
    assert.equal(copies(contexts[4]), 0);
    assert.equal(copies(contexts[5]), 1);
    assert.equal(copies(contexts[7]), 1);
    assert.equal(branch.filter(entry => entry.type === 'custom' && entry.customType === 'pi-sitter-delivery-confirmed').length, 1);
  } finally {
    session?.dispose();
    faux.setResponses([]);
    await rm(root, { recursive: true, force: true });
    if (oldMode === undefined) delete process.env.PI_SITTER_MODE; else process.env.PI_SITTER_MODE = oldMode;
    if (oldStage === undefined) delete process.env.PI_SITTER_STAGE; else process.env.PI_SITTER_STAGE = oldStage;
  }
});

test('native Pi Stage 05 long edit failure advises Godot write after a script read', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pi-sitter-native-godot-route-'));
  const agentDir = join(root, 'agent');
  const oldMode = process.env.PI_SITTER_MODE;
  const oldStage = process.env.PI_SITTER_STAGE;
  process.env.PI_SITTER_MODE = 'active';
  process.env.PI_SITTER_STAGE = '05';
  const path = 'res://scripts/main.gd';
  const edit = (id, body) => fauxAssistantMessage(fauxToolCall('edit', {
    oldText: 'x'.repeat(3200), newText: body, path }, { id }), { stopReason: 'toolUse' });
  const faux = createFauxCore({ provider: 'native-godot-route-fixture' });
  faux.setResponses([
    fauxAssistantMessage(fauxToolCall('mcp__godot__godot_scripts_read', { script_path: path }, { id: 'initial-read' }), { stopReason: 'toolUse' }),
    edit('bad-1', 'first replacement'), edit('bad-2', 'first replacement'),
    fauxAssistantMessage(fauxToolCall('mcp__godot__godot_scripts_read', { script_path: path }, { id: 'advised-read' }), { stopReason: 'toolUse' }),
    edit('bad-3', 'changed replacement'),
    fauxAssistantMessage(fauxToolCall('mcp__godot__godot_scripts_write',
      { script_path: path, content: 'extends Node2D\n' }, { id: 'saved-repair' }), { stopReason: 'toolUse' }),
    fauxAssistantMessage('The script was saved through Godot MCP.')
  ]);
  let session;
  try {
    const loader = new DefaultResourceLoader({ cwd: root, agentDir, noExtensions: true, noSkills: true,
      noPromptTemplates: true, noThemes: true, noContextFiles: true,
      extensionFactories: [createPiSitter({ limits: { ...piSitterLimits(), maxInferenceAttempts: 1 },
        diagnose: async (_ctx, input) => ({ kind: 'ready', latencyMs: 0,
          diagnosis: { issue: 'Wrong file tool route', evidence: input.trigger.evidence,
            next_action: 'Read the script again', confidence: 0.9, abstain: false } }) }),
        pi => pi.registerTool({ name: 'mcp__godot__godot_scripts_read', label: 'Godot script read',
          description: 'Read a Godot script', parameters: Type.Object({ script_path: Type.String() }),
          execute: async () => ({ content: [{ type: 'text', text: 'extends Node\n' }] }) }),
        pi => {
          pi.registerTool({ name: 'mcp__godot__godot_scripts_write', label: 'Godot script write',
            description: 'Write a Godot script', parameters: Type.Object({ script_path: Type.String(), content: Type.String() }),
            execute: async () => ({ content: [{ type: 'text', text: '{"saved":true,"dry_run":false,"receipt":{"status":"updated","changes":[{"op":"write","before":"old","after":"new"}]}}' }] }) });
        }] });
    await loader.reload();
    ({ session } = await createAgentSession({ cwd: root, agentDir, model: faux.getModel(), resourceLoader: loader,
      settingsManager: SettingsManager.create(root, agentDir), sessionManager: SessionManager.inMemory(root) }));
    session.agent.streamFunction = (model, context, options) => faux.streamSimple(model, context, options);
    await session.bindExtensions({});
    session.setActiveToolsByName([...session.getActiveToolNames(),
      'mcp__godot__godot_scripts_read', 'mcp__godot__godot_scripts_write']);
    assert.ok(session.getToolDefinition('mcp__godot__godot_scripts_write'), 'fixture write tool was not registered');
    assert.ok(session.getActiveToolNames().includes('mcp__godot__godot_scripts_write'),
      JSON.stringify(session.getActiveToolNames()));
    await session._startRun({ messageType: 'user', prompt: 'Repair res://scripts/main.gd using Godot Editor MCP.' });
    const branch = session.sessionManager.getBranch();
    const advisories = branch.filter(entry => entry.type === 'custom_message' && entry.customType === 'pi-sitter-advisory');
    assert.equal(advisories.length, 1);
    assert.match(advisories[0].content, /Pi edit cannot use "res:\/\/scripts\/main\.gd"/);
    assert.match(advisories[0].content, /godot_scripts_write/);
    assert.doesNotMatch(advisories[0].content, /first replacement|xxxx/);
    const unresolved = branch.findIndex(entry => entry.type === 'custom' && entry.customType === 'pi-sitter-worker-unresolved');
    const recovery = branch.findIndex(entry => entry.type === 'custom' && entry.customType === 'pi-sitter-worker-recovery');
    assert.ok(unresolved > 0);
    assert.ok(recovery > unresolved, 'saved Godot MCP write resolves the advised failure after the wrong-path repeat');
  } finally {
    session?.dispose();
    faux.setResponses([]);
    await rm(root, { recursive: true, force: true });
    if (oldMode === undefined) delete process.env.PI_SITTER_MODE; else process.env.PI_SITTER_MODE = oldMode;
    if (oldStage === undefined) delete process.env.PI_SITTER_STAGE; else process.env.PI_SITTER_STAGE = oldStage;
  }
});
