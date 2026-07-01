/** Helpers for Bun shell/spawn failures (exitCode, stderr, stdout). */
interface ShellErrorLike {
  exitCode?: number;
  stderr?: Buffer | string;
  stdout?: Buffer | string;
}

function streamText(value: Buffer | string | undefined): string {
  if (!value) return '';
  return typeof value === 'string' ? value : value.toString();
}

export function isShellError(error: unknown): error is ShellErrorLike & { exitCode: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'exitCode' in error &&
    typeof (error as ShellErrorLike).exitCode === 'number'
  );
}

export function formatShellError(command: string, error: unknown): string {
  if (!isShellError(error)) {
    return error instanceof Error ? error.message : String(error);
  }

  const stderr = streamText(error.stderr).trim();
  const stdout = streamText(error.stdout).trim();
  const detail = stderr || stdout || `exit code ${error.exitCode}`;

  return `Command failed (exit ${error.exitCode}): ${command}\n\n${detail}`;
}

const STEP_ERROR_LOGGED = Symbol('gitAiStepErrorLogged');

export function markStepErrorLogged(error: Error): void {
  (error as Error & { [STEP_ERROR_LOGGED]?: boolean })[STEP_ERROR_LOGGED] = true;
}

export function wasStepErrorLogged(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as Record<symbol, boolean>)[STEP_ERROR_LOGGED] === true
  );
}

export function formatStepError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
