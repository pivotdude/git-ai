import { emitKeypressEvents } from 'node:readline';

import { MODE_ORDER, PROVIDER_META, PROVIDER_ORDER } from './constants';
import { getModeMeta } from './mode-meta';
import { loadProjectConfig } from './project-config';
import { resolveEditor } from './editor';
import type { AiProvider, Mode, ParsedResult } from './types';

export type ExecutionConfirmation = 'yes' | 'no' | 'edit';

interface SelectOption<T> {
  value: T;
  label: string;
  shortcuts?: string[];
}

const ANSI_RESET = '\u001b[0m';
const ANSI_BOLD = '\u001b[1m';
const ANSI_DIM = '\u001b[2m';
const ANSI_CYAN = '\u001b[36m';
const ANSI_MAGENTA = '\u001b[35m';
const ANSI_GREEN = '\u001b[32m';

function useColor(): boolean {
  return !!process.stdout.isTTY && !process.env.NO_COLOR;
}

function paint(text: string, ansi: string): string {
  if (!useColor()) return text;
  return `${ansi}${text}${ANSI_RESET}`;
}

function sectionTitle(text: string): string {
  return paint(text, `${ANSI_BOLD}${ANSI_MAGENTA}`);
}

function keyLabel(text: string): string {
  return paint(text, `${ANSI_BOLD}${ANSI_CYAN}`);
}

function valueLabel(text: string): string {
  return paint(text, ANSI_BOLD);
}

function hintText(text: string): string {
  return paint(text, ANSI_DIM);
}

export async function printHelp() {
  try {
    await loadProjectConfig();
  } catch {
    // Help works outside a git repo; mode labels fall back to default base branch.
  }
  const modeLines = MODE_ORDER.map((mode) => {
    const meta = getModeMeta(mode);
    const name = mode.padEnd(20);
    return `  ${name}${meta.help}`;
  });

  const providerLines = PROVIDER_ORDER.map((provider) => {
    const meta = PROVIDER_META[provider];
    const name = provider.padEnd(20);
    return `  ${name}${meta.help}`;
  });

  console.log(
    [
      'Usage:',
      '  git-ai',
      ...MODE_ORDER.map((mode) => `  git-ai --mode ${mode}`),
      '  git-ai --provider cursor-sdk',
      '  git-ai --dry-run --mode commit-push',
      '',
      'In a monorepo you can also wire a package script, e.g. bun run git:ai',
      '',
      'Project config (optional): .git-ai/ at the git repository root',
      '  .git-ai/config.json       settings (baseBranch, stagedFix, ...)',
      '  .git-ai/diff-ignore       .gitignore-style paths omitted from AI diffs',
      '  .git-ai/prompts/*.md      per-mode prompt overrides',
      '  .git-ai/conventions.md    commit/branch conventions for the AI',
      '',
      'Flags:',
      '  --dry-run, -n             Print the AI prompt only (no AI call, no git actions)',
      '  --yes, -y                 Skip yes/no confirmations and apply the AI draft',
      '',
      'Modes:',
      ...modeLines,
      '',
      'AI providers:',
      ...providerLines,
      '',
      'Legend:',
      '  Staged — changes added with git add',
      '  Branch — commits already on the current branch',
    ].join('\n'),
  );
}

export function parseDryRunFromArgs(args: string[]): boolean {
  return args.includes('--dry-run') || args.includes('-n');
}

export function parseYesFromArgs(args: string[]): boolean {
  return args.includes('--yes') || args.includes('-y');
}

export function printDryRunPrompt(promptText: string): void {
  console.log('--- git-ai prompt (dry-run) ---\n');
  console.log(promptText);
  console.log('\n--- end prompt ---');
}

export function parseModeFromArgs(args: string[]): Mode | null {
  const modeArgIndex = args.findIndex((arg) => arg === '--mode');
  if (modeArgIndex >= 0) {
    const value = args[modeArgIndex + 1];
    if (!value) throw new Error('Missing value for --mode');
    return parseModeValue(value);
  }

  const modeInline = args.find((arg) => arg.startsWith('--mode='));
  if (modeInline) {
    return parseModeValue(modeInline.slice('--mode='.length));
  }

  const positional = args.find((arg) => !arg.startsWith('-'));
  if (positional) {
    return parseModeValue(positional);
  }

  return null;
}

function parseModeValue(value: string): Mode {
  if (
    value === 'branch-commit-pr' ||
    value === 'branch-commit-push' ||
    value === 'commit-push' ||
    value === 'create-pr' ||
    value === 'update-pr'
  ) {
    return value;
  }
  throw new Error(
    `Unknown mode "${value}". Expected: branch-commit-pr | branch-commit-push | commit-push | create-pr | update-pr`,
  );
}

