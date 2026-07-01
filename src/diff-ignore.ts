import ignore, { type Ignore } from 'ignore';

let matcher: Ignore | null = null;

export function initDiffIgnore(patterns: readonly string[]): void {
  matcher = ignore().add([...patterns]);
}

function getMatcher(): Ignore {
  if (!matcher) {
    throw new Error('Diff ignore patterns are not initialized. Call loadProjectConfig() first.');
  }

  return matcher;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

export function isDiffIgnoredFile(path: string): boolean {
  return getMatcher().ignores(normalizePath(path));
}

export function withoutDiffIgnoredFiles(paths: readonly string[]): string[] {
  return getMatcher().filter(paths.map(normalizePath));
}
