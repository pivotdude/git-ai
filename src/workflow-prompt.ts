import type { GitClient } from './clients/git-client';
import { withoutDiffIgnoredFiles } from './diff-ignore';
import { readConventions } from './conventions';
import { buildPrompt } from './prompt-builder';
import { getProjectConfig } from './project-config';
import { runStep } from './progress';
import type { Mode } from './types';

export interface BranchPrPromptOptions {
  requireOpenPr?: boolean;
}

export interface StagedPromptInputs {
  stat: string;
  diff: string;
  conventions: string;
}

export async function readStagedPromptInputs(git: GitClient): Promise<StagedPromptInputs | null> {
  const stagedFiles = await runStep('Reading staged file list', () => git.stagedFileNames());
  if (stagedFiles.length === 0) {
    console.log('No staged changes. Stage files first with git add.');
    return null;
  }

  if (withoutDiffIgnoredFiles(stagedFiles).length === 0) {
    console.log('Only ignored files (e.g. lockfiles) are staged; git-ai has nothing meaningful to analyze.');
    return null;
  }

  const stat = await runStep('Reading staged changes summary', () => git.stagedStat());
  const diff = await runStep('Reading staged diff', () => git.stagedDiff());
  const conventions = await runStep('Loading git conventions', () => readConventions());

  return { stat, diff, conventions };
}

export async function buildStagedPrompt(git: GitClient, mode: Mode): Promise<string | null> {
  const inputs = await readStagedPromptInputs(git);
  if (!inputs) return null;

  return runStep('Loading AI prompt template', () =>
    buildPrompt(mode, inputs.stat, inputs.diff, inputs.conventions),
  );
}

export async function buildBranchPrPrompt(
  git: GitClient,
  branch: string,
  mode: 'create-pr' | 'update-pr',
  options: BranchPrPromptOptions = {},
): Promise<string | null> {
  const { baseBranch } = getProjectConfig();

  if (branch === baseBranch) {
    console.log(`Cannot build a PR prompt from ${baseBranch}. Switch to a feature branch first.`);
    return null;
  }

  if (options.requireOpenPr) {
    const openPr = await runStep('Finding open PR', () => git.currentOpenPr());
    if (!openPr) {
      console.log('No open PR found for this branch. Use create-pr mode instead.');
      return null;
    }

    console.log(`Open PR: #${openPr.number} ${openPr.url}\n`);
  }

  const hasCommits = await runStep(`Checking commits ahead of ${baseBranch}`, () => git.hasCommitsAhead(baseBranch));
  if (!hasCommits) {
    console.log(`No commits on ${branch} that are not in ${baseBranch}.`);
    return null;
  }

  const log = await runStep(`Reading commit log (${baseBranch}..HEAD)`, () => git.rangeLog(baseBranch));
  const stat = await runStep(`Reading diff stat (${baseBranch}...HEAD)`, () => git.rangeStat(baseBranch));
  const diff = await runStep(`Reading full diff (${baseBranch}...HEAD)`, () => git.rangeDiff(baseBranch));
  const conventions = await runStep('Loading git conventions', () => readConventions());

  return runStep('Loading AI prompt template', () =>
    buildPrompt(mode, stat, diff, conventions, { baseBranch, log }),
  );
}
