async function pipeToClipboard(command: string[], text: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(command, { stdin: 'pipe', stdout: 'ignore', stderr: 'ignore' });
    proc.stdin.write(text);
    proc.stdin.end();
    return (await proc.exited) === 0;
  } catch {
    return false;
  }
}

const CLIPBOARD_COMMANDS: string[][] = [
  ['wl-copy'],
  ['xclip', '-selection', 'clipboard'],
  ['xsel', '--clipboard', '--input'],
  ['pbcopy'],
  ['clip'],
];

export async function copyToClipboard(text: string): Promise<void> {
  for (const command of CLIPBOARD_COMMANDS) {
    if (await pipeToClipboard(command, text)) return;
  }

  throw new Error('No clipboard tool found. Install wl-clipboard, xclip, or xsel.');
}
