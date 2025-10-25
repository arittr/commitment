import { exec } from '../utils/shell.js';

import { BaseAgent } from './base-agent';

/**
 * Claude CLI agent for AI-powered commit message generation
 *
 * Extends BaseAgent with Claude-specific CLI execution.
 * All standard flow (availability, cleaning, validation) inherited from BaseAgent.
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
 */
export class ClaudeAgent extends BaseAgent {
  /**
   * CLI command name for the agent
   */
  readonly name = 'claude';

  /**
   * Execute Claude CLI to generate commit message
   *
   * @param prompt - The prompt to send to Claude (includes git diff, context, etc.)
   * @param workdir - Working directory for git operations
   * @returns Promise resolving to raw stdout from Claude CLI
   * @throws {Error} If CLI execution fails
   */
  protected async executeCommand(prompt: string, workdir: string): Promise<string> {
    // Use /bin/sh -c for Bun compatibility (Bun.spawn doesn't search PATH)
    const result = await exec('/bin/sh', ['-c', 'claude --print'], {
      cwd: workdir,
      input: prompt,
      timeout: 120_000, // 2 minutes
    });

    return result.stdout;
  }

  /**
   * Clean Claude-specific artifacts from response
   *
   * Claude doesn't produce agent-specific artifacts beyond the common ones
   * handled by BaseAgent (commit message markers, AI preambles, markdown, thinking tags).
   * This override exists for future Claude-specific cleaning needs.
   *
   * @param output - Raw output from Claude CLI
   * @returns Cleaned commit message
   */
  protected override cleanResponse(output: string): string {
    // Apply base cleaning (removes markers, preambles, markdown, thinking tags, etc.)
    const cleaned = super.cleanResponse(output);

    // No Claude-specific cleaning needed currently
    // All common artifacts handled by BaseAgent.cleanResponse()
    return cleaned.trim();
  }
}
