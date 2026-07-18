import { createAiSource } from './ai-factory';
import { showResponseTokenResult } from './ai-session';
import { PROVIDER_META } from './constants';
import {
  parseDryRunFromArgs,
  parseModeFromArgs,
  parseProviderFromArgs,
  parseYesFromArgs,
  printAiPreview,
  printDryRunPrompt,
  printHelp,
  promptForCachedDraftReuse,
  promptForMode,
  promptForProvider,
} from './cli';
import { confirmParsedResult } from './result-edit';
import { GitClient } from './clients/git-client';
import { loadProjectConfig, getProjectConfig } from './project-config';
import { buildPrompt } from './prompt-builder';
import { loadCachedDraft, saveCachedDraft, stagedDiffFingerprint } from './draft-cache';
import { getMaxTokens, getModeMeta } from './mode-meta';
import { parseResult } from './parser';
import { runStep } from './progress';
import { wasStepErrorLogged } from './shell-error';
import type { AiProvider, Mode } from './types';
import { buildStagedPrompt, buildBranchPrPrompt, readStagedPromptInputs } from './workflow-prompt';
import {
  executeBranchCommitPr,
  executeBranchCommitPush,
  executeCommitPush,
  executeCreatePr,
  executeUpdatePr,
} from './workflow';

async function runDryRun(git: GitClient, branch: string, mode: Mode): Promise<void> {
  const promptText =
    mode === 'create-pr' || mode === 'update-pr'
      ? await buildBranchPrPrompt(git, branch, mode)
      : await buildStagedPrompt(git, mode);

  if (!promptText) return;

  printDryRunPrompt(promptText);
}

async function runBranchPr(
  git: GitClient,
  provider: AiProvider,
  branch: string,
  mode: 'create-pr' | 'update-pr',
  assumeYes: boolean,
): Promise<void> {
  const { baseBranch } = getProjectConfig();
  let prNumber: number | undefined;

  if (mode === 'update-pr') {
    const openPr = await runStep('Finding open PR', () => git.currentOpenPr());
    if (!openPr) {
      console.log('No open PR found for this branch. Use create-pr mode instead.');
      return;
    }

    prNumber = openPr.number;
    console.log(`Open PR: #${openPr.number} ${openPr.url}\n`);
  }

  const promptText = await buildBranchPrPrompt(git, branch, mode);
  if (!promptText) return;

  const ai = createAiSource(provider, { assumeYes });
  const maxTokens = getMaxTokens(mode);
  const response =
    provider === 'manual'
      ? await ai.ask(promptText, maxTokens)
      : await runStep('Waiting for AI response', () => ai.ask(promptText, maxTokens));
  showResponseTokenResult(provider, response);
  const raw = response.content;
  let result = parseResult(mode, raw);

  if (result.mode !== mode) {
    throw new Error(`Unexpected ${mode} result: ${result.mode}`);
  }

  const confirmed = await confirmParsedResult(
    mode,
    result,
    (draft) => {
      printAiPreview(branch, draft, baseBranch, prNumber);
    },
    { assumeYes },
  );
  if (!confirmed) {
    console.log('Canceled. No git actions were executed.');
    return;
  }

  result = confirmed;

  if (mode === 'update-pr') {
    if (result.mode !== 'update-pr') {
      throw new Error(`Unexpected update-pr result: ${result.mode}`);
    }
    await executeUpdatePr(git, branch, result);
    return;
  }

  if (result.mode !== 'create-pr') {
    throw new Error(`Unexpected create-pr result: ${result.mode}`);
  }

  await executeCreatePr(git, branch, baseBranch, result);
}

async function runStagedWorkflow(
  git: GitClient,
  provider: AiProvider,
  branch: string,
  mode: Mode,
  assumeYes: boolean,
): Promise<void> {
  const inputs = await readStagedPromptInputs(git);
  if (!inputs) return;

  const { stat, diff, conventions } = inputs;
  const fingerprint = stagedDiffFingerprint(stat, diff);

  const cached = await loadCachedDraft(fingerprint, mode);

  let result;

  if (cached) {
    const reuse = await promptForCachedDraftReuse(assumeYes);
    if (reuse) {
      result = cached.result;
      console.log('');
      console.log('Reusing cached AI draft for matching staged changes.\n');
    }
  }

  if (!result) {
    const promptText = await runStep('Loading AI prompt template', () =>
      buildPrompt(mode, stat, diff, conventions),
    );

    const ai = createAiSource(provider, { assumeYes });
    const maxTokens = getMaxTokens(mode);
    const response =
      provider === 'manual'
        ? await ai.ask(promptText, maxTokens)
        : await runStep('Waiting for AI response', () => ai.ask(promptText, maxTokens));
    showResponseTokenResult(provider, response);
    result = parseResult(mode, response.content);
    await saveCachedDraft(fingerprint, mode, result);
  }

  const confirmed = await confirmParsedResult(
    mode,
    result,
    (draft) => {
      printAiPreview(branch, draft);
    },
    { assumeYes },
  );
  if (!confirmed) {
    console.log('Canceled. No git actions were executed.');
    return;
  }

  result = confirmed;

  const stagedFiles = await runStep('Reading staged file list', () => git.stagedFileNames());
  const context = { stagedFiles, sourceBranch: branch };

  if (result.mode === 'branch-commit-pr') {
    await executeBranchCommitPr(git, result, context);
    return;
  }

  if (result.mode === 'branch-commit-push') {
    await executeBranchCommitPush(git, result, context);
    return;
  }

  if (result.mode !== 'commit-push') {
    throw new Error(`Unexpected staged workflow result: ${result.mode}`);
  }

  await executeCommitPush(git, branch, result.commitMessage, context);
}

export async function run(forcedMode?: Mode): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    await printHelp();
    return;
  }

  const dryRun = parseDryRunFromArgs(args);
  const assumeYes = parseYesFromArgs(args);

  await loadProjectConfig();

  const git = new GitClient();
  const branch = (await git.currentBranch()).trim();
  const mode = forcedMode ?? parseModeFromArgs(args) ?? (await promptForMode(branch));

  console.log(`Current branch: ${branch}`);
  console.log(`Mode: ${getModeMeta(mode).label}`);
  if (dryRun) {
    console.log('Dry run: prompt only (no AI, no git actions)\n');
    await runDryRun(git, branch, mode);
    return;
  }

  const provider = parseProviderFromArgs(args) ?? (await promptForProvider());
  console.log(`AI provider: ${PROVIDER_META[provider].label}\n`);

  if (mode === 'create-pr' || mode === 'update-pr') {
    await runBranchPr(git, provider, branch, mode, assumeYes);
    return;
  }

  await runStagedWorkflow(git, provider, branch, mode, assumeYes);
}

if (import.meta.main) {
  run().catch((err) => {
    if (!wasStepErrorLogged(err)) {
      console.error(err instanceof Error ? err.message : err);
    }
    process.exit(1);
  });
}
