export interface PiSitterLimits {
  maxInferenceAttempts: number;
  maxValidAdvisories: number;
  maxFallbackAdvisories: number;
  maxTriggers: number;
  maxRepeatedIneffectiveOps: number;
  maxRecoveryAttempts: number;
  maxCompletionVerifications: number;
  maxInputChars: number;
  maxOutputTokens: number;
  timeoutMs: number;
  debounceMs: number;
}

const defaults: PiSitterLimits = {
  maxInferenceAttempts: 3,
  maxValidAdvisories: 2,
  maxFallbackAdvisories: 2,
  maxTriggers: 16,
  maxRepeatedIneffectiveOps: 2,
  maxRecoveryAttempts: 2,
  maxCompletionVerifications: 5,
  maxInputChars: 5500,
  maxOutputTokens: 384,
  timeoutMs: 30_000,
  debounceMs: 150,
};

/** One bounded JSON override. Legacy maxCalls maps to the inference budget. */
export function piSitterLimits(raw = process.env.PI_SITTER_LIMITS): PiSitterLimits {
  if (!raw) return { ...defaults };
  try {
    const input = JSON.parse(raw) as Partial<PiSitterLimits> & { maxCalls?: number };
    const limits = { ...defaults };
    if (Number.isInteger(input.maxCalls) && input.maxCalls! > 0 && input.maxInferenceAttempts === undefined)
      limits.maxInferenceAttempts = input.maxCalls!;
    for (const key of Object.keys(defaults) as (keyof PiSitterLimits)[]) {
      const value = input[key];
      if (Number.isInteger(value) && value! > 0) limits[key] = value!;
    }
    return {
      maxInferenceAttempts: Math.min(limits.maxInferenceAttempts, 6),
      maxValidAdvisories: Math.min(limits.maxValidAdvisories, 4),
      maxFallbackAdvisories: Math.min(limits.maxFallbackAdvisories, 4),
      maxTriggers: Math.min(limits.maxTriggers, 32),
      maxRepeatedIneffectiveOps: Math.max(2, Math.min(limits.maxRepeatedIneffectiveOps, 5)),
      maxRecoveryAttempts: Math.min(limits.maxRecoveryAttempts, 3),
      maxCompletionVerifications: Math.min(limits.maxCompletionVerifications, 6),
      maxInputChars: Math.max(1500, Math.min(limits.maxInputChars, 6000)),
      maxOutputTokens: Math.max(256, Math.min(limits.maxOutputTokens, 512)),
      timeoutMs: Math.min(limits.timeoutMs, 60_000),
      debounceMs: Math.max(100, Math.min(limits.debounceMs, 200)),
    };
  } catch { return { ...defaults }; }
}
