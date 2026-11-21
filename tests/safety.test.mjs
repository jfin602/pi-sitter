import test from 'node:test';
import assert from 'node:assert/strict';
import { openSupervisorSession, supervisorToolAllowed } from '../src/supervisor-session.ts';

test('supervisor tool boundary rejects writes and commands even when a policy lists them', () => {
  const policy = { allowedMcpTools: ['project_read_file', 'project_write_file', 'project_delete_file',
    'project_run_command', 'bash', 'edit', 'project_inspect_state'], instructions: '' };
  assert.equal(supervisorToolAllowed(policy, 'pi_sitter_inspect'), true);
  for (const name of ['project_read_file', 'project_inspect_state', 'project_write_file', 'project_delete_file', 'project_run_command', 'bash', 'edit'])
    assert.equal(supervisorToolAllowed(policy, name), false, name);
  assert.equal(supervisorToolAllowed(policy, 'project_read_secrets'), false);
});

test('direct MCP adapter is rejected before a supervisor session starts', async () => {
  await assert.rejects(openSupervisorSession({}, {},
    { allowedMcpTools: ['project_inspect_state'], instructions: '' }), /disabled until an adapter is independently qualified/);
});
