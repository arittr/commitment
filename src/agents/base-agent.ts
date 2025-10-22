import { exec } from '../utils/shell.js';
import { cleanAIResponse, validateConventionalCommit } from './agent-utils';
import type { Agent } from './types';

/**
 * Abstract base class for AI agents using template method pattern
 *
 * Provides standard flow for commit message generation:
 * 1. checkAvailability() - Verify CLI is installed (concrete method)
 * 2. executeCommand() - Execute agent-specific command (abstract - MUST override)
 * 3. cleanResponse() - Clean AI artifacts (virtual - can override)
 * 4. validateResponse() - Validate conventional commit format (virtual - can override)
 *
 * Extension Points:
 * 1. executeCommand() - REQUIRED: Implement agent-specific CLI execution
 * 2. cleanResponse() - OPTIONAL: Override for agent-specific cleaning (default uses cleanAIResponse)
 * 3. validateResponse() - OPTIONAL: Override for custom validation (default uses validateConventionalCommit)
 *
 * Design Philosophy:
 * - Template method enforces consistent flow across all agents
 * - Minimal extension points prevent over-abstraction
 * - Default implementations use agent-utils for common behavior
 * - Keeps agent implementations simple (~40-60 LOC)
 *
 * @example
 * ```typescript
 * class ClaudeAgent extends BaseAgent {
 *   readonly name = 'claude';
 *
 *   protected async executeCommand(prompt: string, workdir: string): Promise<string> {
 *     const result = await execa('claude', ['--prompt', prompt], {
 *       cwd: workdir,
 *       timeout: 120_000
 *     });
 *     return result.stdout;
 *   }
 * }
 *
 * // Usage
 * const agent = new ClaudeAgent();
 * const message = await agent.generate(prompt, workdir);
 * ```
 *
 * @example Override cleanResponse for agent-specific cleaning
 * ```typescript
 * class CodexAgent extends BaseAgent {
 *   readonly name = 'codex';
 *
 *   protected async executeCommand(prompt: string, workdir: string): Promise<string> {
 *     const result = await execa('codex', ['exec', prompt], {
 *       cwd: workdir,
 *       timeout: 120_000
 *     });
 *     return result.stdout;
 *   }
 *
 *   protected override cleanResponse(output: string): string {
 *     // First apply base cleaning
 *     let cleaned = super.cleanResponse(output);
 *     // Then remove Codex-specific artifacts
 *     cleaned = cleaned.replace(/\[CODEX\]/g, '');
 *     return cleaned;
 *   }
 * }
 * ```
 */
export abstract class BaseAgent implements Agent {
  /**
   * Human-readable name of the agent
   *
   * Subclasses must provide this value.
   *
   * @example 'claude', 'codex', 'chatgpt'
   */
  abstract readonly name: string;

  /**
   * Template method for generating commit messages
   *
   * Enforces standard flow:
   * 1. Check CLI availability
   * 2. Execute agent command
   * 3. Clean response
   * 4. Validate response
   *
   * This method is final - subclasses should not override it.
   * Instead, implement the extension points.
   *
   * @param prompt - The prompt to send to the AI agent
   * @param workdir - Working directory for git operations
   * @returns Promise resolving to the generated commit message
   * @throws {Error} If CLI not found, execution fails, or validation fails
   */
  async generate(prompt: string, workdir: string): Promise<string> {
    // Step 1: Check CLI availability
    await this.checkAvailability(this.name, workdir);

    // Step 2: Execute agent-specific command
    const rawOutput = await this.executeCommand(prompt, workdir);

    // Step 3: Clean response (remove artifacts, normalize whitespace)
    const cleanedOutput = this.cleanResponse(rawOutput);

    // Step 4: Validate response (check conventional commit format)
    this.validateResponse(cleanedOutput);

    return cleanedOutput;
  }

  /**
   * Check if CLI command is available on the system
   *
   * Uses `which` command to verify CLI is installed and accessible.
   * Concrete method used by all agents.
   *
   * @param cliCommand - Name of the CLI command to check
   * @param workdir - Working directory for command execution
   * @throws {Error} If CLI not found (ENOENT) or other execution error
   */
  protected async checkAvailability(cliCommand: string, workdir: string): Promise<void> {
    // exec() already throws helpful errors for ENOENT and other failures
    await exec('which', [cliCommand], { cwd: workdir });
  }

  /**
   * Execute agent-specific command to generate commit message
   *
   * EXTENSION POINT 1 (REQUIRED):
   * Subclasses MUST implement this method with agent-specific CLI execution.
   *
   * Responsibilities:
   * - Execute agent CLI with appropriate arguments
   * - Handle command-specific errors
   * - Return raw stdout from command
   *
   * @param prompt - The prompt to send to the AI agent
   * @param workdir - Working directory for command execution
   * @returns Promise resolving to raw command output
   * @throws {Error} If command execution fails
   *
   * @example
   * ```typescript
   * protected async executeCommand(prompt: string, workdir: string): Promise<string> {
   *   const result = await execa('claude', ['--prompt', prompt], {
   *     cwd: workdir,
   *     timeout: 120_000
   *   });
   *   return result.stdout;
   * }
   * ```
   */
  protected abstract executeCommand(prompt: string, workdir: string): Promise<string>;

  /**
   * Clean AI-generated response by removing artifacts
   *
   * EXTENSION POINT 2 (OPTIONAL):
   * Subclasses can override for agent-specific cleaning.
   *
   * Default implementation uses cleanAIResponse() from agent-utils to remove:
   * - Markdown code blocks
   * - Thinking tags
   * - Excessive newlines
   *
   * Override when:
   * - Agent produces specific artifacts not covered by default cleaning
   * - Need to call base cleaning + add custom logic
   *
   * @param output - Raw output from executeCommand()
   * @returns Cleaned output with artifacts removed
   *
   * @example Override for custom cleaning
   * ```typescript
   * protected override cleanResponse(output: string): string {
   *   // First apply base cleaning
   *   let cleaned = super.cleanResponse(output);
   *   // Then remove agent-specific artifacts
   *   cleaned = cleaned.replace(/\[AGENT_NAME\]/g, '');
   *   return cleaned;
   * }
   * ```
   */
  protected cleanResponse(output: string): string {
    return cleanAIResponse(output);
  }

  /**
   * Validate that response follows conventional commit format
   *
   * EXTENSION POINT 3 (OPTIONAL):
   * Subclasses can override for custom validation.
   *
   * Default implementation uses validateConventionalCommit() from agent-utils
   * to check basic format: `type(scope?): description`
   *
   * Override when:
   * - Need stricter validation rules
   * - Want to enforce project-specific conventions
   *
   * @param message - Cleaned commit message to validate
   * @throws {Error} If message is invalid
   *
   * @example Override for custom validation
   * ```typescript
   * protected override validateResponse(message: string): void {
   *   // First apply base validation
   *   super.validateResponse(message);
   *   // Then add custom checks
   *   if (!message.includes('JIRA-')) {
   *     throw new Error('Commit message must include JIRA ticket');
   *   }
   * }
   * ```
   */
  protected validateResponse(message: string): void {
    if (!validateConventionalCommit(message)) {
      throw new Error(
        `Invalid conventional commit format. Expected: type(scope?): description\nReceived: ${message}`
      );
    }
  }
}
