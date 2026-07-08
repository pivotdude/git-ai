import { describe, expect, test } from 'bun:test';

import {
  escalateMaxTokens,
  parseChatCompletionChoice,
} from './clients/chat-completion-content';

describe('parseChatCompletionChoice', () => {
  test('returns trimmed content when present', () => {
    expect(
      parseChatCompletionChoice({
        finish_reason: 'stop',
        message: { content: '  hello  ' },
      }),
    ).toEqual({
      content: 'hello',
      hasReasoningOnly: false,
      shouldEscalateTokens: false,
    });
  });

  test('detects reasoning-only responses stopped by length', () => {
    expect(
      parseChatCompletionChoice({
        finish_reason: 'length',
        message: { content: '', reasoning_content: 'thinking...' },
      }),
    ).toEqual({
      content: '',
      hasReasoningOnly: true,
      shouldEscalateTokens: true,
    });
  });

  test('does not escalate when reasoning finished normally but content is empty', () => {
    expect(
      parseChatCompletionChoice({
        finish_reason: 'stop',
        message: { content: '', reasoning_content: 'thinking...' },
      }),
    ).toEqual({
      content: '',
      hasReasoningOnly: true,
      shouldEscalateTokens: false,
    });
  });
});

describe('escalateMaxTokens', () => {
  test('doubles small limits to at least 2048', () => {
    expect(escalateMaxTokens(500)).toBe(2048);
    expect(escalateMaxTokens(1500)).toBe(3000);
    expect(escalateMaxTokens(2048)).toBe(4096);
  });

  test('caps at 16384', () => {
    expect(escalateMaxTokens(12000)).toBe(16384);
  });
});
