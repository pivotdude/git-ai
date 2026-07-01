import { getCursorSdkConfig, getOpenAiConfig } from './config';
import { printTokenUsage } from './token-report';
import type { AiProvider, AiResponse } from './types';

export function modelLabelForProvider(provider: AiProvider): string | undefined {
  if (provider === 'openai') return getOpenAiConfig().model;
  if (provider === 'cursor-sdk') return getCursorSdkConfig().model;
  return undefined;
}

export function showResponseTokenResult(provider: AiProvider, response: AiResponse): void {
  if (!response.usage) return;
  printTokenUsage(response.usage, modelLabelForProvider(provider));
}
