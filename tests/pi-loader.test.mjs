import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DefaultResourceLoader, createAgentSession, SessionManager, SettingsManager }
  from '@earendil-works/pi-coding-agent';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('installed Pi discovers Pi Sitter from its manifest in an unrelated project', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pi-sitter-independent-'));
  const agentDir = join(root, 'agent-config');
  const project = join(root, 'sample-project');
  try {
    await mkdir(agentDir);
    await mkdir(project);
    await writeFile(join(project, 'main.ts'), 'export const answer = 42;\n');
    const loader = new DefaultResourceLoader({ cwd: project, agentDir,
      additionalExtensionPaths: [packageRoot], noExtensions: true, noSkills: true,
      noPromptTemplates: true, noThemes: true, noContextFiles: true });
    await loader.reload();
    const { session } = await createAgentSession({ cwd: project, agentDir, resourceLoader: loader,
      settingsManager: SettingsManager.create(project, agentDir), sessionManager: SessionManager.inMemory(project) });
    try {
      await session.bindExtensions({});
      const runner = session.extensionRunner;
      assert.ok(runner.getExtensionPaths().some(path => path.endsWith('/src/index.ts')));
      assert.ok(runner.getRegisteredCommands().some(command => command.name === 'sitter'));
      assert.equal(runner.hasHandlers('tool_execution_end'), true);
      assert.equal(runner.hasHandlers('agent_before_settle'), true);
      assert.equal(runner.hasHandlers('session_shutdown'), true);
      assert.equal(session.agent.state.messages.length, 0);
    } finally { session.dispose(); }
  } finally { await rm(root, { recursive: true, force: true }); }
});
