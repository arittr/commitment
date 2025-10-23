/**
 * Tests for best attempt selection utility
 *
 * Tests selection logic for finding highest-scoring successful attempt.
 */

import { describe, expect, it } from 'bun:test';

import type { AttemptOutcome } from '../../core/types.js';
import { getBestAttempt } from '../best-attempt.js';

describe('getBestAttempt', () => {
  describe('successful attempts', () => {
    it('should return the highest-scoring success', () => {
      const attempts: AttemptOutcome[] = [
        {
          attemptNumber: 1,
          commitMessage: 'feat: add feature',
          metrics: { clarity: 8, conventionalFormat: 9, scope: 8, specificity: 7 },
          overallScore: 8.0,
          responseTimeMs: 1000,
          status: 'success',
        },
        {
          attemptNumber: 2,
          commitMessage: 'feat: add better feature',
          metrics: { clarity: 9, conventionalFormat: 10, scope: 9, specificity: 9 },
          overallScore: 9.25,
          responseTimeMs: 1200,
          status: 'success',
        },
        {
          attemptNumber: 3,
          commitMessage: 'feat: add good feature',
          metrics: { clarity: 8, conventionalFormat: 9, scope: 8, specificity: 8 },
          overallScore: 8.25,
          responseTimeMs: 1100,
          status: 'success',
        },
      ];

      const best = getBestAttempt(attempts);
      expect(best).toBeDefined();
      expect(best?.attemptNumber).toBe(2);
      expect(best?.overallScore).toBe(9.25);
    });

    it('should return first attempt if all scores are equal', () => {
      const attempts: AttemptOutcome[] = [
        {
          attemptNumber: 1,
          commitMessage: 'feat: add feature 1',
          metrics: { clarity: 8, conventionalFormat: 8, scope: 8, specificity: 8 },
          overallScore: 8.0,
          responseTimeMs: 1000,
          status: 'success',
        },
        {
          attemptNumber: 2,
          commitMessage: 'feat: add feature 2',
          metrics: { clarity: 8, conventionalFormat: 8, scope: 8, specificity: 8 },
          overallScore: 8.0,
          responseTimeMs: 1000,
          status: 'success',
        },
        {
          attemptNumber: 3,
          commitMessage: 'feat: add feature 3',
          metrics: { clarity: 8, conventionalFormat: 8, scope: 8, specificity: 8 },
          overallScore: 8.0,
          responseTimeMs: 1000,
          status: 'success',
        },
      ];

      const best = getBestAttempt(attempts);
      expect(best).toBeDefined();
      expect(best?.attemptNumber).toBe(1);
    });

    it('should handle single successful attempt', () => {
      const attempts: AttemptOutcome[] = [
        {
          attemptNumber: 1,
          commitMessage: 'feat: add feature',
          metrics: { clarity: 8, conventionalFormat: 9, scope: 8, specificity: 7 },
          overallScore: 8.0,
          responseTimeMs: 1000,
          status: 'success',
        },
      ];

      const best = getBestAttempt(attempts);
      expect(best).toBeDefined();
      expect(best?.attemptNumber).toBe(1);
      expect(best?.overallScore).toBe(8.0);
    });

    it('should work with decimal scores', () => {
      const attempts: AttemptOutcome[] = [
        {
          attemptNumber: 1,
          commitMessage: 'feat: add feature',
          metrics: { clarity: 8.5, conventionalFormat: 9.5, scope: 8.5, specificity: 7.5 },
          overallScore: 8.5,
          responseTimeMs: 1000,
          status: 'success',
        },
        {
          attemptNumber: 2,
          commitMessage: 'feat: add better feature',
          metrics: { clarity: 9.2, conventionalFormat: 9.8, scope: 9.3, specificity: 9.1 },
          overallScore: 9.35,
          responseTimeMs: 1200,
          status: 'success',
        },
      ];

      const best = getBestAttempt(attempts);
      expect(best).toBeDefined();
      expect(best?.attemptNumber).toBe(2);
      expect(best?.overallScore).toBeCloseTo(9.35, 2);
    });
  });

  describe('mixed success and failure', () => {
    it('should ignore failures and return best success', () => {
      const attempts: AttemptOutcome[] = [
        {
          attemptNumber: 1,
          failureReason: 'Invalid format',
          failureType: 'validation',
          responseTimeMs: 100,
          status: 'failure',
        },
        {
          attemptNumber: 2,
          commitMessage: 'feat: add feature',
          metrics: { clarity: 8, conventionalFormat: 9, scope: 8, specificity: 7 },
          overallScore: 8.0,
          responseTimeMs: 1000,
          status: 'success',
        },
        {
          attemptNumber: 3,
          failureReason: 'Failed to clean',
          failureType: 'cleaning',
          responseTimeMs: 100,
          status: 'failure',
        },
      ];

      const best = getBestAttempt(attempts);
      expect(best).toBeDefined();
      expect(best?.status).toBe('success');
      expect(best?.attemptNumber).toBe(2);
    });

    it('should select highest score even with multiple failures', () => {
      const attempts: AttemptOutcome[] = [
        {
          attemptNumber: 1,
          commitMessage: 'feat: add feature 1',
          metrics: { clarity: 6, conventionalFormat: 7, scope: 6, specificity: 6 },
          overallScore: 6.25,
          responseTimeMs: 900,
          status: 'success',
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
          commitMessage: 'feat: add feature 3',
          metrics: { clarity: 9, conventionalFormat: 10, scope: 9, specificity: 9 },
          overallScore: 9.25,
          responseTimeMs: 1200,
          status: 'success',
        },
      ];

      const best = getBestAttempt(attempts);
      expect(best).toBeDefined();
      expect(best?.attemptNumber).toBe(3);
      expect(best?.overallScore).toBe(9.25);
    });
  });

  describe('all failures', () => {
    it('should return undefined if all attempts failed', () => {
      const attempts: AttemptOutcome[] = [
        {
          attemptNumber: 1,
          failureReason: 'Invalid format',
          failureType: 'validation',
          responseTimeMs: 100,
          status: 'failure',
        },
        {
          attemptNumber: 2,
          failureReason: 'Failed to clean',
          failureType: 'cleaning',
          responseTimeMs: 100,
          status: 'failure',
        },
        {
          attemptNumber: 3,
          failureReason: 'ENOENT',
          failureType: 'api_error',
          responseTimeMs: 100,
          status: 'failure',
        },
      ];

      const best = getBestAttempt(attempts);
      expect(best).toBeUndefined();
    });

    it('should return undefined for single failure', () => {
      const attempts: AttemptOutcome[] = [
        {
          attemptNumber: 1,
          failureReason: 'Agent failed',
          failureType: 'generation',
          responseTimeMs: 100,
          status: 'failure',
        },
      ];

      const best = getBestAttempt(attempts);
      expect(best).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should return undefined for empty array', () => {
      const attempts: AttemptOutcome[] = [];

      const best = getBestAttempt(attempts);
      expect(best).toBeUndefined();
    });

    it('should handle attempts with score of 0', () => {
      const attempts: AttemptOutcome[] = [
        {
          attemptNumber: 1,
          commitMessage: 'poor message',
          metrics: { clarity: 0, conventionalFormat: 0, scope: 0, specificity: 0 },
          overallScore: 0,
          responseTimeMs: 800,
          status: 'success',
        },
        {
          attemptNumber: 2,
          commitMessage: 'good message',
          metrics: { clarity: 5, conventionalFormat: 5, scope: 5, specificity: 5 },
          overallScore: 5.0,
          responseTimeMs: 1000,
          status: 'success',
        },
      ];

      const best = getBestAttempt(attempts);
      expect(best).toBeDefined();
      expect(best?.attemptNumber).toBe(2);
      expect(best?.overallScore).toBe(5.0);
    });

    it('should handle attempts with maximum score of 10', () => {
      const attempts: AttemptOutcome[] = [
        {
          attemptNumber: 1,
          commitMessage: 'perfect message',
          metrics: { clarity: 10, conventionalFormat: 10, scope: 10, specificity: 10 },
          overallScore: 10.0,
          responseTimeMs: 1300,
          status: 'success',
        },
        {
          attemptNumber: 2,
          commitMessage: 'good message',
          metrics: { clarity: 9, conventionalFormat: 9, scope: 9, specificity: 9 },
          overallScore: 9.0,
          responseTimeMs: 1100,
          status: 'success',
        },
      ];

      const best = getBestAttempt(attempts);
      expect(best).toBeDefined();
      expect(best?.attemptNumber).toBe(1);
      expect(best?.overallScore).toBe(10.0);
    });

    it('should handle out-of-order attempt numbers', () => {
      const attempts: AttemptOutcome[] = [
        {
          attemptNumber: 3,
          commitMessage: 'feat: third',
          metrics: { clarity: 7, conventionalFormat: 7, scope: 7, specificity: 7 },
          overallScore: 7.0,
          responseTimeMs: 950,
          status: 'success',
        },
        {
          attemptNumber: 1,
          commitMessage: 'feat: first',
          metrics: { clarity: 9, conventionalFormat: 9, scope: 9, specificity: 9 },
          overallScore: 9.0,
          responseTimeMs: 1100,
          status: 'success',
        },
        {
          attemptNumber: 2,
          commitMessage: 'feat: second',
          metrics: { clarity: 8, conventionalFormat: 8, scope: 8, specificity: 8 },
          overallScore: 8.0,
          responseTimeMs: 1000,
          status: 'success',
        },
      ];

      const best = getBestAttempt(attempts);
      expect(best).toBeDefined();
      expect(best?.attemptNumber).toBe(1);
      expect(best?.overallScore).toBe(9.0);
    });
  });

  describe('type narrowing', () => {
    it('should return success outcome type', () => {
      const attempts: AttemptOutcome[] = [
        {
          attemptNumber: 1,
          commitMessage: 'feat: add feature',
          metrics: { clarity: 8, conventionalFormat: 9, scope: 8, specificity: 7 },
          overallScore: 8.0,
          responseTimeMs: 1000,
          status: 'success',
        },
      ];

      const best = getBestAttempt(attempts);
      if (best) {
        // TypeScript should narrow this to success outcome
        expect(best.status).toBe('success');
        expect('commitMessage' in best).toBe(true);
        expect('overallScore' in best).toBe(true);
        expect('metrics' in best).toBe(true);
      }
    });
  });

  describe('pure function characteristics', () => {
    it('should not mutate input array', () => {
      const attempts: AttemptOutcome[] = [
        {
          attemptNumber: 1,
          commitMessage: 'feat: add feature 1',
          metrics: { clarity: 8, conventionalFormat: 9, scope: 8, specificity: 7 },
          overallScore: 8.0,
          responseTimeMs: 1000,
          status: 'success',
        },
        {
          attemptNumber: 2,
          commitMessage: 'feat: add feature 2',
          metrics: { clarity: 9, conventionalFormat: 10, scope: 9, specificity: 9 },
          overallScore: 9.25,
          responseTimeMs: 1200,
          status: 'success',
        },
      ];

      const originalLength = attempts.length;
      const originalFirst = attempts[0];

      getBestAttempt(attempts);

      // Array should be unchanged
      expect(attempts.length).toBe(originalLength);
      expect(attempts[0]).toBe(originalFirst);
    });

    it('should return same result for same input (deterministic)', () => {
      const attempts: AttemptOutcome[] = [
        {
          attemptNumber: 1,
          commitMessage: 'feat: add feature 1',
          metrics: { clarity: 8, conventionalFormat: 9, scope: 8, specificity: 7 },
          overallScore: 8.0,
          responseTimeMs: 1000,
          status: 'success',
        },
        {
          attemptNumber: 2,
          commitMessage: 'feat: add feature 2',
          metrics: { clarity: 9, conventionalFormat: 10, scope: 9, specificity: 9 },
          overallScore: 9.25,
          responseTimeMs: 1200,
          status: 'success',
        },
      ];

      const result1 = getBestAttempt(attempts);
      const result2 = getBestAttempt(attempts);

      expect(result1).toEqual(result2);
    });
  });
});
