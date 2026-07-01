import type { Mode } from './types';
import { getBaseBranchOrDefault } from './project-config';
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

export function getMaxTokens(mode: Mode): number {
  return MODE_META[mode].maxTokens;
}
