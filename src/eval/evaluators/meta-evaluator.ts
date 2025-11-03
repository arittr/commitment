/**
 * Meta-evaluator for 3-attempt analysis
 *
 * Evaluates all 3 attempts together to calculate:
 * - Final score (considers all attempts with failure penalties)
 * - Consistency score (variance across successful attempts)
 * - Error rate impact (penalty for failures)
 * - Success rate (X/3 format)
 * - Best attempt identification
 * - Reasoning (provided even for 0/3 success)
 *
 * **Key Principle:** 2/3 success ≠ average of 2 scores. Failures are penalized.
 *
 * @example
 * ```typescript
 * import { MetaEvaluator } from './meta-evaluator.js';
 *
 * const evaluator = new MetaEvaluator();
 * const result = await evaluator.evaluate(
 *   [attempt1, attempt2, attempt3],
 *   'diff --git...',
 *   'complex-feature'
 * );
 *
 * console.log(result.finalScore); // 7.5 (not just avg of successes)
 * console.log(result.successRate); // '2/3'
 * console.log(result.errorRateImpact); // -1.0
 * ```
 */

import type { Logger } from '../../utils/logger.js';
import { EvaluationError } from '../core/errors.js';
import { metaEvaluationOutputSchema } from '../core/schemas.js';
import type { AttemptOutcome, EvalResult } from '../core/types.js';
import { isSuccessOutcome } from '../core/types.js';
import { ChatGPTAgent } from './chatgpt-agent.js';

/**
 * Meta-evaluator for analyzing 3 attempts together
 *
 * Provides holistic analysis considering all attempts, consistency, and failures.
 */
export class MetaEvaluator {
  private chatgpt: ChatGPTAgent;

  /**
   * Create a new meta-evaluator
   *
   * @param logger - Logger for progress messages (reserved for future use)
   */
  constructor(logger: Logger) {
    this.chatgpt = new ChatGPTAgent(logger);
  }

  /**
   * Evaluate all 3 attempts together
   *
   * Analyzes consistency, calculates final score with failure penalties,
   * and provides reasoning even if all attempts failed.
   *
   * @param attempts - All 3 attempt outcomes (must be exactly 3)
   * @param diff - Git diff for context
   * @param fixtureName - Name of fixture being evaluated
   * @returns Complete evaluation result
   * @throws {EvaluationError} If attempt count is invalid or evaluation fails
   *
   * @example
   * ```typescript
   * const evaluator = new MetaEvaluator();
   * const result = await evaluator.evaluate(
   *   [success1, failure, success2],
   *   'diff --git...',
   *   'feature'
   * );
   * console.log(result.successRate); // '2/3'
   * ```
   */
  async evaluate(
    attempts: AttemptOutcome[],
    diff: string,
    fixtureName: string
  ): Promise<EvalResult> {
    // Validate attempt count
    if (attempts.length !== 3) {
      throw EvaluationError.invalidAttemptCount(attempts.length, 3);
    }

    // Build prompt with all attempts
    const prompt = this._buildPrompt(attempts, diff, fixtureName);

    // Instructions for ChatGPT meta-evaluation
    const instructions = `You are an expert evaluator analyzing the reliability and consistency of an AI commit message generator.

You are evaluating 3 attempts by the same agent on the same fixture. Your job is to:

1. **Calculate Final Score (0-10):**
   - Consider ALL 3 attempts (successes AND failures)
   - Penalize failures: 2/3 success ≠ average of 2 scores
   - Examples:
     - 3/3 success with scores 8, 8.5, 9 → finalScore ≈ 8.5-9.0
     - 2/3 success with scores 8, 9 → finalScore ≈ 7.0-7.5 (penalized)
     - 1/3 success with score 8 → finalScore ≈ 4.0-5.0 (heavily penalized)
     - 0/3 success → finalScore = 0

2. **Calculate Consistency Score (0-10):**
   - How consistent are the successful attempts?
   - 0 if fewer than 2 successes (cannot assess consistency)
   - 10 if all successes have identical or near-identical scores
   - Lower if scores vary significantly

3. **Calculate Error Rate Impact (≤0):**
   - Negative penalty for failures
   - 0 if 3/3 success
   - -0.5 to -1.0 for 1 failure
   - -2.0 to -3.0 for 2 failures
   - -10.0 for 3 failures

4. **Determine Success Rate:**
   - Count successes and format as "X/3"
   - Must be one of: "0/3", "1/3", "2/3", "3/3"

5. **Identify Best Attempt:**
   - Attempt number (1, 2, or 3) with highest score
   - undefined if all failed

6. **Provide Reasoning:**
   - Explain final score calculation
   - Discuss consistency patterns
   - Explain failure impact
   - **REQUIRED even for 0/3 success** - explain why all failed

Return structured evaluation following the schema.`;

    // Use ChatGPT with meta-evaluation schema
    const metaOutput = await this.chatgpt.evaluate<EvalResult>(
      prompt,
      metaEvaluationOutputSchema as any,
      instructions
    );

    // Construct full result with attempts
    return {
      attempts,
      bestAttempt: metaOutput.bestAttempt,
      consistencyScore: metaOutput.consistencyScore,
      errorRateImpact: metaOutput.errorRateImpact,
      finalScore: metaOutput.finalScore,
      reasoning: metaOutput.reasoning,
      successRate: metaOutput.successRate,
    };
  }

  /**
   * Build comprehensive prompt with all 3 attempts
   *
   * Includes both successes (with scores) and failures (with types and reasons).
   *
   * @param attempts - All 3 attempts
   * @param diff - Git diff
   * @param fixtureName - Fixture name
   * @returns Formatted prompt
   */
  private _buildPrompt(attempts: AttemptOutcome[], diff: string, fixtureName: string): string {
    const attemptSummaries = attempts.map((attempt, index) => {
      const attemptNum = index + 1;

      if (isSuccessOutcome(attempt)) {
        return `**Attempt ${attemptNum}: SUCCESS**
- Commit Message: \`${attempt.commitMessage}\`
- Clarity: ${attempt.metrics.clarity}/10
- Specificity: ${attempt.metrics.specificity}/10
- Conventional Format: ${attempt.metrics.conventionalFormat}/10
- Scope: ${attempt.metrics.scope}/10
- Overall Score: ${attempt.overallScore}/10`;
      } else {
        return `**Attempt ${attemptNum}: FAILURE**
- Failure Type: ${attempt.failureType}
- Failure Reason: ${attempt.failureReason}`;
      }
    });

    return `# Meta-Evaluation: 3-Attempt Analysis

**Fixture:** ${fixtureName}

## Git Diff Context
\`\`\`diff
${diff}
\`\`\`

## All 3 Attempts

${attemptSummaries.join('\n\n')}

## Task

Evaluate these 3 attempts holistically. Consider:
- How many succeeded vs failed?
- For successes: How consistent are the scores?
- For failures: What types and how severe?
- Overall reliability: Would you trust this agent?

Calculate final score with failure penalties, assess consistency, and provide detailed reasoning.`;
  }
}
