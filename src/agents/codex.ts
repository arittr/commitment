import { exec } from '../utils/shell.js';

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
   * CLI command name for the agent
   */
  readonly name = 'codex';

  /**
   * Execute Codex CLI command to generate commit message
   *
   * Overrides BaseAgent.executeCommand() to implement Codex-specific CLI invocation.
   * Uses stdin to pass the prompt directly to the Codex CLI.
   *
   * @param prompt - The prompt to send to Codex
   * @param workdir - Working directory for command execution
   * @returns Promise resolving to raw Codex output
   * @throws {Error} If command execution fails
   */
  protected async executeCommand(prompt: string, workdir: string): Promise<string> {
    // Execute Codex CLI with stdin for prompt
    // --skip-git-repo-check allows running in non-git directories (needed for eval system using /tmp)
    const result = await exec('codex', ['exec', '--skip-git-repo-check'], {
      cwd: workdir,
      input: prompt,
      timeout: 120_000, // 2 minutes
    });

    return result.stdout;
  }

  /**
   * Clean AI artifacts from Codex response
   *
   * Overrides BaseAgent.cleanResponse() to add Codex-specific cleaning.
   * First applies base cleaning (commit message markers, AI preambles, code fences, thinking tags),
   * then removes Codex-specific artifacts:
   * - Codex activity logs (timestamps, workdir info, etc.)
   * - Codex metadata fields (model, provider, approval, etc.)
   *
   * @param response - Raw response from Codex CLI
   * @returns Cleaned commit message with all artifacts removed
   *
   * @example
   * ```typescript
   * // Input:
   * // [2025-10-22T00:50:28] OpenAI Codex v0.42.0
   * // workdir: /path/to/repo
   * // feat: add feature
   * //
   * // Output:
   * // feat: add feature
   * ```
   */
  protected override cleanResponse(response: string): string {
    // First apply base cleaning (from BaseAgent)
    // This removes: commit message markers, AI preambles, code fences, thinking tags
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

    // Trim whitespace and remove extra blank lines
    cleaned = cleaned.trim();
    cleaned = cleaned.replaceAll(/\n{3,}/g, '\n\n'); // Max 2 consecutive newlines

    return cleaned;
  }
}
