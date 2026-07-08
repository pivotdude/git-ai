import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { Mode, ReasoningApiProfile, ReasoningLevel } from './types';
import {
  CONFIG_FILE,
  DEFAULT_DIFF_IGNORE_PATTERNS,
  DEFAULT_PROJECT_CONFIG,
  DIFF_IGNORE_FILE,
  LEGACY_CONFIG_FILE,
} from './defaults';
import { initDiffIgnore } from './diff-ignore';
import { parseIgnoreFile } from './ignore-file';
import { getRepoRoot } from './repo-root';

export interface StagedFixRule {
  /** .gitignore-style path patterns; any staged file match runs the command. */
  paths: string[];
  /** Shell command executed from the repository root. */
  command: string;
}

export interface StagedFixConfig {
  rules: StagedFixRule[];
  root: StagedFixRule | null;
}

export interface AiProjectConfig {
  /** Override max_tokens for every mode unless a mode-specific value is set. */
  maxTokens?: number;
  /** Per-mode max_tokens overrides (commit-push, create-pr, …). */
  maxTokensByMode?: Partial<Record<Mode, number>>;
  /**
   * Reasoning / thinking level for OpenAI-compatible providers.
   * Default: off (thinking disabled on proxies such as Manifest).
   */
  reasoning?: ReasoningLevel;
  /**
   * Override auto-detected reasoning request encoding.
   * Default: inferred from OPENAI_BASE_URL host; unknown hosts use `compatible`.
   */
  reasoningProfile?: ReasoningApiProfile;
}

export interface GitAiProjectConfig {
  baseBranch: string;
  diffIgnore: string[];
  /** Repo-relative markdown path, or null to use .git-ai/conventions.md or the bundled default. */
  conventions: string | null;
  /** Repo-relative PR template path. */
  prTemplate: string;
  stagedFix: StagedFixConfig;
  ai: AiProjectConfig;
}

/** Partial shape accepted in .git-ai/config.json (or legacy .git-ai.json). */
export interface GitAiProjectConfigInput {
  baseBranch?: string;
  diffIgnore?: string[];
  conventions?: string | null;
  prTemplate?: string;
  stagedFix?: {
    rules?: StagedFixRule[];
    root?: StagedFixRule | null;
  };
  ai?: AiProjectConfig;
}

let loadedConfig: GitAiProjectConfig | null = null;
let projectDirPath: string | null = null;

function uniquePatterns(patterns: readonly string[]): string[] {
  return [...new Set(patterns)];
}

function mergeAiConfig(input: AiProjectConfig | undefined): AiProjectConfig {
  return {
    maxTokens: input?.maxTokens,
    maxTokensByMode: input?.maxTokensByMode ? { ...input.maxTokensByMode } : undefined,
    reasoning: input?.reasoning,
    reasoningProfile: input?.reasoningProfile,
  };
}

function mergeConfig(input: GitAiProjectConfigInput | undefined): Omit<GitAiProjectConfig, 'diffIgnore'> {
  const stagedFixInput = input?.stagedFix;

  return {
    baseBranch: input?.baseBranch ?? DEFAULT_PROJECT_CONFIG.baseBranch,
    conventions: input?.conventions === undefined ? DEFAULT_PROJECT_CONFIG.conventions : input.conventions,
    prTemplate: input?.prTemplate ?? DEFAULT_PROJECT_CONFIG.prTemplate,
    stagedFix: {
      rules: stagedFixInput?.rules ?? [...DEFAULT_PROJECT_CONFIG.stagedFix.rules],
      root: stagedFixInput?.root === undefined ? DEFAULT_PROJECT_CONFIG.stagedFix.root : stagedFixInput.root,
    },
    ai: mergeAiConfig(input?.ai),
  };
}

async function loadConfigInput(repoRoot: string): Promise<GitAiProjectConfigInput | undefined> {
  const candidates = [join(repoRoot, CONFIG_FILE), join(repoRoot, LEGACY_CONFIG_FILE)];

  for (const configPath of candidates) {
    if (!existsSync(configPath)) continue;
    return (await Bun.file(configPath).json()) as GitAiProjectConfigInput;
  }

  return undefined;
}

async function loadDiffIgnorePatterns(
  repoRoot: string,
  input: GitAiProjectConfigInput | undefined,
): Promise<string[]> {
  const patterns = [...DEFAULT_DIFF_IGNORE_PATTERNS];

  const ignoreFilePath = join(repoRoot, DIFF_IGNORE_FILE);
  if (existsSync(ignoreFilePath)) {
    const content = await Bun.file(ignoreFilePath).text();
    patterns.push(...parseIgnoreFile(content));
  }

  if (input?.diffIgnore) {
    patterns.push(...input.diffIgnore);
  }

  return uniquePatterns(patterns);
}

export function getBaseBranchOrDefault(defaultBranch = 'main'): string {
  return loadedConfig?.baseBranch ?? defaultBranch;
}

export async function loadProjectConfig(): Promise<GitAiProjectConfig> {
  if (loadedConfig) return loadedConfig;

  const repoRoot = await getRepoRoot();
  projectDirPath = join(repoRoot, '.git-ai');

  const input = await loadConfigInput(repoRoot);
  const diffIgnore = await loadDiffIgnorePatterns(repoRoot, input);

  loadedConfig = {
    ...mergeConfig(input),
    diffIgnore,
  };

  initDiffIgnore(loadedConfig.diffIgnore);

  return loadedConfig;
}

export function getProjectConfig(): GitAiProjectConfig {
  if (!loadedConfig) {
    throw new Error('Project config is not loaded. Call loadProjectConfig() first.');
  }

  return loadedConfig;
}

export function getProjectDir(): string {
  if (!projectDirPath) {
    throw new Error('Project dir is not loaded. Call loadProjectConfig() first.');
  }

  return projectDirPath;
}

export function resolveRepoPath(repoRelativePath: string): Promise<string> {
  return getRepoRoot().then((root) => join(root, repoRelativePath));
}
