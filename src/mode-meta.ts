import type { Mode } from './types';
import type { AiProjectConfig } from './project-config';
import { getBaseBranchOrDefault, getProjectConfig } from './project-config';
import { MODE_META, type ModeMeta } from './constants';

export function getModeMeta(mode: Mode, baseBranch = getBaseBranchOrDefault()): ModeMeta {
  const meta = MODE_META[mode];

  if (mode === 'create-pr') {
    return {
      ...meta,
      label: `Branch → PR to ${baseBranch}`,
      help: `Existing commits on this branch: open PR to ${baseBranch}`,
    };
  }

  if (mode === 'update-pr') {
    return {
      ...meta,
      help: `Open PR exists: regenerate title and description from branch..${baseBranch} diff`,
    };
  }

  return meta;
}

export function resolveMaxTokens(mode: Mode, ai: AiProjectConfig): number {
  const byMode = ai.maxTokensByMode?.[mode];
  if (byMode !== undefined) return byMode;
  if (ai.maxTokens !== undefined) return ai.maxTokens;
  return MODE_META[mode].maxTokens;
}

export function getMaxTokens(mode: Mode): number {
  try {
    return resolveMaxTokens(mode, getProjectConfig().ai);
  } catch {
    return MODE_META[mode].maxTokens;
  }
}
