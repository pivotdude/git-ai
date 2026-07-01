import type { AiProvider, Mode } from './types';

export interface ModeMeta {
  label: string;
  help: string;
  maxTokens: number;
}

export const MODE_META: Record<Mode, ModeMeta> = {
  'branch-commit-pr': {
    label: 'Staged → new branch → commit → push → PR',
    help: 'Staged changes: create branch, commit, push, open PR',
    maxTokens: 8096,
  },
  'branch-commit-push': {
    label: 'Staged → new branch → commit → push',
    help: 'Staged changes: create branch, commit, push',
    maxTokens: 500,
  },
  'commit-push': {
    label: 'Staged → current branch → commit → push',
    help: 'Staged changes: commit and push on current branch',
    maxTokens: 500,
  },
  'create-pr': {
    label: 'Branch → PR',
    help: 'Existing commits on this branch: open PR to the configured base branch',
    maxTokens: 8096,
  },
  'update-pr': {
    label: 'Branch → refresh open PR',
    help: 'Open PR exists: regenerate title and description from branch diff',
    maxTokens: 8096,
  },
};

export const MODE_ORDER: Mode[] = [
  'branch-commit-pr',
  'branch-commit-push',
  'commit-push',
  'create-pr',
  'update-pr',
];

export interface ProviderMeta {
  label: string;
  help: string;
}

export const PROVIDER_META: Record<AiProvider, ProviderMeta> = {
  openai: {
    label: 'OpenAI-compatible API',
    help: 'Use OPENAI_BASE_URL + OPENAI_API_KEY (current default flow)',
  },
  'cursor-sdk': {
    label: 'Cursor SDK',
    help: 'Use Cursor subscription models via CURSOR_API_KEY',
  },
  manual: {
    label: 'Manual',
    help: 'Copy prompt, run any AI yourself, paste the response back (uses $EDITOR / $VISUAL)',
  },
};

export const PROVIDER_ORDER: AiProvider[] = ['openai', 'cursor-sdk', 'manual'];
