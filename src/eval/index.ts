/**
 * Evaluation system barrel export
 *
 * This module exports all evaluation system components for the multi-attempt evaluation system:
 * - Core schemas and types (AttemptOutcome, EvalResult, EvalComparison, etc.)
 * - Evaluators (ChatGPTAgent, SingleAttemptEvaluator, MetaEvaluator)
 * - Runners (AttemptRunner, EvalRunner)
 * - Reporters (CLIReporter, JSONReporter, MarkdownReporter)
 * - Utilities (categorizeError, getBestAttempt)
 *
 * @example
 * ```typescript
 * import {
 *   EvalRunner,
 *   AttemptRunner,
 *   MetaEvaluator,
 *   JSONReporter,
 *   MarkdownReporter,
 *   CLIReporter,
 *   SingleAttemptEvaluator,
 *   ChatGPTAgent
 * } from './eval/index.js';
 *
 * // Create dependencies
 * const chatgptAgent = new ChatGPTAgent();
 * const evaluator = new SingleAttemptEvaluator(chatgptAgent);
 * const metaEvaluator = new MetaEvaluator(chatgptAgent);
 * const attemptRunner = new AttemptRunner(generator, evaluator, cliReporter);
 * const runner = new EvalRunner(attemptRunner, metaEvaluator, jsonReporter, markdownReporter);
 *
 * // Run evaluation
 * const fixture = runner.loadFixture('simple', 'mocked');
 * const comparison = await runner.runFixture(fixture);
 * console.log(comparison.winner); // 'claude' | 'codex' | 'tie'
 * console.log(comparison.claudeResult.finalScore); // 8.5
 * console.log(comparison.claudeResult.successRate); // '3/3'
 * ```
 */

// Export core types and schemas
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
} from './core/index.js';
export {
  attemptMetricsSchema,
  attemptOutcomeSchema,
  EvaluationError,
  evalComparisonSchema,
  evalResultSchema,
  failureOutcomeSchema,
  failureTypeSchema,
  isFailureOutcome,
  isSuccessOutcome,
  metaEvaluationInputSchema,
  metaEvaluationOutputSchema,
  successOutcomeSchema,
  successRateSchema,
  validateAttemptOutcome,
  validateEvalComparison,
  validateEvalResult,
  validateMetaEvaluationInput,
  validateMetaEvaluationOutput,
} from './core/index.js';
export type { SingleAttemptResult } from './evaluators/index.js';
// Export evaluators
export { ChatGPTAgent, MetaEvaluator, SingleAttemptEvaluator } from './evaluators/index.js';
// Export reporters
export { CLIReporter, JSONReporter, MarkdownReporter } from './reporters/index.js';
export type { Fixture } from './runners/index.js';
// Export runners
export { AttemptRunner, EvalRunner } from './runners/index.js';
// Export utilities
export { categorizeError, getBestAttempt } from './utils/index.js';
