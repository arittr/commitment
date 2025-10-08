import { execa } from 'execa';

import { ProviderError, ProviderTimeoutError } from '../errors';

/**
 * Options for CLI command execution
 */
export type ExecuteOptions = {
  /** Working directory for command execution */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Input to send to command stdin */
  input?: string;
  /** Timeout in milliseconds */
  timeout?: number;
};

/**
 * Result from CLI command execution
 */
export type ExecuteResult = {
  /** Exit code from command */
  exitCode: number;
  /** Standard error from command */
  stderr: string;
  /** Standard output from command */
  stdout: string;
  /** Whether the command timed out */
  timedOut: boolean;
};

/**
 * Standardized CLI command executor with error handling
 * Provides consistent command execution across all CLI providers
 *
 * @example
 * ```typescript
 * // Simple execution
 * const output = await CLIExecutor.execute('claude', ['--version']);
 *
 * // With options
 * const message = await CLIExecutor.execute('claude', ['--print'], {
 *   input: prompt,
 *   timeout: 30000,
 *   cwd: '/path/to/repo'
 * });
 *
 * // Check availability
 * const available = await CLIExecutor.checkAvailable('claude');
 * ```
 */
export const CLIExecutor = {
  /**
   * Execute a CLI command and return stdout
   * Throws ProviderError on failure
   *
   * @param command - Command to execute (e.g., 'claude', 'codex')
   * @param args - Command arguments
   * @param options - Execution options
   * @returns stdout from command
   * @throws ProviderError if command fails
   * @throws ProviderTimeoutError if command times out
   */
  async execute(
    command: string,
    args: string[] = [],
    options: ExecuteOptions = {},
  ): Promise<string> {
    const result = await this.executeRaw(command, args, options);

    if (result.exitCode !== 0) {
      const errorOutput = result.stderr !== '' ? result.stderr : result.stdout;
      throw new ProviderError(
        `Command failed with exit code ${result.exitCode}: ${errorOutput}`,
        command,
      );
    }

    return result.stdout;
  },

  /**
   * Check if a command is available on the system
   * Tests by running the command with --version or --help
   *
   * @param command - Command to check
   * @returns true if command is available
   */
  async checkAvailable(command: string): Promise<boolean> {
    try {
      // Try --version first (most common)
      const { exitCode } = await execa(command, ['--version'], {
        reject: false,
        timeout: 5000,
      });

      if (exitCode === 0) {
        return true;
      }

      // Fallback to --help if --version doesn't work
      const helpResult = await execa(command, ['--help'], {
        reject: false,
        timeout: 5000,
      });

      return helpResult.exitCode === 0;
    } catch {
      // Command not found or other error
      return false;
    }
  },

  /**
   * Execute command and return full result object
   * Does not throw on non-zero exit codes - caller must check exitCode
   *
   * @param command - Command to execute
   * @param args - Command arguments
   * @param options - Execution options
   * @returns Full execution result
   * @throws ProviderTimeoutError if command times out
   */
  async executeRaw(
    command: string,
    args: string[] = [],
    options: ExecuteOptions = {},
  ): Promise<ExecuteResult> {
    const { timeout, cwd, env, input } = options;

    try {
      const result = await execa(command, args, {
        cwd,
        env,
        input,
        timeout,
        stdin: input !== undefined ? 'pipe' : undefined,
        reject: false, // Don't throw on non-zero exit
      });

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode as number,
        timedOut: (result.timedOut as boolean | undefined) ?? false,
      };
    } catch (error) {
      // Handle timeout errors specially
      if (error instanceof Error && 'timedOut' in error && error.timedOut === true) {
        throw new ProviderTimeoutError(
          command,
          timeout ?? 0,
          'command execution',
          error instanceof Error ? error : undefined,
        );
      }

      // Wrap other errors
      throw new ProviderError(
        error instanceof Error ? error.message : 'Unknown error during command execution',
        command,
        error instanceof Error ? error : undefined,
      );
    }
  },
};
