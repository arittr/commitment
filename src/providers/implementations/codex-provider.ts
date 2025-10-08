import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { CLIProviderConfig } from '../types';

import { BaseCLIProvider } from '../base/base-cli-provider';
import { ProviderError } from '../errors';
import { CLIExecutor } from '../utils/cli-executor';
import { CLIResponseParser } from '../utils/cli-response-parser';

/**
 * Codex CLI provider implementation
 * Integrates with Anthropic's Codex CLI for AI-powered commit message generation
 *
 * Codex requires special handling:
 * - Uses `codex exec` command with natural language prompts
 * - Outputs to temp file via `--output-last-message` flag
 * - Reads git diff automatically from working directory
 * - Can take longer than Claude (30-60s recommended timeout)
 *
 * @example
 * ```typescript
 * const provider = new CodexProvider({ timeout: 45000 });
 * const message = await provider.generateCommitMessage(
 *   'Generate a conventional commit message for the staged changes',
 *   { workdir: '/path/to/repo' }
 * );
 * ```
 */
export class CodexProvider extends BaseCLIProvider {
  constructor(config: Omit<CLIProviderConfig, 'type' | 'provider'> = {}) {
    super({
      type: 'cli',
      provider: 'codex',
      // Codex is slower than Claude - increase default timeout
      timeout: config.timeout ?? 45_000, // 45 seconds
      ...config,
    });
  }

  /**
   * Get the CLI command name
   */
  protected getCommand(): string {
    return this.config.command ?? 'codex';
  }

  /**
   * Get CLI arguments for Codex
   * Note: The prompt and output file path are added dynamically in generateCommitMessage
   */
  protected getArgs(): string[] {
    return this.config.args ?? ['exec'];
  }

  getName(): string {
    return 'Codex CLI';
  }

  /**
   * Check if Codex CLI is available
   */
  async isAvailable(): Promise<boolean> {
    return this.checkCommandAvailable();
  }

  /**
   * Prepare the prompt for Codex
   * Codex reads git diff automatically, so we just need a high-level instruction
   */
  protected override prepareInput(prompt: string): string {
    // Simplify prompt - Codex discovers git context automatically
    if (prompt.includes('diff --git') || prompt.includes('@@')) {
      // User provided raw diff - replace with instruction
      return 'Generate a conventional commit message for the staged changes in this repository';
    }

    return prompt;
  }

  /**
   * Parse and clean Codex's response
   * Leverages CLIResponseParser utility with additional Codex-specific cleaning
   */
  protected override parseResponse(output: string): string {
    // First, use the utility to clean common AI artifacts
    const cleaned = CLIResponseParser.cleanAIArtifacts(output);

    // Then parse with standard validation
    return CLIResponseParser.parse(cleaned);
  }

  /**
   * Override generateCommitMessage to handle Codex's special requirements:
   * - Uses temp file for clean output extraction
   * - Passes prompt as command argument (not stdin)
   * - Uses -C flag for working directory
   */
  override async generateCommitMessage(
    prompt: string,
    options: { timeout?: number; workdir?: string },
  ): Promise<string> {
    // Check availability first
    const available = await this.isAvailable();
    if (!available) {
      throw new ProviderError(
        'Codex CLI is not available. Install it via: npm install -g @openai/codex-cli',
        this.getName(),
      );
    }

    const timeout = options.timeout ?? this.defaultTimeout;
    const preparedPrompt = this.prepareInput(prompt);

    // Create temp directory for output file
    const tempDir = await mkdtemp(join(tmpdir(), 'codex-'));
    const outputFile = join(tempDir, 'output.txt');

    try {
      // Build Codex-specific arguments
      const args = [
        ...this.getArgs(), // ['exec']
        preparedPrompt, // Natural language task
        '--color',
        'never', // Disable colors
        '--output-last-message',
        outputFile, // Write clean output to file
      ];

      // Add working directory if specified
      if (options.workdir !== undefined) {
        args.push('-C', options.workdir);
      }

      // Execute Codex command
      // Note: stdout will contain metadata/progress, actual message is in file
      await CLIExecutor.execute(this.getCommand(), args, {
        timeout,
        // Don't pass workdir to execa since Codex uses -C flag
      });

      // Read the clean output from temp file
      const fileContent = await readFile(outputFile, 'utf8');

      // Parse and validate the response
      return this.parseResponse(fileContent);
    } catch (error) {
      // Enhance error message for common Codex issues
      if (error instanceof Error && error.message.includes('not authenticated')) {
        throw new ProviderError(
          'Codex CLI is not authenticated. Run: codex login',
          this.getName(),
          error,
        );
      }

      throw error;
    } finally {
      // Clean up temp directory
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
