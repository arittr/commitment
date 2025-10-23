/**
 * ChatGPT agent for structured evaluation
 *
 * Uses OpenAI Agents SDK with outputType pattern for type-safe evaluations.
 *
 * **OpenAI Agents SDK Pattern:**
 * - Model: `gpt-5`
 * - Pattern: `outputType` with Zod schema (NOT tools)
 * - Access: `result.finalOutput` (NOT `result.toolCalls`)
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { ChatGPTAgent } from './chatgpt-agent.js';
 *
 * const schema = z.object({
 *   score: z.number().min(0).max(10),
 *   feedback: z.string(),
 * });
 *
 * const agent = new ChatGPTAgent();
 * const result = await agent.evaluate(
 *   'Evaluate this commit message...',
 *   schema,
 *   'You are an expert code reviewer'
 * );
 *
 * console.log(result.score); // Typed as number
 * console.log(result.feedback); // Typed as string
 * ```
 */

import type { AgentOutputType } from '@openai/agents';
import { Agent, run } from '@openai/agents';
import { EvaluationError } from '../core/errors.js';

/**
 * ChatGPT agent wrapper using OpenAI Agents SDK
 *
 * Provides generic evaluate() method that accepts any Zod schema
 * and returns typed results via outputType pattern.
 */
export class ChatGPTAgent {
  /**
   * Evaluate using ChatGPT with structured output
   *
   * Uses OpenAI Agents SDK with outputType pattern for type safety.
   * Always uses gpt-5 model as per tech-stack.md.
   *
   * @template T - Schema type inferred from Zod schema
   * @param prompt - Evaluation prompt with context
   * @param schema - Zod schema for structured output
   * @param instructions - Instructions for the agent
   * @returns Typed evaluation result matching schema
   * @throws {EvaluationError} If evaluation fails
   *
   * @example
   * ```typescript
   * const schema = z.object({ score: z.number() });
   * const result = await agent.evaluate(
   *   'Rate this commit: feat: add login',
   *   schema,
   *   'Rate on scale 0-10'
   * );
   * console.log(result.score); // number
   * ```
   */
  async evaluate<T>(prompt: string, schema: AgentOutputType<T>, instructions: string): Promise<T> {
    try {
      // Create agent with outputType pattern
      const agent = new Agent({
        instructions,
        model: 'gpt-5', // Always use gpt-5 per tech-stack.md
        name: 'ChatGPT Evaluator',
        outputType: schema, // Use outputType, NOT tools
      });

      // Run agent with prompt
      const result = await run(agent, prompt);

      // Access via result.finalOutput, NOT result.toolCalls
      if (!result.finalOutput) {
        throw new Error('No output received from ChatGPT');
      }

      // Schema validation happens automatically via outputType
      return result.finalOutput as T;
    } catch (error) {
      // Wrap all errors in EvaluationError for consistent error handling
      if (error instanceof Error) {
        throw new EvaluationError(
          `ChatGPT evaluation failed: ${error.message}\n\n` +
            `How to fix:\n` +
            `- Check OpenAI API connectivity\n` +
            `- Verify API key is valid\n` +
            `- Review prompt and schema for issues\n` +
            `- Check OpenAI service status`,
          'META_EVALUATION_FAILED',
          error
        );
      }
      throw error;
    }
  }
}
