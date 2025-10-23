/**
 * Tests for EvalRunner
 *
 * Tests the full evaluation pipeline orchestration:
 * - Fixtures → Attempts → Meta-eval → Comparison
 * - Multiple agents and fixtures
 * - Fallback scoring if meta-eval fails
 */

import { describe, expect, it, mock } from 'bun:test';

import type { AttemptOutcome, EvalResult } from '../../core/types.js';
import type { MetaEvaluator } from '../../evaluators/meta-evaluator.js';
import type { JSONReporter } from '../../reporters/json-reporter.js';
import type { MarkdownReporter } from '../../reporters/markdown-reporter.js';
import type { AttemptRunner } from '../attempt-runner.js';
import { EvalRunner } from '../eval-runner.js';

describe('EvalRunner', () => {
  describe('run', () => {
    it('should orchestrate full pipeline for single fixture', async () => {
      // Mock successful attempts (3/3 success)
      const mockAttempts: AttemptOutcome[] = [
        {
          attemptNumber: 1,
          commitMessage: 'feat: add feature',
          metrics: { clarity: 9, conventionalFormat: 10, scope: 7, specificity: 8 },
          overallScore: 8.5,
          status: 'success',
        },
        {
          attemptNumber: 2,
          commitMessage: 'feat: add feature v2',
          metrics: { clarity: 8, conventionalFormat: 10, scope: 8, specificity: 9 },
          overallScore: 8.75,
          status: 'success',
        },
        {
          attemptNumber: 3,
          commitMessage: 'feat: add feature v3',
          metrics: { clarity: 9, conventionalFormat: 9, scope: 8, specificity: 8 },
          overallScore: 8.5,
          status: 'success',
        },
      ];

      const mockEvalResult: EvalResult = {
        attempts: mockAttempts,
        bestAttempt: 1,
        consistencyScore: 9.0,
        errorRateImpact: 0,
        finalScore: 8.5,
        reasoning: 'All attempts succeeded with consistent quality',
        successRate: '3/3',
      };

      // Mock AttemptRunner
      const mockAttemptRunner = {
        runAttempts: mock(async () => mockAttempts),
      } as unknown as AttemptRunner;

      // Mock MetaEvaluator
      const mockMetaEvaluator = {
        evaluate: mock(async () => mockEvalResult),
      } as unknown as MetaEvaluator;

      // Mock JSONReporter
      const mockJSONReporter = {
        saveResults: mock(async () => {}),
      } as unknown as JSONReporter;

      // Mock MarkdownReporter
      const mockMarkdownReporter = {
        generateReport: mock(async () => {}),
      } as unknown as MarkdownReporter;

      const runner = new EvalRunner(
        mockAttemptRunner,
        mockMetaEvaluator,
        mockJSONReporter,
        mockMarkdownReporter
      );

      const fixtures = [
        {
          diff: 'diff --git a/file.ts...',
          name: 'simple',
          status: 'M  file.ts',
        },
      ];

      const comparison = await runner.run(fixtures);

      // Should have results for both agents
      expect(comparison.fixture).toBe('simple');
      expect(comparison.claudeResult).toBeDefined();
      expect(comparison.codexResult).toBeDefined();

      // Winner should be determined
      expect(comparison.winner).toBeDefined();
      if (comparison.winner) {
        expect(['claude', 'codex', 'tie']).toContain(comparison.winner);
      }

      // AttemptRunner should be called twice (once per agent)
      expect(mockAttemptRunner.runAttempts).toHaveBeenCalledTimes(2);

      // MetaEvaluator should be called twice
      expect(mockMetaEvaluator.evaluate).toHaveBeenCalledTimes(2);

      // JSONReporter should be called twice (save each agent's result)
      expect(mockJSONReporter.saveResults).toHaveBeenCalledTimes(2);

      // MarkdownReporter should be called once (final comparison)
      expect(mockMarkdownReporter.generateReport).toHaveBeenCalledTimes(1);
    });

    it('should handle mixed success/failure scenarios', async () => {
      // Mock 2/3 success for one agent
      const mockClaudeAttempts: AttemptOutcome[] = [
        {
          attemptNumber: 1,
          commitMessage: 'feat: add feature',
          metrics: { clarity: 9, conventionalFormat: 10, scope: 7, specificity: 8 },
          overallScore: 8.5,
          status: 'success',
        },
        {
          attemptNumber: 2,
          failureReason: 'Invalid format',
          failureType: 'validation',
          status: 'failure',
        },
        {
          attemptNumber: 3,
          commitMessage: 'feat: add feature v3',
          metrics: { clarity: 8, conventionalFormat: 9, scope: 8, specificity: 8 },
          overallScore: 8.25,
          status: 'success',
        },
      ];

      const mockClaudeResult: EvalResult = {
        attempts: mockClaudeAttempts,
        bestAttempt: 1,
        consistencyScore: 8.5,
        errorRateImpact: -1.0,
        finalScore: 7.0,
        reasoning: '2/3 success with penalty for failure',
        successRate: '2/3',
      };

      // Mock 3/3 success for other agent
      const mockCodexAttempts: AttemptOutcome[] = [
        {
          attemptNumber: 1,
          commitMessage: 'feat: implement feature',
          metrics: { clarity: 9, conventionalFormat: 10, scope: 8, specificity: 9 },
          overallScore: 9.0,
          status: 'success',
        },
        {
          attemptNumber: 2,
          commitMessage: 'feat: implement feature v2',
          metrics: { clarity: 9, conventionalFormat: 10, scope: 8, specificity: 8 },
          overallScore: 8.75,
          status: 'success',
        },
        {
          attemptNumber: 3,
          commitMessage: 'feat: implement feature v3',
          metrics: { clarity: 9, conventionalFormat: 10, scope: 9, specificity: 9 },
          overallScore: 9.25,
          status: 'success',
        },
      ];

      const mockCodexResult: EvalResult = {
        attempts: mockCodexAttempts,
        bestAttempt: 3,
        consistencyScore: 9.5,
        errorRateImpact: 0,
        finalScore: 9.0,
        reasoning: 'All attempts succeeded with excellent consistency',
        successRate: '3/3',
      };

      // Mock AttemptRunner - alternate between agents
      const mockAttemptRunner = {
        runAttempts: mock(async (agentName: string) => {
          return agentName === 'claude' ? mockClaudeAttempts : mockCodexAttempts;
        }),
      } as unknown as AttemptRunner;

      // Mock MetaEvaluator - return appropriate result
      const mockMetaEvaluator = {
        evaluate: mock(async (attempts: AttemptOutcome[]) => {
          return attempts === mockClaudeAttempts ? mockClaudeResult : mockCodexResult;
        }),
      } as unknown as MetaEvaluator;

      // Mock reporters
      const mockJSONReporter = {
        saveResults: mock(async () => {}),
      } as unknown as JSONReporter;

      const mockMarkdownReporter = {
        generateReport: mock(async () => {}),
      } as unknown as MarkdownReporter;

      const runner = new EvalRunner(
        mockAttemptRunner,
        mockMetaEvaluator,
        mockJSONReporter,
        mockMarkdownReporter
      );

      const fixtures = [
        {
          diff: 'diff --git a/file.ts...',
          name: 'complex',
          status: 'M  file.ts',
        },
      ];

      const comparison = await runner.run(fixtures);

      // Codex should win (9.0 vs 7.0)
      expect(comparison.winner).toBe('codex');
      expect(comparison.claudeResult?.finalScore).toBe(7.0);
      expect(comparison.codexResult?.finalScore).toBe(9.0);
    });

    it('should handle all failures scenario (0/3 success)', async () => {
      // Mock all failures
      const mockAttempts: AttemptOutcome[] = [
        {
          attemptNumber: 1,
          failureReason: 'Command not found',
          failureType: 'api_error',
          status: 'failure',
        },
        {
          attemptNumber: 2,
          failureReason: 'Timeout occurred',
          failureType: 'generation',
          status: 'failure',
        },
        {
          attemptNumber: 3,
          failureReason: 'Invalid format',
          failureType: 'validation',
          status: 'failure',
        },
      ];

      const mockEvalResult: EvalResult = {
        attempts: mockAttempts,
        bestAttempt: undefined,
        consistencyScore: 0,
        errorRateImpact: -10.0,
        finalScore: 0,
        reasoning: 'All attempts failed - agent is unreliable',
        successRate: '0/3',
      };

      // Mock dependencies
      const mockAttemptRunner = {
        runAttempts: mock(async () => mockAttempts),
      } as unknown as AttemptRunner;

      const mockMetaEvaluator = {
        evaluate: mock(async () => mockEvalResult),
      } as unknown as MetaEvaluator;

      const mockJSONReporter = {
        saveResults: mock(async () => {}),
      } as unknown as JSONReporter;

      const mockMarkdownReporter = {
        generateReport: mock(async () => {}),
      } as unknown as MarkdownReporter;

      const runner = new EvalRunner(
        mockAttemptRunner,
        mockMetaEvaluator,
        mockJSONReporter,
        mockMarkdownReporter
      );

      const fixtures = [
        {
          diff: 'diff --git a/file.ts...',
          name: 'simple',
          status: 'M  file.ts',
        },
      ];

      const comparison = await runner.run(fixtures);

      // Both agents failed completely
      expect(comparison.claudeResult?.successRate).toBe('0/3');
      expect(comparison.codexResult?.successRate).toBe('0/3');
      expect(comparison.claudeResult?.finalScore).toBe(0);
      expect(comparison.codexResult?.finalScore).toBe(0);

      // Should still determine a winner (or tie)
      expect(comparison.winner).toBeDefined();
    });

    it('should use fallback scoring if meta-eval fails', async () => {
      // Mock successful attempts
      const mockAttempts: AttemptOutcome[] = [
        {
          attemptNumber: 1,
          commitMessage: 'feat: add feature',
          metrics: { clarity: 9, conventionalFormat: 10, scope: 7, specificity: 8 },
          overallScore: 8.5,
          status: 'success',
        },
        {
          attemptNumber: 2,
          commitMessage: 'feat: add feature v2',
          metrics: { clarity: 8, conventionalFormat: 10, scope: 8, specificity: 9 },
          overallScore: 8.75,
          status: 'success',
        },
        {
          attemptNumber: 3,
          commitMessage: 'feat: add feature v3',
          metrics: { clarity: 9, conventionalFormat: 9, scope: 8, specificity: 8 },
          overallScore: 8.5,
          status: 'success',
        },
      ];

      // Mock AttemptRunner
      const mockAttemptRunner = {
        runAttempts: mock(async () => mockAttempts),
      } as unknown as AttemptRunner;

      // Mock MetaEvaluator that throws error
      const mockMetaEvaluator = {
        evaluate: mock(async () => {
          throw new Error('ChatGPT API error');
        }),
      } as unknown as MetaEvaluator;

      // Mock reporters
      const mockJSONReporter = {
        saveResults: mock(async () => {}),
      } as unknown as JSONReporter;

      const mockMarkdownReporter = {
        generateReport: mock(async () => {}),
      } as unknown as MarkdownReporter;

      const runner = new EvalRunner(
        mockAttemptRunner,
        mockMetaEvaluator,
        mockJSONReporter,
        mockMarkdownReporter
      );

      const fixtures = [
        {
          diff: 'diff --git a/file.ts...',
          name: 'simple',
          status: 'M  file.ts',
        },
      ];

      const comparison = await runner.run(fixtures);

      // Should have results with fallback scoring
      expect(comparison.claudeResult).toBeDefined();
      expect(comparison.codexResult).toBeDefined();

      // Fallback score should be average of successful attempts
      // (8.5 + 8.75 + 8.5) / 3 = 8.58
      expect(comparison.claudeResult?.finalScore).toBeCloseTo(8.58, 1);
      expect(comparison.codexResult?.finalScore).toBeCloseTo(8.58, 1);

      // Should still generate reports
      expect(mockMarkdownReporter.generateReport).toHaveBeenCalled();
    });

    it('should determine winner correctly based on finalScore', async () => {
      // Mock Claude: 8.5
      const mockClaudeResult: EvalResult = {
        attempts: [],
        bestAttempt: 1,
        consistencyScore: 9.0,
        errorRateImpact: 0,
        finalScore: 8.5,
        reasoning: 'Good performance',
        successRate: '3/3',
      };

      // Mock Codex: 7.0
      const mockCodexResult: EvalResult = {
        attempts: [],
        bestAttempt: 1,
        consistencyScore: 8.0,
        errorRateImpact: -1.0,
        finalScore: 7.0,
        reasoning: 'Decent with one failure',
        successRate: '2/3',
      };

      let evalCallCount = 0;

      // Mock dependencies
      const mockAttemptRunner = {
        runAttempts: mock(async () => []),
      } as unknown as AttemptRunner;

      const mockMetaEvaluator = {
        evaluate: mock(async () => {
          evalCallCount++;
          return evalCallCount === 1 ? mockClaudeResult : mockCodexResult;
        }),
      } as unknown as MetaEvaluator;

      const mockJSONReporter = {
        saveResults: mock(async () => {}),
      } as unknown as JSONReporter;

      const mockMarkdownReporter = {
        generateReport: mock(async () => {}),
      } as unknown as MarkdownReporter;

      const runner = new EvalRunner(
        mockAttemptRunner,
        mockMetaEvaluator,
        mockJSONReporter,
        mockMarkdownReporter
      );

      const fixtures = [
        {
          diff: 'diff --git...',
          name: 'test',
          status: 'M  file.ts',
        },
      ];

      const comparison = await runner.run(fixtures);

      // Claude should win (8.5 > 7.0)
      expect(comparison.winner).toBe('claude');
    });

    it('should declare tie if scores are within 0.5 points', async () => {
      // Mock Claude: 8.5
      const mockClaudeResult: EvalResult = {
        attempts: [],
        bestAttempt: 1,
        consistencyScore: 9.0,
        errorRateImpact: 0,
        finalScore: 8.5,
        reasoning: 'Good performance',
        successRate: '3/3',
      };

      // Mock Codex: 8.3 (within 0.5 of Claude)
      const mockCodexResult: EvalResult = {
        attempts: [],
        bestAttempt: 2,
        consistencyScore: 8.8,
        errorRateImpact: 0,
        finalScore: 8.3,
        reasoning: 'Very similar performance',
        successRate: '3/3',
      };

      let evalCallCount = 0;

      // Mock dependencies
      const mockAttemptRunner = {
        runAttempts: mock(async () => []),
      } as unknown as AttemptRunner;

      const mockMetaEvaluator = {
        evaluate: mock(async () => {
          evalCallCount++;
          return evalCallCount === 1 ? mockClaudeResult : mockCodexResult;
        }),
      } as unknown as MetaEvaluator;

      const mockJSONReporter = {
        saveResults: mock(async () => {}),
      } as unknown as JSONReporter;

      const mockMarkdownReporter = {
        generateReport: mock(async () => {}),
      } as unknown as MarkdownReporter;

      const runner = new EvalRunner(
        mockAttemptRunner,
        mockMetaEvaluator,
        mockJSONReporter,
        mockMarkdownReporter
      );

      const fixtures = [
        {
          diff: 'diff --git...',
          name: 'test',
          status: 'M  file.ts',
        },
      ];

      const comparison = await runner.run(fixtures);

      // Should be a tie (8.5 - 8.3 = 0.2 < 0.5)
      expect(comparison.winner).toBe('tie');
    });
  });
});