export function parseProviderFromArgs(args: string[]): AiProvider | null {
  const providerArgIndex = args.findIndex((arg) => arg === '--provider');
  if (providerArgIndex >= 0) {
    const value = args[providerArgIndex + 1];
    if (!value) throw new Error('Missing value for --provider');
    return parseProviderValue(value);
  }

  const providerInline = args.find((arg) => arg.startsWith('--provider='));
  if (providerInline) {
    return parseProviderValue(providerInline.slice('--provider='.length));
  }

  return null;
}

function parseProviderValue(value: string): AiProvider {
  if (value === 'openai' || value === 'cursor-sdk' || value === 'manual') {
    return value;
  }
  throw new Error(`Unknown provider "${value}". Expected: openai | cursor-sdk | manual`);
}

function parseYesNoInput(raw: string | null | undefined): boolean | null {
  const value = raw?.trim().toLowerCase();
  if (!value) return null;

  if (value === 'yes' || value === 'y' || value === '1') return true;
  if (value === 'no' || value === 'n' || value === '2') return false;
  return null;
}

async function promptSelection<T>(params: {
  headerLines: string[];
  options: Array<SelectOption<T>>;
  fallbackQuestion: string;
  fallbackParser: (answer: string | null | undefined) => T | null;
}): Promise<T> {
  const { headerLines, options, fallbackQuestion, fallbackParser } = params;

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    if (typeof prompt !== 'function') {
      throw new Error('Interactive prompt is unavailable. Pass explicit CLI arguments.');
    }

    while (true) {
      const answer = prompt(fallbackQuestion);
      if (answer === null) {
        throw new Error('Input closed (EOF). Pass explicit CLI arguments.');
      }

      const parsed = fallbackParser(answer);
      if (parsed !== null) return parsed;
    }
  }

  let selectedIndex = 0;
  let renderedLines = 0;
  const shortcuts = new Map<string, T>();

  options.forEach((option) => {
    for (const key of option.shortcuts ?? []) {
      shortcuts.set(key.toLowerCase(), option.value);
    }
  });

  const render = () => {
    if (renderedLines > 0) {
      process.stdout.write(`\u001b[${renderedLines}A`);
    }

    const lines = [
      ...headerLines,
      ...options.map((option, index) => {
        if (index === selectedIndex) {
          return `${paint('->', ANSI_GREEN)} ${paint(option.label, `${ANSI_BOLD}${ANSI_CYAN}`)}`;
        }

        return `   ${hintText(option.label)}`;
      }),
    ];

    for (const line of lines) {
      process.stdout.write('\u001b[2K');
      process.stdout.write(`${line}\n`);
    }

    renderedLines = lines.length;
  };

  const previousRawMode = process.stdin.isRaw;
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdout.write('\u001b[?25l');

  render();

  return await new Promise<T>((resolve, reject) => {
    const cleanup = () => {
      process.stdin.off('keypress', onKeyPress);
      process.stdin.setRawMode(previousRawMode ?? false);
      process.stdin.pause();
      process.stdout.write('\u001b[?25h');
      process.stdout.write('\n');
    };

    const onKeyPress = (_: string, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        reject(new Error('Selection cancelled'));
        return;
      }

      if (key.name === 'up') {
        selectedIndex = (selectedIndex - 1 + options.length) % options.length;
        render();
        return;
      }

      if (key.name === 'down') {
        selectedIndex = (selectedIndex + 1) % options.length;
        render();
        return;
      }

      if (key.name === 'return' || key.name === 'enter') {
        const selected = options[selectedIndex];
        cleanup();
        resolve(selected.value);
        return;
      }

      if (key.name) {
        const mapped = shortcuts.get(key.name.toLowerCase());
        if (mapped !== undefined) {
          cleanup();
          resolve(mapped);
        }
      }
    };

    process.stdin.on('keypress', onKeyPress);
  });
}

export async function promptForMode(currentBranch?: string): Promise<Mode> {
  return promptSelection<Mode>({
    headerLines: [
      sectionTitle('[MODE] Choose action'),
      `${keyLabel('Current branch:')} ${valueLabel(currentBranch ?? 'unknown')}`,
      hintText('Staged = git add first · Branch = commits on this branch'),
      hintText('Use Up/Down and Enter to choose'),
    ],
    options: MODE_ORDER.map((mode, index) => ({
      value: mode,
      label: getModeMeta(mode).label,
      shortcuts: [String(index + 1)],
    })),
    fallbackQuestion: `Current branch: ${currentBranch ?? 'unknown'}. Select [1-5]: `,
    fallbackParser: (answer) => {
      const normalized = answer?.trim();
      if (normalized === '1') return 'branch-commit-pr';
      if (normalized === '2') return 'branch-commit-push';
      if (normalized === '3') return 'commit-push';
      if (normalized === '4') return 'create-pr';
      if (normalized === '5') return 'update-pr';
      return null;
    },
  });
}

