import { execa } from 'execa';

import { BaseAgent } from './base-agent';

/**
 * Codex CLI agent for commit message generation
 *
 * Extends BaseAgent with Codex-specific CLI execution and response cleaning.
 * Handles Codex activity logs, metadata fields, and commit message markers.
 *
 * Implementation:
 * - Uses template method pattern from BaseAgent
 * - Overrides executeCommand() for Codex-specific CLI invocation
 * - Overrides cleanResponse() for Codex-specific artifact removal
 * - Inherits standard validation and error handling from BaseAgent
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
export class CodexAgent extends BaseAgent {
  /**
   * Human-readable name of the agent
   */
  readonly name = 'Codex CLI';

  /**
   * Execute Codex CLI command to generate commit message
   *
   * Overrides BaseAgent.executeCommand() to implement Codex-specific CLI invocation.
   * Uses temp file for output and handles file I/O with fallback to stdout.
   *
   * @param prompt - The prompt to send to Codex
   * @param workdir - Working directory for command execution
   * @returns Promise resolving to raw Codex output
   * @throws {Error} If command execution fails
   */
  protected async executeCommand(prompt: string, workdir: string): Promise<string> {
    const tmpFile = `/tmp/codex-output-${Date.now()}.txt`;

    try {
      // Execute Codex CLI in non-interactive mode
      const result = await execa('codex', ['exec', '--output-last-message', tmpFile, prompt], {
        cwd: workdir,
        timeout: 120_000, // 2 minutes
      });

      // Read output from temp file or fallback to stdout
      return await this._readOutput(tmpFile, result.stdout);
    } catch (error) {
      await this._cleanupTempFile(tmpFile);
      throw error;
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
   * Clean AI artifacts from Codex response
   *
   * Overrides BaseAgent.cleanResponse() to add Codex-specific cleaning.
   * First applies base cleaning (code fences, thinking tags, etc.), then removes:
   * - Codex activity logs (timestamps, workdir info, etc.)
   * - Codex metadata fields (model, provider, approval, etc.)
   * - Commit message markers (<<<COMMIT_MESSAGE_START>>> and <<<COMMIT_MESSAGE_END>>>)
   *
   * @param response - Raw response from Codex CLI
   * @returns Cleaned commit message with all artifacts removed
   *
   * @example
   * ```typescript
   * // Input:
   * // [2025-10-22T00:50:28] OpenAI Codex v0.42.0
   * // workdir: /path/to/repo
   * // <<<COMMIT_MESSAGE_START>>>
   * // feat: add feature
   * // <<<COMMIT_MESSAGE_END>>>
   * //
   * // Output:
   * // feat: add feature
   * ```
   */
  protected override cleanResponse(response: string): string {
    // First apply base cleaning (from BaseAgent)
    let cleaned = super.cleanResponse(response);

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

    // Remove common AI artifacts (not covered by base cleanAIResponse)
    cleaned = cleaned.replace(/^(here is|here's) (the|a) commit message:?\s*/i, '');
    cleaned = cleaned.replace(/^commit message:?\s*/i, '');

    // Trim whitespace and remove extra blank lines
    cleaned = cleaned.trim();
    cleaned = cleaned.replaceAll(/\n{3,}/g, '\n\n'); // Max 2 consecutive newlines

    return cleaned;
  }
}
