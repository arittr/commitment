/**
 * Type definitions and type guards for evaluation system
 *
 * This module exports types inferred from schemas and provides type guards
 * for narrowing discriminated unions.
 *
 * @example
 * ```typescript
 * import { AttemptOutcome, isSuccessOutcome } from './types.js';
 *
 * function processOutcome(outcome: AttemptOutcome) {
 *   if (isSuccessOutcome(outcome)) {
 *     console.log(outcome.commitMessage); // TypeScript knows this exists
 *   } else {
 *     console.log(outcome.failureReason); // TypeScript knows this exists
 *   }
 * }
 * ```
 */

import type {
  AttemptMetrics,
  AttemptOutcome,
  EvalComparison,
  EvalResult,
  FailureType,
  MetaEvaluationInput,
  MetaEvaluationOutput,
  SuccessRate,
} from './schemas.js';

/**
 * Re-export all types from schemas for convenience
 */
export type {
  AttemptMetrics,
  AttemptOutcome,
  EvalComparison,
  EvalResult,
  FailureType,
  MetaEvaluationInput,
  MetaEvaluationOutput,
  SuccessRate,
};

/**
 * Type guard for success outcomes
 *
 * Narrows AttemptOutcome to success branch of discriminated union.
 *
 * @param outcome - Attempt outcome to check
 * @returns true if outcome is a success
 *
 * @example
 * ```typescript
 * if (isSuccessOutcome(outcome)) {
 *   console.log(outcome.commitMessage); // TypeScript knows this exists
 *   console.log(outcome.overallScore);  // TypeScript knows this exists
 * }
 * ```
 */
export function isSuccessOutcome(
  outcome: AttemptOutcome
): outcome is Extract<AttemptOutcome, { status: 'success' }> {
  return outcome.status === 'success';
}

/**
 * Type guard for failure outcomes
 *
 * Narrows AttemptOutcome to failure branch of discriminated union.
 *
 * @param outcome - Attempt outcome to check
 * @returns true if outcome is a failure
 *
 * @example
 * ```typescript
 * if (isFailureOutcome(outcome)) {
 *   console.log(outcome.failureType);   // TypeScript knows this exists
 *   console.log(outcome.failureReason); // TypeScript knows this exists
 * }
 * ```
 */
export function isFailureOutcome(
  outcome: AttemptOutcome
): outcome is Extract<AttemptOutcome, { status: 'failure' }> {
  return outcome.status === 'failure';
}

/**
 * Extract success outcome type from discriminated union
 */
export type SuccessOutcome = Extract<AttemptOutcome, { status: 'success' }>;

/**
 * Extract failure outcome type from discriminated union
 */
export type FailureOutcome = Extract<AttemptOutcome, { status: 'failure' }>;
