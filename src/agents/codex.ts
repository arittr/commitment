import { execa } from 'execa';

import { AgentError } from '../errors.js';

import type { Agent } from './types.js';

/**
 * Codex CLI agent for commit message generation
 *
 * This agent uses the codex-sh CLI to generate conventional commit messages.
 * It handles CLI execution, response parsing, and provides actionable error
 * messages when the CLI is unavailable or returns invalid output.
 *
 * Implementation Philosophy:
 * - Standalone implementation (no base classes)
 * - All logic inlined (~50-100 LOC)
 * - Actionable error messages with installation instructions
 * - Cleans AI artifacts (code fences, extra whitespace)
 *
 * @example
 * ```typescript
 * const agent = new CodexAgent();
 * const message = await agent.generate(
 *   'Generate commit message for:\n\nfeat: add dark mode toggle',
 *   '/path/to/repo'
 * );
 * // Returns: "feat: add dark mode toggle\n\nImplement theme switching..."
 * ```
 */
export class CodexAgent implements Agent {
  /**
   * Human-readable name of the agent
   */
  readonly name = 'Codex CLI';

  /**
   * Generate a commit message using Codex CLI
   *
   * Executes codex-sh with the provided prompt and parses the response.
   * Cleans AI artifacts like code fences and validates the output format.
   *
   * @param prompt - The prompt to send to Codex (includes git diff, context, etc.)
   * @param workdir - Working directory for git operations
   * @returns Promise resolving to the generated commit message in conventional commit format
   * @throws {Error} If Codex CLI is not available (with installation instructions)
   * @throws {Error} If response is empty or malformed (with diagnostic context)
   *
   * @example
   * ```typescript
   * const agent = new CodexAgent();
   * const message = await agent.generate(
   *   'Generate a commit message for these changes:\n\nModified: src/feature.ts',
   *   '/path/to/repo'
   * );
   * console.log(message);
   * // "feat: add new feature\n\nImplement feature in feature.ts"
   * ```
   */
  async generate(prompt: string, workdir: string): Promise<string> {
    try {
      // Execute Codex CLI with prompt
      const { stdout } = await execa('codex-sh', ['--print'], {
        input: prompt,
        cwd: workdir,
        timeout: 120_000, // 2 minutes
      });

      // Clean AI artifacts (code fences, extra whitespace)
      const cleaned = this._cleanResponse(stdout);

      // Validate response format
      if (cleaned.length === 0 || cleaned.trim().length === 0) {
        throw AgentError.executionFailed(
          this.name,
          0,
          'Empty response - CLI may not be properly configured',
        );
      }

      // Basic validation: should look like a conventional commit
      if (!this._isValidCommitFormat(cleaned)) {
        throw AgentError.malformedResponse(this.name, cleaned);
      }

      return cleaned;
    } catch (error) {
      // Re-throw AgentError as-is (already properly formatted)
      if (error instanceof AgentError) {
        throw error;
      }

      // Handle CLI not found error
      if (
        error !== null &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        throw AgentError.cliNotFound('codex-sh', this.name);
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
   * Clean AI artifacts from response
   *
   * Removes:
   * - Code fences (```...```)
   * - Extra leading/trailing whitespace
   * - Common AI prefixes/suffixes
   *
   * @param response - Raw response from Codex CLI
   * @returns Cleaned commit message
   */
  private _cleanResponse(response: string): string {
    let cleaned = response;

    // Remove code fences
    cleaned = cleaned.replaceAll(/^```[a-z]*\n?/gm, '');
    cleaned = cleaned.replaceAll(/\n?```$/gm, '');

    // Remove common AI artifacts
    cleaned = cleaned.replace(/^(here is|here's) (the|a) commit message:?\s*/i, '');
    cleaned = cleaned.replace(/^commit message:?\s*/i, '');

    // Trim whitespace
    cleaned = cleaned.trim();

    return cleaned;
  }

  /**
   * Validate commit message format
   *
   * Checks if response looks like a conventional commit:
   * - Starts with a type (feat, fix, etc.)
   * - Has colon after type
   * - Has description after colon
   *
   * @param message - Cleaned commit message
   * @returns true if format is valid
   */
  private _isValidCommitFormat(message: string): boolean {
    // Basic pattern: type: description or type(scope): description
    const conventionalPattern = /^(feat|fix|docs|style|refactor|test|chore|perf)(\([^)]+\))?:\s+.+/;
    return conventionalPattern.test(message);
  }
}
