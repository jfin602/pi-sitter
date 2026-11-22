/** Durable, UI-independent state for one accepted supervision attempt. */
export type InterventionPhase = 'started' | 'completed' | 'failed' | 'cancelled';

export interface InterventionEvent {
  id: string;
  phase: InterventionPhase;
  trigger: string;
  stage: string;
  description?: string;
  issue?: string;
  evidence?: string;
  nextAction?: string;
  reason?: string;
  source?: 'model' | 'fallback';
  delivered?: boolean;
  workerPrompt?: string;
  rejectedResponses?: string[];
}

export class InterventionLifecycle {
  private readonly starts = new Set<string>();
  private readonly states = new Map<string, InterventionEvent>();

  apply(event: InterventionEvent): boolean {
    if (!event?.id || !event.trigger || !event.stage) return false;
    const previous = this.states.get(event.id);
    if (event.phase === 'started') {
      if (previous) return false;
      this.starts.add(event.id);
      this.states.set(event.id, event);
      return true;
    }
    if (!['completed', 'failed', 'cancelled'].includes(event.phase) ||
        (previous && previous.phase !== 'started')) return false;
    this.states.set(event.id, event);
    return true;
  }

  get(id: string): InterventionEvent | undefined { return this.states.get(id); }
  hasStart(id: string): boolean { return this.starts.has(id); }
  active(): InterventionEvent[] { return [...this.states.values()].filter(value => value.phase === 'started'); }
  clear(): void { this.starts.clear(); this.states.clear(); }

  /** An abandoned session has no live supervisor to finish an orphaned start. */
  interruptPending(reason: string): void {
    for (const started of this.active()) this.states.set(started.id,
      { ...started, phase: 'cancelled', reason });
  }
}
