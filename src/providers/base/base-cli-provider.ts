import { execa } from 'execa';

import type { AIProvider, CLIProviderConfig, GenerateOptions } from '../types';

import { isProviderError, ProviderNotAvailableError, ProviderTimeoutError } from '../errors';
import { ProviderType } from '../types';

/**
 * Abstract base class for CLI-based AI providers (Claude, Codex, Cursor)
 * Handles common CLI operations like process spawning, timeout handling, and error management
 */
export abstract class BaseCLIProvider implements AIProvider {
  protected readonly config: CLIProviderConfig;
  protected readonly defaultTimeout: number;

  constructor(config: CLIProviderConfig) {
    this.config = config;
    this.defaultTimeout = config.timeout ?? 30_000; // 30 seconds default
  }

  /**
   * Get the CLI command to execute
   * @returns The command name (e.g., 'claude', 'codex')
   */
  protected abstract getCommand(): string;

  /**
   * Get the CLI arguments for commit message generation
   * @returns Array of command arguments
   */
  protected abstract getArgs(): string[];

  /**
   * Get the human-readable name of this provider
   */
  abstract getName(): string;

  /**
   * Check if this provider is available and configured correctly
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * Prepare the input text to send to the CLI
   * Default implementation returns the prompt as-is
   * Override this to customize input formatting
   */
  protected prepareInput(prompt: string): string {
    return prompt;
  }

  /**
   * Generate a commit message using the CLI provider
   */
  async generateCommitMessage(prompt: string, options: GenerateOptions): Promise<string> {
    // Check availability first
    const available = await this.isAvailable();
    if (!available) {
      throw new ProviderNotAvailableError(
        this.getName(),
        'Provider is not available or not properly configured',
      );
    }

    const timeout = options.timeout ?? this.defaultTimeout;
    const input = this.prepareInput(prompt);

    try {
      const { stdout } = await execa(this.getCommand(), this.getArgs(), {
        cwd: options.workdir,
        timeout,
        stdin: 'pipe',
        input,
        reject: true,
      });

      return stdout.trim();
    } catch (error) {
      // Handle timeout specifically
      if (error instanceof Error && 'timedOut' in error && error.timedOut === true) {
        throw new ProviderTimeoutError(this.getName(), timeout, 'generateCommitMessage', error);
      }

      // Re-throw provider errors as-is
      if (isProviderError(error)) {
        throw error;
      }

      // Wrap other errors
      throw new ProviderNotAvailableError(
        this.getName(),
        error instanceof Error ? error.message : 'Unknown error during CLI execution',
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Get the provider type (always CLI for this base class)
   */
  getProviderType(): ProviderType {
    return ProviderType.CLI;
  }
}
