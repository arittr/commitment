/**
 * Eval runner for complete pipeline orchestration
 *
 * Orchestrates the full evaluation pipeline:
 * 1. Load fixtures
 * 2. For each fixture, for each agent:
 *    - Run 3 attempts via AttemptRunner
 *    - Meta-evaluate via MetaEvaluator
 *    - Store results via JSONReporter
 * 3. Compare agents using finalScore
 * 4. Generate markdown report via MarkdownReporter
 *
 * Handles errors gracefully with fallback scoring if meta-eval fails.
 *
 * @example
 * ```typescript
 * const runner = new EvalRunner(
 *   attemptRunner,
 *   metaEvaluator,
 *   jsonReporter,
 *   markdownReporter
 * );
 *
 * const comparison = await runner.run(fixtures);
 * console.log(comparison.winner); // 'claude' | 'codex' | 'tie'
 * console.log(comparison.claudeResult.finalScore); // 8.5
 * console.log(comparison.codexResult.finalScore); // 7.0
 * ```
 */

import { EvaluationError } from '../core/errors.js';
import type { AttemptOutcome, EvalComparison, EvalResult } from '../core/types.js';
import { isSuccessOutcome } from '../core/types.js';
import type { MetaEvaluator } from '../evaluators/meta-evaluator.js';
import type { JSONReporter } from '../reporters/json-reporter.js';
import type { MarkdownReporter } from '../reporters/markdown-reporter.js';
import type { AttemptRunner, Fixture } from './attempt-runner.js';

/**
 * Eval runner for complete pipeline orchestration
 *
 * Coordinates all components to execute the full evaluation pipeline.
 */
export class EvalRunner {
  /**
   * Create a new eval runner
   *
   * @param attemptRunner - Attempt runner for 3-attempt loop
   * @param metaEvaluator - Meta-evaluator for analyzing 3 attempts
   * @param jsonReporter - JSON reporter for storing results
   * @param markdownReporter - Markdown reporter for human-readable reports
   */
  constructor(
    private readonly attemptRunner: AttemptRunner,
    private readonly metaEvaluator: MetaEvaluator,
    private readonly jsonReporter: JSONReporter,
    private readonly markdownReporter: MarkdownReporter
  ) {}

  /**
   * Run complete evaluation pipeline
   *
   * Pipeline steps:
   * 1. For each fixture:
   *    a. Run Claude: 3 attempts → meta-eval → store JSON
   *    b. Run Codex: 3 attempts → meta-eval → store JSON
   * 2. Compare agents using finalScore
   * 3. Generate markdown report
   *
   * Handles errors with fallback scoring if meta-eval fails.
   *
   * @param fixtures - Fixtures to evaluate (usually just one)
   * @returns Evaluation comparison with winner
   * @throws {EvaluationError} If critical pipeline steps fail
   *
   * @example
   * ```typescript
   * const fixtures = [
   *   {
   *     name: 'simple',
   *     diff: 'diff --git...',
   *     status: 'M  file.ts'
   *   }
   * ];
   *
   * const comparison = await runner.run(fixtures);
   * console.log(comparison.winner); // 'claude'
   * console.log(comparison.claudeResult.finalScore); // 8.5
   * ```
   */
  async run(fixtures: Fixture[]): Promise<EvalComparison> {
    // For now, we only support single-fixture evaluation
    // (Multi-fixture would require aggregation logic)
    const fixture = fixtures[0];
    if (!fixture) {
      throw EvaluationError.missingFixture('No fixtures provided');
    }

    // Evaluate both agents
    const claudeResult = await this._evaluateAgent('claude', fixture);
    const codexResult = await this._evaluateAgent('codex', fixture);

    // Compare agents
    const winner = this._determineWinner(claudeResult, codexResult);

    // Build comparison
    const comparison: EvalComparison = {
      claudeResult,
      codexResult,
      fixture: fixture.name,
      winner,
    };

    // Generate markdown report
    await this.markdownReporter.generateReport(comparison);

    return comparison;
  }

  /**
   * Evaluate a single agent on a fixture
   *
   * Steps:
   * 1. Run 3 attempts via AttemptRunner
   * 2. Meta-evaluate via MetaEvaluator (with fallback)
   * 3. Store results via JSONReporter
   *
   * @param agentName - Agent to evaluate ('claude' | 'codex')
   * @param fixture - Fixture to evaluate
   * @returns Evaluation result with finalScore
   */
  private async _evaluateAgent(agentName: string, fixture: Fixture): Promise<EvalResult> {
    // Step 1: Run 3 attempts
    const attempts = await this.attemptRunner.runAttempts(agentName, fixture);

    // Step 2: Meta-evaluate (with fallback)
    let evalResult: EvalResult;
    try {
      evalResult = await this.metaEvaluator.evaluate(attempts, fixture.diff, fixture.name);
    } catch (_error) {
      // Fallback: Calculate simple average if meta-eval fails
      evalResult = this._calculateFallbackScore(attempts);
    }

    // Step 3: Store results (fixture name includes agent)
    const fixtureKey = `${fixture.name}-${agentName}`;
    await this.jsonReporter.saveResults(evalResult, fixtureKey);

    return evalResult;
  }

  /**
   * Calculate fallback score if meta-evaluation fails
   *
   * Simple fallback logic:
   * - Average successful attempts' scores
   * - Penalize for failures (approximate error rate impact)
   * - No consistency analysis (requires ChatGPT)
   *
   * @param attempts - All 3 attempts
   * @returns Evaluation result with fallback scores
   */
  private _calculateFallbackScore(attempts: AttemptOutcome[]): EvalResult {
    // Count successes
    const successes = attempts.filter(isSuccessOutcome);
    const successCount = successes.length;
    const successRate = `${successCount}/3` as '0/3' | '1/3' | '2/3' | '3/3';

    // Calculate average score from successes
    let finalScore = 0;
    if (successCount > 0) {
      const sum = successes.reduce((acc, s) => acc + s.overallScore, 0);
      finalScore = sum / successCount;
    }

    // Approximate error rate impact
    const failureCount = 3 - successCount;
    const errorRateImpact = failureCount * -1.0;

    // Best attempt (highest score)
    let bestAttempt: number | undefined;
    if (successCount > 0) {
      const best = successes.reduce((best, curr) =>
        curr.overallScore > best.overallScore ? curr : best
      );
      bestAttempt = best.attemptNumber;
    }

    return {
      attempts,
      bestAttempt,
      consistencyScore: 0, // Cannot calculate without ChatGPT
      errorRateImpact,
      finalScore: Math.round(finalScore * 10) / 10,
      reasoning: '[FALLBACK] Meta-evaluation failed. Using simple average of successful attempts.',
      successRate,
    };
  }

  /**
   * Determine winner based on finalScore comparison
   *
   * Winner determination:
   * - If difference > 0.5: higher score wins
   * - If difference ≤ 0.5: tie
   *
   * @param claudeResult - Claude's evaluation result
   * @param codexResult - Codex's evaluation result
   * @returns Winner ('claude' | 'codex' | 'tie')
   */
  private _determineWinner(
    claudeResult: EvalResult,
    codexResult: EvalResult
  ): 'claude' | 'codex' | 'tie' {
    const difference = Math.abs(claudeResult.finalScore - codexResult.finalScore);

    // Tie threshold: 0.5 points
    if (difference <= 0.5) {
      return 'tie';
    }

    // Winner has higher finalScore
    return claudeResult.finalScore > codexResult.finalScore ? 'claude' : 'codex';
  }
}
