import type { ControllerContext } from './controller-context.ts';
import type { TestObservation, TrustedRunInput } from './gates.ts';

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const bounded = (value: unknown, limit: number): string => typeof value === 'string' ? value.slice(0, limit) : '';

/** Translate Vitest's JSON reporter, keeping the controller manifest as the only gate authority. */
export function adaptVitestReport(input: unknown, context: ControllerContext): TrustedRunInput {
  const bad = (reason: string): never => { throw new Error(`Blocked Vitest report: ${reason}`); };
  let size: number;
  try { size = JSON.stringify(input).length; } catch { return bad('unserializable report'); }
  if (size > 1024 * 1024) return bad('oversized report');
  if (!object(input) || input.format !== 'vitest-json' || !object(input.vitest) ||
      typeof input.runId !== 'string' || input.runId.length > 128 ||
      input.taskId !== context.taskId || input.stage !== context.stage ||
      input.snapshotIdentity !== context.sourceSnapshot || !object(input.suite) ||
      input.suite.id !== context.suite.id || input.suite.version !== context.suite.version ||
      input.suite.digest !== context.suite.digest || !object(input.execution)) return bad('missing or stale identity');
  if (Object.keys(input).sort().join(',') !== 'execution,format,runId,snapshotIdentity,stage,suite,taskId,vitest')
    return bad('unexpected envelope field');
  const vitest = input.vitest;
  if (!Array.isArray(vitest.testResults) || vitest.testResults.length === 0) return bad('empty suite');
  const suiteStatus = vitest.testResults.map(value => object(value) ? value.status : undefined);
  if (vitest.numTotalTestSuites !== vitest.testResults.length ||
      vitest.numPassedTestSuites !== suiteStatus.filter(value => value === 'passed').length ||
      vitest.numFailedTestSuites !== suiteStatus.filter(value => value === 'failed').length ||
      vitest.numPendingTestSuites !== suiteStatus.filter(value => value === 'pending').length ||
      vitest.success !== (vitest.numFailedTests === 0 && vitest.numFailedTestSuites === 0) ||
      vitest.success !== (input.execution.exitCode === 0)) return bad('inconsistent suite status');
  const observed = new Map<string, TestObservation>();
  let passed = 0, failed = 0, skipped = 0;
  for (const suite of vitest.testResults) {
    if (!object(suite) || !Array.isArray(suite.assertionResults) || !suite.assertionResults.length ||
        !['passed', 'failed', 'pending'].includes(String(suite.status))) return bad('suite crash or malformed suite');
    for (const row of suite.assertionResults) {
      if (!object(row) || typeof row.fullName !== 'string' || !row.fullName || observed.has(row.fullName))
        return bad('missing or duplicate test ID');
      if (!['passed', 'failed', 'pending', 'skipped', 'todo'].includes(String(row.status))) return bad('invalid assertion status');
      const result: TestObservation['result'] = row.status === 'passed' ? 'PASS' : row.status === 'failed' ? 'FAIL' : 'SKIP';
      if (result === 'PASS') passed++; else if (result === 'FAIL') failed++; else skipped++;
      const messages = row.failureMessages;
      if (messages !== undefined && (!Array.isArray(messages) || messages.some(message => typeof message !== 'string')))
        return bad('malformed failure messages');
      const detail = Array.isArray(row.failureDetails) && object(row.failureDetails[0]) ? row.failureDetails[0] : undefined;
      const location = object(row.location) ? row.location : undefined;
      const message = bounded((messages as string[] | undefined)?.join('\n') || detail?.message, 4096);
      if (result === 'FAIL' && !message) return bad('failed assertion lacks diagnostic');
      const stackLocation = typeof suite.name === 'string' ? message.match(/\bat (\/[^\s:]+):(\d+):(\d+)/) : null;
      const diagnostic = result === 'FAIL' ? { message, ...(detail?.expected === undefined ? {} : { expected: bounded(String(detail.expected), 4096) }),
        ...(detail?.actual === undefined ? {} : { actual: bounded(String(detail.actual), 4096) }),
        ...(typeof suite.name === 'string' ? { path: bounded(stackLocation?.[1] ?? suite.name, 1024) } : {}),
        ...(Number.isSafeInteger(location?.line) && (location!.line as number) > 0 ? { line: location!.line as number } :
          stackLocation ? { line: Number(stackLocation[2]) } : {}),
        ...(typeof row.logRef === 'string' ? { logRef: bounded(row.logRef, 1024) } : {}),
        ...(typeof row.artifactRef === 'string' ? { artifactRef: bounded(row.artifactRef, 1024) } : {}) } : undefined;
      observed.set(row.fullName, { id: row.fullName, result,
        evidence: result === 'PASS' ? `Vitest passed ${row.fullName}` : result === 'FAIL' ? message : '',
        ...(diagnostic ? { diagnostic } : {}) });
    }
    const assertionStatuses = suite.assertionResults.map(row => object(row) ? row.status : undefined);
    if ((suite.status === 'passed' && assertionStatuses.includes('failed')) ||
        (suite.status === 'pending' && assertionStatuses.some(status => status === 'passed' || status === 'failed')))
      return bad('suite and assertion status disagree');
  }
  const number = (key: string): number => {
    const value = vitest[key];
    if (!Number.isSafeInteger(value) || (value as number) < 0) return bad(`invalid ${key}`);
    return value as number;
  };
  if (number('numTotalTests') !== observed.size || number('numPassedTests') !== passed ||
      number('numFailedTests') !== failed || number('numPendingTests') + number('numTodoTests') !== skipped)
    return bad('spoofed Vitest counts');
  const required = new Set(context.suite.gates.flatMap(gate => gate.testIds));
  if (observed.size !== required.size || [...observed.keys()].some(id => !required.has(id))) return bad('unknown or missing mandatory test');
  return { schemaVersion: 2, taskId: input.taskId as string, runId: input.runId as string,
    stage: input.stage as string, snapshotIdentity: input.snapshotIdentity as string,
    suite: input.suite as TrustedRunInput['suite'], execution: input.execution as TrustedRunInput['execution'],
    testCounts: { executed: passed + failed, skipped, passed, failed },
    gates: context.suite.gates.map(gate => ({ id: gate.id, tests: gate.testIds.map(id => observed.get(id)!) })) };
}
