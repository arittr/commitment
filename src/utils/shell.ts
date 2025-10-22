import { execa } from 'execa';

/**
 * Options for shell command execution
 *
 * @property cwd - Working directory for command execution
 * @property timeout - Optional timeout in milliseconds
 * @property input - Optional stdin input to pipe to command
 */
export interface ShellExecOptions {
  cwd: string;
  timeout?: number;
  input?: string;
}

/**
 * Result of shell command execution
 *
 * @property stdout - Standard output from command
 * @property stderr - Standard error from command
 * @property exitCode - Exit code from command (0 = success)
 */
export interface ShellExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Execute a shell command with runtime-adaptive implementation
 *
 * Uses Bun.spawn() in Bun runtime and execa in Node runtime.
 * Provides consistent interface across both runtimes.
 *
 * Runtime Detection:
 * - Bun: `typeof process.versions.bun !== 'undefined'`
 * - Node: Otherwise (uses execa)
 *
 * Error Handling:
 * - ENOENT: Command not found (actionable message with command name)
 * - ETIMEDOUT: Timeout exceeded (actionable message)
 * - Non-zero exit: Command failed (includes stderr in message)
 * - All errors preserve original error as cause
 *
 * @param command - Command to execute
 * @param args - Command arguments
 * @param options - Execution options (cwd, timeout, input)
 * @returns Promise resolving to command result (stdout, stderr, exitCode)
 * @throws {Error} If command fails, times out, or is not found
 *
 * @example Basic usage
 * ```typescript
 * const result = await exec('git', ['status', '--porcelain'], { cwd: '/repo' });
 * console.log(result.stdout);
 * ```
 *
 * @example With timeout
 * ```typescript
 * const result = await exec('claude', ['--prompt', prompt], {
 *   cwd: workdir,
 *   timeout: 120_000
 * });
 * ```
 *
 * @example With stdin input
 * ```typescript
 * const result = await exec('cat', [], {
 *   cwd: '/tmp',
 *   input: 'test data'
 * });
 * ```
 */
export async function exec(
  command: string,
  args: string[],
  options: ShellExecOptions
): Promise<ShellExecResult> {
  // Runtime detection
  const isBun = typeof process.versions.bun !== 'undefined';

  if (isBun) {
    return execBun(command, args, options);
  } else {
    return execNode(command, args, options);
  }
}

/**
 * Execute command using Bun.spawn() (Bun runtime)
 *
 * @internal
 */
async function execBun(
  command: string,
  args: string[],
  options: ShellExecOptions
): Promise<ShellExecResult> {
  try {
    // Build spawn options
    const spawnOptions = buildBunSpawnOptions(options);

    // Execute command
    const process = Bun.spawn([command, ...args], spawnOptions);

    // Write to stdin if input provided
    if (options.input !== undefined && process.stdin) {
      writeToStdin(process.stdin, options.input);
    }

    // Wait for process to complete and capture output
    const result = await captureProcessOutput(process);

    // Handle non-zero exit code
    if (result.exitCode !== 0) {
      throw new Error(
        `Command failed with exit code ${result.exitCode}: ${command} ${args.join(' ')}\n${result.stderr}`
      );
    }

    return result;
  } catch (error) {
    throw wrapExecutionError(error, command, args, options);
  }
}

/**
 * Build Bun.spawn options from ShellExecOptions
 *
 * @internal
 */
function buildBunSpawnOptions(options: ShellExecOptions): Record<string, unknown> {
  const spawnOptions: Record<string, unknown> = {
    cwd: options.cwd,
    stderr: 'pipe',
    stdout: 'pipe',
  };

  if (options.input !== undefined) {
    spawnOptions.stdin = 'pipe';
  }

  return spawnOptions;
}

/**
 * Write input data to stdin stream
 *
 * @internal
 */
function writeToStdin(stdin: unknown, input: string): void {
  // biome-ignore lint/suspicious/noExplicitAny: Bun types incomplete
  const stdinStream = stdin as any;
  stdinStream.write(input);
  stdinStream.end();
}

/**
 * Capture stdout, stderr, and exit code from process
 *
 * @internal
 */
async function captureProcessOutput(process: unknown): Promise<ShellExecResult> {
  // biome-ignore lint/suspicious/noExplicitAny: Bun types incomplete
  const proc = process as any;
  const stdout = await proc.stdout.text();
  const stderr = await proc.stderr.text();
  const exitCode = await proc.exited;

  return {
    exitCode,
    stderr,
    stdout,
  };
}

/**
 * Wrap execution error with helpful message
 *
 * @internal
 */
function wrapExecutionError(
  error: unknown,
  command: string,
  args: string[],
  options: ShellExecOptions
): Error {
  if (error instanceof Error && 'code' in error) {
    // biome-ignore lint/suspicious/noExplicitAny: Error codes are dynamic
    const errorCode = (error as any).code;

    if (errorCode === 'ENOENT') {
      return new Error(
        `Command "${command}" not found. Please ensure it is installed and in your PATH.`,
        { cause: error }
      );
    }

    if (errorCode === 'ETIMEDOUT') {
      return new Error(
        `Command timed out after ${options.timeout}ms: ${command} ${args.join(' ')}`,
        { cause: error }
      );
    }
  }

  // Re-throw with cause for other errors
  if (error instanceof Error) {
    return error;
  }

  // Unknown error type
  return new Error(`Command execution failed: ${String(error)}`, {
    cause: error as Error,
  });
}

/**
 * Execute command using execa (Node runtime)
 *
 * @internal
 */
async function execNode(
  command: string,
  args: string[],
  options: ShellExecOptions
): Promise<ShellExecResult> {
  try {
    const result = await execa(command, args, {
      cwd: options.cwd,
      input: options.input,
      reject: false, // Don't throw on non-zero exit, we'll handle it
      timeout: options.timeout,
    });

    // Handle non-zero exit code
    if (result.exitCode !== 0) {
      throw new Error(
        `Command failed with exit code ${result.exitCode}: ${command} ${args.join(' ')}\n${result.stderr}`
      );
    }

    return {
      exitCode: result.exitCode,
      stderr: result.stderr,
      stdout: result.stdout,
    };
  } catch (error) {
    throw wrapExecutionError(error, command, args, options);
  }
}
