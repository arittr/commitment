/**
 * Core schemas for multi-attempt evaluation system
 *
 * This module defines Zod schemas for the multi-attempt evaluation system:
 * - AttemptOutcome: Discriminated union for success/failure outcomes
 * - EvalResult: Complete result with 3 attempts and meta-evaluation
 * - MetaEvaluationInput/Output: ChatGPT integration schemas
 * - EvalComparison: Head-to-head comparison of agents
 *
 * All types are inferred from schemas using z.infer<typeof schema>.
 *
 * @example
 * ```typescript
 * // Parse a success outcome
 * const outcome = attemptOutcomeSchema.parse({
 *   status: 'success',
 *   commitMessage: 'feat: add new feature',
 *   metrics: { clarity: 9, specificity: 8, conventionalFormat: 10, scope: 7 },
 *   overallScore: 8.5,
 *   attemptNumber: 1
 * });
 *
 * // Parse a failure outcome
 * const failure = attemptOutcomeSchema.parse({
 *   status: 'failure',
 *   failureType: 'validation',
 *   failureReason: 'Invalid conventional commit format',
 *   attemptNumber: 2
 * });
 * ```
 */

import { z } from 'zod';

/**
 * Schema for attempt metrics (0-10 scale)
 *
 * Defines the 4 scoring dimensions used by single-attempt evaluator:
 * - clarity: How clear and understandable the message is
 * - specificity: Level of detail and precision
 * - conventionalFormat: Adherence to conventional commit format
 * - scope: Appropriate scope and focus
 */
export const attemptMetricsSchema = z.object({
  /**
   * How clear and understandable the commit message is (0-10)
   * - 10: Crystal clear, no ambiguity
   * - 5: Somewhat clear but could be improved
   * - 0: Confusing or unclear
   */
  clarity: z
    .number()
    .min(0, 'Clarity score must be at least 0')
    .max(10, 'Clarity score must not exceed 10')
    .describe('Clarity and readability score (0-10)'),

  /**
   * How well the commit message follows Conventional Commits spec (0-10)
   * - 10: Perfect format (type: description, proper body)
   * - 5: Correct type but poor structure
   * - 0: No conventional format
   */
  conventionalFormat: z
    .number()
    .min(0, 'Conventional format score must be at least 0')
    .max(10, 'Conventional format score must not exceed 10')
    .describe('Conventional Commits compliance score (0-10)'),

  /**
   * Appropriate scope and focus (0-10)
   * - 10: Perfect scope definition
   * - 5: Scope could be more focused
   * - 0: No clear scope or too broad
   */
  scope: z
    .number()
    .min(0, 'Scope score must be at least 0')
    .max(10, 'Scope score must not exceed 10')
    .describe('Scope appropriateness score (0-10)'),

  /**
   * Level of detail and precision (0-10)
   * - 10: Perfect level of specificity
   * - 5: Too vague or too detailed
   * - 0: Missing specifics or overwhelming detail
   */
  specificity: z
    .number()
    .min(0, 'Specificity score must be at least 0')
    .max(10, 'Specificity score must not exceed 10')
    .describe('Detail and precision score (0-10)'),
});

/**
 * Attempt metrics type inferred from schema
 */
export type AttemptMetrics = z.infer<typeof attemptMetricsSchema>;

/**
 * Schema for failure types
 *
 * Categorizes different types of attempt failures:
 * - cleaning: Failed to remove thinking/COT artifacts from AI response
 * - validation: Output doesn't follow conventional commit format
 * - generation: Agent failed to generate a message (timeout, error)
 * - api_error: API/CLI communication error (ENOENT, network, etc.)
 */
export const failureTypeSchema = z.enum(['cleaning', 'validation', 'generation', 'api_error']);

/**
 * Failure type enum inferred from schema
 */
export type FailureType = z.infer<typeof failureTypeSchema>;

/**
 * Schema for successful attempt outcome
 *
 * Represents a successful commit message generation and evaluation.
 */
