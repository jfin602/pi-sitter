/** Presentation only. Host diagnostic text and Worker instructions remain separate, unchanged fields. */
export interface DiagnosticFinding {
  id: string;
  detail: string;
  expected?: string;
  observed?: string;
  path?: string;
}

export function diagnosticFinding(row: DiagnosticFinding): {
  title: string; id: string; explanation: string; path?: string;
  expected?: string; observed?: string;
} {
  const first = row.detail.split(/\r?\n/, 1)[0].replace(/^\s*(?:AssertionError|Error):\s*/i, '').trim();
  const title = first.split(/:\s|: expected\b/i)[0].trim() || 'Diagnostic check failed';
  return { title, id: row.id, explanation: first || 'The host reported a failed check.',
    path: row.path, ...(row.expected === undefined || row.observed === undefined ? {} :
      { expected: row.expected, observed: row.observed }) };
}

/** A small, bounded Markdown display parser for the syntax present in Pi Sitter prompts. */
export function readableMarkdown(source: string): string[] {
  let fence: string | undefined;
  return safeRawLines(source).map(line => {
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) {
      if (!fence) { fence = marker[0]; return '┌ code'; }
      if (marker[0] === fence) { fence = undefined; return '└'; }
    }
    if (fence) return `│ ${line}`;
    // A backslash escape is an intentional literal greater-than sign.
    return line.replace(/^\s{0,3}> ?/, '│ ').replace(/^\\>/, '>')
      .replace(/^\s{0,3}#{1,6} +/, '').replace(/^(\s*)[-*+] +/, '$1• ')
      .replace(/\*\*([^*\n]+)\*\*/g, '$1').replace(/\*([^*\n]+)\*/g, '$1')
      .replace(/`([^`\n]+)`/g, '$1');
  });
}

/** Raw view retains every printable byte; terminal controls are shown as escapes. */
export function safeRawLines(source: string): string[] {
  return source.replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g,
    c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`).split('\n');
}
