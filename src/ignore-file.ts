/** Parse a .gitignore-style pattern file (blank lines and # comments skipped). */
export function parseIgnoreFile(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}
