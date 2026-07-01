export type Mode = 'branch-commit-pr' | 'branch-commit-push' | 'commit-push' | 'create-pr' | 'update-pr';

export type AiProvider = 'openai' | 'cursor-sdk' | 'manual';

export interface OpenAiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface CursorSdkConfig {
  apiKey: string;
  model: string;
}

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  costUsd?: number;
}

export interface AiResponse {
  content: string;
  usage?: TokenUsage;
}

export interface AiSource {
  ask(prompt: string, maxTokens: number): Promise<AiResponse>;
}

export interface CommitPushResult {
  mode: 'commit-push';
  commitMessage: string;
}

export interface BranchCommitPrResult {
  mode: 'branch-commit-pr';
  branchName: string;
  commitMessage: string;
  title: string;
  prDescription: string;
}

export interface BranchCommitPushResult {
  mode: 'branch-commit-push';
  branchName: string;
  commitMessage: string;
}

export interface CreatePrResult {
  mode: 'create-pr';
  title: string;
  prDescription: string;
}

export interface UpdatePrResult {
  mode: 'update-pr';
  title: string;
  prDescription: string;
}

export type ParsedResult =
  | CommitPushResult
  | BranchCommitPrResult
  | BranchCommitPushResult
  | CreatePrResult
  | UpdatePrResult;
