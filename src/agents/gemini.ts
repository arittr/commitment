import { exec } from '../utils/shell.js';

import { BaseAgent } from './base-agent';

/**
 * Gemini CLI agent for AI-powered commit message generation
 *
 * Extends BaseAgent with Gemini-specific CLI execution.
 * All standard flow (availability, cleaning, validation) inherited from BaseAgent.
 *
 * Implementation:
 * - Uses template method pattern from BaseAgent
 * - Overrides executeCommand() for Gemini-specific CLI invocation
 * - Inherits cleanResponse() from BaseAgent (Gemini produces clean output)
 * - Inherits standard validation and error handling from BaseAgent
 *
 * @example
 * ```typescript
 * const agent = new GeminiAgent();
 * const message = await agent.generate(
 *   'Generate commit message for:\n\nfeat: add dark mode toggle',
 *   '/path/to/repo'
 * );
 * // Returns: "feat: add dark mode toggle\n\nImplement theme switching..."
 * ```
 */
export class GeminiAgent extends BaseAgent {
  /**
   * CLI command name for the agent
   */
  readonly name = 'gemini';

  /**
   * Execute Gemini CLI to generate commit message
   *
   * Overrides BaseAgent.executeCommand() to implement Gemini-specific CLI invocation.
   * Uses gemini CLI with -p flag for prompt input.
   *
   * @param prompt - The prompt to send to Gemini (includes git diff, context, etc.)
   * @param workdir - Working directory for git operations
   * @returns Promise resolving to raw stdout from Gemini CLI
   * @throws {Error} If CLI execution fails
   */
  protected async executeCommand(prompt: string, workdir: string): Promise<string> {
    // Use gemini CLI with -p flag for prompt
    const result = await exec('gemini', ['-p', prompt], {
      cwd: workdir,
      timeout: 120_000, // 2 minutes
    });

    return result.stdout;
  }

  /**
   * Clean Gemini-specific artifacts from response
   *
   * Gemini produces clean output without agent-specific artifacts beyond the common ones
   * handled by BaseAgent (commit message markers, AI preambles, markdown, thinking tags).
   * This override exists for future Gemini-specific cleaning needs.
   *
   * @param output - Raw output from Gemini CLI
   * @returns Cleaned commit message
   */
  protected override cleanResponse(output: string): string {
    // Apply base cleaning (removes markers, preambles, markdown, thinking tags, etc.)
    const cleaned = super.cleanResponse(output);

    // No Gemini-specific cleaning needed currently
    // All common artifacts handled by BaseAgent.cleanResponse()
    return cleaned.trim();
  }
}
