/**
 * Tests for AttemptRunner
 *
 * Tests the 3-attempt loop with error handling and categorization.
 * Ensures all 3 attempts always complete (no short-circuiting).
 */

import { describe, expect, it, mock } from 'bun:test';

import type { CommitMessageGenerator } from '../../../generator.js';
import type { SingleAttemptEvaluator } from '../../evaluators/single-attempt.js';
import type { CLIReporter } from '../../reporters/cli-reporter.js';
import { AttemptRunner } from '../attempt-runner.js';

describe('AttemptRunner', () => {
  describe('runAttempts', () => {
    it('should execute exactly 3 attempts and return 3 outcomes', async () => {
      // Mock generator
      const mockGenerator = {
        generateCommitMessage: mock(async () => 'feat: add feature'),
      } as unknown as CommitMessageGenerator;

      // Mock evaluator
      const mockEvaluator = {
        evaluate: mock(async () => ({
          metrics: {
            clarity: 9,
            conventionalFormat: 10,
            scope: 7,
            specificity: 8,
          },
          overallScore: 8.5,
        })),
      } as unknown as SingleAttemptEvaluator;

      // Mock reporter
      const mockReporter = {
        reportAttemptFailure: mock(
          (_attemptNumber: number, _failureType: string, _responseTimeMs: number) => {}
        ),
        reportAttemptStart: mock((_attemptNumber: number) => {}),
        reportAttemptSuccess: mock(
          (_attemptNumber: number, _score: number, _responseTimeMs: number) => {}
        ),
      } as unknown as CLIReporter;

      // Generator factory that returns our mock
      const generatorFactory = () => mockGenerator;

      const runner = new AttemptRunner(mockEvaluator, mockReporter, generatorFactory);

      const fixture = {
        diff: 'diff --git a/file.ts...',
        name: 'simple',
        status: 'M  file.ts',
      };

      const outcomes = await runner.runAttempts('claude', fixture);

      // Should return exactly 3 outcomes
      expect(outcomes).toHaveLength(3);

      // All should be successes
      outcomes.forEach((outcome, index) => {
        expect(outcome.status).toBe('success');
        expect(outcome.attemptNumber).toBe(index + 1);
        if (outcome.status === 'success') {
          expect(outcome.commitMessage).toBe('feat: add feature');
          expect(outcome.overallScore).toBe(8.5);
        }
      });

      // Generator should be called 3 times
      expect(mockGenerator.generateCommitMessage).toHaveBeenCalledTimes(3);

      // Evaluator should be called 3 times (all succeeded)
      expect(mockEvaluator.evaluate).toHaveBeenCalledTimes(3);

      // Reporter should be called for each attempt
      expect(mockReporter.reportAttemptStart).toHaveBeenCalledTimes(3);
      expect(mockReporter.reportAttemptSuccess).toHaveBeenCalledTimes(3);
    });

    it('should categorize errors on failure and create failure outcomes', async () => {
      // Mock generator that fails with validation error
      const mockGenerator = {
        generateCommitMessage: mock(async () => {
          throw new Error('Invalid conventional commit format');
        }),
      } as unknown as CommitMessageGenerator;

      // Mock evaluator (should not be called)
      const mockEvaluator = {
        evaluate: mock(async () => ({
          metrics: { clarity: 0, conventionalFormat: 0, scope: 0, specificity: 0 },
          overallScore: 0,
        })),
      } as unknown as SingleAttemptEvaluator;

      // Mock reporter
      const mockReporter = {
        reportAttemptFailure: mock(
          (_attemptNumber: number, _failureType: string, _responseTimeMs: number) => {}
        ),
        reportAttemptStart: mock((_attemptNumber: number) => {}),
        reportAttemptSuccess: mock(
          (_attemptNumber: number, _score: number, _responseTimeMs: number) => {}
        ),
      } as unknown as CLIReporter;

      const generatorFactory = () => mockGenerator;

      const runner = new AttemptRunner(mockEvaluator, mockReporter, generatorFactory);

      const fixture = {
        diff: 'diff --git a/file.ts...',
        name: 'simple',
        status: 'M  file.ts',
      };

      const outcomes = await runner.runAttempts('claude', fixture);

      // Should return exactly 3 outcomes
      expect(outcomes).toHaveLength(3);

      // All should be failures
      outcomes.forEach((outcome, index) => {
        expect(outcome).toBeDefined();
        expect(outcome?.status).toBe('failure');
        expect(outcome?.attemptNumber).toBe(index + 1);
        if (outcome && outcome.status === 'failure') {
          expect(outcome.failureType).toBe('validation');
          expect(outcome.failureReason).toContain('Invalid conventional commit');
        }
      });

      // Generator should be called 3 times
      expect(mockGenerator.generateCommitMessage).toHaveBeenCalledTimes(3);

      // Evaluator should NOT be called (all failed)
      expect(mockEvaluator.evaluate).not.toHaveBeenCalled();

      // Reporter should report failures
      expect(mockReporter.reportAttemptStart).toHaveBeenCalledTimes(3);
      expect(mockReporter.reportAttemptFailure).toHaveBeenCalledTimes(3);
    });

    it('should complete all 3 attempts even if first attempt fails (no short-circuiting)', async () => {
      let callCount = 0;

      // Mock generator: first fails, second and third succeed
      const mockGenerator = {
        generateCommitMessage: mock(async () => {
          callCount++;
          if (callCount === 1) {
            throw new Error('Timeout occurred');
          }
          return 'feat: add feature';
        }),
      } as unknown as CommitMessageGenerator;

      // Mock evaluator
      const mockEvaluator = {
        evaluate: mock(async () => ({
          metrics: {
            clarity: 8,
            conventionalFormat: 9,
            scope: 7,
            specificity: 8,
          },
          overallScore: 8.0,
        })),
      } as unknown as SingleAttemptEvaluator;

      // Mock reporter
      const mockReporter = {
        reportAttemptFailure: mock(
          (_attemptNumber: number, _failureType: string, _responseTimeMs: number) => {}
        ),
        reportAttemptStart: mock((_attemptNumber: number) => {}),
        reportAttemptSuccess: mock(
          (_attemptNumber: number, _score: number, _responseTimeMs: number) => {}
        ),
      } as unknown as CLIReporter;

      const generatorFactory = () => mockGenerator;

      const runner = new AttemptRunner(mockEvaluator, mockReporter, generatorFactory);

      const fixture = {
        diff: 'diff --git a/file.ts...',
        name: 'simple',
        status: 'M  file.ts',
      };

      const outcomes = await runner.runAttempts('claude', fixture);

      // Should return exactly 3 outcomes
      expect(outcomes).toHaveLength(3);

      // First should be failure
      expect(outcomes[0]).toBeDefined();
      expect(outcomes[0]?.status).toBe('failure');
      expect(outcomes[0]?.attemptNumber).toBe(1);
      if (outcomes[0] && outcomes[0].status === 'failure') {
        expect(outcomes[0].failureType).toBe('generation');
        expect(outcomes[0].failureReason).toContain('Timeout');
      }

      // Second and third should be successes
      expect(outcomes[1]).toBeDefined();
      expect(outcomes[1]?.status).toBe('success');
      expect(outcomes[2]).toBeDefined();
      expect(outcomes[2]?.status).toBe('success');

      // Generator should be called 3 times (never short-circuited)
      expect(mockGenerator.generateCommitMessage).toHaveBeenCalledTimes(3);

      // Evaluator should be called 2 times (for successes)
      expect(mockEvaluator.evaluate).toHaveBeenCalledTimes(2);

      // Reporter should report 1 failure and 2 successes
      expect(mockReporter.reportAttemptFailure).toHaveBeenCalledTimes(1);
      expect(mockReporter.reportAttemptSuccess).toHaveBeenCalledTimes(2);
    });

    it.skip('should categorize different error types correctly', async () => {
      // TODO: This test needs to be rewritten - AttemptRunner creates its own generator internally
      // so we can't mock it. Need to either test with real agents or refactor to use dependency injection.

      // Note: AttemptRunner creates its own generator internally, so we can't mock it here
      // This test validates that different errors are properly categorized

      // Mock evaluator (should not be called)
      const mockEvaluator = {
        evaluate: mock(async () => ({
          metrics: { clarity: 0, conventionalFormat: 0, scope: 0, specificity: 0 },
          overallScore: 0,
        })),
      } as unknown as SingleAttemptEvaluator;

      // Mock reporter
      const mockReporter = {
        reportAttemptFailure: mock(
          (_attemptNumber: number, _failureType: string, _responseTimeMs: number) => {}
        ),
        reportAttemptStart: mock((_attemptNumber: number) => {}),
        reportAttemptSuccess: mock(
          (_attemptNumber: number, _score: number, _responseTimeMs: number) => {}
        ),
      } as unknown as CLIReporter;

      const runner = new AttemptRunner(mockEvaluator, mockReporter);

      const fixture = {
        diff: 'diff --git a/file.ts...',
        name: 'simple',
        status: 'M  file.ts',
      };

      const outcomes = await runner.runAttempts('claude', fixture);

      // Should categorize each error correctly
      expect(outcomes[0]).toBeDefined();
      expect(outcomes[0]?.status).toBe('failure');
      if (outcomes[0] && outcomes[0].status === 'failure') {
        expect(outcomes[0].failureType).toBe('api_error');
      }

      expect(outcomes[1]).toBeDefined();
      expect(outcomes[1]?.status).toBe('failure');
      if (outcomes[1] && outcomes[1].status === 'failure') {
        expect(outcomes[1].failureType).toBe('cleaning');
      }

      expect(outcomes[2]).toBeDefined();
      expect(outcomes[2]?.status).toBe('failure');
      if (outcomes[2] && outcomes[2].status === 'failure') {
        expect(outcomes[2].failureType).toBe('validation');
      }
    });

    it('should handle mixed success and failure scenarios', async () => {
      let callCount = 0;

      // Mock generator: fail, success, fail
      const mockGenerator = {
        generateCommitMessage: mock(async () => {
          callCount++;
          if (callCount === 1 || callCount === 3) {
            throw new Error('Generation failed');
          }
          return 'feat: add feature';
        }),
      } as unknown as CommitMessageGenerator;

      // Mock evaluator
      const mockEvaluator = {
        evaluate: mock(async () => ({
          metrics: {
            clarity: 9,
            conventionalFormat: 10,
            scope: 8,
            specificity: 8,
          },
          overallScore: 8.75,
        })),
      } as unknown as SingleAttemptEvaluator;

      // Mock reporter
      const mockReporter = {
        reportAttemptFailure: mock(
          (_attemptNumber: number, _failureType: string, _responseTimeMs: number) => {}
        ),
        reportAttemptStart: mock((_attemptNumber: number) => {}),
        reportAttemptSuccess: mock(
          (_attemptNumber: number, _score: number, _responseTimeMs: number) => {}
        ),
      } as unknown as CLIReporter;

      const generatorFactory = () => mockGenerator;

      const runner = new AttemptRunner(mockEvaluator, mockReporter, generatorFactory);

      const fixture = {
        diff: 'diff --git a/file.ts...',
        name: 'simple',
        status: 'M  file.ts',
      };

      const outcomes = await runner.runAttempts('claude', fixture);

      // Should have exactly 3 outcomes with expected pattern
      expect(outcomes).toHaveLength(3);
      expect(outcomes[0]).toBeDefined();
      expect(outcomes[0]?.status).toBe('failure');
      expect(outcomes[1]).toBeDefined();
      expect(outcomes[1]?.status).toBe('success');
      expect(outcomes[2]).toBeDefined();
      expect(outcomes[2]?.status).toBe('failure');

      // Verify attempt numbers
      expect(outcomes[0]).toBeDefined();
      expect(outcomes[0]?.attemptNumber).toBe(1);
      expect(outcomes[1]).toBeDefined();
      expect(outcomes[1]?.attemptNumber).toBe(2);
      expect(outcomes[2]).toBeDefined();
      expect(outcomes[2]?.attemptNumber).toBe(3);

      // Generator called 3 times
      expect(mockGenerator.generateCommitMessage).toHaveBeenCalledTimes(3);

      // Evaluator called once (only for success)
      expect(mockEvaluator.evaluate).toHaveBeenCalledTimes(1);

      // Reporter shows 1 success, 2 failures
      expect(mockReporter.reportAttemptSuccess).toHaveBeenCalledTimes(1);
      expect(mockReporter.reportAttemptFailure).toHaveBeenCalledTimes(2);
    });

    it('should pass correct parameters to generator', async () => {
      // Mock generator to verify parameters
      const mockGenerator = {
        generateCommitMessage: mock(async () => 'feat: add feature'),
      } as unknown as CommitMessageGenerator;

      // Mock evaluator
      const mockEvaluator = {
        evaluate: mock(async () => ({
          metrics: {
            clarity: 8,
            conventionalFormat: 9,
            scope: 7,
            specificity: 8,
          },
          overallScore: 8.0,
        })),
      } as unknown as SingleAttemptEvaluator;

      // Mock reporter
      const mockReporter = {
        reportAttemptFailure: mock(
          (_attemptNumber: number, _failureType: string, _responseTimeMs: number) => {}
        ),
        reportAttemptStart: mock((_attemptNumber: number) => {}),
        reportAttemptSuccess: mock(
          (_attemptNumber: number, _score: number, _responseTimeMs: number) => {}
        ),
      } as unknown as CLIReporter;

      const generatorFactory = () => mockGenerator;

      const runner = new AttemptRunner(mockEvaluator, mockReporter, generatorFactory);

      const fixture = {
        diff: 'diff --git a/src/file.ts...',
        name: 'complex',
        status: 'M  src/file.ts\nA  src/new.ts',
      };

      await runner.runAttempts('codex', fixture);

      // Verify generator was called with correct task and options
      const calls = (mockGenerator.generateCommitMessage as any).mock.calls;
      expect(calls).toHaveLength(3);

      // Each call should have task and options
      for (const call of calls) {
        const [task, options] = call;

        // Task should be derived from fixture
        expect(task).toBeDefined();
        expect(task.title).toContain('complex');
        expect(task.description).toBeDefined();

        // Options should include workdir
        expect(options).toBeDefined();
        expect(options.workdir).toBeDefined();
      }
    });
  });
});
