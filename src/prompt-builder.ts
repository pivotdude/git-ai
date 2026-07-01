import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { PROMPTS_DIR } from './defaults';
import { MODE_PROMPT_FILES } from './prompt-files';
import { getProjectConfig, resolveRepoPath } from './project-config';
import { getRepoRoot } from './repo-root';
import type { Mode } from './types';

const templateCache = new Map<string, string>();

async function loadBundledModeTemplate(fileName: string): Promise<string> {
  const templatePath = join(import.meta.dir, 'prompts', fileName);
  const content = await Bun.file(templatePath).text();
  if (!content.trim()) {
    throw new Error(`Prompt template is empty: ${templatePath}`);
  }

  return content.trim();
}

async function loadModeTemplate(mode: Mode): Promise<string> {
  const fileName = MODE_PROMPT_FILES[mode];
  const cached = templateCache.get(fileName);
  if (cached) return cached;

  const repoRoot = await getRepoRoot();
  const projectPromptPath = join(repoRoot, PROMPTS_DIR, fileName);
  const content = existsSync(projectPromptPath)
    ? await Bun.file(projectPromptPath).text()
    : await loadBundledModeTemplate(fileName);

  if (!content.trim()) {
    throw new Error(`Prompt template is empty: ${fileName}`);
  }

  templateCache.set(fileName, content.trim());
  return content.trim();
}

async function loadPrTemplate(): Promise<string | null> {
  const { prTemplate } = getProjectConfig();
  const templatePath = await resolveRepoPath(prTemplate);
  try {
    if (!existsSync(templatePath)) return null;
    const content = await Bun.file(templatePath).text();
    return content.trim() || null;
  } catch {
    return null;
  }
}

const BRANCH_PR_SECTIONS = ['Commit log', 'Diff stat', 'Full diff', 'Git conventions', 'PR template'] as const;

const SECTIONS: Record<Mode, string[]> = {
  'branch-commit-pr': ['Diff stat', 'Full diff', 'Git conventions', 'PR template'],
  'branch-commit-push': ['Diff stat', 'Full diff', 'Git conventions'],
  'commit-push': ['Diff stat', 'Full diff', 'Git conventions'],
  'create-pr': [...BRANCH_PR_SECTIONS],
  'update-pr': [...BRANCH_PR_SECTIONS],
};

export interface BranchPrPromptContext {
  baseBranch: string;
  log: string;
}

/** @deprecated Use BranchPrPromptContext */
export type CreatePrPromptContext = BranchPrPromptContext;

export async function buildPrompt(
  mode: Mode,
  stat: string,
  diff: string,
  conventions: string,
  branchPrContext?: BranchPrPromptContext,
): Promise<string> {
  const modeSection = await loadModeTemplate(mode);

  const parts: string[] = ['You help developers with git.', '', modeSection, ''];

  if ((mode === 'create-pr' || mode === 'update-pr') && branchPrContext) {
    parts.push(
      `Base branch: ${branchPrContext.baseBranch}`,
      '',
      `### ${BRANCH_PR_SECTIONS[0]}`,
      '```',
      branchPrContext.log.trim() || '(no commits)',
      '```',
      '',
      `### ${BRANCH_PR_SECTIONS[1]}`,
      '```',
      stat.trim() || '(no file changes)',
      '```',
      '',
      `### ${BRANCH_PR_SECTIONS[2]}`,
      '```',
      diff.trim() || '(no diff)',
      '```',
      '',
      `### ${BRANCH_PR_SECTIONS[3]}`,
      '```',
      conventions,
      '```',
    );

    const prTemplate = await loadPrTemplate();
    if (prTemplate) {
      parts.push('', `### ${BRANCH_PR_SECTIONS[4]}`, '```', prTemplate, '```');
    }

    return parts.join('\n');
  }

  parts.push(
    `### ${SECTIONS[mode][0]}`,
    '```',
    stat.trim(),
    '```',
    '',
    `### ${SECTIONS[mode][1]}`,
    '```',
    diff.trim() || '(no diff)',
    '```',
    '',
    `### ${SECTIONS[mode][2]}`,
    '```',
    conventions,
    '```',
  );

  if (mode === 'branch-commit-pr') {
    const prTemplate = await loadPrTemplate();
    if (prTemplate) {
      parts.push('', `### ${SECTIONS[mode][3]}`, '```', prTemplate, '```');
    }
  }

  return parts.join('\n');
}
