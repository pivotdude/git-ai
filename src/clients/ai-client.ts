import type { AiSource, AiResponse, OpenAiConfig } from '../types';
import { parseChatCompletionUsage } from './openai-usage';

const MAX_ATTEMPTS = 10;
const RETRY_BASE_DELAY_MS = 1500;

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number;
    total_cost?: number;
  };
  cost?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: Error): boolean {
  if (error.message === 'Empty response from AI') return true;

  const statusMatch = error.message.match(/AI request failed \((\d+)\)/);
  if (!statusMatch) return true;

  const status = Number(statusMatch[1]);
  return status === 429 || status >= 500;
}

function retryDelayMs(attempt: number): number {
  return RETRY_BASE_DELAY_MS * attempt;
}

export class AiClient implements AiSource {
  constructor(private readonly config: OpenAiConfig) {}

  async ask(prompt: string, maxTokens: number): Promise<AiResponse> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await this.requestOnce(prompt, maxTokens);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error), { cause: error });
        const canRetry = attempt < MAX_ATTEMPTS && isRetryableError(lastError);
        if (!canRetry) throw lastError;

        const delayMs = retryDelayMs(attempt);
        console.error(
          `AI request failed (${lastError.message}), retrying ${attempt + 1}/${MAX_ATTEMPTS} in ${(delayMs / 1000).toFixed(1)}s...`
        );
        await sleep(delayMs);
      }
    }

    throw lastError ?? new Error('AI request failed');
  }

  private async requestOnce(prompt: string, maxTokens: number): Promise<AiResponse> {
    let res: Response;
    try {
      res = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 1.0,
          max_tokens: maxTokens,
          // provider: {
          //   order: ['deepinfra'],
          // },
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`AI request failed (network): ${message}`, { cause: error });
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`AI request failed (${res.status}): ${body}`);
    }

    const json = (await res.json()) as ChatCompletionResponse;
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('Empty response from AI');

    return {
      content,
      usage: parseChatCompletionUsage(json),
    };
  }
}
