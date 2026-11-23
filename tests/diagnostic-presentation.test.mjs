import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnosticFinding, readableMarkdown } from '../src/diagnostic-presentation.ts';

test('Markdown blockquotes render without raw markers while literals and fences survive', () => {
  const source = '> Quoted diagnosis\n\\> literal comparison\n```ts\n> code content\nconst path = `res://scenes/meteor.tscn`;\n```\n> **Repair** `MD-METEOR-ROOT`';
  assert.deepEqual(readableMarkdown(source), [
    '│ Quoted diagnosis', '> literal comparison', '┌ code', '│ > code content',
    '│ const path = `res://scenes/meteor.tscn`;', '└', '│ Repair MD-METEOR-ROOT',
  ]);
  assert.match(source, /^> Quoted diagnosis/); // Display conversion never mutates source.
});

test('Stage 04 finding keeps failure, guidance, and repair outcome as distinct facts', () => {
  const row = { id: 'MD-METEOR-ROOT',
    detail: 'AssertionError: Meteor root verification failed: expected FAIL to be PASS\n at host.test:4',
    path: 'scenes/meteor.tscn' };
  const finding = diagnosticFinding(row);
  assert.equal(finding.id, 'MD-METEOR-ROOT');
  assert.equal(finding.path, 'scenes/meteor.tscn');
  assert.equal(finding.expected, undefined); // Ambiguous prose is not structured expected/observed evidence.
  assert.equal(finding.observed, undefined);
  assert.match(finding.explanation, /Meteor root verification failed/);
});

test('structured expected and observed values are used verbatim', () => {
  const finding = diagnosticFinding({ id: 'CHECK', detail: 'Mismatch', expected: 'Node2D',
    observed: 'Area2D', path: 'scenes/meteor.tscn' });
  assert.equal(finding.expected, 'Node2D');
  assert.equal(finding.observed, 'Area2D');
});

test('headings, bullets, and malformed fences stay bounded and readable', () => {
  assert.deepEqual(readableMarkdown('# Diagnostic\n- **Repair** the path\n```ts\n> unfinished fence'),
    ['Diagnostic', '• Repair the path', '┌ code', '│ > unfinished fence']);
});
