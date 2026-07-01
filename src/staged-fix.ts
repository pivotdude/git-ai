import { existsSync } from 'node:fs';
import { join } from 'node:path';
import ignore from 'ignore';

import type { GitClient } from './clients/git-client';
import { getProjectConfig, type StagedFixRule } from './project-config';
import { getRepoRoot } from './repo-root';

function ruleMatches(rule: StagedFixRule, stagedFiles: readonly string[]): boolean {
  if (rule.paths.length === 0) return false;

  const matcher = ignore().add(rule.paths);
  return stagedFiles.some((file) => matcher.ignores(file));
}

function commandsForStagedFiles(stagedFiles: readonly string[]): string[] {
  const { stagedFix } = getProjectConfig();
  const commands = new Set<string>();

  for (const rule of stagedFix.rules) {
    if (ruleMatches(rule, stagedFiles)) {
      commands.add(rule.command);
    }
  }

  if (stagedFix.root && ruleMatches(stagedFix.root, stagedFiles)) {
    commands.add(stagedFix.root.command);
  }

  return [...commands];
}

async function runCommand(repoRoot: string, command: string): Promise<void> {
  const result = await Bun.$`sh -c ${command}`.cwd(repoRoot).quiet().nothrow();
  if (result.exitCode !== 0) {
    const detail = result.stderr.toString().trim() || result.stdout.toString().trim();
    if (detail) {
      console.error(`[warn] ${command} exited with code ${result.exitCode}\n${detail}`);
    }
  }
}

export async function fixStagedWorkspaces(stagedFiles: readonly string[]): Promise<void> {
  if (stagedFiles.length === 0) return;

  const commands = commandsForStagedFiles(stagedFiles);
  if (commands.length === 0) return;

  const repoRoot = await getRepoRoot();
  await Promise.all(commands.map((command) => runCommand(repoRoot, command)));
}

export async function restageFiles(git: GitClient, stagedFiles: readonly string[]): Promise<void> {
  if (stagedFiles.length === 0) return;

  const repoRoot = await getRepoRoot();
  const pathsToAdd = stagedFiles.filter((file) => existsSync(join(repoRoot, file)));
  if (pathsToAdd.length === 0) return;

  await git.addFiles(pathsToAdd);
}

export async function fixAndRestageStaged(git: GitClient, stagedFiles: readonly string[]): Promise<void> {
  await fixStagedWorkspaces(stagedFiles);
  await restageFiles(git, stagedFiles);
}
