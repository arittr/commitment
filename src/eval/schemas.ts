/**
 * Zod schemas for evaluation system
 *
 * This module defines all schemas for the evaluation system following schema-first development:
 * - EvalFixture: Test fixture with git changeset and metadata
 * - EvalMetrics: Structured scoring dimensions (0-10 scale)
 * - EvalResult: Complete evaluation result for one agent
 * - EvalComparison: Head-to-head comparison of two agents
 *
 * All types are inferred from schemas using z.infer<typeof schema>.
 *
 * @example
 * ```typescript
 * // Validate a fixture
 * const fixture = evalFixtureSchema.parse({
 *   name: 'simple',
 *   gitStatus: 'M  src/file.ts',
 *   gitDiff: 'diff --git...',
 *   expectedType: 'fix',
 *   description: 'Fix null safety bug'
 * });
 *
 * // Validate evaluation metrics
 * const metrics = evalMetricsSchema.parse({
 *   conventionalCompliance: 9,
 *   clarity: 8,
 *   accuracy: 9,
 *   detailLevel: 7
 * });
 * ```
 */

import { z } from 'zod';

/**
 * Schema for evaluation fixture
 *
 * Represents a test case with git changeset and expected characteristics.
 * Used for systematic commit message quality evaluation.
 *
 * @example
 * ```typescript
 * const fixture: EvalFixture = {
 *   name: 'simple-bugfix',
 *   gitStatus: 'M  src/utils/parser.ts',
 *   gitDiff: 'diff --git a/src/utils/parser.ts...',
 *   expectedType: 'fix',
 *   description: 'Single-file bug fix for null safety'
 * };
 * ```
 */
export const evalFixtureSchema = z.object({
  /**
   * Human-readable description of what this fixture tests
   */
  description: z.string().min(1, 'Description must not be empty'),

  /**
   * Expected commit type for this changeset
   * Must follow conventional commit types
   */
  expectedType: z.enum(['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore', 'perf']),

  /**
   * Git diff output (from git diff or git diff --cached)
   */
  gitDiff: z.string().min(1, 'Git diff must not be empty'),

  /**
   * Git status output (from git status --porcelain)
   */
  gitStatus: z.string().min(1, 'Git status must not be empty'),
  /**
   * Unique name for this fixture
   */
  name: z.string().min(1, 'Fixture name must not be empty'),
});

/**
 * Evaluation fixture type inferred from schema
 */
export type EvalFixture = z.infer<typeof evalFixtureSchema>;

/**
 * Validation function for evaluation fixtures
 *
 * @param fixture - Unknown input to validate
 * @returns Validated EvalFixture
 * @throws {ZodError} If fixture is invalid
 */
export function validateEvalFixture(fixture: unknown): EvalFixture {
  return evalFixtureSchema.parse(fixture);
}

/**
 * Schema for evaluation metrics
 *
 * Defines the 4 scoring dimensions used by ChatGPT evaluator.
 * All scores are on a 0-10 scale.
 *
 * @example
 * ```typescript
 * const metrics: EvalMetrics = {
 *   conventionalCompliance: 9,  // Follows conventional commit format
 *   clarity: 8,                  // Clear and understandable
 *   accuracy: 9,                 // Matches the actual changes
 *   detailLevel: 7               // Appropriate level of detail
 * };
 * ```
 */
export const evalMetricsSchema = z.object({
  /**
   * How accurately the message describes the actual changes (0-10)
   * - 10: Perfectly matches git diff
   * - 5: Partially accurate
   * - 0: Inaccurate or misleading
   */
  accuracy: z
    .number()
    .min(0, 'Score must be at least 0')
    .max(10, 'Score must not exceed 10')
    .describe('Accuracy of description score (0-10)'),

  /**
   * How clear and understandable the message is (0-10)
   * - 10: Crystal clear, no ambiguity
   * - 5: Somewhat clear but could be improved
   * - 0: Confusing or unclear
   */
  clarity: z
    .number()
    .min(0, 'Score must be at least 0')
    .max(10, 'Score must not exceed 10')
    .describe('Clarity and readability score (0-10)'),
  /**
   * How well the commit message follows Conventional Commits spec (0-10)
   * - 10: Perfect format (type: description, proper body)
   * - 5: Correct type but poor structure
   * - 0: No conventional format
   */
  conventionalCompliance: z
    .number()
    .min(0, 'Score must be at least 0')
    .max(10, 'Score must not exceed 10')
    .describe('Conventional Commits compliance score (0-10)'),

  /**
   * Appropriate level of detail (0-10)
   * - 10: Perfect detail level (not too verbose, not too terse)
   * - 5: Too verbose or too terse
   * - 0: Missing critical details or overwhelmingly verbose
   */
  detailLevel: z
    .number()
    .min(0, 'Score must be at least 0')
    .max(10, 'Score must not exceed 10')
    .describe('Appropriate detail level score (0-10)'),
});

