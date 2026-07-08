import { describe, expect, test } from 'bun:test';

import { getMaxTokens, resolveMaxTokens } from './mode-meta';

describe('resolveMaxTokens', () => {
  test('uses mode override before global override', () => {
    expect(
      resolveMaxTokens('commit-push', {
        maxTokens: 3000,
        maxTokensByMode: { 'commit-push': 5000 },
      }),
    ).toBe(5000);
  });

  test('uses global override when mode override is absent', () => {
    expect(resolveMaxTokens('create-pr', { maxTokens: 3000 })).toBe(3000);
  });

  test('falls back to package defaults', () => {
    expect(resolveMaxTokens('commit-push', {})).toBe(2048);
    expect(resolveMaxTokens('create-pr', {})).toBe(8096);
  });
});

describe('getMaxTokens', () => {
  test('falls back to package defaults when project config is not loaded', () => {
    expect(getMaxTokens('commit-push')).toBe(2048);
    expect(getMaxTokens('create-pr')).toBe(8096);
  });
});
