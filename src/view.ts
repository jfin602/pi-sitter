import type { Trigger, PiSitterMode } from './core.ts';
import { installedPiSitterVersion } from './test-discovery.ts';

const VERSION = installedPiSitterVersion();

export type PanelPhase = 'sleeping' | 'triggered' | 'streaming' | 'ready' | 'delivered' | 'abstained' | 'timeout' | 'error';

export interface PanelStats {
  mode: PiSitterMode;
  remaining: number;
  calls: number;
  delivered: number;
  failed: number;
  abstained: number;
  latencyMs: number;
}

export class PiSitterView {
  phase: PanelPhase = 'sleeping';
  expanded = false;
  latest?: Trigger;
  streamed = '';
  result = '';

  reset(): void {
    this.phase = 'sleeping';
    this.expanded = false;
    this.latest = undefined;
    this.streamed = '';
    this.result = '';
  }

  trigger(value: Trigger): void {
    this.latest = value;
    this.phase = 'triggered';
    this.streamed = '';
    this.result = '';
  }

  stream(text: string): void {
    if (!this.latest) return;
    this.phase = 'streaming';
    this.streamed = text.slice(0, 1200);
  }

  finish(phase: Extract<PanelPhase, 'ready' | 'delivered' | 'abstained' | 'timeout' | 'error'>, result: string): void {
    this.phase = phase;
    this.result = result.slice(0, 400);
  }

  toggle(): void { this.expanded = !this.expanded; }

  status(mode: PiSitterMode, count: number): string {
    if (mode === 'off') return `Pi Sitter v${VERSION} off`;
    return `Pi Sitter v${VERSION} ${mode} | ${this.phase} | ${count} trigger${count === 1 ? '' : 's'}`;
  }

  lines(stats: PanelStats): string[] | undefined {
    if (!this.expanded) return;
    const lines = [`Pi Sitter | ${stats.mode} | ${this.phase}`,
      `Delivered ${stats.delivered} | failed ${stats.failed} | abstained ${stats.abstained}`,
      `Inferences ${stats.calls} | latency ${stats.latencyMs} ms | intervention budget ${stats.remaining}`];
    if (!this.latest) return [...lines, 'Waiting for meaningful evidence.'];
    lines.push(`${this.latest.type} | ${this.latest.tool}`);
    lines.push(this.latest.evidence);
    if (this.phase === 'triggered') lines.push('Trigger detected | waiting for safe turn boundary');
    else if (this.phase === 'streaming') lines.push(`Diagnosis generating | ${this.streamed}`);
    else lines.push(`${this.phase}: ${this.result}`);
    return lines;
  }
}
