import type { AIProvider, CLIProviderConfig, GenerateOptions } from '../types';

import { hasContent, isDefined } from '../../utils/guards';
import { isProviderTimeoutError, ProviderNotAvailableError, ProviderTimeoutError } from '../errors';
import { ProviderType } from '../types';
import { CLIExecutor } from '../utils/cli-executor';
import { CLIResponseParser } from '../utils/cli-response-parser';

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
   * Check if a CLI command is available on the system
   * Utility method that subclasses can use in their isAvailable() implementation
   *
   * @param command - Command to check (defaults to getCommand())
   * @returns true if command is available
   */
  protected async checkCommandAvailable(command?: string): Promise<boolean> {
    const cmd = command ?? this.getCommand();
    return CLIExecutor.checkAvailable(cmd);
  }

  /**
   * Parse and validate CLI response
   * Subclasses can override to customize parsing behavior
   *
   * @param output - Raw output from CLI
   * @returns Parsed and validated commit message
   */
  protected parseResponse(output: string): string {
    return CLIResponseParser.parse(output);
  }

  /**
   * Generate a commit message using the CLI provider
   */
  async generateCommitMessage(prompt: string, options: GenerateOptions): Promise<string> {
    // Validate input prompt
    if (!hasContent(prompt)) {
      throw new ProviderNotAvailableError(this.getName(), 'Prompt must be a non-empty string');
    }

    // Validate options object
    if (!isDefined(options)) {
      throw new ProviderNotAvailableError(this.getName(), 'Options parameter is required');
    }

    // Validate timeout if provided
    if (
      isDefined(options.timeout) &&
      (typeof options.timeout !== 'number' || options.timeout <= 0)
    ) {
      throw new ProviderNotAvailableError(this.getName(), 'Timeout must be a positive number');
    }

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
      // Execute CLI command using CLIExecutor utility
      const output = await CLIExecutor.execute(this.getCommand(), this.getArgs(), {
        cwd: options.workdir,
        timeout,
        input,
      });

      // Parse and validate the response
      return this.parseResponse(output);
    } catch (error) {
      // Re-throw timeout errors with correct provider name
      if (isProviderTimeoutError(error)) {
        throw new ProviderTimeoutError(
          this.getName(),
          error.timeoutMs,
          'generateCommitMessage',
          error.cause,
        );
      }

      // Wrap all other errors in ProviderNotAvailableError
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
