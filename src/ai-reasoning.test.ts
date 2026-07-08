import { describe, expect, test } from 'bun:test';

import {
  buildReasoningRequestBody,
  buildReasoningRequestBodyForBaseUrl,
  resolveReasoningLevel,
  resolveReasoningProfile,
} from './ai-reasoning';

describe('resolveReasoningLevel', () => {
  test('defaults to off', () => {
    expect(resolveReasoningLevel({})).toBe('off');
  });

  test('uses configured value', () => {
    expect(resolveReasoningLevel({ reasoning: 'high' })).toBe('high');
  });
});

describe('resolveReasoningProfile', () => {
  test('detects official OpenAI host', () => {
    expect(resolveReasoningProfile('https://api.openai.com/v1')).toBe('openai');
  });

  test('detects OpenRouter host', () => {
    expect(resolveReasoningProfile('https://openrouter.ai/api/v1')).toBe('openrouter');
  });

  test('detects DeepSeek host', () => {
    expect(resolveReasoningProfile('https://api.deepseek.com/v1')).toBe('deepseek');
  });

  test('uses compatible fallback for unknown hosts', () => {
    expect(resolveReasoningProfile('https://manifest.example.com/v1')).toBe('compatible');
  });

  test('config override wins over host detection', () => {
    expect(
      resolveReasoningProfile('https://api.openai.com/v1', { reasoningProfile: 'compatible' }),
    ).toBe('compatible');
  });
});

describe('buildReasoningRequestBody', () => {
  test('openai off sends nothing', () => {
    expect(buildReasoningRequestBody('off', 'openai')).toEqual({});
  });

  test('openrouter off disables reasoning effort', () => {
    expect(buildReasoningRequestBody('off', 'openrouter')).toEqual({
      reasoning: { effort: 'none' },
    });
  });

  test('deepseek off disables thinking', () => {
    expect(buildReasoningRequestBody('off', 'deepseek')).toEqual({
      thinking: { type: 'disabled' },
    });
  });

  test('compatible off sends OpenRouter + DeepSeek fields', () => {
    expect(buildReasoningRequestBody('off', 'compatible')).toEqual({
      thinking: { type: 'disabled' },
      reasoning: { effort: 'none' },
    });
  });

  test('compatible on enables both styles', () => {
    expect(buildReasoningRequestBody('on', 'compatible')).toEqual({
      thinking: { type: 'enabled' },
      reasoning: { enabled: true },
    });
  });

  test('compatible effort sends enabled thinking plus effort fields', () => {
    expect(buildReasoningRequestBody('low', 'compatible')).toEqual({
      thinking: { type: 'enabled' },
      reasoning_effort: 'low',
      reasoning: { effort: 'low' },
    });
  });
});

describe('buildReasoningRequestBodyForBaseUrl', () => {
  test('uses manifest host fallback profile', () => {
    expect(
      buildReasoningRequestBodyForBaseUrl('off', 'https://manifest.sienna.example/v1'),
    ).toEqual({
      thinking: { type: 'disabled' },
      reasoning: { effort: 'none' },
    });
  });
});
