import { join } from 'node:path';

import { safeUnlink, tempFile } from '../temp-files';
import type { AiSource, AiResponse, CursorSdkConfig } from '../types';

const RUNNER_PATH = join(import.meta.dir, 'cursor-sdk-runner.mjs');

export class CursorSdkClient implements AiSource {
  constructor(private readonly config: CursorSdkConfig) {}

  async ask(prompt: string, _maxTokens: number): Promise<AiResponse> {
    const promptPath = tempFile('git-ai-cursor-prompt', 'md');

    try {
      await Bun.write(promptPath, prompt);

      const proc = Bun.spawn(['node', RUNNER_PATH, promptPath], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          CURSOR_API_KEY: this.config.apiKey,
          CURSOR_MODEL: this.config.model,
        },
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);

      if (exitCode !== 0) {
        const details = stderr.trim() || stdout.trim() || `exit code ${exitCode}`;
        throw new Error(`Cursor SDK request failed: ${details}`);
      }

      const content = stdout.trim();
      if (!content) throw new Error('Empty response from Cursor agent');
      return { content };
    } finally {
      await safeUnlink(promptPath);
    }
  }
}
