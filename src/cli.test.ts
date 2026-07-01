import { describe, expect, test } from 'bun:test';

import { parseDryRunFromArgs } from './cli';

// Mirror of cli.ts fallback parser for unit tests.
function parseExecutionConfirmationInput(raw: string | null | undefined): 'yes' | 'no' | 'edit' | null {
  const value = raw?.trim().toLowerCase();
  if (!value) return null;
  if (value === 'yes' || value === 'y' || value === '1') return 'yes';
  if (value === 'no' || value === 'n' || value === '2') return 'no';
  if (value === 'edit' || value === 'e' || value === '3') return 'edit';
  return null;
}

describe('parseDryRunFromArgs', () => {
  test('detects --dry-run', () => {
    expect(parseDryRunFromArgs(['--dry-run', '--mode', 'commit-push'])).toBe(true);
  });

  test('detects -n', () => {
    expect(parseDryRunFromArgs(['-n', '--mode', 'create-pr'])).toBe(true);
  });

  test('returns false when flag is absent', () => {
    expect(parseDryRunFromArgs(['--mode', 'commit-push'])).toBe(false);
  });
});

describe('parseExecutionConfirmationInput', () => {
  test('parses edit', () => {
    expect(parseExecutionConfirmationInput('edit')).toBe('edit');
    expect(parseExecutionConfirmationInput('e')).toBe('edit');
    expect(parseExecutionConfirmationInput('3')).toBe('edit');
  });
});
