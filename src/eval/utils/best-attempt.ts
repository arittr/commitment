/**
 * Best attempt selection utility for multi-attempt evaluation
 *
 * Provides pure function to select the highest-scoring successful attempt
 * from an array of attempt outcomes.
 *
 * @module best-attempt
 *
 * @example
 * ```typescript
 * import { getBestAttempt } from './best-attempt.js';
 *
 * const attempts = [
 *   { status: 'success', overallScore: 8.0, attemptNumber: 1, ... },
 *   { status: 'failure', failureType: 'validation', attemptNumber: 2, ... },
 *   { status: 'success', overallScore: 9.5, attemptNumber: 3, ... }
 * ];
 *
 * const best = getBestAttempt(attempts);
 * console.log(best?.attemptNumber); // 3
 * console.log(best?.overallScore);  // 9.5
 * ```
 */

import type { AttemptOutcome, SuccessOutcome } from '../core/types.js';
import { isSuccessOutcome } from '../core/types.js';

/**
 * Select the highest-scoring successful attempt from an array of outcomes
 *
 * This is a pure function that:
 * - Filters out all failure outcomes
 * - Finds the success with the highest overallScore
 * - Returns undefined if no successes exist
 * - Does not mutate the input array
 * - Returns the first success in case of tied scores
 *
 * The function is deterministic - same input always produces same output.
 *
 * @param attempts - Array of attempt outcomes (successes and failures)
 * @returns Highest-scoring success outcome, or undefined if all failed
 *
 * @example
 * ```typescript
 * // Mixed successes and failures
 * const attempts = [
 *   { status: 'failure', failureType: 'validation', attemptNumber: 1, ... },
 *   { status: 'success', overallScore: 8.0, attemptNumber: 2, ... },
 *   { status: 'success', overallScore: 9.5, attemptNumber: 3, ... }
 * ];
 *
 * const best = getBestAttempt(attempts);
 * console.log(best?.attemptNumber); // 3
 * console.log(best?.overallScore);  // 9.5
 * ```
 *
 * @example
 * ```typescript
 * // All failures
 * const attempts = [
 *   { status: 'failure', failureType: 'validation', attemptNumber: 1, ... },
 *   { status: 'failure', failureType: 'cleaning', attemptNumber: 2, ... }
 * ];
 *
 * const best = getBestAttempt(attempts);
 * console.log(best); // undefined
 * ```
 *
 * @example
 * ```typescript
 * // Tied scores - returns first
 * const attempts = [
 *   { status: 'success', overallScore: 8.0, attemptNumber: 1, ... },
 *   { status: 'success', overallScore: 8.0, attemptNumber: 2, ... }
 * ];
 *
 * const best = getBestAttempt(attempts);
 * console.log(best?.attemptNumber); // 1 (first one wins)
 * ```
 */
export function getBestAttempt(attempts: AttemptOutcome[]): SuccessOutcome | undefined {
  // Filter to only successful attempts
  const successes = attempts.filter(isSuccessOutcome);

  // Return undefined if no successes
  if (successes.length === 0) {
    return undefined;
  }

  // Find the success with the highest score using reduce
  // Starting with the first success, compare each subsequent one
  return successes.reduce((best, current) => {
    return current.overallScore > best.overallScore ? current : best;
  });
}
