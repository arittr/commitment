/**
 * Reporter module for formatting and storing evaluation results
 *
 * This module handles result persistence and report generation:
 * - Store timestamped JSON results in .eval-results/
 * - Create/update symlinks to latest results per fixture
 * - Generate human-readable markdown reports
 * - Compare current results with baseline (if exists)
 *
 * Results are organized by fixture and timestamp for historical tracking.
 *
 * @example
 * ```typescript
 * const reporter = new EvalReporter();
 *
 * // Store results with automatic timestamping
 * reporter.storeResults(comparison);
 * // Creates: .eval-results/simple-2025-01-22T10-30-00.000Z.json
 * // Updates: .eval-results/latest-simple.json -> simple-2025...json
 *
 * // Generate markdown report
 * reporter.storeMarkdownReport([comparison1, comparison2]);
 * // Creates: .eval-results/report-2025-01-22T10-30-00.000Z.md
 * // Updates: .eval-results/latest-report.md -> report-2025...md
 * ```
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import type { EvalComparison } from './schemas.js';

/**
 * EvalReporter class for formatting and storing evaluation results
 *
 * Responsibilities:
 * - Store timestamped JSON results
 * - Create/update symlinks to latest results
 * - Generate markdown reports
 * - Compare with baseline (if exists)
 */
export class EvalReporter {
  /** Directory where results are stored */
  private readonly resultsDir: string;

  /**
   * Create a new EvalReporter instance
   *
   * Ensures results directory exists.
   *
   * @param resultsDir - Directory for storing results (defaults to '.eval-results')
   *
   * @example
   * ```typescript
   * const reporter = new EvalReporter();
   * // Uses default: .eval-results/
   *
   * const customReporter = new EvalReporter('.eval-results-test');
   * // Uses custom directory
   * ```
   */
  constructor(resultsDir: string = '.eval-results') {
    this.resultsDir = resultsDir;
    this._ensureResultsDir();
  }

  /**
   * Ensure results directory exists
   *
   * Creates directory if it doesn't exist (recursive).
   */
  private _ensureResultsDir(): void {
    if (!existsSync(this.resultsDir)) {
      mkdirSync(this.resultsDir, { recursive: true });
    }
  }

  /**
   * Store evaluation results with timestamp and create symlink to latest
   *
   * Workflow:
   * 1. Create timestamped filename: {fixture}-{timestamp}.json
   * 2. Write JSON result to file
   * 3. Update symlink: latest-{fixture}.json -> timestamped file
   *
   * @param comparison - EvalComparison result to store
   *
   * @example
   * ```typescript
   * const reporter = new EvalReporter();
   * reporter.storeResults(comparison);
   *
   * // Creates files:
   * // .eval-results/simple-2025-01-22T10-30-00.000Z.json
   * // .eval-results/latest-simple.json -> simple-2025-01-22T10-30-00.000Z.json
   * ```
   */
  storeResults(comparison: EvalComparison): void {
    // 1. Generate timestamped filename (replace colons for Windows compatibility)
    const timestamp = new Date().toISOString().replaceAll(':', '-');
    const filename = `${comparison.fixture}-${timestamp}.json`;
    const filepath = join(this.resultsDir, filename);

    // 2. Write timestamped JSON result
    writeFileSync(filepath, JSON.stringify(comparison, null, 2));

    // 3. Update symlink to latest result for this fixture
    const symlinkPath = join(this.resultsDir, `latest-${comparison.fixture}.json`);

    // Remove existing symlink if present
    if (existsSync(symlinkPath)) {
      unlinkSync(symlinkPath);
    }

    // Create new symlink pointing to timestamped file
    symlinkSync(filename, symlinkPath);
  }

