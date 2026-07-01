import { withoutDiffIgnoredFiles } from '../diff-ignore';
import { formatShellError } from '../shell-error';

export interface OpenPrInfo {
  number: number;
  title: string;
  body: string;
  url: string;
  baseBranch: string;
}

export class GitClient {
  private async runShell(command: string, action: () => Promise<string>): Promise<string> {
    try {
      return await action();
    } catch (error) {
      throw new Error(formatShellError(command, error), { cause: error });
    }
  }

  async run(args: string[]): Promise<string> {
    const command = `git ${args.join(' ')}`;
    return this.runShell(command, () => Bun.$`git ${args}`.text());
  }

  currentBranch(): Promise<string> {
    return this.run(['branch', '--show-current']);
  }

  private async diffStat(args: string[], changedFiles: () => Promise<string[]>): Promise<string> {
    const files = withoutDiffIgnoredFiles(await changedFiles());
    if (files.length === 0) return '';
    return this.run([...args, '--stat', '--', ...files]);
  }

  private async diffFull(args: string[], changedFiles: () => Promise<string[]>): Promise<string> {
    const files = withoutDiffIgnoredFiles(await changedFiles());
    if (files.length === 0) return '';
    return this.run([...args, '--', ...files]);
  }

  stagedStat(): Promise<string> {
    return this.diffStat(['diff', '--cached'], () => this.stagedFileNames());
  }

  stagedDiff(): Promise<string> {
    return this.diffFull(['diff', '--cached'], () => this.stagedFileNames());
  }

  /** Commits reachable from HEAD but not from base (PR-only commits). */
  rangeLog(base: string): Promise<string> {
    return this.run(['log', `${base}..HEAD`, '--oneline', '--no-decorate']);
  }

  /** Diff from merge-base to HEAD (what the PR would change). */
  rangeChangedFileNames(base: string): Promise<string[]> {
    return this.run(['diff', `${base}...HEAD`, '--name-only']).then((text) =>
      text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    );
  }

  rangeStat(base: string): Promise<string> {
    return this.diffStat(['diff', `${base}...HEAD`], () => this.rangeChangedFileNames(base));
  }

  /** Diff from merge-base to HEAD (what the PR would change). */
  rangeDiff(base: string): Promise<string> {
    return this.diffFull(['diff', `${base}...HEAD`], () => this.rangeChangedFileNames(base));
  }

  async hasCommitsAhead(base: string): Promise<boolean> {
    const count = (await this.run(['rev-list', '--count', `${base}..HEAD`])).trim();
    return Number.parseInt(count, 10) > 0;
  }

  checkoutBranch(name: string): Promise<string> {
    return this.run(['checkout', '-b', name]);
  }

  checkoutExisting(name: string): Promise<string> {
    return this.run(['checkout', name]);
  }

  deleteBranch(name: string): Promise<string> {
    return this.run(['branch', '-D', name]);
  }

  stagedFileNames(): Promise<string[]> {
    return this.run(['diff', '--cached', '--name-only']).then((text) =>
      text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    );
  }

  addFiles(paths: string[]): Promise<string> {
    if (paths.length === 0) return Promise.resolve('');
    return this.run(['add', '--', ...paths]);
  }

  commitFromFile(filePath: string): Promise<string> {
    return this.run(['commit', '-F', filePath]);
  }

  pushCurrentBranch(): Promise<string> {
    return this.run(['push']);
  }

  pushCurrentBranchWithUpstream(branch: string): Promise<string> {
    return this.run(['push', '-u', 'origin', branch]);
  }

  pushBranch(branch: string): Promise<string> {
    return this.run(['push', '-u', 'origin', branch]);
  }

  createPr(title: string, bodyFile: string, baseBranch = 'main'): Promise<string> {
    const command = `gh pr create --base ${baseBranch} --title ${title} --body-file ${bodyFile}`;
    return this.runShell(command, () =>
      Bun.$`gh pr create --base ${baseBranch} --title ${title} --body-file ${bodyFile}`.text(),
    );
  }

  async currentOpenPr(): Promise<OpenPrInfo | null> {
    try {
      const json = await Bun.$`gh pr view --json number,title,body,url,baseRefName`.text();
      const parsed = JSON.parse(json.trim()) as {
        number: number;
        title?: string;
        body?: string;
        url?: string;
        baseRefName?: string;
      };

      return {
        number: parsed.number,
        title: parsed.title ?? '',
        body: parsed.body ?? '',
        url: parsed.url ?? '',
        baseBranch: parsed.baseRefName ?? 'main',
      };
    } catch {
      return null;
    }
  }

  updatePr(title: string, bodyFile: string): Promise<string> {
    const command = `gh pr edit --title ${title} --body-file ${bodyFile}`;
    return this.runShell(command, () => Bun.$`gh pr edit --title ${title} --body-file ${bodyFile}`.text());
  }
}