export const successOutcomeSchema = z.object({
  /**
   * Attempt number (1, 2, or 3)
   */
  attemptNumber: z
    .number()
    .int()
    .min(1, 'Attempt number must be at least 1')
    .max(3, 'Attempt number must not exceed 3'),

  /**
   * The successfully generated commit message
   */
  commitMessage: z.string().min(1, 'Commit message must not be empty'),

  /**
   * Structured evaluation metrics (4 dimensions, 0-10 scale)
   */
  metrics: attemptMetricsSchema,

  /**
   * Overall score (average of all metrics)
   * Calculated as: (clarity + specificity + conventionalFormat + scope) / 4
   */
  overallScore: z
    .number()
    .min(0, 'Overall score must be at least 0')
    .max(10, 'Overall score must not exceed 10')
    .describe('Average of all metrics (0-10)'),

  /**
   * Discriminator: success
   */
  status: z.literal('success'),
});

/**
 * Schema for failed attempt outcome
 *
 * Represents a failed attempt with categorized error type and reason.
 */
export const failureOutcomeSchema = z.object({
  /**
   * Attempt number (1, 2, or 3)
   */
  attemptNumber: z
    .number()
    .int()
    .min(1, 'Attempt number must be at least 1')
    .max(3, 'Attempt number must not exceed 3'),

  /**
   * Reason for failure (human-readable explanation)
   */
  failureReason: z.string().min(1, 'Failure reason must not be empty'),

  /**
   * Type of failure for categorization
   */
  failureType: failureTypeSchema,

  /**
   * Discriminator: failure
   */
  status: z.literal('failure'),
});

/**
 * Schema for attempt outcome (discriminated union)
 *
 * Discriminated union of success and failure outcomes.
 * TypeScript narrows the type based on the `status` field.
 *
 * @example
 * ```typescript
 * function handleOutcome(outcome: AttemptOutcome) {
 *   if (outcome.status === 'success') {
 *     console.log(outcome.commitMessage);  // TypeScript knows this exists
 *     console.log(outcome.overallScore);   // TypeScript knows this exists
 *   } else {
 *     console.log(outcome.failureType);    // TypeScript knows this exists
 *     console.log(outcome.failureReason);  // TypeScript knows this exists
 *   }
 * }
 * ```
 */
export const attemptOutcomeSchema = z.discriminatedUnion('status', [
  successOutcomeSchema,
  failureOutcomeSchema,
]);

/**
 * Attempt outcome type inferred from schema
 */
export type AttemptOutcome = z.infer<typeof attemptOutcomeSchema>;

/**
 * Schema for success rate
 *
 * Must be in format "X/3" where X is 0, 1, 2, or 3
 */
export const successRateSchema = z.enum(['0/3', '1/3', '2/3', '3/3']);

/**
 * Success rate type inferred from schema
 */
export type SuccessRate = z.infer<typeof successRateSchema>;

/**
 * Schema for evaluation result
 *
 * Complete result of evaluating one agent on one fixture with 3 attempts.
 * Includes all attempts (successes and failures) plus meta-evaluation.
 *
 * @example
 * ```typescript
 * const result: EvalResult = {
 *   attempts: [
 *     { status: 'success', commitMessage: 'feat: add', metrics: {...}, overallScore: 8.5, attemptNumber: 1 },
 *     { status: 'failure', failureType: 'validation', failureReason: 'Invalid format', attemptNumber: 2 },
 *     { status: 'success', commitMessage: 'feat: add', metrics: {...}, overallScore: 8.0, attemptNumber: 3 }
 *   ],
 *   finalScore: 7.5,
 *   consistencyScore: 8.0,
 *   errorRateImpact: -1.0,
 *   successRate: '2/3',
 *   reasoning: 'Two successful attempts with good consistency...',
 *   bestAttempt: 1
 * };
 * ```
 */
