import type { Mode } from './types';

export const MODE_PROMPT_FILES: Record<Mode, string> = {
  'branch-commit-pr': 'branch-commit-pr.md',
  'branch-commit-push': 'branch-commit-push.md',
  'commit-push': 'commit-push.md',
  'create-pr': 'create-pr.md',
  'update-pr': 'create-pr.md',
};
