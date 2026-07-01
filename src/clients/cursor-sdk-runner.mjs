#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

import { Agent, CursorAgentError } from '@cursor/sdk';

const apiKey = process.env.CURSOR_API_KEY;
const model = process.env.CURSOR_MODEL ?? 'composer-2.5';
const promptPath = process.argv[2];

if (!apiKey) {
  console.error('CURSOR_API_KEY is required');
  process.exit(1);
}

if (!promptPath) {
  console.error('Usage: cursor-sdk-runner.mjs <prompt-file>');
  process.exit(1);
}

const prompt = await readFile(promptPath, 'utf8');

try {
  const result = await Agent.prompt(prompt, {
    apiKey,
    model: { id: model },
    local: { cwd: process.cwd(), settingSources: [] },
  });

  if (result.status === 'error') {
    console.error(`Cursor agent run failed: ${result.id}`);
    process.exit(2);
  }

  const content = result.result?.trim();
  if (!content) {
    console.error('Empty response from Cursor agent');
    process.exit(2);
  }

  process.stdout.write(content);
} catch (error) {
  if (error instanceof CursorAgentError) {
    console.error(`Cursor SDK startup failed: ${error.message}`);
    process.exit(1);
  }

  throw error;
}
