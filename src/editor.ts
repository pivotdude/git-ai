export function resolveEditor(): string {
  return process.env.VISUAL ?? process.env.EDITOR ?? 'nano';
}

export function editorCommand(filePath: string): string[] {
  const editor = resolveEditor();
  const parts = editor.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [editor];
  return [...parts.map((part) => part.replace(/^['"]|['"]$/g, '')), filePath];
}

export async function openFileInEditor(filePath: string): Promise<void> {
  const child = Bun.spawn(editorCommand(filePath), {
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  });

  const exitCode = await child.exited;
  if (exitCode !== 0) {
    throw new Error(`Editor exited with code ${exitCode}`);
  }
}

export async function readFileText(filePath: string): Promise<string> {
  return Bun.file(filePath).text();
}
