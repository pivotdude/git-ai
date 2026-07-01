let cachedRepoRoot: string | null = null;

export async function getRepoRoot(): Promise<string> {
  if (cachedRepoRoot) return cachedRepoRoot;

  const root = (await Bun.$`git rev-parse --show-toplevel`.text()).trim();
  if (!root) throw new Error('Not inside a git repository');

  cachedRepoRoot = root;
  return root;
}
