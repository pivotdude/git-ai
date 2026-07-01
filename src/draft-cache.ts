import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { getRepoRoot } from './repo-root';
import type { Mode, ParsedResult } from './types';

let cacheFilePath: string | null = null;

async function getCacheFilePath(): Promise<string> {
  if (cacheFilePath) return cacheFilePath;

  const repoRoot = await getRepoRoot();
  const repoId = createHash('sha256').update(repoRoot).digest('hex').slice(0, 12);
  cacheFilePath = join(tmpdir(), `git-ai-draft-${repoId}.json`);
  return cacheFilePath;
}

export interface CachedDraft {
  fingerprint: string;
  mode: Mode;
  result: ParsedResult;
}

function normalizeForFingerprint(value: string): string {
  return value.trim().replace(/\r\n/g, '\n');
}

/** Fingerprint staged changes using both diff stat and full diff content. */
export function stagedDiffFingerprint(stat: string, diff: string): string {
  const normalizedStat = normalizeForFingerprint(stat);
  const normalizedDiff = normalizeForFingerprint(diff);
  const diffHash = createHash('sha256').update(normalizedDiff).digest('hex').slice(0, 16);

  return `${normalizedStat}\n---\n${diffHash}`;
}

export async function loadCachedDraft(fingerprint: string, mode: Mode): Promise<CachedDraft | null> {
  try {
    const file = Bun.file(await getCacheFilePath());
    if (!(await file.exists())) return null;

    const parsed = (await file.json()) as CachedDraft;
    if (parsed.fingerprint !== fingerprint || parsed.mode !== mode) return null;

    return parsed;
  } catch {
    return null;
  }
}

export async function saveCachedDraft(fingerprint: string, mode: Mode, result: ParsedResult): Promise<void> {
  const payload: CachedDraft = { fingerprint, mode, result };
  await Bun.write(await getCacheFilePath(), JSON.stringify(payload, null, 2));
}
