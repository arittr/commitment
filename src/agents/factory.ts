import { match } from 'ts-pattern';

import { ClaudeAgent } from './claude';
import { CodexAgent } from './codex';
import type { Agent, AgentName } from './types';

/**
 * Create an agent instance based on the agent name
 *
 * Uses ts-pattern for exhaustive, type-safe agent instantiation.
 * Provides compile-time exhaustiveness checking - if a new AgentName is added
 * to the type but not handled here, TypeScript will error.
 *
 * @param name - The agent name ('claude', 'codex', or 'gemini')
 * @returns Agent instance for the specified name
 *
 * @example
 * ```typescript
 * const agent = createAgent('claude');
 * const message = await agent.generate(prompt, workdir);
 * ```
 */
export function createAgent(name: AgentName): Agent {
  return match(name)
    .with('claude', () => new ClaudeAgent())
    .with('codex', () => new CodexAgent())
    .with('gemini', () => {
      // GeminiAgent will be implemented in Task 3
      // For now, throw a helpful error
      throw new Error(
        'Gemini agent not yet implemented. This will be available in the next version.'
      );
    })
    .exhaustive();
}
