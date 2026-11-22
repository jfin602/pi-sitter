import test from 'node:test';
import assert from 'node:assert/strict';
import { InterventionLifecycle } from '../src/intervention-lifecycle.ts';

const started = { id: 'one', phase: 'started', trigger: 'T1:failure', stage: 'current',
  description: 'Investigating repeated tool failure…' };

test('duplicate starts and late terminal events cannot change a settled intervention', () => {
  const lifecycle = new InterventionLifecycle();
  assert.equal(lifecycle.apply(started), true);
  assert.equal(lifecycle.apply({ ...started }), false);
  const completed = { ...started, phase: 'completed', issue: 'Repeated tool failure' };
  assert.equal(lifecycle.apply(completed), true);
  assert.equal(lifecycle.apply({ ...completed, phase: 'failed' }), false);
  assert.equal(lifecycle.apply({ ...started }), false);
  assert.deepEqual(lifecycle.get('one'), completed);
  assert.deepEqual(lifecycle.active(), []);
});

test('a terminal event without a start is retained and replayed', () => {
  const lifecycle = new InterventionLifecycle();
  const terminal = { ...started, phase: 'completed', issue: 'Recovered result' };
  assert.equal(lifecycle.apply(terminal), true);
  assert.equal(lifecycle.hasStart('one'), false);
  assert.deepEqual(lifecycle.get('one'), terminal);
  assert.equal(lifecycle.apply(started), false);
});

test('replay closes an orphaned pending attempt without inventing a diagnosis', () => {
  const lifecycle = new InterventionLifecycle();
  lifecycle.apply(started);
  lifecycle.interruptPending('Session ended before result');
  assert.equal(lifecycle.get('one').phase, 'cancelled');
  assert.equal(lifecycle.get('one').reason, 'Session ended before result');
  assert.equal(lifecycle.get('one').issue, undefined);
});
