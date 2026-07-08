import type { TokenUsage } from '../types';

interface ChatCompletionUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost?: number | string;
  total_cost?: number | string;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  usage?: ChatCompletionUsage;
  cost?: number | string;
}

function coerceUsdCost(value: number | string | undefined): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseChatCompletionUsage(json: ChatCompletionResponse): TokenUsage | undefined {
  const usage = json.usage;
  const costUsd = coerceUsdCost(usage?.cost ?? usage?.total_cost ?? json.cost);

  if (!usage && costUsd === undefined) return undefined;

  const promptTokens = usage?.prompt_tokens;
  const completionTokens = usage?.completion_tokens;
  const totalTokens =
    usage?.total_tokens ??
    (promptTokens !== undefined && completionTokens !== undefined ? promptTokens + completionTokens : undefined);

  if (promptTokens === undefined && completionTokens === undefined && totalTokens === undefined && costUsd === undefined) {
    return undefined;
  }

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    costUsd,
  };
}
