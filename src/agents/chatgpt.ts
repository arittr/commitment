/**
 * ChatGPT agent for evaluating commit message quality
 *
 * This agent uses OpenAI Agents SDK to evaluate commit messages on 4 dimensions:
 * - Conventional Commits compliance (0-10)
 * - Clarity and readability (0-10)
 * - Accuracy of description (0-10)
 * - Appropriate detail level (0-10)
 *
 * Follows the agent pattern: ~80 LOC, inline logic, no base classes.
 * This agent is evaluation-only (not part of the Agent interface for message generation).
 *
 * @example
 * ```typescript
 * const agent = new ChatGPTAgent();
 * const result = await agent.evaluate(
 *   'fix: add null safety check',
 *   'diff --git...',
 *   'M  src/file.ts'
 * );
 * console.log(result.metrics.clarity); // 8
 * console.log(result.feedback); // 'Clear and concise...'
 * ```
 */

import { Agent, run, type Tool } from '@openai/agents';
import { EvalError } from '../errors';
import type { EvalMetrics } from '../eval/schemas';

/**
 * ChatGPT agent for commit message quality evaluation
 *
 * Uses OpenAI Agents SDK to score commit messages on multiple dimensions.
 * Returns structured metrics and textual feedback.
 */
export class ChatGPTAgent {
  /** Agent identifier */
  readonly name = 'chatgpt';

  /**
   * Evaluate a commit message against changeset context
   *
   * @param commitMessage - The commit message to evaluate
   * @param gitDiff - Git diff output showing actual changes
   * @param gitStatus - Git status output showing file changes
   * @returns Structured metrics (0-10 scale) and textual feedback
   * @throws {EvalError} If API key is missing or evaluation fails
   *
   * @example
   * ```typescript
   * const agent = new ChatGPTAgent();
   * const result = await agent.evaluate(
   *   'fix: add null safety check to parser',
   *   'diff --git a/src/parser.ts...',
   *   'M  src/parser.ts'
   * );
   * // result.metrics: { conventionalCompliance: 9, clarity: 8, accuracy: 9, detailLevel: 7 }
   * // result.feedback: 'Good conventional commit format. Clear description...'
   * ```
   */
  async evaluate(
    commitMessage: string,
    gitDiff: string,
    gitStatus: string
  ): Promise<{ feedback: string; metrics: EvalMetrics }> {
    // 1. Check API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      throw EvalError.apiKeyMissing('OpenAI');
    }

    // 2. Initialize OpenAI Agents SDK

    const agent = new Agent({
      instructions: `You are an expert at evaluating commit messages according to the Conventional Commits specification.

Evaluate commit messages on these 4 dimensions (0-10 scale):

1. Conventional Compliance (0-10):
   - 10: Perfect format (type: description, proper body/footer)
   - 5: Correct type but poor structure
   - 0: No conventional format

2. Clarity (0-10):
   - 10: Crystal clear, no ambiguity
   - 5: Somewhat clear but could be improved
   - 0: Confusing or unclear

3. Accuracy (0-10):
   - 10: Perfectly matches git diff
   - 5: Partially accurate
   - 0: Inaccurate or misleading

4. Detail Level (0-10):
   - 10: Perfect detail (not too verbose, not too terse)
   - 5: Too verbose or too terse
   - 0: Missing critical details or overwhelming

Provide structured scores and actionable feedback.`,
      model: 'gpt-4',
      name: 'commit-evaluator',
      tools: [
        {
          description: 'Score a commit message on multiple dimensions and provide feedback',
          name: 'score_commit',
          parameters: {
            additionalProperties: false,
            properties: {
              accuracy: {
                description: 'Accuracy of description score (0-10)',
                maximum: 10,
                minimum: 0,
                type: 'number',
              },
              clarity: {
                description: 'Clarity and readability score (0-10)',
                maximum: 10,
                minimum: 0,
                type: 'number',
              },
              conventionalCompliance: {
                description: 'Conventional Commits compliance score (0-10)',
                maximum: 10,
                minimum: 0,
                type: 'number',
              },
              detailLevel: {
                description: 'Appropriate detail level score (0-10)',
                maximum: 10,
                minimum: 0,
                type: 'number',
              },
              feedback: {
                description: 'Actionable feedback explaining the scores',
                type: 'string',
              },
            },
            required: ['conventionalCompliance', 'clarity', 'accuracy', 'detailLevel', 'feedback'],
            type: 'object',
          },
        },
      ] as Tool[],
    });

    // 3. Call agent with commit message and changeset context
    try {
      const result: unknown = await run(
        agent,
        `Evaluate this commit message:

Commit Message:
${commitMessage}

Git Status:
${gitStatus}

Git Diff:
${gitDiff}

Use the score_commit tool to provide structured evaluation.`
      );

      // 4. Parse structured response from tool call
      // Type guard for result structure
      if (
        typeof result !== 'object' ||
        result === null ||
        !('toolCalls' in result) ||
        !Array.isArray((result as { toolCalls?: unknown[] }).toolCalls) ||
        (result as { toolCalls: unknown[] }).toolCalls.length === 0
      ) {
        throw new Error('No tool call in response');
      }

      const { toolCalls } = result as { toolCalls: Array<{ arguments?: unknown }> };
      const firstToolCall = toolCalls[0];
      if (firstToolCall === undefined) {
        throw new Error('No tool call found in response');
      }
      const toolCallArguments = firstToolCall.arguments;

      if (typeof toolCallArguments !== 'object' || toolCallArguments === null) {
        throw new Error('Tool call missing arguments');
      }

      const scores = toolCallArguments as {
        accuracy: number;
        clarity: number;
        conventionalCompliance: number;
        detailLevel: number;
        feedback: string;
      };

      return {
        feedback: scores.feedback,
        metrics: {
          accuracy: scores.accuracy,
          clarity: scores.clarity,
          conventionalCompliance: scores.conventionalCompliance,
          detailLevel: scores.detailLevel,
        },
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw EvalError.evaluationFailed(error.message);
      }
      throw EvalError.evaluationFailed('Unknown error');
    }
  }
}
