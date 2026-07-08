import type { ReasoningApiProfile, ReasoningLevel } from './types';
import type { AiProjectConfig } from './project-config';

export type { ReasoningApiProfile, ReasoningLevel } from './types';

export const DEFAULT_REASONING_LEVEL: ReasoningLevel = 'off';
export const DEFAULT_REASONING_PROFILE: ReasoningApiProfile = 'compatible';

const PROFILE_HOST_PATTERNS: ReadonlyArray<{ profile: ReasoningApiProfile; pattern: RegExp }> = [
  { profile: 'openai', pattern: /(^|\.)api\.openai\.com$/i },
  { profile: 'openrouter', pattern: /openrouter\.ai$/i },
  { profile: 'deepseek', pattern: /(^|\.)api\.deepseek\.com$/i },
];

export function resolveReasoningLevel(ai: AiProjectConfig): ReasoningLevel {
  return ai.reasoning ?? DEFAULT_REASONING_LEVEL;
}

export function resolveReasoningProfile(baseUrl: string, ai: AiProjectConfig = {}): ReasoningApiProfile {
  if (ai.reasoningProfile) return ai.reasoningProfile;

  try {
    const host = new URL(baseUrl).hostname;
    for (const { profile, pattern } of PROFILE_HOST_PATTERNS) {
      if (pattern.test(host)) return profile;
    }
  } catch {
    // Invalid URL; use fallback profile.
  }

  return DEFAULT_REASONING_PROFILE;
}

function mapDeepseekEffort(level: Exclude<ReasoningLevel, 'off'>): 'high' | 'max' {
  if (level === 'high') return 'high';
  return 'high';
}

function buildOpenAiReasoningBody(level: ReasoningLevel): Record<string, unknown> {
  if (level === 'off') return {};
  if (level === 'on') return { reasoning_effort: 'medium' };
  return { reasoning_effort: level };
}

function buildOpenRouterReasoningBody(level: ReasoningLevel): Record<string, unknown> {
  if (level === 'off') return { reasoning: { effort: 'none' } };
  if (level === 'on') return { reasoning: { enabled: true } };
  return { reasoning: { effort: level } };
}

function buildDeepseekReasoningBody(level: ReasoningLevel): Record<string, unknown> {
  if (level === 'off') return { thinking: { type: 'disabled' } };

  return {
    thinking: { type: 'enabled' },
    reasoning_effort: mapDeepseekEffort(level),
  };
}

function buildCompatibleReasoningBody(level: ReasoningLevel): Record<string, unknown> {
  if (level === 'off') {
    return {
      thinking: { type: 'disabled' },
      reasoning: { effort: 'none' },
    };
  }

  if (level === 'on') {
    return {
      thinking: { type: 'enabled' },
      reasoning: { enabled: true },
    };
  }

  return {
    thinking: { type: 'enabled' },
    reasoning_effort: level,
    reasoning: { effort: level },
  };
}

export function buildReasoningRequestBody(
  level: ReasoningLevel,
  profile: ReasoningApiProfile,
): Record<string, unknown> {
  switch (profile) {
    case 'openai':
      return buildOpenAiReasoningBody(level);
    case 'openrouter':
      return buildOpenRouterReasoningBody(level);
    case 'deepseek':
      return buildDeepseekReasoningBody(level);
    case 'compatible':
      return buildCompatibleReasoningBody(level);
  }
}

export function buildReasoningRequestBodyForBaseUrl(
  level: ReasoningLevel,
  baseUrl: string,
  ai: AiProjectConfig = {},
): Record<string, unknown> {
  return buildReasoningRequestBody(level, resolveReasoningProfile(baseUrl, ai));
}
