/**
 * Markdown reporter for human-readable evaluation reports
 *
 * Generates comprehensive markdown reports with:
 * - Per-attempt details (success scores or failure reasons)
 * - Meta-evaluation with finalScore, consistency, error rate, reasoning
 * - Success rate breakdowns
 * - Agent comparison with winner
 *
 * @example
 * ```typescript
 * const reporter = new MarkdownReporter('/path/to/results');
 *
 * const comparison: EvalComparison = {
 *   fixture: 'simple-feature',
 *   claudeResult: { ... },
 *   codexResult: { ... },
 *   winner: 'claude'
 * };
 *
 * await reporter.generateReport(comparison);
 * // Creates: latest-report.md
 * ```
 */

import { existsSync, mkdirSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { AttemptOutcome, EvalComparison, EvalResult } from '../core/types.js';
import { isSuccessOutcome } from '../core/types.js';

/**
 * Markdown reporter for human-readable evaluation reports
 *
 * Generates markdown files with full evaluation details and comparisons.
 */
export class MarkdownReporter {
  /**
   * Directory where reports are stored
   */
  private readonly resultsDir: string;

  /**
   * Create a new Markdown reporter
   *
   * @param resultsDir - Directory to store markdown reports (default: .eval-results)
   *
   * @example
   * ```typescript
   * const reporter = new MarkdownReporter('/path/to/results');
   * ```
   */
  constructor(resultsDir: string = join(process.cwd(), '.eval-results')) {
    this.resultsDir = resultsDir;
  }

  /**
   * Generate markdown report for evaluation comparison
   *
   * Creates a markdown file with:
   * - Run subdirectory: YYYY-MM-DDTHH-MM-SS.sssZ/ (shared with JSON files)
   * - Report file: YYYY-MM-DDTHH-MM-SS.sssZ/report.md
   * - Symlink: latest-report.md -> YYYY-MM-DDTHH-MM-SS.sssZ/report.md
   * - Fixture name
   * - Winner announcement
   * - Per-agent results (attempts + meta-evaluation)
   * - Best attempt details
   *
   * @param comparison - Evaluation comparison to report
   * @param runDir - Run directory name from JSONReporter (to share same directory)
   * @throws {Error} If unable to write report file
   *
   * @example
   * ```typescript
   * const runDir = jsonReporter.getRunDir();
   * await reporter.generateReport(comparison, runDir);
   * // Creates: 2025-10-23T12-34-56.789Z/report.md
   * // Symlink: latest-report.md -> 2025-10-23T12-34-56.789Z/report.md
   * ```
   */
  async generateReport(comparison: EvalComparison, runDir: string): Promise<void> {
    // Ensure results directory exists
    if (!existsSync(this.resultsDir)) {
      mkdirSync(this.resultsDir, { recursive: true });
    }

    // Use the provided run directory (shared with JSON files)
    const runDirPath = join(this.resultsDir, runDir);

    // Ensure run subdirectory exists
    if (!existsSync(runDirPath)) {
      mkdirSync(runDirPath, { recursive: true });
    }

    const sections: string[] = [];

    // Title
    sections.push('# Evaluation Report\n');

    // Fixture
    sections.push(`## Fixture: ${comparison.fixture}\n`);

    // Winner
    if (comparison.winner) {
      const winnerEmoji = comparison.winner === 'tie' ? '🤝' : '🏆';
      const winnerText =
        comparison.winner === 'tie' ? 'Tie' : comparison.winner === 'claude' ? 'Claude' : 'Codex';
      sections.push(`## Winner: ${winnerEmoji} ${winnerText}\n`);
    }

    // Claude Results
    sections.push('## Claude Results\n');
    if (comparison.claudeResult) {
      sections.push(this.formatAgentResult(comparison.claudeResult));
    } else {
      sections.push('No results available.\n');
    }

    // Codex Results
    sections.push('## Codex Results\n');
    if (comparison.codexResult) {
      sections.push(this.formatAgentResult(comparison.codexResult));
    } else {
      sections.push('No results available.\n');
    }

    // Generate filename (simple name, timestamp is in directory)
    const filename = 'report.md';
    const relativeFilepath = join(runDir, filename); // Relative to resultsDir
    const absoluteFilepath = join(this.resultsDir, relativeFilepath);

    // Write report
    writeFileSync(absoluteFilepath, sections.join('\n'), 'utf-8');

    // Create or update symlink to latest report (in root of resultsDir)
    const symlinkPath = join(this.resultsDir, 'latest-report.md');

    // Remove existing symlink if it exists
    try {
      unlinkSync(symlinkPath);
    } catch {
      // Symlink doesn't exist, continue
    }

    // Create new symlink pointing to report (relative path)
    symlinkSync(relativeFilepath, symlinkPath);
  }

  /**
   * Format agent result section
   *
   * Includes:
   * - Per-attempt details
   * - Meta-evaluation
   * - Best attempt
   *
   * @param result - Agent evaluation result
   * @returns Formatted markdown section
   */
  private formatAgentResult(result: EvalResult): string {
    const sections: string[] = [];

    // Per-Attempt Details
    sections.push('### Attempts\n');
    for (const attempt of result.attempts) {
      sections.push(this.formatAttempt(attempt));
    }

    // Meta-Evaluation
    sections.push('### Meta-Evaluation\n');
    sections.push('| Metric | Value |');
    sections.push('| --- | --- |');
    sections.push(`| Final Score | ${result.finalScore.toFixed(1)} |`);
    sections.push(`| Consistency Score | ${result.consistencyScore.toFixed(1)} |`);
    sections.push(`| Error Rate Impact | ${result.errorRateImpact.toFixed(1)} |`);
    sections.push(`| Success Rate | ${result.successRate} |`);
    sections.push(`| Best Attempt | ${result.bestAttempt ?? 'None'} |\n`);

    sections.push('**Reasoning:**\n');
    sections.push(`${result.reasoning}\n`);

    return sections.join('\n');
  }

  /**
   * Format individual attempt
   *
   * For success: shows commit message, score, and metrics
   * For failure: shows failure type and reason
   *
   * @param attempt - Attempt outcome to format
   * @returns Formatted markdown for attempt
   */
  private formatAttempt(attempt: AttemptOutcome): string {
    const sections: string[] = [];

    sections.push(`#### Attempt ${attempt.attemptNumber}\n`);

    if (isSuccessOutcome(attempt)) {
      sections.push(`**Status:** ✓ Success\n`);
      sections.push(`**Response Time:** ${attempt.responseTimeMs}ms\n`);
      sections.push(`**Commit Message:**`);
      sections.push('```');
      sections.push(attempt.commitMessage);
      sections.push('```\n');
      sections.push(`**Score:** ${attempt.overallScore.toFixed(1)}\n`);
      sections.push('**Metrics:**');
      sections.push('| Metric | Score |');
      sections.push('| --- | --- |');
      sections.push(`| Clarity | ${attempt.metrics.clarity.toFixed(1)} |`);
      sections.push(`| Specificity | ${attempt.metrics.specificity.toFixed(1)} |`);
      sections.push(`| Conventional Format | ${attempt.metrics.conventionalFormat.toFixed(1)} |`);
      sections.push(`| Scope | ${attempt.metrics.scope.toFixed(1)} |\n`);
    } else {
      sections.push(`**Status:** ✗ Failed\n`);
      sections.push(`**Response Time:** ${attempt.responseTimeMs}ms\n`);
      sections.push(`**Failure Type:** ${attempt.failureType}\n`);
      sections.push(`**Failure Reason:** ${attempt.failureReason}\n`);
    }

    return sections.join('\n');
  }
}
