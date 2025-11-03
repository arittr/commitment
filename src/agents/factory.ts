import { match } from 'ts-pattern';
import type { Logger } from '../utils/logger';

import { ClaudeAgent } from './claude';
import { CodexAgent } from './codex';
import { GeminiAgent } from './gemini';
import type { Agent, AgentName } from './types';

/**
 * Create an agent instance based on the agent name
 *
 * Uses ts-pattern for exhaustive, type-safe agent instantiation.
 * Provides compile-time exhaustiveness checking - if a new AgentName is added
 * to the type but not handled here, TypeScript will error.
 *
 * @param name - The agent name ('claude', 'codex', or 'gemini')
 * @param logger - Optional logger for debugging
 * @returns Agent instance for the specified name
 *
 * @example
 * ```typescript
 * const agent = createAgent('claude');
 * const message = await agent.generate(prompt, workdir);
 * ```
 */
export function createAgent(name: AgentName, logger?: Logger): Agent {
  const agent = match(name)
    .with('claude', () => new ClaudeAgent())
    .with('codex', () => new CodexAgent())
    .with('gemini', () => new GeminiAgent())
    .exhaustive();

  // Set logger on agent if provided
  if (logger) {
    agent.logger = logger;
  }

  return agent;
}
