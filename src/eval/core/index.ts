/**
 * Core evaluation system exports
 *
 * This module exports all core components for the multi-attempt evaluation system:
 * - Schemas: Zod schemas for validation
 * - Types: TypeScript types inferred from schemas
 * - Errors: EvaluationError class with factory methods
 * - Type guards: Helper functions for discriminated unions
 * - Validation functions: Schema validation helpers
 *
 * @example
 * ```typescript
 * import {
 *   attemptOutcomeSchema,
 *   AttemptOutcome,
 *   isSuccessOutcome,
 *   EvaluationError,
 *   validateEvalResult
 * } from './core/index.js';
 * ```
 */

export type { EvaluationErrorCode } from './errors.js';
// Export errors
export { EvaluationError } from './errors.js';
// Export all schemas
export {
  attemptMetricsSchema,
  attemptOutcomeSchema,
  evalComparisonSchema,
  evalResultSchema,
  failureOutcomeSchema,
  failureTypeSchema,
  metaEvaluationInputSchema,
  metaEvaluationOutputSchema,
  successOutcomeSchema,
  successRateSchema,
  validateAttemptOutcome,
  validateEvalComparison,
  validateEvalResult,
  validateMetaEvaluationInput,
  validateMetaEvaluationOutput,
} from './schemas.js';
// Export all types and type guards
export type {
  AttemptMetrics,
  AttemptOutcome,
  EvalComparison,
  EvalResult,
  FailureOutcome,
  FailureType,
  MetaEvaluationInput,
  MetaEvaluationOutput,
  SuccessOutcome,
  SuccessRate,
} from './types.js';
export { isFailureOutcome, isSuccessOutcome } from './types.js';
