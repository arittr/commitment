import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

import type { EvalComparison } from '../../core/types.js';
import { MarkdownReporter } from '../markdown-reporter.js';

describe('MarkdownReporter', () => {
  const testResultsDir = join(process.cwd(), '.eval-results');
  let createdFiles: string[] = [];

  beforeEach(() => {
    createdFiles = [];
  });

  afterEach(() => {
    // Clean up created files
    for (const file of createdFiles) {
      try {
        if (existsSync(file)) {
          unlinkSync(file);
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  function createTestComparison(): EvalComparison {
    return {
      claudeResult: {
        attempts: [
          {
            attemptNumber: 1,
            commitMessage: 'feat: add Claude feature',
            metrics: {
              clarity: 9,
              conventionalFormat: 10,
              scope: 7,
              specificity: 8,
            },
            overallScore: 8.5,
            responseTimeMs: 1000,
            status: 'success',
          },
          {
            attemptNumber: 2,
            commitMessage: 'feat: improve Claude feature',
            metrics: {
              clarity: 8,
              conventionalFormat: 9,
              scope: 8,
              specificity: 9,
            },
            overallScore: 8.5,
            responseTimeMs: 1100,
            status: 'success',
          },
          {
            attemptNumber: 3,
            commitMessage: 'feat: finalize Claude feature',
            metrics: {
              clarity: 9,
              conventionalFormat: 10,
              scope: 9,
              specificity: 8,
            },
            overallScore: 9.0,
            responseTimeMs: 1200,
            status: 'success',
          },
        ],
        bestAttempt: 3,
        consistencyScore: 9.0,
        errorRateImpact: 0,
        finalScore: 8.7,
        reasoning: 'All three attempts successful with high consistency.',
        successRate: '3/3',
      },
      codexResult: {
        attempts: [
          {
            attemptNumber: 1,
            commitMessage: 'feat: add Codex feature',
            metrics: {
              clarity: 8,
              conventionalFormat: 9,
              scope: 6,
              specificity: 7,
            },
            overallScore: 7.5,
            responseTimeMs: 1000,
            status: 'success',
          },
          {
            attemptNumber: 2,
            failureReason: 'Invalid conventional commit format',
            failureType: 'validation',
            responseTimeMs: 100,
            status: 'failure',
          },
          {
            attemptNumber: 3,
            commitMessage: 'feat: improve Codex feature',
            metrics: {
              clarity: 7,
              conventionalFormat: 8,
              scope: 7,
              specificity: 8,
            },
            overallScore: 7.5,
            responseTimeMs: 1100,
            status: 'success',
          },
        ],
        bestAttempt: 1,
        consistencyScore: 7.0,
        errorRateImpact: -1.0,
        finalScore: 6.5,
        reasoning: 'Two successful attempts, but one failure impacts consistency.',
        successRate: '2/3',
      },
      fixture: 'test-fixture',
      winner: 'claude',
    };
  }

  describe('generateReport', () => {
    it('should generate markdown file with all sections', async () => {
      const reporter = new MarkdownReporter(testResultsDir);
      const comparison = createTestComparison();

      const runDir = '2025-01-01T00-00-00.000Z';
      await reporter.generateReport(comparison, runDir);

      const reportPath = join(testResultsDir, runDir, 'report.md');
      createdFiles.push(reportPath);

      expect(existsSync(reportPath)).toBe(true);

      const content = readFileSync(reportPath, 'utf-8');

      // Check major sections exist
      expect(content).toContain('# Evaluation Report');
      expect(content).toContain('## Fixture');
      expect(content).toContain('## Winner');
      expect(content).toContain('## Claude Results');
      expect(content).toContain('## Codex Results');
    });

    it('should show per-attempt details for successes', async () => {
      const reporter = new MarkdownReporter(testResultsDir);
      const comparison = createTestComparison();

      const runDir = '2025-01-01T00-00-00.000Z';
      await reporter.generateReport(comparison, runDir);

      const reportPath = join(testResultsDir, runDir, 'report.md');
      createdFiles.push(reportPath);

      const content = readFileSync(reportPath, 'utf-8');

      // Check attempt details
      expect(content).toContain('Attempt 1');
      expect(content).toContain('Attempt 2');
      expect(content).toContain('Attempt 3');

      // Check success details
      expect(content).toContain('feat: add Claude feature');
      expect(content).toContain('Score:');
      expect(content).toContain('8.5');
    });

    it('should show per-attempt details for failures', async () => {
      const reporter = new MarkdownReporter(testResultsDir);
      const comparison = createTestComparison();

      const runDir = '2025-01-01T00-00-00.000Z';
      await reporter.generateReport(comparison, runDir);

      const reportPath = join(testResultsDir, runDir, 'report.md');
      createdFiles.push(reportPath);

      const content = readFileSync(reportPath, 'utf-8');

      // Check failure details
      expect(content).toContain('validation');
      expect(content).toContain('Invalid conventional commit format');
    });

    it('should display meta-evaluation with scores and reasoning', async () => {
      const reporter = new MarkdownReporter(testResultsDir);
      const comparison = createTestComparison();

      const runDir = '2025-01-01T00-00-00.000Z';
      await reporter.generateReport(comparison, runDir);

      const reportPath = join(testResultsDir, runDir, 'report.md');
      createdFiles.push(reportPath);

      const content = readFileSync(reportPath, 'utf-8');

      // Check meta-evaluation section
      expect(content).toContain('Meta-Evaluation');
      expect(content).toContain('Final Score');
      expect(content).toContain('8.7');
      expect(content).toContain('Consistency Score');
      expect(content).toContain('9.0');
      expect(content).toContain('Error Rate Impact');
      expect(content).toContain('Reasoning');
      expect(content).toContain('All three attempts successful');
    });

    it('should show success rate breakdown', async () => {
      const reporter = new MarkdownReporter(testResultsDir);
      const comparison = createTestComparison();

      const runDir = '2025-01-01T00-00-00.000Z';
      await reporter.generateReport(comparison, runDir);

      const reportPath = join(testResultsDir, runDir, 'report.md');
      createdFiles.push(reportPath);

      const content = readFileSync(reportPath, 'utf-8');

      expect(content).toContain('Success Rate');
      expect(content).toContain('3/3');
      expect(content).toContain('2/3');
    });

    it('should display winner', async () => {
      const reporter = new MarkdownReporter(testResultsDir);
      const comparison = createTestComparison();

      const runDir = '2025-01-01T00-00-00.000Z';
      await reporter.generateReport(comparison, runDir);

      const reportPath = join(testResultsDir, runDir, 'report.md');
      createdFiles.push(reportPath);

      const content = readFileSync(reportPath, 'utf-8');

      expect(content).toContain('Winner');
      expect(content).toContain('Claude');
    });

    it('should handle tie scenario', async () => {
      const reporter = new MarkdownReporter(testResultsDir);
      const comparison = createTestComparison();
      comparison.winner = 'tie';
      if (comparison.claudeResult) {
        comparison.claudeResult.finalScore = 8.0;
      }
      if (comparison.codexResult) {
        comparison.codexResult.finalScore = 8.0;
      }

      const runDir = '2025-01-01T00-00-00.000Z';
      await reporter.generateReport(comparison, runDir);

      const reportPath = join(testResultsDir, runDir, 'report.md');
      createdFiles.push(reportPath);

      const content = readFileSync(reportPath, 'utf-8');

      expect(content).toContain('Tie');
    });

    it('should handle all-failure scenario', async () => {
      const reporter = new MarkdownReporter(testResultsDir);
      const comparison: EvalComparison = {
        claudeResult: {
          attempts: [
            {
              attemptNumber: 1,
              failureReason: 'Failed to clean artifacts',
              failureType: 'cleaning',
              responseTimeMs: 100,
              status: 'failure',
            },
            {
              attemptNumber: 2,
              failureReason: 'Invalid format',
              failureType: 'validation',
              responseTimeMs: 100,
              status: 'failure',
            },
            {
              attemptNumber: 3,
              failureReason: 'Agent timeout',
              failureType: 'generation',
              responseTimeMs: 100,
              status: 'failure',
            },
          ],
          bestAttempt: undefined,
          consistencyScore: 0.0,
          errorRateImpact: -3.0,
          finalScore: 0.0,
          reasoning: 'All attempts failed',
          successRate: '0/3',
        },
        codexResult: {
          attempts: [
            {
              attemptNumber: 1,
              failureReason: 'API error',
              failureType: 'api_error',
              responseTimeMs: 100,
              status: 'failure',
            },
            {
              attemptNumber: 2,
              failureReason: 'API error',
              failureType: 'api_error',
              responseTimeMs: 100,
              status: 'failure',
            },
            {
              attemptNumber: 3,
              failureReason: 'API error',
              failureType: 'api_error',
              responseTimeMs: 100,
              status: 'failure',
            },
          ],
          bestAttempt: undefined,
          consistencyScore: 0.0,
          errorRateImpact: -3.0,
          finalScore: 0.0,
          reasoning: 'All attempts failed',
          successRate: '0/3',
        },
        fixture: 'all-failures',
        winner: 'tie',
      };

      const runDir = '2025-01-01T00-00-00.000Z';
      await reporter.generateReport(comparison, runDir);

      const reportPath = join(testResultsDir, runDir, 'report.md');
      createdFiles.push(reportPath);

      const content = readFileSync(reportPath, 'utf-8');

      expect(content).toContain('0/3');
      expect(content).toContain('Failed to clean artifacts');
      expect(content).toContain('API error');
    });

    it('should include best attempt details', async () => {
      const reporter = new MarkdownReporter(testResultsDir);
      const comparison = createTestComparison();

      const runDir = '2025-01-01T00-00-00.000Z';
      await reporter.generateReport(comparison, runDir);

      const reportPath = join(testResultsDir, runDir, 'report.md');
      createdFiles.push(reportPath);

      const content = readFileSync(reportPath, 'utf-8');

      expect(content).toContain('Best Attempt');
      expect(content).toContain('Attempt 3'); // Claude's best
      expect(content).toContain('Attempt 1'); // Codex's best
    });

    it('should handle missing agent results gracefully', async () => {
      const reporter = new MarkdownReporter(testResultsDir);
      const comparison: EvalComparison = {
        claudeResult: createTestComparison().claudeResult,
        codexResult: undefined,
        fixture: 'missing-codex',
        winner: 'claude',
      };

      const runDir = '2025-01-01T00-00-00.000Z';
      await reporter.generateReport(comparison, runDir);

      const reportPath = join(testResultsDir, runDir, 'report.md');
      createdFiles.push(reportPath);

      const content = readFileSync(reportPath, 'utf-8');

      expect(content).toContain('Claude Results');
      expect(content).toContain('No results');
    });
  });

  describe('markdown formatting', () => {
    it('should use proper markdown table format for metrics', async () => {
      const reporter = new MarkdownReporter(testResultsDir);
      const comparison = createTestComparison();

      const runDir = '2025-01-01T00-00-00.000Z';
      await reporter.generateReport(comparison, runDir);

      const reportPath = join(testResultsDir, runDir, 'report.md');
      createdFiles.push(reportPath);

      const content = readFileSync(reportPath, 'utf-8');

      // Check for table markers
      expect(content).toContain('|');
      expect(content).toContain('---');
    });

    it('should use headings correctly', async () => {
      const reporter = new MarkdownReporter(testResultsDir);
      const comparison = createTestComparison();

      // Use a test runDir
      const runDir = '2025-01-01T00-00-00.000Z';
      await reporter.generateReport(comparison, runDir);

      const reportPath = join(testResultsDir, runDir, 'report.md');
      createdFiles.push(reportPath);

      const content = readFileSync(reportPath, 'utf-8');

      expect(content).toMatch(/^# /m); // H1
      expect(content).toMatch(/^## /m); // H2
      expect(content).toMatch(/^### /m); // H3
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid results directory', async () => {
      const reporter = new MarkdownReporter('/nonexistent/invalid/path');
      const comparison = createTestComparison();

      await expect(
        reporter.generateReport(comparison, '/nonexistent/invalid/path')
      ).rejects.toThrow();
    });
  });
});
