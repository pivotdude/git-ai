import { formatStepError, markStepErrorLogged } from './shell-error';

const ANSI_RESET = '\u001b[0m';
const ANSI_DIM = '\u001b[2m';
const ANSI_CYAN = '\u001b[36m';
const ANSI_GREEN = '\u001b[32m';
const ANSI_RED = '\u001b[31m';
const BRAILLE_BASE = 0x2800;
const SIX_DOT_ORDER = [0, 3, 1, 4, 2, 5];

function isInteractiveOutput(): boolean {
  return !!process.stdout.isTTY;
}

function formatElapsedMs(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function color(text: string, ansi: string): string {
  return `${ansi}${text}${ANSI_RESET}`;
}

function logStepFailure(error: unknown): void {
  const message = formatStepError(error);
  console.error(color(message, ANSI_RED));
  if (error instanceof Error) {
    markStepErrorLogged(error);
  }
}

function buildSixDotBraille(frameIndex: number): string {
  const filledDots = frameIndex % (SIX_DOT_ORDER.length + 1);
  let mask = 0;

  for (let i = 0; i < filledDots; i++) {
    mask |= 1 << SIX_DOT_ORDER[i];
  }

  return String.fromCodePoint(BRAILLE_BASE + mask);
}

export async function runStep<T>(label: string, action: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();

  if (!isInteractiveOutput()) {
    console.log(`${label}...`);
    try {
      const result = await action();
      console.log(`[done] ${label} (${formatElapsedMs(Date.now() - startedAt)})`);
      return result;
    } catch (error) {
      console.error(`[failed] ${label} (${formatElapsedMs(Date.now() - startedAt)})`);
      logStepFailure(error);
      throw error;
    }
  }

  let frameIndex = 0;
  const render = () => {
    const frame = buildSixDotBraille(frameIndex);
    const elapsed = formatElapsedMs(Date.now() - startedAt);
    frameIndex += 1;
    process.stdout.write(`\r\u001b[2K${color(frame, ANSI_CYAN)} ${label} ${color(elapsed, ANSI_DIM)}`);
  };

  render();
  const timer = setInterval(render, 90);
  timer.unref?.();

  try {
    const result = await action();
    clearInterval(timer);
    const elapsed = formatElapsedMs(Date.now() - startedAt);
    process.stdout.write(`\r\u001b[2K${color('[ok]', ANSI_GREEN)} ${label} ${color(`(${elapsed})`, ANSI_DIM)}\n`);
    return result;
  } catch (error) {
    clearInterval(timer);
    const elapsed = formatElapsedMs(Date.now() - startedAt);
    process.stdout.write(`\r\u001b[2K${color('[x]', ANSI_RED)} ${label} ${color(`(${elapsed})`, ANSI_DIM)}\n`);
    logStepFailure(error);
    throw error;
  }
}
