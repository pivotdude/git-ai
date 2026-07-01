import type { BranchCommitPrResult, BranchCommitPushResult, CreatePrResult, UpdatePrResult } from './types';
import { safeUnlink, tempFile } from './temp-files';
import type { GitClient } from './clients/git-client';
import { runStep } from './progress';
import { fixAndRestageStaged } from './staged-fix';

interface StagedWorkflowContext {
  stagedFiles: string[];
  sourceBranch: string;
}

async function prepareStagedForCommit(git: GitClient, stagedFiles: string[]): Promise<void> {
  await runStep('Applying format/lint fixes to staged files', () => fixAndRestageStaged(git, stagedFiles));
}

async function commitFromFileWithRetry(git: GitClient, commitFile: string, stagedFiles: string[]): Promise<void> {
  try {
    await git.commitFromFile(commitFile);
    return;
  } catch (firstError) {
    await runStep('Retrying commit after format/lint fixes', () => fixAndRestageStaged(git, stagedFiles));

    try {
      await git.commitFromFile(commitFile);
      return;
    } catch {
      throw firstError;
    }
  }
}

async function rollbackNewBranch(git: GitClient, sourceBranch: string, newBranch: string): Promise<void> {
  try {
    const current = (await git.currentBranch()).trim();
    if (current === newBranch) {
      await runStep(`Rolling back to ${sourceBranch}`, () => git.checkoutExisting(sourceBranch));
    }

    await runStep(`Deleting branch ${newBranch}`, () => git.deleteBranch(newBranch));
  } catch {
    console.error(`Could not fully roll back branch ${newBranch}. You may need to delete it manually.`);
  }
}

async function runStagedCommit(
  git: GitClient,
  commitFile: string,
  stagedFiles: string[],
  sourceBranch: string,
  newBranch?: string,
): Promise<void> {
  try {
    await runStep('Creating commit', () => commitFromFileWithRetry(git, commitFile, stagedFiles));
  } catch (error) {
    if (newBranch) {
      await rollbackNewBranch(git, sourceBranch, newBranch);
    }
    throw error;
  }
}

export async function executeCommitPush(
  git: GitClient,
  branch: string,
  commitMessage: string,
  context: StagedWorkflowContext,
): Promise<void> {
  const commitFile = tempFile('git-ai-commit', 'msg');
  try {
    await Bun.write(commitFile, commitMessage);
    await prepareStagedForCommit(git, context.stagedFiles);
    await runStagedCommit(git, commitFile, context.stagedFiles, context.sourceBranch);

    try {
      await runStep('Pushing current branch', () => git.pushCurrentBranch());
    } catch {
      await runStep('Pushing with upstream tracking', () => git.pushCurrentBranchWithUpstream(branch));
    }
  } finally {
    await safeUnlink(commitFile);
  }
}

export async function executeBranchCommitPush(
  git: GitClient,
  result: BranchCommitPushResult,
  context: StagedWorkflowContext,
): Promise<void> {
  const commitFile = tempFile('git-ai-branch-commit', 'msg');

  try {
    await Bun.write(commitFile, result.commitMessage);

    await prepareStagedForCommit(git, context.stagedFiles);
    await runStep(`Creating branch ${result.branchName}`, () => git.checkoutBranch(result.branchName));
    await runStagedCommit(git, commitFile, context.stagedFiles, context.sourceBranch, result.branchName);
    await runStep(`Pushing branch ${result.branchName}`, () => git.pushBranch(result.branchName));
  } finally {
    await safeUnlink(commitFile);
  }
}

export async function executeCreatePr(
  git: GitClient,
  branch: string,
  baseBranch: string,
  result: CreatePrResult,
): Promise<void> {
  const prFile = tempFile('git-ai-pr-desc', 'md');

  try {
    await Bun.write(prFile, result.prDescription || result.title);

    try {
      await runStep('Pushing current branch', () => git.pushCurrentBranch());
    } catch {
      await runStep('Pushing with upstream tracking', () => git.pushCurrentBranchWithUpstream(branch));
    }

    await runStep('Creating PR', () => git.createPr(result.title, prFile, baseBranch));
  } finally {
    await safeUnlink(prFile);
  }
}

export async function executeUpdatePr(git: GitClient, branch: string, result: UpdatePrResult): Promise<void> {
  const prFile = tempFile('git-ai-pr-desc', 'md');

  try {
    await Bun.write(prFile, result.prDescription || result.title);

    try {
      await runStep('Pushing current branch', () => git.pushCurrentBranch());
    } catch {
      await runStep('Pushing with upstream tracking', () => git.pushCurrentBranchWithUpstream(branch));
    }

    await runStep('Updating PR', () => git.updatePr(result.title, prFile));
  } finally {
    await safeUnlink(prFile);
  }
}

export async function executeBranchCommitPr(
  git: GitClient,
  result: BranchCommitPrResult,
  context: StagedWorkflowContext,
): Promise<void> {
  const commitFile = tempFile('git-ai-branch-commit', 'msg');
  const prFile = tempFile('git-ai-pr-desc', 'md');

  try {
    await Bun.write(commitFile, result.commitMessage);
    await Bun.write(prFile, result.prDescription || result.commitMessage);

    await prepareStagedForCommit(git, context.stagedFiles);
    await runStep(`Creating branch ${result.branchName}`, () => git.checkoutBranch(result.branchName));
    await runStagedCommit(git, commitFile, context.stagedFiles, context.sourceBranch, result.branchName);
    await runStep(`Pushing branch ${result.branchName}`, () => git.pushBranch(result.branchName));
    await runStep('Creating PR', () => git.createPr(result.title, prFile));
  } finally {
    await safeUnlink(commitFile);
    await safeUnlink(prFile);
  }
}
