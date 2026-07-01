import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function tempFile(prefix: string, extension: string): string {
  const suffix = `${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  return join(tmpdir(), `${prefix}-${suffix}.${extension}`);
}

export async function safeUnlink(path: string | null): Promise<void> {
  if (!path) return;
  try {
    await unlink(path);
  } catch {
    // ignore temp cleanup failures
  }
}
