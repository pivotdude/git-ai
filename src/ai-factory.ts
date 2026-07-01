import { AiClient } from './clients/ai-client';
import { CursorSdkClient } from './clients/cursor-sdk-client';
import { ManualAiClient } from './clients/manual-client';
import { getCursorSdkConfig, getOpenAiConfig } from './config';
import type { AiProvider, AiSource } from './types';

export function createAiSource(provider: AiProvider): AiSource {
  switch (provider) {
    case 'openai':
      return new AiClient(getOpenAiConfig());
    case 'cursor-sdk':
      return new CursorSdkClient(getCursorSdkConfig());
    case 'manual':
      return new ManualAiClient();
  }
}
