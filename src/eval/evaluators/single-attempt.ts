/**
 * Single-attempt evaluator for commit messages
 *
 * Evaluates a single commit message across 4 dimensions:
 * - Clarity: How clear and understandable (0-10)
 * - Specificity: Level of detail and precision (0-10)
 * - Conventional Format: Adherence to Conventional Commits (0-10)
 * - Scope: Appropriate scope and focus (0-10)
 *
 * Uses ChatGPT for evaluation and calculates overall score as average.
 *
 * @example
 * ```typescript
 * import { SingleAttemptEvaluator } from './single-attempt.js';
 *
 * const evaluator = new SingleAttemptEvaluator();
 * const result = await evaluator.evaluate(
 *   'feat: add user authentication',
 *   'diff --git a/src/auth.ts...',
 *   'simple-feature'
 * );
 *
 * console.log(result.overallScore); // 8.5
 * console.log(result.metrics.clarity); // 9
 * ```
 */

import type { Logger } from '../../utils/logger.js';
import { attemptMetricsSchema } from '../core/schemas.js';
import type { AttemptMetrics } from '../core/types.js';
import { ChatGPTAgent } from './chatgpt-agent.js';

/**
 * Result of single-attempt evaluation
 */
export interface SingleAttemptResult {
  /**
   * Overall score (average of all metrics)
   */
  overallScore: number;

  /**
   * Structured metrics (4 dimensions)
   */
  metrics: AttemptMetrics;
}

/**
 * Single-attempt evaluator
 *
 * Evaluates individual commit messages using ChatGPT.
 */
export class SingleAttemptEvaluator {
  private chatgpt: ChatGPTAgent;

  /**
   * Create a new single-attempt evaluator
   *
   * @param logger - Logger for progress messages (reserved for future use)
   */
  constructor(logger: Logger) {
    this.chatgpt = new ChatGPTAgent(logger);
  }

  /**
   * Evaluate a commit message
   *
   * Scores the message across 4 dimensions (0-10 scale each).
   * Calculates overall score as average of all metrics.
   *
   * @param commitMessage - Commit message to evaluate
   * @param diff - Git diff for context
   * @param fixtureName - Name of fixture being evaluated
   * @returns Evaluation result with metrics and overall score
   * @throws {EvaluationError} If evaluation fails
   *
   * @example
   * ```typescript
   * const evaluator = new SingleAttemptEvaluator();
   * const result = await evaluator.evaluate(
   *   'fix: resolve authentication bug',
   *   'diff --git a/src/auth.ts...',
   *   'bug-fix'
   * );
   * console.log(result.overallScore); // 8.25
   * ```
   */
  async evaluate(
    commitMessage: string,
    diff: string,
    fixtureName: string
  ): Promise<SingleAttemptResult> {
    // Build evaluation prompt with context
    const prompt = this._buildPrompt(commitMessage, diff, fixtureName);

    // Instructions for ChatGPT evaluation
    const instructions = `You are an expert code reviewer evaluating commit message quality.

Evaluate the commit message across 4 dimensions on a 0-10 scale:

1. **Clarity** (0-10): How clear and understandable is the message?
   - 10: Crystal clear, no ambiguity
   - 5: Somewhat clear but could be improved
   - 0: Confusing or unclear

2. **Specificity** (0-10): Level of detail and precision
   - 10: Perfect level of specificity
   - 5: Too vague or too detailed
   - 0: Missing specifics or overwhelming detail

3. **Conventional Format** (0-10): Adherence to Conventional Commits
   - 10: Perfect format (type: description, proper structure)
   - 5: Correct type but poor structure
   - 0: No conventional format

4. **Scope** (0-10): Appropriate scope and focus
   - 10: Perfect scope definition
   - 5: Scope could be more focused
   - 0: No clear scope or too broad

Provide numeric scores for each dimension.`;

    // Use ChatGPT with metrics schema
    const metrics = await this.chatgpt.evaluate<AttemptMetrics>(
      prompt,
      attemptMetricsSchema as any,
      instructions
    );

    // Calculate overall score as average
    const overallScore = this._calculateOverallScore(metrics);

    return {
      metrics,
      overallScore,
    };
  }

  /**
   * Build evaluation prompt with commit message, diff, and fixture context
   *
   * @param commitMessage - Commit message to evaluate
   * @param diff - Git diff for context
   * @param fixtureName - Fixture name
   * @returns Formatted prompt
   */
  private _buildPrompt(commitMessage: string, diff: string, fixtureName: string): string {
    return `# Commit Message Evaluation

**Fixture:** ${fixtureName}

**Commit Message:**
\`\`\`
${commitMessage}
\`\`\`

**Git Diff:**
\`\`\`diff
${diff}
\`\`\`

Evaluate this commit message across all 4 dimensions.`;
  }

  /**
   * Calculate overall score as average of all metrics
   *
   * Rounds to 1 decimal place.
   *
   * @param metrics - Individual metrics
   * @returns Overall score (0-10)
   */
  private _calculateOverallScore(metrics: AttemptMetrics): number {
    const sum = metrics.clarity + metrics.specificity + metrics.conventionalFormat + metrics.scope;
    const average = sum / 4;

    // Round to 1 decimal place
    return Math.round(average * 10) / 10;
  }
}
