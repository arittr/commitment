/**
 * Evaluation system barrel export
 *
 * This module exports all evaluation system components:
 * - Schemas and types (EvalFixture, EvalMetrics, EvalResult, EvalComparison)
 * - Evaluator (ChatGPT-based commit message evaluator)
 * - EvalRunner (fixture loading and execution orchestration)
 * - EvalReporter (result storage and markdown report generation)
 *
 * @example
 * ```typescript
 * import { EvalRunner, EvalReporter } from './eval/index.js';
 *
 * const runner = new EvalRunner();
 * const reporter = new EvalReporter();
 *
 * // Run evaluation for a fixture
 * const fixture = runner.loadFixture('simple', 'mocked');
 * const comparison = await runner.runFixture(fixture);
 *
 * // Store and report results
 * reporter.storeResults(comparison);
 * reporter.storeMarkdownReport([comparison]);
 * ```
 */

// Export core evaluation components
export { Evaluator } from './evaluator.js';

export { EvalReporter } from './reporter.js';
export { EvalRunner } from './runner.js';
// Export all schemas and types
export * from './schemas.js';
