import type { TokenUsage } from './types';

const ANSI_RESET = '\u001b[0m';
const ANSI_BOLD = '\u001b[1m';
const ANSI_DIM = '\u001b[2m';
const ANSI_MAGENTA = '\u001b[35m';

function useColor(): boolean {
  return !!process.stdout.isTTY && !process.env.NO_COLOR;
}

function paint(text: string, ansi: string): string {
  if (!useColor()) return text;
  return `${ansi}${text}${ANSI_RESET}`;
}

function dim(text: string): string {
  return paint(text, ANSI_DIM);
}

function tag(text: string): string {
  return paint(text, `${ANSI_BOLD}${ANSI_MAGENTA}`);
}

export function formatTokenCount(count: number): string {
  if (count >= 10_000) return `${Math.round(count / 1000)}k`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return count.toLocaleString('en-US');
}

export function formatUsd(cost: number): string {
  if (cost === 0) return '$0';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

function joinParts(parts: string[]): string {
  return parts.filter(Boolean).join(dim(' · '));
}

function hasUsageData(usage: TokenUsage): boolean {
  return (
    usage.promptTokens !== undefined ||
    usage.completionTokens !== undefined ||
    usage.totalTokens !== undefined ||
    usage.costUsd !== undefined
  );
}

export function printTokenUsage(usage: TokenUsage, model?: string): void {
  if (!hasUsageData(usage)) return;

  const total =
    usage.totalTokens ??
    (usage.promptTokens !== undefined && usage.completionTokens !== undefined
      ? usage.promptTokens + usage.completionTokens
      : undefined);

  const parts = [
    usage.promptTokens !== undefined ? `${formatTokenCount(usage.promptTokens)} in` : '',
    usage.completionTokens !== undefined ? `${formatTokenCount(usage.completionTokens)} out` : '',
    total !== undefined ? `${formatTokenCount(total)} total` : '',
    usage.costUsd !== undefined ? formatUsd(usage.costUsd) : '',
    model ?? '',
  ];

  console.log(`${tag('[tokens]')} ${joinParts(parts)}`);
}
