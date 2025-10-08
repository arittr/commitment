import type { CLIProviderConfig } from '../types';

import { BaseCLIProvider } from '../base/base-cli-provider';
import { CLIResponseParser } from '../utils/cli-response-parser';

/**
 * Claude CLI provider implementation
 * Integrates with the Claude CLI tool for AI-powered commit message generation
 */
export class ClaudeProvider extends BaseCLIProvider {
  constructor(config: Omit<CLIProviderConfig, 'type' | 'provider'> = {}) {
    super({
      type: 'cli',
      provider: 'claude',
      ...config,
    });
  }

  /**
   * Get the CLI command name
   */
  protected getCommand(): string {
    return this.config.command ?? 'claude';
  }

  /**
   * Get CLI arguments for Claude
   */
  protected getArgs(): string[] {
    return this.config.args ?? ['--print'];
  }

  getName(): string {
    return 'Claude CLI';
  }

  /**
   * Check if Claude CLI is available
   */
  async isAvailable(): Promise<boolean> {
    return this.checkCommandAvailable();
  }

  /**
   * Parse and clean Claude's response
   * Leverages CLIResponseParser utility with additional Claude-specific cleaning
   */
  protected override parseResponse(output: string): string {
    // First, use the utility to clean common AI artifacts
    const cleaned = CLIResponseParser.cleanAIArtifacts(output);

    // Then parse with standard validation
    return CLIResponseParser.parse(cleaned);
  }
}
