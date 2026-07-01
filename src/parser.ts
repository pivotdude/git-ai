import type {
  BranchCommitPrResult,
  BranchCommitPushResult,
  CreatePrResult,
  Mode,
  ParsedResult,
  UpdatePrResult,
} from './types';

function stripSingleCodeFence(raw: string): string {
  return raw.replace(/^```[\w-]*\n?/, '').replace(/\n?```\s*$/, '').trim();
}

function matchTaggedLine(raw: string, tag: string, valuePattern = '(.+)'): RegExpMatchArray | null {
  return raw.match(new RegExp(`^${tag}\\s*:\\s*${valuePattern}$`, 'im'));
}

function normalizeCommitTitle(rawTitle: string): string {
  const title = stripSingleCodeFence(rawTitle).replace(/^`(.+)`$/, '$1').trim();
  const conventional = title.match(/^([a-z]+)(\[[^\]]+\]|\([^)]+\))?:\s+(.+)$/i);
  if (!conventional) return title;

  const [, type, scope = '', description] = conventional;
  return `${type.toLowerCase()}${scope}: ${description.trim()}`;
}

function extractFallbackCommit(raw: string): { title: string; body: string } | null {
  const cleaned = stripSingleCodeFence(raw);
  const lines = cleaned.split(/\r?\n/);

  const conventionalIndex = lines.findIndex((line) => /^[a-z]+(?:\[[^\]]+\]|\([^)]+\))?:\s+\S/i.test(line.trim()));
  const firstNonEmptyIndex = lines.findIndex((line) => line.trim().length > 0);
  const start = conventionalIndex >= 0 ? conventionalIndex : firstNonEmptyIndex;
  if (start < 0) return null;

  let title = lines[start]!.trim().replace(/^[-*]\s+/, '');
  if (/^commit(?:\s+message)?\s*:?\s*$/i.test(title)) {
    const nextNonEmpty = lines.slice(start + 1).findIndex((line) => line.trim().length > 0);
    if (nextNonEmpty >= 0) {
      title = lines[start + 1 + nextNonEmpty]!.trim().replace(/^[-*]\s+/, '');
    }
  }

  if (!title) return null;

  const body = stripSingleCodeFence(lines.slice(start + 1).join('\n').trim());
  return { title: normalizeCommitTitle(title), body };
}

function parseCommitMessage(raw: string): string {
  const commitLine = matchTaggedLine(raw, 'COMMIT');
  if (!commitLine) {
    const fallback = extractFallbackCommit(raw);
    if (!fallback) {
      console.error('Could not parse AI response:\n', raw);
      throw new Error('Expected COMMIT: line or plain commit message in AI response');
    }

    return fallback.body ? `${fallback.title}\n${fallback.body}` : fallback.title;
  }

  const title = normalizeCommitTitle(commitLine[1].trim());
  const start = raw.indexOf(commitLine[0]) + commitLine[0].length;
  const rest = stripSingleCodeFence(raw.slice(start).trim());

  return rest ? `${title}\n${rest}` : title;
}

function parseBranchCommitPush(raw: string): BranchCommitPushResult {
  const branchLine = matchTaggedLine(raw, 'BRANCH');
  const commitLine = matchTaggedLine(raw, 'COMMIT');

  if (!branchLine || !commitLine) {
    console.error('Could not parse AI response:\n', raw);
    throw new Error('Expected BRANCH: and COMMIT: lines in AI response');
  }

  const title = normalizeCommitTitle(commitLine[1].trim());
  const branchName = stripSingleCodeFence(branchLine[1].trim());

  const commitStart = raw.indexOf(commitLine[0]) + commitLine[0].length;
  const commitBody = stripSingleCodeFence(raw.slice(commitStart).trim());

  return {
    mode: 'branch-commit-push',
    branchName,
    commitMessage: commitBody ? `${title}\n${commitBody}` : title,
  };
}

function parseTaggedSection(raw: string, tag: string): string {
  const lines = raw.split(/\r?\n/);
  const headerLineIndex = lines.findIndex((line) => new RegExp(`^${tag}\\s*:`, 'i').test(line));
  if (headerLineIndex < 0) return '';

  const headerLine = lines[headerLineIndex]!;
  const inline = headerLine.replace(new RegExp(`^${tag}\\s*:\\s*`, 'i'), '').trim();
  if (inline) return stripSingleCodeFence(inline);

  return stripSingleCodeFence(lines.slice(headerLineIndex + 1).join('\n').trim());
}

function parseBranchCommitPr(raw: string): BranchCommitPrResult {
  const branchLine = matchTaggedLine(raw, 'BRANCH');
  const commitLine = matchTaggedLine(raw, 'COMMIT');

  if (!branchLine || !commitLine) {
    console.error('Could not parse AI response:\n', raw);
    throw new Error('Expected BRANCH: and COMMIT: lines in AI response');
  }

  const title = normalizeCommitTitle(commitLine[1].trim());
  const branchName = stripSingleCodeFence(branchLine[1].trim());

  const commitStart = raw.indexOf(commitLine[0]) + commitLine[0].length;
  const prLine = matchTaggedLine(raw, 'PR_DESC', '(.*)');
  const prStart = prLine ? raw.indexOf(prLine[0]) : -1;
  const bodySlice = prStart >= 0 ? raw.slice(commitStart, prStart) : raw.slice(commitStart);
  const commitBody = stripSingleCodeFence(bodySlice.trim());

  const prDescription = parseTaggedSection(raw, 'PR_DESC');

  return {
    mode: 'branch-commit-pr',
    branchName,
    title,
    commitMessage: commitBody ? `${title}\n${commitBody}` : title,
    prDescription,
  };
}

function parsePrText(raw: string, mode: 'create-pr' | 'update-pr'): CreatePrResult | UpdatePrResult {
  const titleLine = matchTaggedLine(raw, 'PR_TITLE');

  if (!titleLine) {
    console.error('Could not parse AI response:\n', raw);
    throw new Error('Expected PR_TITLE: line in AI response');
  }

  const title = normalizeCommitTitle(titleLine[1].trim());
  const prDescription = parseTaggedSection(raw, 'PR_DESC');

  return {
    mode,
    title,
    prDescription,
  };
}

function parseCreatePr(raw: string): CreatePrResult {
  return parsePrText(raw, 'create-pr') as CreatePrResult;
}

function parseUpdatePr(raw: string): UpdatePrResult {
  return parsePrText(raw, 'update-pr') as UpdatePrResult;
}

export function parseResult(mode: Mode, raw: string): ParsedResult {
  if (mode === 'create-pr') {
    return parseCreatePr(raw);
  }

  if (mode === 'update-pr') {
    return parseUpdatePr(raw);
  }

  if (mode === 'branch-commit-pr') {
    return parseBranchCommitPr(raw);
  }

  if (mode === 'branch-commit-push') {
    return parseBranchCommitPush(raw);
  }

  return {
    mode: 'commit-push',
    commitMessage: parseCommitMessage(raw),
  };
}