export const evalResultSchema = z.object({
  /**
   * Array of exactly 3 attempt outcomes
   * Can be any mix of successes and failures
   */
  attempts: z
    .array(attemptOutcomeSchema)
    .length(3, 'Must have exactly 3 attempts')
    .describe('Array of 3 attempt outcomes'),

  /**
   * Best attempt number (1, 2, or 3), or undefined if all failed
   */
  bestAttempt: z
    .number()
    .int()
    .min(1, 'Best attempt must be at least 1')
    .max(3, 'Best attempt must not exceed 3')
    .optional()
    .describe('Best attempt number or undefined if all failed'),

  /**
   * Consistency score across successful attempts (0-10)
   * Measures how similar the quality is across attempts
   */
  consistencyScore: z
    .number()
    .min(0, 'Consistency score must be at least 0')
    .max(10, 'Consistency score must not exceed 10')
    .describe('Consistency across attempts (0-10)'),

  /**
   * Impact of error rate on final score (negative value)
   * Penalizes failures: 1 failure = -0.5 to -1.0, 2 failures = -2.0 to -3.0, etc.
   */
  errorRateImpact: z
    .number()
    .max(0, 'Error rate impact must be non-positive')
    .describe('Error penalty (≤0)'),

  /**
   * Final meta-evaluation score (0-10)
   * Considers all attempts, consistency, and error rate
   * NOT the average of successful attempts - failures are penalized
   */
  finalScore: z
    .number()
    .min(0, 'Final score must be at least 0')
    .max(10, 'Final score must not exceed 10')
    .describe('Final meta-evaluation score (0-10)'),

  /**
   * Reasoning for the meta-evaluation
   * Explains final score, consistency, and error rate impact
   */
  reasoning: z.string().min(1, 'Reasoning must not be empty'),

  /**
   * Success rate in format "X/3"
   */
  successRate: successRateSchema,
});

/**
 * Evaluation result type inferred from schema
 */
export type EvalResult = z.infer<typeof evalResultSchema>;

/**
 * Schema for meta-evaluation input
 *
 * Input to ChatGPT meta-evaluator for evaluating 3 attempts together.
 *
 * @example
 * ```typescript
 * const input: MetaEvaluationInput = {
 *   attempts: [attempt1, attempt2, attempt3],
 *   gitDiff: 'diff --git a/file.ts...',
 *   fixtureName: 'complex-feature'
 * };
 * ```
 */
export const metaEvaluationInputSchema = z.object({
  /**
   * All 3 attempt outcomes to evaluate
   */
  attempts: z
    .array(attemptOutcomeSchema)
    .length(3, 'Must have exactly 3 attempts')
    .describe('Array of 3 attempts to meta-evaluate'),

  /**
   * Name of the fixture being evaluated
   */
  fixtureName: z.string().min(1, 'Fixture name must not be empty'),

  /**
   * Git diff for context
   */
  gitDiff: z.string().min(1, 'Git diff must not be empty'),
});

/**
 * Meta-evaluation input type inferred from schema
 */
export type MetaEvaluationInput = z.infer<typeof metaEvaluationInputSchema>;

/**
 * Schema for meta-evaluation output
 *
 * Output from ChatGPT meta-evaluator via outputType pattern.
 * This schema is used directly with OpenAI Agents SDK outputType.
 *
 * @example
 * ```typescript
 * // Used with OpenAI Agents SDK
 * const agent = new Agent({
 *   name: 'MetaEvaluator',
 *   instructions: '...',
 *   model: 'gpt-5',
 *   outputType: metaEvaluationOutputSchema
 * });
 *
 * const result = await run(agent, prompt);
 * const output: MetaEvaluationOutput = result.finalOutput;
 * ```
 */
export const metaEvaluationOutputSchema = z.object({
  /**
   * Best attempt number (1, 2, or 3), or undefined if all failed
   */
  bestAttempt: z
    .number()
    .int()
    .min(1, 'Best attempt must be at least 1')
    .max(3, 'Best attempt must not exceed 3')
    .optional()
    .describe('Best attempt number or undefined if all failed'),

  /**
   * Consistency score across successful attempts (0-10)
   */
  consistencyScore: z
    .number()
    .min(0, 'Consistency score must be at least 0')
    .max(10, 'Consistency score must not exceed 10')
    .describe('Consistency across attempts (0-10)'),

  /**
   * Impact of error rate on final score (negative value)
   */
  errorRateImpact: z
    .number()
    .max(0, 'Error rate impact must be non-positive')
    .describe('Error penalty (≤0)'),

  /**
   * Final meta-evaluation score (0-10)
   */
  finalScore: z
    .number()
    .min(0, 'Final score must be at least 0')
    .max(10, 'Final score must not exceed 10')
    .describe('Final meta-evaluation score (0-10)'),

  /**
   * Reasoning for the meta-evaluation
   */
  reasoning: z.string().min(1, 'Reasoning must not be empty'),

  /**
   * Success rate in format "X/3"
   */
  successRate: successRateSchema,
});

