import { describe, expect, it } from 'bun:test';
import { EvaluationError } from '../errors.js';

describe('EvaluationError', () => {
  describe('metaEvaluationFailed', () => {
    it('creates error with correct message pattern', () => {
      const cause = new Error('API timeout');
      const error = EvaluationError.metaEvaluationFailed('test-fixture', cause);

      expect(error).toBeInstanceOf(EvaluationError);
      expect(error.name).toBe('EvaluationError');
      expect(error.code).toBe('META_EVALUATION_FAILED');
      expect(error.message).toContain('Meta-evaluation failed');
      expect(error.message).toContain('test-fixture');
      expect(error.cause).toBe(cause);
    });

    it('follows what/why/how-to-fix pattern', () => {
      const cause = new Error('Network error');
      const error = EvaluationError.metaEvaluationFailed('complex-fixture', cause);

      // What: Clear statement of the problem
      expect(error.message).toContain('Meta-evaluation failed');

      // Why: Reason or context
      expect(error.message).toContain('complex-fixture');

      // How to fix: Actionable guidance
      expect(error.message.toLowerCase()).toMatch(/check|verify|ensure|review/);
    });
  });

  describe('invalidAttemptCount', () => {
    it('creates error for wrong attempt count', () => {
      const error = EvaluationError.invalidAttemptCount(2, 3);

      expect(error).toBeInstanceOf(EvaluationError);
      expect(error.name).toBe('EvaluationError');
      expect(error.code).toBe('INVALID_ATTEMPT_COUNT');
      expect(error.message).toContain('2');
      expect(error.message).toContain('3');
    });

    it('follows what/why/how-to-fix pattern', () => {
      const error = EvaluationError.invalidAttemptCount(1, 3);

      // What: Clear statement
      expect(error.message).toContain('Invalid attempt count');

      // Why: Expected vs actual
      expect(error.message).toContain('expected');
      expect(error.message).toContain('received');

      // How to fix: Actionable
      expect(error.message.toLowerCase()).toMatch(/ensure|verify|check/);
    });
  });

  describe('missingFixture', () => {
    it('creates error for missing fixture', () => {
      const error = EvaluationError.missingFixture('nonexistent-fixture');

      expect(error).toBeInstanceOf(EvaluationError);
      expect(error.name).toBe('EvaluationError');
      expect(error.code).toBe('MISSING_FIXTURE');
      expect(error.message).toContain('nonexistent-fixture');
    });

    it('follows what/why/how-to-fix pattern', () => {
      const error = EvaluationError.missingFixture('missing-test');

      // What: Clear statement
      expect(error.message).toContain('Fixture not found');

      // Why: Fixture name
      expect(error.message).toContain('missing-test');

      // How to fix: Actionable guidance
      expect(error.message.toLowerCase()).toMatch(/check|verify|ensure/);
      expect(error.message).toContain('fixtures');
    });
  });

  describe('allAttemptsFailed', () => {
    it('creates error when all attempts fail', () => {
      const error = EvaluationError.allAttemptsFailed('test-fixture', 'claude');

      expect(error).toBeInstanceOf(EvaluationError);
      expect(error.name).toBe('EvaluationError');
      expect(error.code).toBe('ALL_ATTEMPTS_FAILED');
      expect(error.message).toContain('test-fixture');
      expect(error.message).toContain('claude');
    });

    it('follows what/why/how-to-fix pattern', () => {
      const error = EvaluationError.allAttemptsFailed('complex', 'codex');

      // What: Clear statement
      expect(error.message).toContain('All 3 attempts failed');

      // Why: Agent and fixture context
      expect(error.message).toContain('codex');
      expect(error.message).toContain('complex');

      // How to fix: Actionable
      expect(error.message.toLowerCase()).toMatch(/check|review|verify/);
    });
  });

  describe('invalidMetrics', () => {
    it('creates error for invalid metrics', () => {
      const error = EvaluationError.invalidMetrics('Score out of range: 15');

      expect(error).toBeInstanceOf(EvaluationError);
      expect(error.name).toBe('EvaluationError');
      expect(error.code).toBe('INVALID_METRICS');
      expect(error.message).toContain('Invalid metrics');
      expect(error.message).toContain('Score out of range: 15');
    });

    it('follows what/why/how-to-fix pattern', () => {
      const error = EvaluationError.invalidMetrics('Negative score');

      // What: Clear statement
      expect(error.message).toContain('Invalid metrics');

      // Why: Specific reason
      expect(error.message).toContain('Negative score');

      // How to fix: Actionable
      expect(error.message.toLowerCase()).toMatch(/ensure|check|verify/);
    });
  });

  describe('error properties', () => {
    it('includes error code for categorization', () => {
      const errors = [
        EvaluationError.metaEvaluationFailed('test', new Error('test')),
        EvaluationError.invalidAttemptCount(1, 3),
        EvaluationError.missingFixture('test'),
        EvaluationError.allAttemptsFailed('test', 'claude'),
        EvaluationError.invalidMetrics('test'),
      ];

      for (const error of errors) {
        expect(error.code).toBeTruthy();
        expect(typeof error.code).toBe('string');
      }
    });

    it('has distinct error codes', () => {
      const codes = [
        EvaluationError.metaEvaluationFailed('test', new Error('test')).code,
        EvaluationError.invalidAttemptCount(1, 3).code,
        EvaluationError.missingFixture('test').code,
        EvaluationError.allAttemptsFailed('test', 'claude').code,
        EvaluationError.invalidMetrics('test').code,
      ];

      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });

    it('preserves cause chain', () => {
      const cause = new Error('Original error');
      const error = EvaluationError.metaEvaluationFailed('test', cause);

      expect(error.cause).toBe(cause);
    });
  });
});
