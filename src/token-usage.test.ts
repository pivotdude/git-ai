import { describe, expect, test } from 'bun:test';

import { parseChatCompletionUsage } from './clients/openai-usage';
import { formatTokenCount, formatUsd } from './token-report';

describe('formatTokenCount', () => {
  test('formats thousands compactly', () => {
    expect(formatTokenCount(12500)).toBe('13k');
    expect(formatTokenCount(1500)).toBe('1.5k');
    expect(formatTokenCount(500)).toBe('500');
  });
});

describe('formatUsd', () => {
  test('formats small costs with extra precision', () => {
    expect(formatUsd(0.0021)).toBe('$0.0021');
  });
});

describe('parseChatCompletionUsage', () => {
  test('parses standard usage block', () => {
    expect(
      parseChatCompletionUsage({
        usage: {
          prompt_tokens: 1200,
          completion_tokens: 80,
          total_tokens: 1280,
        },
      }),
    ).toEqual({
      promptTokens: 1200,
      completionTokens: 80,
      totalTokens: 1280,
      costUsd: undefined,
    });
  });

  test('parses provider cost fields', () => {
    expect(
      parseChatCompletionUsage({
        usage: {
          prompt_tokens: 100,
          completion_tokens: 20,
          total_cost: 0.0012,
        },
      }),
    ).toEqual({
      promptTokens: 100,
      completionTokens: 20,
      totalTokens: 120,
      costUsd: 0.0012,
    });
  });
});