/**
 * Meta-evaluation output type inferred from schema
 */
export type MetaEvaluationOutput = z.infer<typeof metaEvaluationOutputSchema>;

/**
 * Schema for evaluation comparison
 *
 * Head-to-head comparison of two agents on the same fixture.
 * Each agent has a complete EvalResult with 3 attempts and meta-evaluation.
 *
 * Winner is determined by comparing finalScore (not by averaging successful attempts).
 *
 * @example
 * ```typescript
 * const comparison: EvalComparison = {
 *   fixture: 'complex-feature',
 *   claudeResult: {
 *     attempts: [...],
 *     finalScore: 8.5,
 *     consistencyScore: 8.0,
 *     errorRateImpact: 0,
 *     successRate: '3/3',
 *     reasoning: '...',
 *     bestAttempt: 1
 *   },
 *   codexResult: {
 *     attempts: [...],
 *     finalScore: 7.0,
 *     consistencyScore: 6.5,
 *     errorRateImpact: -1.0,
 *     successRate: '2/3',
 *     reasoning: '...',
 *     bestAttempt: 1
 *   },
 *   winner: 'claude'
 * };
 * ```
 */
export const evalComparisonSchema = z.object({
  /**
   * Claude agent's complete evaluation result
   */
  claudeResult: evalResultSchema.optional(),

  /**
   * Codex agent's complete evaluation result
   */
  codexResult: evalResultSchema.optional(),

  /**
   * Name of the fixture being compared
   */
  fixture: z.string().min(1, 'Fixture name must not be empty'),

  /**
   * Winner of the comparison based on finalScore
   * - 'claude': Claude's finalScore is higher
   * - 'codex': Codex's finalScore is higher
   * - 'tie': finalScores are within 0.5 points
   */
  winner: z.enum(['claude', 'codex', 'tie']).optional(),
});

/**
 * Evaluation comparison type inferred from schema
 */
export type EvalComparison = z.infer<typeof evalComparisonSchema>;

/**
 * Validation function for attempt outcomes
 *
 * @param outcome - Unknown input to validate
 * @returns Validated AttemptOutcome
 * @throws {ZodError} If outcome is invalid
 */
export function validateAttemptOutcome(outcome: unknown): AttemptOutcome {
  return attemptOutcomeSchema.parse(outcome);
}

/**
 * Validation function for evaluation results
 *
 * @param result - Unknown input to validate
 * @returns Validated EvalResult
 * @throws {ZodError} If result is invalid
 */
export function validateEvalResult(result: unknown): EvalResult {
  return evalResultSchema.parse(result);
}

/**
 * Validation function for meta-evaluation input
 *
 * @param input - Unknown input to validate
 * @returns Validated MetaEvaluationInput
 * @throws {ZodError} If input is invalid
 */
export function validateMetaEvaluationInput(input: unknown): MetaEvaluationInput {
  return metaEvaluationInputSchema.parse(input);
}

/**
 * Validation function for meta-evaluation output
 *
 * @param output - Unknown input to validate
 * @returns Validated MetaEvaluationOutput
 * @throws {ZodError} If output is invalid
 */
export function validateMetaEvaluationOutput(output: unknown): MetaEvaluationOutput {
  return metaEvaluationOutputSchema.parse(output);
}

/**
 * Validation function for evaluation comparisons
 *
 * @param comparison - Unknown input to validate
 * @returns Validated EvalComparison
 * @throws {ZodError} If comparison is invalid
 */
export function validateEvalComparison(comparison: unknown): EvalComparison {
  return evalComparisonSchema.parse(comparison);
}
