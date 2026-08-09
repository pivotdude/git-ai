import { describe, expect, test } from 'bun:test';

import { getEditableFields, stripEditComments } from './result-edit';

describe('getEditableFields', () => {
  test('commit-push exposes only commit message', () => {
    const fields = getEditableFields({
      mode: 'commit-push',
      commitMessage: 'feat(cli): Add edit step',
    });

    expect(fields.map((field) => field.id)).toEqual(['commitMessage']);
    expect(fields[0]!.getValue({ mode: 'commit-push', commitMessage: 'hello' })).toBe('hello');
    expect(
      fields[0]!.setValue({ mode: 'commit-push', commitMessage: 'old' }, 'new message'),
    ).toEqual({
      mode: 'commit-push',
      commitMessage: 'new message',
    });
  });

  test('branch-commit-pr exposes branch, commit, title, and description', () => {
    const fields = getEditableFields({
      mode: 'branch-commit-pr',
      branchName: 'feature/foo',
      commitMessage: 'feat: Title\n\nBody',
      title: 'feat: Title',
      prDescription: '## Summary\nDetails',
    });

    expect(fields.map((field) => field.id)).toEqual([
      'branchName',
      'commitMessage',
      'prTitle',
      'prDescription',
    ]);
  });

  test('updating commit message syncs PR title from first line', () => {
    const fields = getEditableFields({
      mode: 'branch-commit-pr',
      branchName: 'feature/foo',
      commitMessage: 'feat: Old title',
      title: 'feat: Old title',
      prDescription: 'Body',
    });

    const commitField = fields.find((field) => field.id === 'commitMessage')!;
    const updated = commitField.setValue(
      {
        mode: 'branch-commit-pr',
        branchName: 'feature/foo',
        commitMessage: 'feat: Old title',
        title: 'feat: Old title',
        prDescription: 'Body',
      },
      'feat: New title\n\nMore detail',
    );

    expect(updated).toEqual({
      mode: 'branch-commit-pr',
      branchName: 'feature/foo',
      commitMessage: 'feat: New title\n\nMore detail',
      title: 'feat: New title',
      prDescription: 'Body',
    });
  });
});

describe('stripEditComments', () => {
  test('removes HTML instruction comments but keeps markdown headings', () => {
    expect(
      stripEditComments(`<!-- Edit PR description. Save and close when done. -->
## Summary
- Detail one
### Notes
More text`),
    ).toBe(`## Summary
- Detail one
### Notes
More text`);
  });

  test('preserves markdown headings in manual AI responses', () => {
    expect(
      stripEditComments(`<!-- Paste the AI response below this line, save, and close the editor. -->
PR_TITLE: feat(git-ai): Keep markdown headings
PR_DESC:
## Summary
- Keeps # / ## / ### in PR body
### Test plan
- [ ] Preview shows headings`),
    ).toBe(`PR_TITLE: feat(git-ai): Keep markdown headings
PR_DESC:
## Summary
- Keeps # / ## / ### in PR body
### Test plan
- [ ] Preview shows headings`);
  });
});
