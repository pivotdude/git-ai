import type { CursorSdkConfig, OpenAiConfig } from './types';

export function getOpenAiConfig(): OpenAiConfig {
  const baseUrl = process.env.OPENAI_BASE_URL;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!baseUrl) throw new Error('OPENAI_BASE_URL env var is required for OpenAI-compatible provider');
  if (!apiKey) throw new Error('OPENAI_API_KEY env var is required for OpenAI-compatible provider');

  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    apiKey,
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  };
}

export function getCursorSdkConfig(): CursorSdkConfig {
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) throw new Error('CURSOR_API_KEY env var is required for Cursor SDK provider');

  return {
    apiKey,
    model: process.env.CURSOR_MODEL ?? 'composer-2.5',
  };
}
