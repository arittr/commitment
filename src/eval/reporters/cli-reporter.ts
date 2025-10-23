/**
 * CLI reporter for real-time progress updates
 *
 * Provides colored console output for attempt progress and summaries.
 * Uses chalk for colored output (green for success, red for failure, yellow for warnings).
 *
 * @example
 * ```typescript
 * const reporter = new CLIReporter();
 *
 * // Report attempt progress
 * reporter.reportAttemptStart(1);
 * reporter.reportAttemptSuccess(1, 8.5);
 *
 * reporter.reportAttemptStart(2);
 * reporter.reportAttemptFailure(2, 'validation');
 *
 * // Report final summary
 * reporter.reportSummary('2/3', 7.5);
 * ```
 */

/* eslint-disable no-console */

import chalk from 'chalk';

import type { FailureType, SuccessRate } from '../core/types.js';

/**
 * CLI reporter for real-time evaluation progress
 *
 * Displays colored output for:
 * - Attempt start notifications
 * - Success results with scores
 * - Failure results with failure types
 * - Summary with success rate and final score
 */
export class CLIReporter {
  /**
   * Report the start of an attempt
   *
   * @param attemptNumber - Attempt number (1, 2, or 3)
   *
   * @example
   * ```typescript
   * reporter.reportAttemptStart(1);
   * // Output: "▶ Attempt 1..."
   * ```
   */
  reportAttemptStart(attemptNumber: number): void {
    console.log(chalk.gray(`▶ Attempt ${attemptNumber}...`));
  }

  /**
   * Report a successful attempt with score
   *
   * @param attemptNumber - Attempt number (1, 2, or 3)
   * @param score - Overall score (0-10)
   *
   * @example
   * ```typescript
   * reporter.reportAttemptSuccess(1, 8.5);
   * // Output: "✓ Attempt 1: Success (score: 8.5)"
   * ```
   */
  reportAttemptSuccess(attemptNumber: number, score: number): void {
    console.log(chalk.green(`  ✓ Attempt ${attemptNumber}: Success (score: ${score.toFixed(1)})`));
  }

  /**
   * Report a failed attempt with failure type
   *
   * @param attemptNumber - Attempt number (1, 2, or 3)
   * @param failureType - Type of failure
   *
   * @example
   * ```typescript
   * reporter.reportAttemptFailure(2, 'validation');
   * // Output: "✗ Attempt 2: Failed (validation)"
   * ```
   */
  reportAttemptFailure(attemptNumber: number, failureType: FailureType): void {
    console.log(chalk.red(`  ✗ Attempt ${attemptNumber}: Failed (${failureType})`));
  }

  /**
   * Report summary with success rate and final score
   *
   * Colors:
   * - Green: 3/3 success
   * - Yellow: 1/3 or 2/3 success
   * - Red: 0/3 success
   *
   * @param successRate - Success rate in format "X/3"
   * @param finalScore - Final meta-evaluation score (0-10)
   *
   * @example
   * ```typescript
   * reporter.reportSummary('2/3', 7.5);
   * // Output:
   * // "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
   * // "Summary:"
   * // "  Success Rate: 2/3"
   * // "  Final Score: 7.5"
   * ```
   */
  reportSummary(successRate: SuccessRate, finalScore: number): void {
    console.log(chalk.gray('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.bold('Summary:'));

    // Color based on success rate
    const rateColor =
      successRate === '3/3' ? chalk.green : successRate === '0/3' ? chalk.red : chalk.yellow;

    console.log(`  Success Rate: ${rateColor(successRate)}`);
    console.log(`  Final Score: ${chalk.cyan(finalScore.toFixed(1))}`);
    console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  }
}