export async function promptForProvider(): Promise<AiProvider> {
  return promptSelection<AiProvider>({
    headerLines: [
      sectionTitle('[PROVIDER] Choose AI source'),
      hintText('OpenAI-compatible uses your API endpoint'),
      hintText('Cursor SDK uses models from your Cursor subscription'),
      hintText('Manual lets you copy the prompt and paste the response'),
      hintText('Use Up/Down and Enter to choose'),
    ],
    options: PROVIDER_ORDER.map((provider, index) => ({
      value: provider,
      label: PROVIDER_META[provider].label,
      shortcuts: [String(index + 1)],
    })),
    fallbackQuestion: 'Select AI provider [1-3]: ',
    fallbackParser: (answer) => {
      const normalized = answer?.trim();
      if (normalized === '1') return 'openai';
      if (normalized === '2') return 'cursor-sdk';
      if (normalized === '3') return 'manual';
      return null;
    },
  });
}

export function printAiPreview(
  currentBranch: string,
  result: ParsedResult,
  baseBranch?: string,
  prNumber?: number,
) {
  if (result.mode === 'create-pr' || result.mode === 'update-pr') {
    const actionLabel = result.mode === 'update-pr' ? 'Updated PR draft' : 'Generated draft';

    console.log('');
    console.log(sectionTitle(`[AI PREVIEW] ${actionLabel}`));
    console.log(`${keyLabel('Current branch:')} ${valueLabel(currentBranch)}`);
    console.log(`${keyLabel('Base branch:')} ${valueLabel(baseBranch ?? 'main')}`);
    if (prNumber) {
      console.log(`${keyLabel('PR:')} ${valueLabel(`#${prNumber}`)}`);
    }
    console.log(`${keyLabel('PR title:')} ${valueLabel(result.title)}`);
    console.log(hintText('----------------------------------------'));
    console.log(sectionTitle('[PR MESSAGE]'));
    console.log(result.prDescription || '(empty)');
    console.log('');
    return;
  }

  const commitTitle = result.commitMessage.split('\n')[0] ?? '';
  const targetBranch = result.mode === 'branch-commit-pr' || result.mode === 'branch-commit-push' ? result.branchName : null;
  const prTitle = result.mode === 'branch-commit-pr' ? result.title : null;
  const prMessage = result.mode === 'branch-commit-pr' ? result.prDescription || '(empty)' : null;

  console.log('');
  console.log(sectionTitle('[AI PREVIEW] Generated draft'));
  console.log(`${keyLabel('Current branch:')} ${valueLabel(currentBranch)}`);
  if (targetBranch) {
    console.log(`${keyLabel('Target branch:')} ${valueLabel(targetBranch)}`);
  }
  console.log(`${keyLabel('Commit title:')} ${valueLabel(commitTitle)}`);
  if (prTitle) {
    console.log(`${keyLabel('PR title:')} ${valueLabel(prTitle)}`);
  }
  console.log(hintText('----------------------------------------'));
  console.log(sectionTitle('[COMMIT MESSAGE]'));
  console.log(result.commitMessage);

  if (prMessage) {
    console.log('');
    console.log(sectionTitle('[PR MESSAGE]'));
    console.log(prMessage);
  }

  console.log('');
}

function parseExecutionConfirmationInput(raw: string | null | undefined): ExecutionConfirmation | null {
  const value = raw?.trim().toLowerCase();
  if (!value) return null;

  if (value === 'yes' || value === 'y' || value === '1') return 'yes';
  if (value === 'no' || value === 'n' || value === '2') return 'no';
  if (value === 'edit' || value === 'e' || value === '3') return 'edit';
  return null;
}

export async function promptForExecutionConfirmation(): Promise<ExecutionConfirmation> {
  const editor = resolveEditor();

  return promptSelection<ExecutionConfirmation>({
    headerLines: [
      sectionTitle('[ACTION] Apply these changes?'),
      hintText('Use Up/Down and Enter to choose'),
    ],
    options: [
      { value: 'yes', label: 'Yes', shortcuts: ['y', '1'] },
      { value: 'edit', label: 'Edit fields', shortcuts: ['e', '3'] },
      { value: 'no', label: 'No', shortcuts: ['n', '2'] },
    ],
    fallbackQuestion: `Apply these changes? [yes/edit/no] (${editor}): `,
    fallbackParser: parseExecutionConfirmationInput,
  });
}

function parseEditFieldInput<T extends string>(
  raw: string | null | undefined,
  fields: Array<{ id: T; label: string }>,
): T | 'back' | null {
  const value = raw?.trim().toLowerCase();
  if (!value) return null;

  if (value === 'back' || value === 'b' || value === '0') return 'back';

  const index = Number.parseInt(value, 10);
  if (!Number.isNaN(index) && index >= 1 && index <= fields.length) {
    return fields[index - 1]!.id;
  }

  const byId = fields.find((field) => field.id.toLowerCase() === value);
  if (byId) return byId.id;

  const byLabel = fields.find((field) => field.label.toLowerCase() === value);
  if (byLabel) return byLabel.id;

  return null;
}

export async function promptForEditField<T extends string>(
  fields: Array<{ id: T; label: string }>,
): Promise<T | null> {
  if (fields.length === 0) return null;
  if (fields.length === 1) return fields[0]!.id;

  const choice = await promptSelection<T | 'back'>({
    headerLines: [
      sectionTitle('[EDIT] What to change?'),
      hintText('Use Up/Down and Enter to choose'),
    ],
    options: [
      ...fields.map((field, index) => ({
        value: field.id,
        label: field.label,
        shortcuts: [String(index + 1)],
      })),
      { value: 'back', label: 'Back to preview', shortcuts: ['b', '0'] },
    ],
    fallbackQuestion: 'Edit which field? [number/back]: ',
    fallbackParser: (raw) => parseEditFieldInput(raw, fields),
  });

  return choice === 'back' ? null : choice;
}

export async function promptForCachedDraftReuse(assumeYes = false): Promise<boolean> {
  if (assumeYes) return true;

  return promptSelection<boolean>({
    headerLines: [
      sectionTitle('[CACHE] Matching staged changes found'),
      hintText('A previous AI draft matches the current staged changes'),
      hintText('Reuse it to skip the AI call?'),
      hintText('Use Up/Down and Enter to choose'),
    ],
    options: [
      { value: true, label: 'Yes, reuse draft', shortcuts: ['y', '1'] },
      { value: false, label: 'No, generate again', shortcuts: ['n', '2'] },
    ],
    fallbackQuestion: 'Reuse cached draft? [yes/no]: ',
    fallbackParser: parseYesNoInput,
  });
}

export type ManualPromptAction = 'copy' | 'show' | 'cancel';

export async function promptForManualPromptAction(editor: string): Promise<ManualPromptAction> {
  return promptSelection<ManualPromptAction>({
    headerLines: [
      sectionTitle('[MANUAL] What next?'),
      `${keyLabel('Editor:')} ${valueLabel(editor)}`,
      hintText('Copy puts the prompt on the clipboard'),
      hintText('Show prints the prompt in the terminal'),
      hintText('Set EDITOR or VISUAL in .env or shell to change the editor'),
      hintText('Use Up/Down and Enter to choose'),
    ],
    options: [
      { value: 'copy', label: 'Copy prompt to clipboard', shortcuts: ['c', '1'] },
      { value: 'show', label: 'Show prompt', shortcuts: ['s', '2'] },
      { value: 'cancel', label: 'Cancel', shortcuts: ['n', '3'] },
    ],
    fallbackQuestion: 'Choose [1=copy / 2=show / 3=cancel]: ',
    fallbackParser: (answer) => {
      const normalized = answer?.trim().toLowerCase();
      if (normalized === '1' || normalized === 'c' || normalized === 'copy') return 'copy';
      if (normalized === '2' || normalized === 's' || normalized === 'show') return 'show';
      if (normalized === '3' || normalized === 'n' || normalized === 'cancel') return 'cancel';
      return null;
    },
  });
}

export async function promptForManualResponseReady(): Promise<boolean> {
  return promptSelection<boolean>({
    headerLines: [
      sectionTitle('[MANUAL] Next step'),
      hintText('Paste the prompt into any AI chat and send it.'),
      hintText('When you have the response, continue to open the editor and paste it there.'),
      hintText('Use Up/Down and Enter to choose'),
    ],
    options: [
      { value: true, label: 'Continue', shortcuts: ['y', '1'] },
      { value: false, label: 'Cancel', shortcuts: ['n', '2'] },
    ],
    fallbackQuestion: 'Continue? [yes/cancel]: ',
    fallbackParser: (answer) => {
      const normalized = answer?.trim().toLowerCase();
      if (!normalized || normalized === 'y' || normalized === 'yes' || normalized === '1') return true;
      if (normalized === 'n' || normalized === 'no' || normalized === '2' || normalized === 'cancel') return false;
      return null;
    },
  });
}
