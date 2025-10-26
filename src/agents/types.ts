import { z } from 'zod';

/**
 * Core Agent interface for AI-powered commit message generation
 *
 * This interface represents a simplified abstraction for AI agents that generate
 * commit messages. Each agent implementation handles its own execution logic,
 * availability checking, and response parsing.
 *
 * Design Philosophy:
 * - No base classes or abstract classes (standalone implementations)
 * - Single responsibility: generate commit messages from prompts
 * - Self-contained: each agent manages its own CLI/API interaction
 *
 * @example
 * ```typescript
 * class ClaudeAgent implements Agent {
 *   readonly name = 'Claude CLI';
 *
 *   async generate(prompt: string, workdir: string): Promise<string> {
 *     // Execute claude CLI, parse response
 *     const { stdout } = await execa('claude', ['--print'], {
 *       input: prompt,
 *       cwd: workdir,
 *     });
 *     return parseCommitMessage(stdout);
 *   }
 * }
 * ```
 */
export type Agent = {
  /**
   * Generate a commit message from the given prompt
   *
   * @param prompt - The prompt to send to the AI agent (includes git diff, context, etc.)
   * @param workdir - Working directory for git operations
   * @returns Promise resolving to the generated commit message in conventional commit format
   * @throws {AgentError} If agent execution fails or response is malformed
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
  generate(prompt: string, workdir: string): Promise<string>;

  /**
   * Human-readable name of the agent (e.g., "Claude CLI", "Codex CLI")
   */
  readonly name: string;
};

/**
 * Supported AI agent names for commit message generation
 *
 * This is the SINGLE SOURCE OF TRUTH for all supported agents.
 * The agentNameSchema in types/schemas.ts derives from this.
 *
 * Supported agents:
 * - claude: Claude CLI agent
 * - codex: Codex CLI agent
 * - gemini: Gemini CLI agent
 *
 * Note: ChatGPTAgent is not included here as it's evaluation-only (not for generation).
 * ChatGPTAgent is exported separately for use by the evaluation system.
 *
 * @example
 * ```typescript
 * import { SUPPORTED_AGENTS } from './agents/types.js';
 *
 * // Use for validation
 * const isValid = SUPPORTED_AGENTS.includes(userInput);
 *
 * // Use for schemas
 * const schema = z.enum(SUPPORTED_AGENTS);
 * ```
 */
export const SUPPORTED_AGENTS = ['claude', 'codex', 'gemini'] as const;

/**
 * Type representing a valid agent name
 */
export type AgentName = (typeof SUPPORTED_AGENTS)[number];

/**
 * Zod schema for agent configuration
 *
 * Validates that:
 * - agent field is present and non-empty
 * - agent value is one of the supported agents
 * - whitespace is trimmed from agent name
 *
 * @example
 * ```typescript
 * const config = agentConfigSchema.parse({ agent: 'claude' });
 * // => { agent: 'claude' }
 *
 * const config = agentConfigSchema.parse({ agent: 'invalid' });
 * // => throws ZodError: "Invalid agent. Valid options: claude, codex"
 * ```
 */
export const agentConfigSchema = z.object({
  agent: z
    .string()
    .trim()
    .min(1, 'Agent name is required')
    .refine((value): value is AgentName => SUPPORTED_AGENTS.includes(value as AgentName), {
      message: `Invalid agent. Valid options: ${SUPPORTED_AGENTS.join(', ')}`,
    }),
});

/**
 * Type for agent configuration
 *
 * Inferred from agentConfigSchema to ensure single source of truth.
 * Use this type for all agent configuration in the codebase.
 *
 * @example
 * ```typescript
 * const config: AgentConfig = { agent: 'claude' };
 * const generator = new CommitMessageGenerator(config);
 * ```
 */
export type AgentConfig = z.infer<typeof agentConfigSchema>;

/**
 * Validate agent configuration with runtime checks
 *
 * Throws ZodError if configuration is invalid.
 * Use this at system boundaries (CLI input, file I/O, etc.)
 *
 * @param config - Unknown input to validate
 * @returns Validated and typed agent configuration
 * @throws {ZodError} If configuration is invalid
 *
 * @example
 * ```typescript
 * try {
 *   const config = validateAgentConfig(userInput);
 *   const agent = createAgent(config.agent);
 * } catch (error) {
 *   if (error instanceof z.ZodError) {
 *     console.error('Invalid configuration:', error.message);
 *   }
 * }
 * ```
 */
export function validateAgentConfig(config: unknown): AgentConfig {
  return agentConfigSchema.parse(config);
}

/**
 * Safely validate agent configuration without throwing
 *
 * Returns a result object with success/failure status.
 * Use this when you want to handle validation errors gracefully.
 *
 * @param config - Unknown input to validate
 * @returns Result object with success status and data or error
 *
 * @example
 * ```typescript
 * const result = safeValidateAgentConfig(userInput);
 *
 * if (result.success) {
 *   const agent = createAgent(result.data.agent);
 * } else {
 *   console.warn('Invalid config:', result.error.issues);
 *   // Fall back to default
 * }
 * ```
 */
export function safeValidateAgentConfig(
  config: unknown
): { data: AgentConfig; success: true } | { error: z.ZodError; success: false } {
  return agentConfigSchema.safeParse(config);
}
