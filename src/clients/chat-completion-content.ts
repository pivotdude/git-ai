export interface ChatCompletionMessage {
  content?: string | null;
  reasoning_content?: string | null;
}

export interface ParsedChatCompletion {
  content: string;
  hasReasoningOnly: boolean;
  shouldEscalateTokens: boolean;
}

export function parseChatCompletionChoice(choice?: {
  finish_reason?: string | null;
  message?: ChatCompletionMessage;
}): ParsedChatCompletion {
  const content = choice?.message?.content?.trim() ?? '';
  if (content) {
    return { content, hasReasoningOnly: false, shouldEscalateTokens: false };
  }

  const reasoning = choice?.message?.reasoning_content?.trim() ?? '';
  const finishReason = choice?.finish_reason ?? '';

  return {
    content: '',
    hasReasoningOnly: reasoning.length > 0,
    shouldEscalateTokens: reasoning.length > 0 && finishReason === 'length',
  };
}

export function escalateMaxTokens(current: number): number {
  return Math.min(Math.max(current * 2, 2048), 16384);
}
