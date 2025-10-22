/**
 * Evaluator module for orchestrating ChatGPT-based commit message evaluation
 *
 * This module coordinates the evaluation process:
 * - Takes a commit message and changeset context
 * - Calls ChatGPT agent for structured scoring
 * - Returns complete evaluation result with metrics and feedback
 *
 * The evaluator calculates the overall score as the average of all metrics.
 *
 * @example
 * ```typescript
 * const evaluator = new Evaluator();
 * const result = await evaluator.evaluate(
 *   'fix: add null safety check',
 *   'M  src/parser.ts',
 *   'diff --git a/src/parser.ts...',
 *   'simple',
 *   'claude'
 * );
 * console.log(result.overallScore); // 8.25
 * console.log(result.feedback); // 'Good conventional commit format...'
 * ```
 */

import { ChatGPTAgent } from '../agents/chatgpt.js';

import type { EvalResult } from './schemas.js';

/**
 * Evaluator class that orchestrates ChatGPT-based commit message evaluation
 *
 * Responsibilities:
 * - Call ChatGPT agent with commit message and context
 * - Calculate overall score (average of 4 metrics)
 * - Return structured EvalResult with all details
 */
export class Evaluator {
  /** ChatGPT agent instance for evaluation */
  private readonly agent: ChatGPTAgent;

  /**
   * Create a new Evaluator instance
   *
   * @example
   * ```typescript
   * const evaluator = new Evaluator();
   * ```
   */
  constructor() {
    this.agent = new ChatGPTAgent();
  }

  /**
   * Evaluate a commit message against changeset context
   *
   * Takes a commit message, git status, and git diff, then:
   * 1. Calls ChatGPT agent for structured evaluation
   * 2. Calculates overall score (average of all metrics)
   * 3. Returns complete EvalResult
   *
   * @param commitMessage - The commit message to evaluate
   * @param gitStatus - Git status output (from git status --porcelain)
   * @param gitDiff - Git diff output (from git diff or git diff --cached)
   * @param fixtureName - Name of the fixture being evaluated
   * @param agentName - Name of the agent that generated the message (claude or codex)
   * @returns Complete evaluation result with metrics, feedback, and overall score
   * @throws {EvalError} If ChatGPT evaluation fails (API key missing, network error, etc.)
   *
   * @example
   * ```typescript
   * const evaluator = new Evaluator();
   * const result = await evaluator.evaluate(
   *   'fix: add null safety check to parser',
   *   'M  src/utils/parser.ts',
   *   'diff --git a/src/utils/parser.ts...',
   *   'simple-bugfix',
   *   'claude'
   * );
   *
   * console.log(result.agent); // 'claude'
   * console.log(result.overallScore); // 8.25
   * console.log(result.metrics.clarity); // 8
   * console.log(result.feedback); // 'Good conventional commit format...'
   * ```
   */
  async evaluate(
    commitMessage: string,
    gitStatus: string,
    gitDiff: string,
    fixtureName: string,
    agentName: 'claude' | 'codex',
  ): Promise<EvalResult> {
    // 1. Call ChatGPT agent for structured evaluation
    const { metrics, feedback } = await this.agent.evaluate(commitMessage, gitDiff, gitStatus);

    // 2. Calculate overall score (average of all 4 metrics)
    const overallScore =
      (metrics.conventionalCompliance + metrics.clarity + metrics.accuracy + metrics.detailLevel) /
      4;

    // 3. Return complete evaluation result
    return {
      agent: agentName,
      commitMessage,
      feedback,
      fixture: fixtureName,
      metrics,
      overallScore,
      timestamp: new Date().toISOString(),
    };
  }
}
