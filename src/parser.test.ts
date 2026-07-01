import { describe, expect, test } from 'bun:test';

import { parseResult } from './parser';

describe('parseResult', () => {
  test('parses commit-push with COMMIT tag', () => {
    const result = parseResult('commit-push', 'COMMIT: feat(cli): Add mode picker\n\n- Detail one');

    expect(result).toEqual({
      mode: 'commit-push',
      commitMessage: 'feat(cli): Add mode picker\n- Detail one',
    });
  });

  test('parses commit-push fallback without COMMIT tag', () => {
    const result = parseResult('commit-push', 'feat(parser): Handle fenced output\n\n- Bullet');

    expect(result).toEqual({
      mode: 'commit-push',
      commitMessage: 'feat(parser): Handle fenced output\n- Bullet',
    });
  });

  test('normalizes conventional commit casing in titles', () => {
    const result = parseResult('commit-push', 'COMMIT: FEAT(web): Add chart toolbar');

    expect(result).toEqual({
      mode: 'commit-push',
      commitMessage: 'feat(web): Add chart toolbar',
    });
  });

  test('parses branch-commit-push', () => {
    const result = parseResult(
      'branch-commit-push',
      `BRANCH: feature/git-ai-tests
COMMIT: test(git-ai): Add parser coverage`,
    );

    expect(result).toEqual({
      mode: 'branch-commit-push',
      branchName: 'feature/git-ai-tests',
      commitMessage: 'test(git-ai): Add parser coverage',
    });
  });

  test('parses branch-commit-pr with PR description', () => {
    const result = parseResult(
      'branch-commit-pr',
      `BRANCH: feature/git-ai-cache
COMMIT: fix(git-ai): Tighten draft cache fingerprint
PR_DESC: Uses full staged diff hash in the draft cache fingerprint.`,
    );

    expect(result).toEqual({
      mode: 'branch-commit-pr',
      branchName: 'feature/git-ai-cache',
      title: 'fix(git-ai): Tighten draft cache fingerprint',
      commitMessage: 'fix(git-ai): Tighten draft cache fingerprint',
      prDescription: 'Uses full staged diff hash in the draft cache fingerprint.',
    });
  });

  test('parses create-pr with multiline PR description', () => {
    const result = parseResult(
      'create-pr',
      `PR_TITLE: feat(git-ai): Support project config directory
PR_DESC:
## Summary
- Adds .git-ai/ layout`,
    );

    expect(result).toEqual({
      mode: 'create-pr',
      title: 'feat(git-ai): Support project config directory',
      prDescription: '## Summary\n- Adds .git-ai/ layout',
    });
  });

  test('parses update-pr with inline PR description', () => {
    const result = parseResult(
      'update-pr',
      'PR_TITLE: docs(git-ai): Refresh README\nPR_DESC: Documents stagedFix shell security.',
    );

    expect(result).toEqual({
      mode: 'update-pr',
      title: 'docs(git-ai): Refresh README',
      prDescription: 'Documents stagedFix shell security.',
    });
  });

  test('strips markdown fences from commit body', () => {
    const result = parseResult(
      'commit-push',
      `COMMIT: chore: Refresh lockfile

\`\`\`
- updated bun.lock
\`\`\``,
    );

    expect(result).toEqual({
      mode: 'commit-push',
      commitMessage: 'chore: Refresh lockfile\n- updated bun.lock',
    });
  });
});
