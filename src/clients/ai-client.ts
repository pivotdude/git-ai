import type { AiSource, AiResponse, OpenAiConfig } from '../types';
import { buildReasoningRequestBodyForBaseUrl, resolveReasoningLevel } from '../ai-reasoning';
import { getProjectConfig } from '../project-config';
import {
  escalateMaxTokens,
  parseChatCompletionChoice,
} from './chat-completion-content';
import { parseChatCompletionUsage } from './openai-usage';

const MAX_ATTEMPTS = 10;
const RETRY_BASE_DELAY_MS = 1500;

interface ChatCompletionResponse {
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: string | null;
      reasoning_content?: string | null;
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
  if (error.message.startsWith('AI used all tokens on reasoning')) return false;

  const statusMatch = error.message.match(/AI request failed \((\d+)\)/);
  if (!statusMatch) return true;

  const status = Number(statusMatch[1]);
  return status === 429 || status >= 500;
}

function retryDelayMs(attempt: number): number {
  return RETRY_BASE_DELAY_MS * attempt;
}

function emptyResponseError(parsed: ReturnType<typeof parseChatCompletionChoice>): Error {
  if (parsed.hasReasoningOnly) {
    return new Error(
      'AI used all tokens on reasoning; increase ai.maxTokens in .git-ai/config.json or use a non-reasoning model'
    );
  }

  return new Error('Empty response from AI');
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
    const first = await this.fetchCompletion(prompt, maxTokens);
    const parsed = parseChatCompletionChoice(first.json.choices?.[0]);

    if (parsed.content) {
      return {
        content: parsed.content,
        usage: parseChatCompletionUsage(first.json),
      };
    }

    if (parsed.shouldEscalateTokens) {
      const escalated = escalateMaxTokens(maxTokens);
      if (escalated > maxTokens) {
        const second = await this.fetchCompletion(prompt, escalated);
        const retryParsed = parseChatCompletionChoice(second.json.choices?.[0]);
        if (retryParsed.content) {
          return {
            content: retryParsed.content,
            usage: parseChatCompletionUsage(second.json),
          };
        }
      }
    }

    throw emptyResponseError(parsed);
  }

  private async fetchCompletion(
    prompt: string,
    maxTokens: number,
  ): Promise<{ json: ChatCompletionResponse }> {
    let reasoningLevel = resolveReasoningLevel({});
    let aiConfig = {};

    try {
      const project = getProjectConfig();
      reasoningLevel = resolveReasoningLevel(project.ai);
      aiConfig = project.ai;
    } catch {
      // Project config not loaded; use default reasoning level.
    }

    const reasoningBody = buildReasoningRequestBodyForBaseUrl(
      reasoningLevel,
      this.config.baseUrl,
      aiConfig,
    );

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
          ...reasoningBody,
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

    return { json: (await res.json()) as ChatCompletionResponse };
  }
}