/**
 * Evaluation metrics type inferred from schema
 */
export type EvalMetrics = z.infer<typeof evalMetricsSchema>;

/**
 * Validation function for evaluation metrics
 *
 * @param metrics - Unknown input to validate
 * @returns Validated EvalMetrics
 * @throws {ZodError} If metrics are invalid
 */
export function validateEvalMetrics(metrics: unknown): EvalMetrics {
  return evalMetricsSchema.parse(metrics);
}

/**
 * Schema for evaluation result
 *
 * Complete result of evaluating one agent's commit message for one fixture.
 * Includes the generated message, structured metrics, feedback, and overall score.
 *
 * @example
 * ```typescript
 * const result: EvalResult = {
 *   fixture: 'simple-bugfix',
 *   timestamp: '2025-01-22T10:30:00.000Z',
 *   agent: 'claude',
 *   commitMessage: 'fix: add null safety check to parser',
 *   metrics: {
 *     conventionalCompliance: 9,
 *     clarity: 8,
 *     accuracy: 9,
 *     detailLevel: 7
 *   },
 *   feedback: 'Good conventional commit format...',
 *   overallScore: 8.25
 * };
 * ```
 */
export const evalResultSchema = z.object({
  /**
   * Which agent generated the commit message
   */
  agent: z.enum(['claude', 'codex']),

  /**
   * The commit message that was generated and evaluated
   */
  commitMessage: z.string().min(1, 'Commit message must not be empty'),

  /**
   * Textual feedback from the evaluator
   * Explains the scores and provides actionable suggestions
   */
  feedback: z.string().min(1, 'Feedback must not be empty'),
  /**
   * Name of the fixture that was evaluated
   */
  fixture: z.string().min(1, 'Fixture name must not be empty'),

  /**
   * Structured evaluation metrics (4 dimensions, 0-10 scale)
   */
  metrics: evalMetricsSchema,

  /**
   * Overall score (average of all metrics)
   * Calculated as: (conventionalCompliance + clarity + accuracy + detailLevel) / 4
   */
  overallScore: z
    .number()
    .min(0, 'Overall score must be at least 0')
    .max(10, 'Overall score must not exceed 10')
    .describe('Average of all metrics (0-10)'),

  /**
   * ISO timestamp when evaluation was performed
   */
  timestamp: z.string().datetime({ message: 'Must be valid ISO 8601 datetime' }),
});

/**
 * Evaluation result type inferred from schema
 */
export type EvalResult = z.infer<typeof evalResultSchema>;

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
 * Schema for evaluation comparison
 *
 * Head-to-head comparison of two agents on the same fixture.
 * Determines winner based on score difference threshold (>0.5 points).
 *
 * @example
 * ```typescript
 * const comparison: EvalComparison = {
 *   fixture: 'simple-bugfix',
 *   claudeResult: { ... },  // Claude's evaluation
 *   codexResult: { ... },   // Codex's evaluation
 *   winner: 'claude',       // Claude scored higher
 *   scoreDiff: 1.25         // Claude scored 1.25 points higher
 * };
 * ```
 */
export const evalComparisonSchema = z.object({
  /**
   * Claude agent's evaluation result
   */
  claudeResult: evalResultSchema,

  /**
   * Codex agent's evaluation result
   */
  codexResult: evalResultSchema,
  /**
   * Name of the fixture being compared
   */
  fixture: z.string().min(1, 'Fixture name must not be empty'),

  /**
   * Score difference (claudeScore - codexScore)
   * Positive: Claude scored higher
   * Negative: Codex scored higher
   * Near zero: Tie
   */
  scoreDiff: z.number().describe('Claude score minus Codex score'),

  /**
   * Winner of the comparison
   * - 'claude': Claude scored higher (difference > 0.5)
   * - 'codex': Codex scored higher (difference > 0.5)
   * - 'tie': Score difference <= 0.5
   */
  winner: z.enum(['claude', 'codex', 'tie']),
});

/**
 * Evaluation comparison type inferred from schema
 */
export type EvalComparison = z.infer<typeof evalComparisonSchema>;

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
