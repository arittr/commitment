import { execa } from 'execa';

import { AgentError } from '../errors';

import type { Agent } from './types';

/**
 * Codex CLI agent for commit message generation
 *
 * This agent uses the codex CLI to generate conventional commit messages.
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
   * Executes codex with the provided prompt and parses the response.
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
    const tmpFile = `/tmp/codex-output-${Date.now()}.txt`;

    try {
      // Execute Codex CLI in non-interactive mode
      const result = await execa('codex', ['exec', '--output-last-message', tmpFile, prompt], {
        cwd: workdir,
        timeout: 120_000, // 2 minutes
      });

      // Read output from temp file or fallback to stdout
      const output = await this._readOutput(tmpFile, result.stdout);

      // Process and validate the response
      return this._processResponse(output);
    } catch (error) {
      await this._cleanupTempFile(tmpFile);
      this._handleExecutionError(error);
    }
  }

  /**
   * Read output from temp file with fallback to stdout
   *
   * @param tmpFile - Path to temporary output file
   * @param fallbackOutput - Fallback output (stdout) if file doesn't exist
   * @returns Output content
   */
  private async _readOutput(tmpFile: string, fallbackOutput: string): Promise<string> {
    try {
      const { readFileSync, unlinkSync, existsSync } = await import('node:fs');
      if (existsSync(tmpFile)) {
        const output = readFileSync(tmpFile, 'utf8');
        unlinkSync(tmpFile);
        return output;
      }
      return fallbackOutput;
    } catch {
      // If file operations fail, use stdout (for mocked tests)
      return fallbackOutput;
    }
  }

  /**
   * Process and validate the CLI response
   *
   * @param output - Raw output from Codex CLI
   * @returns Cleaned and validated commit message
   * @throws {AgentError} If response is invalid
   */
  private _processResponse(output: string): string {
    // Clean AI artifacts (code fences, extra whitespace)
    const cleaned = this._cleanResponse(output);

    // Validate response is not empty
    if (cleaned.length === 0 || cleaned.trim().length === 0) {
      throw AgentError.executionFailed(
        this.name,
        0,
        'Empty response - CLI may not be properly configured'
      );
    }

    // Validate conventional commit format
    if (!this._isValidCommitFormat(cleaned)) {
      throw AgentError.malformedResponse(this.name, cleaned);
    }

    return cleaned;
  }

  /**
   * Clean up temporary file (best effort)
   *
   * @param tmpFile - Path to temporary file
   */
  private async _cleanupTempFile(tmpFile: string): Promise<void> {
    try {
      const { unlinkSync, existsSync } = await import('node:fs');
      if (existsSync(tmpFile)) {
        unlinkSync(tmpFile);
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Handle execution errors and convert to AgentError
   *
   * @param error - The error that occurred
   * @throws {AgentError} Always throws with appropriate error type
   */
  private _handleExecutionError(error: unknown): never {
    // Re-throw AgentError as-is (already properly formatted)
    if (error instanceof AgentError) {
      throw error;
    }

    // Handle CLI not found error
    if (error !== null && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw AgentError.cliNotFound('codex', this.name);
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
        error instanceof Error ? error : undefined
      );
    }

    // Fallback for unknown errors
    const message = error instanceof Error ? error.message : String(error);
    throw new AgentError(`Unexpected error during ${this.name} execution: ${message}`, {
      agentName: this.name,
      cause: error instanceof Error ? error : undefined,
    });
  }

  /**
   * Clean AI artifacts from response
   *
   * Removes:
   * - Codex activity logs (timestamps, workdir info, etc.)
   * - Commit message markers (<<<COMMIT_MESSAGE_START>>> and <<<COMMIT_MESSAGE_END>>>)
   * - Code fences (```...```)
   * - Extra leading/trailing whitespace
   * - Common AI prefixes/suffixes
   *
   * @param response - Raw response from Codex CLI
   * @returns Cleaned commit message
   */
  private _cleanResponse(response: string): string {
    let cleaned = response;

    // Remove Codex activity logs (lines starting with timestamps, workdir, etc.)
    // Example: "[2025-10-22T00:50:28] OpenAI Codex v0.42.0 (research preview)"
    cleaned = cleaned.replaceAll(/^\[[\d:TZ-]+].*$/gm, '');
    cleaned = cleaned.replaceAll(/^-{3,}$/gm, ''); // Remove separator lines
    cleaned = cleaned.replaceAll(/^OpenAI Codex.*$/gm, '');

    // Remove specific Codex metadata fields (must be before conventional commit type matching)
    const metadataFields = [
      'workdir',
      'model',
      'provider',
      'approval',
      'sandbox',
      'reasoning effort',
      'reasoning summaries',
    ];
    for (const field of metadataFields) {
      cleaned = cleaned.replaceAll(new RegExp(`^${field}:.*$`, 'gmi'), '');
    }

    // Remove commit message markers (<<<COMMIT_MESSAGE_START>>> and <<<COMMIT_MESSAGE_END>>>)
    cleaned = cleaned.replaceAll(/<<<COMMIT_MESSAGE_START>>>\s*/g, '');
    cleaned = cleaned.replaceAll(/\s*<<<COMMIT_MESSAGE_END>>>/g, '');

    // Remove code fences
    cleaned = cleaned.replaceAll(/^```[a-z]*\n?/gm, '');
    cleaned = cleaned.replaceAll(/\n?```$/gm, '');

    // Remove common AI artifacts
    cleaned = cleaned.replace(/^(here is|here's) (the|a) commit message:?\s*/i, '');
    cleaned = cleaned.replace(/^commit message:?\s*/i, '');

    // Trim whitespace and remove extra blank lines
    cleaned = cleaned.trim();
    cleaned = cleaned.replaceAll(/\n{3,}/g, '\n\n'); // Max 2 consecutive newlines

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
