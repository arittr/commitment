import { execa } from 'execa';

import { AgentError } from '../errors.js';

import type { Agent } from './types.js';

/**
 * Claude CLI agent for AI-powered commit message generation
 *
 * Standalone implementation that executes the Claude CLI (`claude` command)
 * to generate conventional commit messages. Includes inline availability checking,
 * execution, and response parsing.
 *
 * Features:
 * - Checks `claude` command availability
 * - Executes CLI with prompt via stdin
 * - Cleans AI artifacts (markdown code blocks, etc.)
 * - Validates response format (conventional commits)
 * - Provides actionable error messages with installation instructions
 *
 * @example
 * ```typescript
 * const agent = new ClaudeAgent();
 * const message = await agent.generate(
 *   'Generate commit message for:\n\nfeat: add dark mode toggle',
 *   '/path/to/repo'
 * );
 * // Returns: "feat: add dark mode toggle\n\nImplement theme switching..."
 * ```
 *
 * @example
 * ```typescript
 * // Error handling
 * try {
 *   const message = await agent.generate(prompt, workdir);
 * } catch (error) {
 *   if (error.message.includes('not installed')) {
 *     console.error('Please install Claude CLI: https://claude.ai/download');
 *   }
 * }
 * ```
 */
export class ClaudeAgent implements Agent {
  /**
   * Human-readable name of the agent
   */
  readonly name = 'Claude CLI';

  /**
   * Generate a commit message using Claude CLI
   *
   * Executes the `claude` command with `--print` flag to generate a commit message
   * from the provided prompt. The response is cleaned of AI artifacts and validated
   * for conventional commit format.
   *
   * @param prompt - The prompt to send to Claude (includes git diff, context, etc.)
   * @param workdir - Working directory for git operations
   * @returns Promise resolving to the generated commit message in conventional commit format
   * @throws {Error} If CLI is not installed, execution fails, or response is malformed
   *
   * @example
   * ```typescript
   * const agent = new ClaudeAgent();
   * const message = await agent.generate(
   *   'Generate conventional commit message for these changes:\n\nM  src/feature.ts',
   *   '/home/user/project'
   * );
   * ```
   */
  async generate(prompt: string, workdir: string): Promise<string> {
    try {
      // Execute Claude CLI with prompt via stdin
      const { stdout } = await execa('claude', ['--print'], {
        input: prompt,
        cwd: workdir,
        timeout: 120_000, // 2 minutes
      });

      // Clean AI artifacts from response
      const cleaned = this._cleanAIArtifacts(stdout);

      // Validate response
      if (cleaned.length === 0 || cleaned.trim().length === 0) {
        throw AgentError.executionFailed(
          this.name,
          0,
          'Empty response - API key may not be configured',
        );
      }

      // Basic validation for conventional commit format
      if (!this._isValidCommitMessage(cleaned)) {
        throw AgentError.malformedResponse(this.name, cleaned);
      }

      return cleaned;
    } catch (error) {
      // Re-throw AgentError as-is (already properly formatted)
      if (error instanceof AgentError) {
        throw error;
      }

      // Handle CLI not found error
      if (this._isCLINotFoundError(error)) {
        throw AgentError.cliNotFound('claude', this.name);
      }

      // Handle execution errors
      if (error !== null && typeof error === 'object' && 'code' in error) {
        const execError = error as { code?: number | string; message?: string; stderr?: string };
        const details = execError.stderr ?? execError.message ?? 'Unknown error';
        const code = execError.code ?? 'unknown';
        throw AgentError.executionFailed(
          this.name,
          code,
          details,
          error instanceof Error ? error : undefined,
        );
      }

      // Fallback for unknown errors
      const message = error instanceof Error ? error.message : String(error);
      throw new AgentError(`Unexpected error during ${this.name} execution: ${message}`, {
        agentName: this.name,
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Clean AI artifacts from Claude's response
   *
   * Removes markdown code blocks, extra whitespace, and other artifacts
   * that Claude might include in the response.
   *
   * @param output - Raw output from Claude CLI
   * @returns Cleaned commit message
   */
  private _cleanAIArtifacts(output: string): string {
    let cleaned = output.trim();

    // Remove markdown code blocks (```...```)
    cleaned = cleaned.replaceAll(/^```[\S\s]*?\n/gm, '').replaceAll(/\n```$/gm, '');

    // Remove leading/trailing backticks
    cleaned = cleaned.replaceAll(/^`+|`+$/g, '');

    return cleaned.trim();
  }

  /**
   * Validate that response looks like a conventional commit message
   *
   * Performs basic format checking to ensure the response starts with
   * a conventional commit type (feat, fix, etc.).
   *
   * @param message - Commit message to validate
   * @returns True if message appears to be valid conventional commit format
   */
  private _isValidCommitMessage(message: string): boolean {
    const firstLine = message.split('\n')[0];
    if (firstLine === undefined || firstLine.length === 0) {
      return false;
    }

    // Check if starts with conventional commit type
    const conventionalTypes = [
      'feat',
      'fix',
      'docs',
      'style',
      'refactor',
      'perf',
      'test',
      'chore',
      'build',
      'ci',
    ];

    return conventionalTypes.some((type) => firstLine.startsWith(`${type}:`));
  }

  /**
   * Check if error indicates CLI command was not found
   *
   * @param error - Error object from execa
   * @returns True if error is ENOENT (command not found)
   */
  private _isCLINotFoundError(error: unknown): boolean {
    return Boolean(
      error !== null && typeof error === 'object' && 'code' in error && error.code === 'ENOENT',
    );
  }
}
