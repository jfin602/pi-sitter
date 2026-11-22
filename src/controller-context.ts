/** Internal host ingress. The embedding controller, not session/model content, owns these facts. */
export interface ControllerContext {
  schemaVersion: 1;
  taskId: string;
  stage: string;
  originalTask: {
    text: string;
    reference: string;
    version: string;
    requirements: { id: string; text: string }[];
  };
  suite: { id: string; version: string; digest: string; gates: { id: string; requirementIds: string[]; testIds: string[] }[] };
  sourceSnapshot: string;
}

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SHA = /^[a-f0-9]{64}$/;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const string = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;
const id = (value: unknown): value is string => string(value, 128) && ID.test(value);
const unique = (items: string[]): boolean => new Set(items).size === items.length;

export function validateControllerContext(value: unknown, stage: string): ControllerContext {
  if (!object(value) || value.schemaVersion !== 1 || !id(value.taskId) || value.stage !== stage ||
      !object(value.originalTask) || !object(value.suite) || !string(value.sourceSnapshot, 64) || !SHA.test(value.sourceSnapshot))
    throw new Error('Missing or invalid trusted controller task, stage, or source identity');
  const task = value.originalTask;
  const suite = value.suite;
  if (!string(task.text, 65536) || !string(task.reference, 512) || !id(task.version) ||
      !Array.isArray(task.requirements) || task.requirements.length < 1 || task.requirements.length > 256 ||
      !id(suite.id) || !id(suite.version) || !string(suite.digest, 64) || !SHA.test(suite.digest) ||
      !Array.isArray(suite.gates) || suite.gates.length < 1 || suite.gates.length > 256)
    throw new Error('Trusted controller inventory is incomplete or oversized');
  const requirements: { id: string; text: string }[] = [];
  for (const row of task.requirements) {
    if (!object(row) || !id(row.id) || !string(row.text, 8192) || !task.text.includes(row.text))
      throw new Error('Invalid or unanchored original requirement');
    requirements.push({ id: row.id, text: row.text });
  }
  if (!unique(requirements.map(row => row.id))) throw new Error('Duplicate requirement ID');
  const gates: { id: string; requirementIds: string[]; testIds: string[] }[] = [];
  let totalTests = 0;
  for (const row of suite.gates) {
    if (!object(row) || !id(row.id) || !Array.isArray(row.requirementIds) || !Array.isArray(row.testIds) ||
        row.requirementIds.length < 1 || row.testIds.length < 1 || row.testIds.length > 256 ||
        !row.requirementIds.every(id) || !row.testIds.every(id) || !unique(row.requirementIds) || !unique(row.testIds) ||
        !row.requirementIds.every(item => requirements.some(req => req.id === item)))
      throw new Error('Invalid trusted gate or test inventory');
    totalTests += row.testIds.length;
    gates.push({ id: row.id, requirementIds: [...row.requirementIds], testIds: [...row.testIds] });
  }
  if (totalTests > 1024 || !unique(gates.map(row => row.id)) || !unique(gates.flatMap(row => row.testIds)))
    throw new Error('Duplicate or oversized mandatory test inventory');
  return {
    schemaVersion: 1, taskId: value.taskId, stage,
    originalTask: { text: task.text, reference: task.reference, version: task.version, requirements },
    suite: { id: suite.id, version: suite.version, digest: suite.digest, gates }, sourceSnapshot: value.sourceSnapshot,
  };
}
