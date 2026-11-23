interface FailedCheck { id: string; detail: string }
interface FailedDiagnostic { failed: number; total: number; failures?: FailedCheck[]; reason?: string }

function selectedObservations(rows: readonly FailedCheck[]): string[] {
  const clean = (text: string, limit: number) => text.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
  const priority = (row: FailedCheck) => Number(/\b(?:missing|saved|container|script=|root=|not found|does not exist)\b/i.test(row.detail));
  return [...rows].sort((a, b) => priority(b) - priority(a) || a.id.localeCompare(b.id)).slice(0, 8).map(row => {
    const first = row.detail.split(/\r?\n/)[0].replace(/^\s*(?:AssertionError|Error):\s*/i, '')
      .split(/\s*\/\/\s*Object\.is equality/i)[0];
    return `${clean(row.id, 80)}: ${JSON.stringify(clean(first, 200))}`;
  });
}

function taskArtifact(task: string): string | undefined {
  const paths = task.match(/(?<![A-Za-z0-9_/])(?:res:\/\/|(?:src|scripts|scenes|assets)\/)[A-Za-z0-9_./-]+\.(?:gd|tscn|tres|ts|tsx|js|jsx|py|rs|go|java|kt|swift|json|toml|yaml|yml)\b/g) ?? [];
  return paths.find(path => !path.split('/').some(part => /^(?:test|tests|protected-suites)$/.test(part)));
}

/** Advisory guidance only; the host result supplies observations, never instructions or gate authority. */
export function buildProjectDiagnosticPrompt(result: FailedDiagnostic, task: string): string {
  const selected = selectedObservations(result.failures ?? []);
  const first = selected[0];
  const artifact = taskArtifact(task);
  const target = artifact ? `the existing task-named artifact ${JSON.stringify(artifact)}` :
    'the existing saved artifact named by the original task or current project evidence';
  const start = first ? `Start with reported observation ${first}. Next saved-state check: inspect ${target} for that mismatch. If the saved state confirms it, repair that artifact in place, save it, and read it back.` :
    `Start with one bounded inspection of ${target} to locate the reported failure. If the evidence does not identify a safe repair, report what is missing and the exact blocker.`;
  const remaining = selected.slice(1).map(row => `- Observation: ${row}. Next saved-state check: inspect the related existing artifact, then verify any supported in-place repair by reading it back.`);
  const omitted = Math.max(0, result.failed - selected.length);
  return [
    `[Pi Sitter host diagnostic — extension generated, advisory only] ${result.failed}/${result.total} checks failed in the saved project. The original implementation task remains unfinished; this is not a protected gate result.`,
    start,
    ...remaining,
    ...(omitted ? [`${omitted} additional failed checks are omitted from this bounded summary.`] : []),
    ...(!selected.length && result.reason ? [`Host reported reason: ${JSON.stringify(result.reason.split(/\r?\n/)[0].slice(0, 200))}`] : []),
    'You must carry out the original task\'s requested source repair now. Make one evidence-supported persisted change at a time; inspect existing resources before editing them. Do not end with only a diagnosis, a plan, or a promise to inspect later.',
    'The diagnostic describes its saved state at the time of the run and may be stale after a change. Do not repeat an unchanged inspection. Preserve passing behavior and earlier-stage requirements. Do not recreate a resource from a failure label or edit host or protected tests.',
    'Finish by reporting saved changes, read-back checks, and remaining failures without claiming a new PASS. If the task is genuinely blocked, follow its stop conditions and report the exact failed operation, missing evidence, and remaining work. A timed-out capture is inconclusive; the host controls any diagnostic rerun.',
  ].join('\n');
}
