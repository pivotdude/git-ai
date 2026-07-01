import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { CONVENTIONS_FILE } from './defaults';
import { getProjectConfig, resolveRepoPath } from './project-config';
import { getRepoRoot } from './repo-root';

async function loadBundledConventions(): Promise<string> {
  const path = `${import.meta.dir}/prompts/git-conventions.md`;
  return Bun.file(path).text();
}

export async function readConventions(): Promise<string> {
  const { conventions } = getProjectConfig();

  if (conventions) {
    const path = await resolveRepoPath(conventions);
    if (!existsSync(path)) {
      throw new Error(`Conventions file not found: ${conventions}`);
    }

    return Bun.file(path).text();
  }

  const repoRoot = await getRepoRoot();
  const projectConventions = join(repoRoot, CONVENTIONS_FILE);
  if (existsSync(projectConventions)) {
    return Bun.file(projectConventions).text();
  }

  return loadBundledConventions();
}
