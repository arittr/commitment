/**
 * Tests for MetaEvaluator
 *
 * Verifies meta-evaluation across 3 attempts:
 * - Evaluates 3/3, 2/3, 1/3, 0/3 success scenarios
 * - Calculates finalScore with failure penalties
 * - Provides reasoning for all cases
 * - Handles consistency and error rate
 */

import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { AttemptOutcome } from '../../core/types.js';
import { MetaEvaluator } from '../meta-evaluator.js';

// Mock ChatGPTAgent
const mockEvaluate = mock();

mock.module('../chatgpt-agent.js', () => ({
  // biome-ignore lint/style/useNamingConvention: Mock needs to match exported class name
  ChatGPTAgent: class MockChatGPTAgent {
    evaluate = mockEvaluate;
  },
}));

describe('MetaEvaluator', () => {
  beforeEach(() => {
    mockEvaluate.mockReset();
  });
  describe('evaluate() - 3/3 success', () => {
    it('should evaluate all 3 successful attempts', async () => {
      const evaluator = new MetaEvaluator();
      const attempts: AttemptOutcome[] = [
        {
          attemptNumber: 1,
          commitMessage: 'feat: add feature',
          metrics: { clarity: 9, conventionalFormat: 10, scope: 7, specificity: 8 },
          overallScore: 8.5,
          responseTimeMs: 1000,
          status: 'success',
        },
        {
          attemptNumber: 2,
          commitMessage: 'feat: add feature',
          metrics: { clarity: 8, conventionalFormat: 10, scope: 7, specificity: 8 },
          overallScore: 8.25,
          responseTimeMs: 1100,
          status: 'success',
        },
        {
          attemptNumber: 3,
          commitMessage: 'feat: add feature',
          metrics: { clarity: 9, conventionalFormat: 10, scope: 8, specificity: 9 },
          overallScore: 9.0,
          responseTimeMs: 1200,
          status: 'success',
        },
      ];

      mockEvaluate.mockResolvedValue({
        bestAttempt: 3,
        consistencyScore: 9.0,
        errorRateImpact: 0,
        finalScore: 8.5,
        reasoning: 'All attempts succeeded with consistent quality',
        successRate: '3/3',
      });

      const result = await evaluator.evaluate(attempts, 'diff', 'fixture');

      expect(result.successRate).toBe('3/3');
      expect(result.errorRateImpact).toBe(0);
      expect(result.bestAttempt).toBe(3);
    });

    it('should have high consistency for similar scores', async () => {
      const evaluator = new MetaEvaluator();
      const attempts: AttemptOutcome[] = [
        {
          attemptNumber: 1,
          commitMessage: 'feat: add',
          metrics: { clarity: 8, conventionalFormat: 9, scope: 8, specificity: 8 },
          overallScore: 8.25,
          responseTimeMs: 1000,
          status: 'success',
        },
        {
          attemptNumber: 2,
          commitMessage: 'feat: add',
          metrics: { clarity: 8, conventionalFormat: 9, scope: 8, specificity: 8 },
          overallScore: 8.25,
          responseTimeMs: 1000,
          status: 'success',
        },
        {
          attemptNumber: 3,
          commitMessage: 'feat: add',
          metrics: { clarity: 8, conventionalFormat: 9, scope: 8, specificity: 8 },
          overallScore: 8.25,
          responseTimeMs: 1000,
          status: 'success',
        },
      ];

      mockEvaluate.mockResolvedValue({
        bestAttempt: 1,
        consistencyScore: 10.0,
        errorRateImpact: 0,
        finalScore: 8.5,
        reasoning: 'Perfect consistency across all attempts',
        successRate: '3/3',
      });

      const result = await evaluator.evaluate(attempts, 'diff', 'fixture');

      expect(result.consistencyScore).toBeGreaterThanOrEqual(9.0);
    });
  });

  describe('evaluate() - 2/3 success', () => {
    it('should penalize failures in finalScore', async () => {
      const evaluator = new MetaEvaluator();
      const attempts: AttemptOutcome[] = [
        {
          attemptNumber: 1,
          commitMessage: 'feat: add',
          metrics: { clarity: 9, conventionalFormat: 10, scope: 8, specificity: 8 },
          overallScore: 8.75,
          responseTimeMs: 1200,
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
          commitMessage: 'feat: add',
          metrics: { clarity: 8, conventionalFormat: 9, scope: 7, specificity: 8 },
          overallScore: 8.0,
          responseTimeMs: 1100,
          status: 'success',
        },
      ];

      mockEvaluate.mockResolvedValue({
        bestAttempt: 1,
        consistencyScore: 8.0,
        errorRateImpact: -1.0,
        finalScore: 7.5, // Lower than average of successes (8.375)
        reasoning: 'One failure penalized the final score',
        successRate: '2/3',
      });

      const result = await evaluator.evaluate(attempts, 'diff', 'fixture');

      expect(result.successRate).toBe('2/3');
      expect(result.errorRateImpact).toBeLessThan(0);
      // Final score should be less than average of successes
      const avgSuccess = (8.75 + 8.0) / 2; // 8.375
      expect(result.finalScore).toBeLessThan(avgSuccess);
    });

    it('should identify best attempt among successes', async () => {
      const evaluator = new MetaEvaluator();
      const attempts: AttemptOutcome[] = [
        {
          attemptNumber: 1,
          commitMessage: 'feat: add',
          metrics: { clarity: 7, conventionalFormat: 8, scope: 7, specificity: 7 },
          overallScore: 7.25,
          responseTimeMs: 1000,
          status: 'success',
        },
        {
          attemptNumber: 2,
          failureReason: 'Failed to remove COT artifacts',
          failureType: 'cleaning',
          responseTimeMs: 100,
          status: 'failure',
        },
        {
          attemptNumber: 3,
          commitMessage: 'feat: add better',
          metrics: { clarity: 9, conventionalFormat: 10, scope: 9, specificity: 9 },
          overallScore: 9.25,
          responseTimeMs: 1300,
          status: 'success',
        },
      ];

      mockEvaluate.mockResolvedValue({
        bestAttempt: 3,
        consistencyScore: 7.0,
        errorRateImpact: -0.75,
        finalScore: 8.0,
        reasoning: 'Attempt 3 was best despite one failure',
        successRate: '2/3',
      });

      const result = await evaluator.evaluate(attempts, 'diff', 'fixture');

      expect(result.bestAttempt).toBe(3);
    });
  });

  describe('evaluate() - 1/3 success', () => {
    it('should heavily penalize 2 failures', async () => {
      const evaluator = new MetaEvaluator();
      const attempts: AttemptOutcome[] = [
        {
          attemptNumber: 1,
          failureReason: 'Agent timeout',
          failureType: 'generation',
          responseTimeMs: 100,
          status: 'failure',
        },
        {
          attemptNumber: 2,
          commitMessage: 'fix: resolve issue',
          metrics: { clarity: 8, conventionalFormat: 9, scope: 7, specificity: 7 },
          overallScore: 7.75,
          responseTimeMs: 1100,
          status: 'success',
        },
        {
          attemptNumber: 3,
          failureReason: 'Invalid format',
          failureType: 'validation',
          responseTimeMs: 100,
          status: 'failure',
        },
      ];

      mockEvaluate.mockResolvedValue({
        bestAttempt: 2,
        consistencyScore: 0,
        errorRateImpact: -2.5,
        finalScore: 5.0, // Much lower than success score (7.75)
        reasoning: 'Two failures significantly reduced reliability',
        successRate: '1/3',
      });

      const result = await evaluator.evaluate(attempts, 'diff', 'fixture');

      expect(result.successRate).toBe('1/3');
      expect(result.errorRateImpact).toBeLessThan(-2.0);
      expect(result.finalScore).toBeLessThan(6.0);
    });

    it('should set consistency to 0 with only 1 success', async () => {
      const evaluator = new MetaEvaluator();
      const attempts: AttemptOutcome[] = [
        {
          attemptNumber: 1,
          failureReason: 'ENOENT',
          failureType: 'api_error',
          responseTimeMs: 100,
          status: 'failure',
        },
        {
          attemptNumber: 2,
          failureReason: 'Timeout',
          failureType: 'generation',
          responseTimeMs: 100,
          status: 'failure',
        },
        {
          attemptNumber: 3,
          commitMessage: 'chore: update',
          metrics: { clarity: 6, conventionalFormat: 7, scope: 6, specificity: 6 },
          overallScore: 6.25,
          responseTimeMs: 1000,
          status: 'success',
        },
      ];

      mockEvaluate.mockResolvedValue({
        bestAttempt: 3,
        consistencyScore: 0,
        errorRateImpact: -3.0,
        finalScore: 3.0,
        reasoning: 'Cannot assess consistency with only 1 success',
        successRate: '1/3',
      });

      const result = await evaluator.evaluate(attempts, 'diff', 'fixture');

      expect(result.consistencyScore).toBe(0);
    });
  });

  describe('evaluate() - 0/3 success', () => {
    it('should provide reasoning even with all failures', async () => {
      const evaluator = new MetaEvaluator();
      const attempts: AttemptOutcome[] = [
        {
          attemptNumber: 1,
          failureReason: 'CLI not found',
          failureType: 'api_error',
          responseTimeMs: 100,
          status: 'failure',
        },
        {
          attemptNumber: 2,
          failureReason: 'CLI not found',
          failureType: 'api_error',
          responseTimeMs: 100,
          status: 'failure',
        },
        {
          attemptNumber: 3,
          failureReason: 'CLI not found',
          failureType: 'api_error',
          responseTimeMs: 100,
          status: 'failure',
        },
      ];

      mockEvaluate.mockResolvedValue({
        bestAttempt: undefined,
        consistencyScore: 0,
        errorRateImpact: -10.0,
        finalScore: 0,
        reasoning: 'All attempts failed due to CLI unavailability',
        successRate: '0/3',
      });

      const result = await evaluator.evaluate(attempts, 'diff', 'fixture');

      expect(result.successRate).toBe('0/3');
      expect(result.finalScore).toBe(0);
      expect(result.bestAttempt).toBeUndefined();
      expect(result.reasoning).toBeTruthy();
      expect(result.reasoning.length).toBeGreaterThan(0);
    });

    it('should set bestAttempt to undefined', async () => {
      const evaluator = new MetaEvaluator();
      const attempts: AttemptOutcome[] = [
        {
          attemptNumber: 1,
          failureReason: 'Bad format',
          failureType: 'validation',
          responseTimeMs: 100,
          status: 'failure',
        },
        {
          attemptNumber: 2,
          failureReason: 'Bad format',
          failureType: 'validation',
          responseTimeMs: 100,
          status: 'failure',
        },
        {
          attemptNumber: 3,
          failureReason: 'Bad format',
          failureType: 'validation',
          responseTimeMs: 100,
          status: 'failure',
        },
      ];

      mockEvaluate.mockResolvedValue({
        bestAttempt: undefined,
        consistencyScore: 0,
        errorRateImpact: -10.0,
        finalScore: 0,
        reasoning: 'Consistent validation failures',
        successRate: '0/3',
      });

      const result = await evaluator.evaluate(attempts, 'diff', 'fixture');

      expect(result.bestAttempt).toBeUndefined();
    });
  });

  describe('validate inputs', () => {
    it('should throw on invalid attempt count', async () => {
      const evaluator = new MetaEvaluator();
      const attempts: AttemptOutcome[] = [
        {
          attemptNumber: 1,
          commitMessage: 'feat: add',
          metrics: { clarity: 8, conventionalFormat: 9, scope: 8, specificity: 8 },
          overallScore: 8.25,
          responseTimeMs: 1000,
          status: 'success',
        },
        // Only 2 attempts - invalid!
        {
          attemptNumber: 2,
          commitMessage: 'feat: add',
          metrics: { clarity: 8, conventionalFormat: 9, scope: 8, specificity: 8 },
          overallScore: 8.25,
          responseTimeMs: 1000,
          status: 'success',
        },
      ];

      await expect(evaluator.evaluate(attempts, 'diff', 'fixture')).rejects.toThrow('3 attempts');
    });

    it('should handle ChatGPT API errors', async () => {
      const evaluator = new MetaEvaluator();
      const attempts: AttemptOutcome[] = [
        {
          attemptNumber: 1,
          commitMessage: 'feat: add',
          metrics: { clarity: 8, conventionalFormat: 9, scope: 8, specificity: 8 },
          overallScore: 8.25,
          responseTimeMs: 1000,
          status: 'success',
        },
        {
          attemptNumber: 2,
          commitMessage: 'feat: add',
          metrics: { clarity: 8, conventionalFormat: 9, scope: 8, specificity: 8 },
          overallScore: 8.25,
          responseTimeMs: 1000,
          status: 'success',
        },
        {
          attemptNumber: 3,
          commitMessage: 'feat: add',
          metrics: { clarity: 8, conventionalFormat: 9, scope: 8, specificity: 8 },
          overallScore: 8.25,
          responseTimeMs: 1000,
          status: 'success',
        },
      ];

      mockEvaluate.mockRejectedValue(new Error('OpenAI API timeout'));

      await expect(evaluator.evaluate(attempts, 'diff', 'fixture')).rejects.toThrow();
    });
  });

  describe('build comprehensive prompt', () => {
    it('should include all attempts in prompt', async () => {
      const evaluator = new MetaEvaluator();
      const attempts: AttemptOutcome[] = [
        {
          attemptNumber: 1,
          commitMessage: 'feat: first',
          metrics: { clarity: 8, conventionalFormat: 9, scope: 7, specificity: 7 },
          overallScore: 7.75,
          responseTimeMs: 1000,
          status: 'success',
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
          commitMessage: 'feat: third',
          metrics: { clarity: 9, conventionalFormat: 10, scope: 8, specificity: 8 },
          overallScore: 8.75,
          responseTimeMs: 1200,
          status: 'success',
        },
      ];

      mockEvaluate.mockResolvedValue({
        bestAttempt: 3,
        consistencyScore: 7.5,
        errorRateImpact: -1.0,
        finalScore: 7.0,
        reasoning: 'Mixed results',
        successRate: '2/3',
      });

      await evaluator.evaluate(attempts, 'diff', 'fixture');

      expect(mockEvaluate).toHaveBeenCalled();
      const call = mockEvaluate.mock.calls[0];
      expect(call).toBeDefined();
      const prompt = call?.[0] as string;

      // Prompt should mention all 3 attempts
      expect(prompt).toContain('Attempt 1');
      expect(prompt).toContain('Attempt 2');
      expect(prompt).toContain('Attempt 3');

      // Should include success details
      expect(prompt).toContain('feat: first');
      expect(prompt).toContain('feat: third');

      // Should include failure details
      expect(prompt).toContain('validation');
      expect(prompt).toContain('Invalid format');
    });
  });
});