  /**
   * Generate markdown report from evaluation comparisons
   *
   * Creates a human-readable report with:
   * - Header with timestamp and fixture count
   * - Per-fixture sections with both agents' results
   * - Metrics breakdown
   * - Winner determination
   *
   * @param comparisons - Array of EvalComparison results
   * @returns Formatted markdown string
   *
   * @example
   * ```typescript
   * const reporter = new EvalReporter();
   * const markdown = reporter.generateMarkdownReport([comparison]);
   * console.log(markdown);
   * // # Commit Message Quality Evaluation Report
   * // **Generated**: 2025-01-22T10:30:00.000Z
   * // **Fixtures**: 1
   * // ...
   * ```
   */
  generateMarkdownReport(comparisons: EvalComparison[]): string {
    const lines: string[] = [
      '# Commit Message Quality Evaluation Report',
      '',
      `**Generated**: ${new Date().toISOString()}`,
      `**Fixtures**: ${comparisons.length}`,
      '',
      '---',
      '',
    ];

    for (const comparison of comparisons) {
      lines.push(
        `## Fixture: ${comparison.fixture}`,
        '',
        '### Claude',
        `**Message**: ${comparison.claudeResult.commitMessage}`,
      );
      // eslint-disable-next-line unicorn/no-array-push-push
      lines.push(
        `**Overall Score**: ${comparison.claudeResult.overallScore.toFixed(2)}/10`,
        '**Metrics**:',
        `- Conventional Compliance: ${comparison.claudeResult.metrics.conventionalCompliance}/10`,
        `- Clarity: ${comparison.claudeResult.metrics.clarity}/10`,
        `- Accuracy: ${comparison.claudeResult.metrics.accuracy}/10`,
        `- Detail Level: ${comparison.claudeResult.metrics.detailLevel}/10`,
        `**Feedback**: ${comparison.claudeResult.feedback}`,
        '',
        '### Codex',
        `**Message**: ${comparison.codexResult.commitMessage}`,
      );
      // eslint-disable-next-line unicorn/no-array-push-push
      lines.push(
        `**Overall Score**: ${comparison.codexResult.overallScore.toFixed(2)}/10`,
        '**Metrics**:',
        `- Conventional Compliance: ${comparison.codexResult.metrics.conventionalCompliance}/10`,
        `- Clarity: ${comparison.codexResult.metrics.clarity}/10`,
        `- Accuracy: ${comparison.codexResult.metrics.accuracy}/10`,
        `- Detail Level: ${comparison.codexResult.metrics.detailLevel}/10`,
        `**Feedback**: ${comparison.codexResult.feedback}`,
        '',
        '### Comparison',
        `**Winner**: ${comparison.winner}`,
      );
      // eslint-disable-next-line unicorn/no-array-push-push
      lines.push(
        `**Score Difference**: ${comparison.scoreDiff > 0 ? '+' : ''}${comparison.scoreDiff.toFixed(2)}`,
        '',
        '---',
        '',
      );
    }

    return lines.join('\n');
  }

  /**
   * Store markdown report with timestamp and create symlink to latest
   *
   * Workflow:
   * 1. Generate markdown from comparisons
   * 2. Create timestamped filename: report-{timestamp}.md
   * 3. Write markdown to file
   * 4. Update symlink: latest-report.md -> timestamped file
   *
   * @param comparisons - Array of EvalComparison results
   *
   * @example
   * ```typescript
   * const reporter = new EvalReporter();
   * reporter.storeMarkdownReport([comparison1, comparison2]);
   *
   * // Creates files:
   * // .eval-results/report-2025-01-22T10-30-00.000Z.md
   * // .eval-results/latest-report.md -> report-2025-01-22T10-30-00.000Z.md
   * ```
   */
  storeMarkdownReport(comparisons: EvalComparison[]): void {
    // 1. Generate markdown content
    const markdown = this.generateMarkdownReport(comparisons);

    // 2. Generate timestamped filename
    const timestamp = new Date().toISOString().replaceAll(':', '-');
    const filename = `report-${timestamp}.md`;
    const filepath = join(this.resultsDir, filename);

    // 3. Write markdown to file
    writeFileSync(filepath, markdown);

    // 4. Update symlink to latest report
    const symlinkPath = join(this.resultsDir, 'latest-report.md');

    // Remove existing symlink if present
    if (existsSync(symlinkPath)) {
      unlinkSync(symlinkPath);
    }

    // Create new symlink pointing to timestamped file
    symlinkSync(filename, symlinkPath);
  }

  /**
   * Compare current results against baseline (if exists)
   *
   * Calculates score differences between current and baseline results.
   * Returns null if no baseline exists for this fixture.
   *
   * Baseline file location: .eval-results/baseline-{fixture}.json
   *
   * @param current - Current EvalComparison to compare
   * @returns Formatted comparison string, or null if no baseline exists
   *
   * @example
   * ```typescript
   * const reporter = new EvalReporter();
   * const baselineComparison = reporter.compareWithBaseline(current);
   *
   * if (baselineComparison) {
   *   console.log(baselineComparison);
   *   // Baseline Comparison (simple):
   *   //   Claude: +0.50 (8.00 → 8.50)
   *   //   Codex: -0.25 (7.50 → 7.25)
   * } else {
   *   console.log('No baseline to compare');
   * }
   * ```
   */
  compareWithBaseline(current: EvalComparison): string | null {
    const baselinePath = join(this.resultsDir, `baseline-${current.fixture}.json`);

    // Check if baseline exists
    if (!existsSync(baselinePath)) {
      return null; // No baseline to compare
    }

    // Load baseline
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as EvalComparison;

    // Calculate differences
    const claudeDiff = current.claudeResult.overallScore - baseline.claudeResult.overallScore;
    const codexDiff = current.codexResult.overallScore - baseline.codexResult.overallScore;

    // Format comparison string
    return (
      `Baseline Comparison (${current.fixture}):\n` +
      `  Claude: ${claudeDiff > 0 ? '+' : ''}${claudeDiff.toFixed(2)} (${baseline.claudeResult.overallScore.toFixed(2)} → ${current.claudeResult.overallScore.toFixed(2)})\n` +
      `  Codex: ${codexDiff > 0 ? '+' : ''}${codexDiff.toFixed(2)} (${baseline.codexResult.overallScore.toFixed(2)} → ${current.codexResult.overallScore.toFixed(2)})`
    );
  }
}
