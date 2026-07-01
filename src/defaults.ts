import type { GitAiProjectConfig } from './project-config';

export const CONFIG_SCHEMA_FILE = 'config.schema.json';

export const GIT_AI_DIR = '.git-ai';

export const LEGACY_CONFIG_FILE = '.git-ai.json';

export const CONFIG_FILE = `${GIT_AI_DIR}/config.json`;

export const DIFF_IGNORE_FILE = `${GIT_AI_DIR}/diff-ignore`;

export const PROMPTS_DIR = `${GIT_AI_DIR}/prompts`;

export const CONVENTIONS_FILE = `${GIT_AI_DIR}/conventions.md`;

export const DEFAULT_DIFF_IGNORE_PATTERNS: readonly string[] = [
  'bun.lock',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
];

export const DEFAULT_PROJECT_CONFIG: GitAiProjectConfig = {
  baseBranch: 'main',
  diffIgnore: [...DEFAULT_DIFF_IGNORE_PATTERNS],
  conventions: null,
  prTemplate: '.github/PULL_REQUEST_TEMPLATE.md',
  stagedFix: {
    rules: [],
    root: null,
  },
};
