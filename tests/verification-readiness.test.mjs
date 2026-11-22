import test from 'node:test';
import assert from 'node:assert/strict';
import { approvedPlanId, assessVerificationReadiness, configuredPlanId } from '../src/verification-readiness.ts';

const candidate = { kind: 'candidate', command: 'npm test', source: 'package.json scripts.test',
  script: 'vitest run', tool: 'Vitest' };

test('discovered project tests are informational until a host attests protected verification', () => {
  const unavailable = assessVerificationReadiness({ candidate, controller: false, verifier: false,
    requirementReview: false });
  assert.equal(unavailable.status, 'UNAVAILABLE');
  assert.match(unavailable.summary, /Discovered npm test \(Vitest\)/);
  assert.match(unavailable.summary, /not approved/);
  assert.deepEqual(unavailable.missing, ['trusted controller inventory', 'approved isolated verifier',
    'independent requirement review']);
  const configured = assessVerificationReadiness({ candidate, controller: true, verifier: true,
    requirementReview: true, planId: 'approved-suite' });
  assert.equal(configured.status, 'CONFIGURED');
  const ready = assessVerificationReadiness({ candidate, controller: true, verifier: true,
    requirementReview: true, planId: 'approved-suite', hostCheck: { ready: true } });
  assert.equal(ready.status, 'READY');
  assert.match(ready.summary, /approved-suite/);
  const blocked = assessVerificationReadiness({ candidate, controller: true, verifier: true,
    requirementReview: true, planId: 'approved-suite', hostCheck: { ready: false, reason: 'suite digest changed' } });
  assert.equal(blocked.status, 'UNAVAILABLE');
  assert.match(blocked.summary, /suite digest changed/);
});

test('no-tests and invalid configuration never become ready', () => {
  const noTests = assessVerificationReadiness({ candidate: { kind: 'none' }, controller: false,
    verifier: false, requirementReview: false });
  assert.equal(noTests.status, 'NO_TESTS');
  assert.match(noTests.summary, /UNVERIFIED/);
  const malformed = assessVerificationReadiness({ candidate, controller: false, verifier: false,
    requirementReview: false, configurationError: 'Invalid host config' });
  assert.equal(malformed.status, 'BLOCKED');
  assert.match(malformed.summary, /Invalid host config/);
});

test('plan IDs are identifiers, not commands or paths', () => {
  assert.equal(configuredPlanId('"suite:v1"'), 'suite:v1');
  assert.equal(configuredPlanId(undefined), undefined);
  for (const raw of ['["npm","test"]', '"npm test"', '"/usr/bin/npm"', '{"id":"suite"}', 'bad-json'])
    assert.throws(() => configuredPlanId(raw));
  assert.throws(() => approvedPlanId('suite; rm -rf /'));
});
