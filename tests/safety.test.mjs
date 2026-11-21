import test from 'node:test';
import assert from 'node:assert/strict';
import { supervisorToolAllowed } from '../src/supervisor-session.ts';

test('supervisor tool boundary rejects writes and commands even when a policy lists them', () => {
  const policy = { allowedMcpTools: ['project_read_file', 'project_write_file', 'project_delete_file',
    'project_run_command', 'bash', 'edit', 'project_inspect_state'], instructions: '' };
  assert.equal(supervisorToolAllowed(policy, 'pi_sitter_inspect'), true);
  assert.equal(supervisorToolAllowed(policy, 'project_read_file'), true);
  assert.equal(supervisorToolAllowed(policy, 'project_inspect_state'), true);
  for (const name of ['project_write_file', 'project_delete_file', 'project_run_command', 'bash', 'edit'])
    assert.equal(supervisorToolAllowed(policy, name), false, name);
  assert.equal(supervisorToolAllowed(policy, 'project_read_secrets'), false);
});
