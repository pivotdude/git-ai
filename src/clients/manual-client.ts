import { copyToClipboard } from '../clipboard';
import { promptForManualPromptAction, promptForManualResponseReady } from '../cli';
import { openFileInEditor, readFileText, resolveEditor } from '../editor';
import { stripEditComments } from '../result-edit';
import { safeUnlink, tempFile } from '../temp-files';
import type { AiSource, AiResponse } from '../types';

const RESPONSE_HEADER = '# Paste the AI response below this line, save, and close the editor.\n\n';

async function readStdinUntilEof(): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: string[] = [];

    process.stdin.setEncoding('utf8');
    process.stdin.resume();
    process.stdin.on('data', (chunk) => chunks.push(String(chunk)));
    process.stdin.on('end', () => resolve(chunks.join('').trim()));
    process.stdin.on('error', reject);
  });
}

async function collectResponseFromEditor(responsePath: string): Promise<string> {
  await openFileInEditor(responsePath);

  const content = stripEditComments((await readFileText(responsePath)).replace(RESPONSE_HEADER, ''));
  if (!content) throw new Error('Empty manual AI response');
  return content;
}

async function collectResponseFromStdin(): Promise<string> {
  console.log('Paste the AI response below, then press Ctrl+D when done:\n');
  const content = await readStdinUntilEof();
  if (!content) throw new Error('Empty manual AI response');
  return content;
}

function printManualPrompt(prompt: string, promptPath: string): void {
  console.log('');
  console.log('[MANUAL] Copy the prompt below and paste it into any AI chat.');
  console.log('[MANUAL] Send it, wait for the response, then choose Continue in the next step.');
  console.log(`[MANUAL] Prompt file: ${promptPath}`);
  console.log('----------------------------------------');
  console.log(prompt);
  console.log('----------------------------------------');
  console.log('');
}

async function collectManualResponseInteractive(
  prompt: string,
  promptPath: string,
  responsePath: string,
): Promise<string> {
  const editor = resolveEditor();
  const action = await promptForManualPromptAction(editor);

  if (action === 'cancel') {
    throw new Error('Manual input canceled');
  }

  if (action === 'copy') {
    await copyToClipboard(prompt);
    console.log('[MANUAL] Prompt copied to clipboard.');
  } else {
    printManualPrompt(prompt, promptPath);

    const ready = await promptForManualResponseReady();
    if (!ready) {
      throw new Error('Manual input canceled');
    }
  }

  console.log(`[MANUAL] Opening ${editor}...`);
  return await collectResponseFromEditor(responsePath);
}

export class ManualAiClient implements AiSource {
  async ask(prompt: string, _maxTokens: number): Promise<AiResponse> {
    const promptPath = tempFile('git-ai-prompt', 'md');
    const responsePath = tempFile('git-ai-response', 'md');

    try {
      await Bun.write(promptPath, prompt);
      await Bun.write(responsePath, RESPONSE_HEADER);

      if (process.stdin.isTTY && process.stdout.isTTY) {
        return { content: await collectManualResponseInteractive(prompt, promptPath, responsePath) };
      }

      return { content: await collectResponseFromStdin() };
    } finally {
      await safeUnlink(promptPath);
      await safeUnlink(responsePath);
    }
  }
}
