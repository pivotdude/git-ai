import type { TokenUsage } from '../types';

interface ChatCompletionUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost?: number;
  total_cost?: number;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  usage?: ChatCompletionUsage;
  cost?: number;
}

export function parseChatCompletionUsage(json: ChatCompletionResponse): TokenUsage | undefined {
  const usage = json.usage;
  const costUsd =
    usage?.cost ??
    usage?.total_cost ??
    json.cost ??
  undefined;

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
