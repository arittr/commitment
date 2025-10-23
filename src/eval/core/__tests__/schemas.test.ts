import { describe, expect, it } from 'bun:test';
import {
  type AttemptOutcome,
  attemptOutcomeSchema,
  evalComparisonSchema,
  evalResultSchema,
  metaEvaluationInputSchema,
  metaEvaluationOutputSchema,
} from '../schemas.js';

describe('attemptOutcomeSchema', () => {
  describe('success outcome', () => {
    it('accepts valid success outcome', () => {
      const outcome = {
        attemptNumber: 1,
        commitMessage: 'feat: add new feature',
        metrics: {
          clarity: 9,
          conventionalFormat: 10,
          scope: 7,
          specificity: 8,
        },
        overallScore: 8.5,
        responseTimeMs: 1000,
        status: 'success' as const,
      };

      const result = attemptOutcomeSchema.parse(outcome);
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.commitMessage).toBe('feat: add new feature');
        expect(result.metrics.clarity).toBe(9);
        expect(result.overallScore).toBe(8.5);
      }
      expect(result.attemptNumber).toBe(1);
    });

    it('accepts all three attempt numbers', () => {
      for (const attemptNumber of [1, 2, 3]) {
        const outcome = {
          attemptNumber,
          commitMessage: 'fix: test',
          metrics: {
            clarity: 8,
            conventionalFormat: 9,
            scope: 6,
            specificity: 7,
          },
          overallScore: 7.5,
          responseTimeMs: 1000,
          status: 'success' as const,
        };

        const result = attemptOutcomeSchema.parse(outcome);
        expect(result.attemptNumber).toBe(attemptNumber);
      }
    });

    it('validates metric scores are between 0 and 10', () => {
      const outcome = {
        attemptNumber: 1,
        commitMessage: 'fix: test',
        metrics: {
          clarity: 11, // Invalid: > 10
          conventionalFormat: 9,
          scope: 6,
          specificity: 7,
        },
        overallScore: 7.5,
        responseTimeMs: 1000,
        status: 'success' as const,
      };

      expect(() => attemptOutcomeSchema.parse(outcome)).toThrow();
    });

    it('validates overall score is between 0 and 10', () => {
      const outcome = {
        attemptNumber: 1,
        commitMessage: 'fix: test',
        metrics: {
          clarity: 8,
          conventionalFormat: 9,
          scope: 6,
          specificity: 7,
        },
        overallScore: 11, // Invalid: > 10
        responseTimeMs: 1000,
        status: 'success' as const,
      };

      expect(() => attemptOutcomeSchema.parse(outcome)).toThrow();
    });

    it('rejects invalid attempt numbers', () => {
      const outcome = {
        attemptNumber: 0, // Invalid: must be 1, 2, or 3
        commitMessage: 'fix: test',
        metrics: {
          clarity: 8,
          conventionalFormat: 9,
          scope: 6,
          specificity: 7,
        },
        overallScore: 7.5,
        responseTimeMs: 1000,
        status: 'success' as const,
      };

      expect(() => attemptOutcomeSchema.parse(outcome)).toThrow();
    });
  });

  describe('failure outcome', () => {
    it('accepts valid failure outcome', () => {
      const outcome = {
        attemptNumber: 2,
        failureReason: 'Commit message does not follow conventional format',
        failureType: 'validation' as const,
        responseTimeMs: 100,
        status: 'failure' as const,
      };

      const result = attemptOutcomeSchema.parse(outcome);
      expect(result.status).toBe('failure');
      if (result.status === 'failure') {
        expect(result.failureType).toBe('validation');
        expect(result.failureReason).toBe('Commit message does not follow conventional format');
      }
      expect(result.attemptNumber).toBe(2);
    });

    it('accepts all failure types', () => {
      const failureTypes = ['cleaning', 'validation', 'generation', 'api_error'] as const;

      for (const failureType of failureTypes) {
        const outcome = {
          attemptNumber: 1,
          failureReason: `Test ${failureType} error`,
          failureType,
          responseTimeMs: 100,
          status: 'failure' as const,
        };

        const result = attemptOutcomeSchema.parse(outcome);
        if (result.status === 'failure') {
          expect(result.failureType).toBe(failureType);
        }
      }
    });

    it('rejects empty failure reason', () => {
      const outcome = {
        attemptNumber: 1,
        failureReason: '', // Invalid: empty
        failureType: 'validation' as const,
        responseTimeMs: 100,
        status: 'failure' as const,
      };

      expect(() => attemptOutcomeSchema.parse(outcome)).toThrow();
    });
  });

  describe('discriminated union', () => {
    it('narrows type based on status field', () => {
      const outcome: AttemptOutcome = {
        attemptNumber: 1,
        commitMessage: 'feat: test',
        metrics: {
          clarity: 8,
          conventionalFormat: 9,
          scope: 6,
          specificity: 7,
        },
        overallScore: 7.5,
        responseTimeMs: 1000,
        status: 'success',
      };

      if (outcome.status === 'success') {
        // TypeScript should know these fields exist
        expect(outcome.commitMessage).toBeDefined();
        expect(outcome.metrics).toBeDefined();
        expect(outcome.overallScore).toBeDefined();
      }
    });
  });
});

describe('evalResultSchema', () => {
  it('accepts valid eval result with 3 attempts', () => {
    const result = {
      attempts: [
        {
          attemptNumber: 1,
          commitMessage: 'feat: test 1',
          metrics: { clarity: 8, conventionalFormat: 9, scope: 6, specificity: 7 },
          overallScore: 7.5,
          responseTimeMs: 1000,
          status: 'success' as const,
        },
        {
          attemptNumber: 2,
          failureReason: 'Invalid format',
          failureType: 'validation' as const,
          responseTimeMs: 100,
          status: 'failure' as const,
        },
        {
          attemptNumber: 3,
          commitMessage: 'feat: test 3',
          metrics: { clarity: 9, conventionalFormat: 10, scope: 7, specificity: 8 },
          overallScore: 8.5,
          responseTimeMs: 1200,
          status: 'success' as const,
        },
      ],
      bestAttempt: 3,
      consistencyScore: 7.5,
      errorRateImpact: -0.5,
      finalScore: 8.0,
      reasoning: 'Two successful attempts with one validation failure',
      successRate: '2/3',
    };

    const parsed = evalResultSchema.parse(result);
    expect(parsed.attempts).toHaveLength(3);
    expect(parsed.finalScore).toBe(8.0);
    expect(parsed.successRate).toBe('2/3');
    expect(parsed.bestAttempt).toBe(3);
  });

  it('rejects result with wrong number of attempts', () => {
    const result = {
      attempts: [
        {
          attemptNumber: 1,
          commitMessage: 'feat: test',
          metrics: { clarity: 8, conventionalFormat: 9, scope: 6, specificity: 7 },
          overallScore: 7.5,
          responseTimeMs: 1000,
          status: 'success' as const,
        },
      ], // Only 1 attempt, should be 3
      bestAttempt: 1,
      consistencyScore: 0,
      errorRateImpact: 0,
      finalScore: 7.5,
      reasoning: 'Only one attempt',
      successRate: '1/3',
    };

    expect(() => evalResultSchema.parse(result)).toThrow();
  });

  it('accepts valid success rates', () => {
    const validRates = ['0/3', '1/3', '2/3', '3/3'] as const;

    for (const successRate of validRates) {
      const result = {
        attempts: [
          {
            attemptNumber: 1,
            commitMessage: 'feat: test',
            metrics: { clarity: 8, conventionalFormat: 9, scope: 6, specificity: 7 },
            overallScore: 7.5,
            responseTimeMs: 1000,
            status: 'success' as const,
          },
          {
            attemptNumber: 2,
            commitMessage: 'feat: test',
            metrics: { clarity: 8, conventionalFormat: 9, scope: 6, specificity: 7 },
            overallScore: 7.5,
            responseTimeMs: 1000,
            status: 'success' as const,
          },
          {
            attemptNumber: 3,
            commitMessage: 'feat: test',
            metrics: { clarity: 8, conventionalFormat: 9, scope: 6, specificity: 7 },
            overallScore: 7.5,
            responseTimeMs: 1000,
            status: 'success' as const,
          },
        ],
        bestAttempt: 1,
        consistencyScore: 8.0,
        errorRateImpact: 0,
        finalScore: 7.5,
        reasoning: 'Test',
        successRate,
      };

      const parsed = evalResultSchema.parse(result);
      expect(parsed.successRate).toBe(successRate);
    }
  });

  it('rejects invalid success rate format', () => {
    const result = {
      attempts: [
        {
          attemptNumber: 1,
          commitMessage: 'feat: test',
          metrics: { clarity: 8, conventionalFormat: 9, scope: 6, specificity: 7 },
          overallScore: 7.5,
          responseTimeMs: 1000,
          status: 'success' as const,
        },
        {
          attemptNumber: 2,
          commitMessage: 'feat: test',
          metrics: { clarity: 8, conventionalFormat: 9, scope: 6, specificity: 7 },
          overallScore: 7.5,
          responseTimeMs: 1000,
          status: 'success' as const,
        },
        {
          attemptNumber: 3,
          commitMessage: 'feat: test',
          metrics: { clarity: 8, conventionalFormat: 9, scope: 6, specificity: 7 },
          overallScore: 7.5,
          responseTimeMs: 1000,
          status: 'success' as const,
        },
      ],
      bestAttempt: 1,
      consistencyScore: 8.0,
      errorRateImpact: 0,
      finalScore: 7.5,
      reasoning: 'Test',
      successRate: '2 out of 3', // Invalid format
    };

    expect(() => evalResultSchema.parse(result)).toThrow();
  });

  it('accepts undefined bestAttempt when all attempts failed', () => {
    const result = {
      attempts: [
        {
          attemptNumber: 1,
          failureReason: 'Test',
          failureType: 'validation' as const,
          responseTimeMs: 100,
          status: 'failure' as const,
        },
        {
          attemptNumber: 2,
          failureReason: 'Test',
          failureType: 'validation' as const,
          responseTimeMs: 100,
          status: 'failure' as const,
        },
        {
          attemptNumber: 3,
          failureReason: 'Test',
          failureType: 'validation' as const,
          responseTimeMs: 100,
          status: 'failure' as const,
        },
      ],
      bestAttempt: undefined,
      consistencyScore: 0,
      errorRateImpact: -10,
      finalScore: 0,
      reasoning: 'All attempts failed',
      successRate: '0/3',
    };

    const parsed = evalResultSchema.parse(result);
    expect(parsed.bestAttempt).toBeUndefined();
  });
});

describe('metaEvaluationInputSchema', () => {
  it('accepts valid meta evaluation input', () => {
    const input = {
      attempts: [
        {
          attemptNumber: 1,
          commitMessage: 'feat: test',
          metrics: { clarity: 8, conventionalFormat: 9, scope: 6, specificity: 7 },
          overallScore: 7.5,
          responseTimeMs: 1000,
          status: 'success' as const,
        },
        {
          attemptNumber: 2,
          failureReason: 'Invalid',
          failureType: 'validation' as const,
          responseTimeMs: 100,
          status: 'failure' as const,
        },
        {
          attemptNumber: 3,
          commitMessage: 'feat: test',
          metrics: { clarity: 9, conventionalFormat: 10, scope: 7, specificity: 8 },
          overallScore: 8.5,
          responseTimeMs: 1200,
          status: 'success' as const,
        },
      ],
      fixtureName: 'test-fixture',
      gitDiff: 'diff --git a/file.ts b/file.ts\n+new line',
    };

    const parsed = metaEvaluationInputSchema.parse(input);
    expect(parsed.attempts).toHaveLength(3);
    expect(parsed.gitDiff).toContain('diff --git');
    expect(parsed.fixtureName).toBe('test-fixture');
  });
});

describe('metaEvaluationOutputSchema', () => {
  it('accepts valid meta evaluation output', () => {
    const output = {
      bestAttempt: 3,
      consistencyScore: 7.5,
      errorRateImpact: -0.5,
      finalScore: 8.0,
      reasoning: 'Good consistency despite one failure',
      successRate: '2/3',
    };

    const parsed = metaEvaluationOutputSchema.parse(output);
    expect(parsed.finalScore).toBe(8.0);
    expect(parsed.consistencyScore).toBe(7.5);
    expect(parsed.errorRateImpact).toBe(-0.5);
    expect(parsed.successRate).toBe('2/3');
    expect(parsed.bestAttempt).toBe(3);
  });

  it('validates scores are within bounds', () => {
    const output = {
      bestAttempt: 1,
      consistencyScore: 7.5,
      errorRateImpact: -0.5,
      finalScore: 11, // Invalid: > 10
      reasoning: 'Test',
      successRate: '2/3',
    };

    expect(() => metaEvaluationOutputSchema.parse(output)).toThrow();
  });
});

describe('evalComparisonSchema', () => {
  it('accepts valid comparison with both agents', () => {
    const comparison = {
      claudeResult: {
        attempts: [
          {
            attemptNumber: 1,
            commitMessage: 'feat: test',
            metrics: { clarity: 8, conventionalFormat: 9, scope: 6, specificity: 7 },
            overallScore: 7.5,
            responseTimeMs: 1000,
            status: 'success' as const,
          },
          {
            attemptNumber: 2,
            commitMessage: 'feat: test',
            metrics: { clarity: 8, conventionalFormat: 9, scope: 6, specificity: 7 },
            overallScore: 7.5,
            responseTimeMs: 1000,
            status: 'success' as const,
          },
          {
            attemptNumber: 3,
            commitMessage: 'feat: test',
            metrics: { clarity: 8, conventionalFormat: 9, scope: 6, specificity: 7 },
            overallScore: 7.5,
            responseTimeMs: 1000,
            status: 'success' as const,
          },
        ],
        bestAttempt: 1,
        consistencyScore: 7.5,
        errorRateImpact: 0,
        finalScore: 8.0,
        reasoning: 'Claude reasoning',
        successRate: '3/3',
      },
      codexResult: {
        attempts: [
          {
            attemptNumber: 1,
            commitMessage: 'feat: test',
            metrics: { clarity: 7, conventionalFormat: 8, scope: 5, specificity: 6 },
            overallScore: 6.5,
            responseTimeMs: 1000,
            status: 'success' as const,
          },
          {
            attemptNumber: 2,
            commitMessage: 'feat: test',
            metrics: { clarity: 7, conventionalFormat: 8, scope: 5, specificity: 6 },
            overallScore: 6.5,
            responseTimeMs: 1000,
            status: 'success' as const,
          },
          {
            attemptNumber: 3,
            commitMessage: 'feat: test',
            metrics: { clarity: 7, conventionalFormat: 8, scope: 5, specificity: 6 },
            overallScore: 6.5,
            responseTimeMs: 1000,
            status: 'success' as const,
          },
        ],
        bestAttempt: 1,
        consistencyScore: 6.5,
        errorRateImpact: 0,
        finalScore: 7.0,
        reasoning: 'Codex reasoning',
        successRate: '3/3',
      },
      fixture: 'test-fixture',
      winner: 'claude' as const,
    };

    const parsed = evalComparisonSchema.parse(comparison);
    expect(parsed.fixture).toBe('test-fixture');
    expect(parsed.winner).toBe('claude');
    expect(parsed.claudeResult).toBeDefined();
    expect(parsed.codexResult).toBeDefined();
  });

  it('accepts tie winner', () => {
    const comparison = {
      claudeResult: {
        attempts: [
          {
            attemptNumber: 1,
            commitMessage: 'feat: test',
            metrics: { clarity: 8, conventionalFormat: 9, scope: 6, specificity: 7 },
            overallScore: 7.5,
            responseTimeMs: 1000,
            status: 'success' as const,
          },
          {
            attemptNumber: 2,
            commitMessage: 'feat: test',
            metrics: { clarity: 8, conventionalFormat: 9, scope: 6, specificity: 7 },
            overallScore: 7.5,
            responseTimeMs: 1000,
            status: 'success' as const,
          },
          {
            attemptNumber: 3,
            commitMessage: 'feat: test',
            metrics: { clarity: 8, conventionalFormat: 9, scope: 6, specificity: 7 },
            overallScore: 7.5,
            responseTimeMs: 1000,
            status: 'success' as const,
          },
        ],
        bestAttempt: 1,
        consistencyScore: 7.5,
        errorRateImpact: 0,
        finalScore: 8.0,
        reasoning: 'Claude reasoning',
        successRate: '3/3',
      },
      codexResult: {
        attempts: [
          {
            attemptNumber: 1,
            commitMessage: 'feat: test',
            metrics: { clarity: 8, conventionalFormat: 9, scope: 6, specificity: 7 },
            overallScore: 7.5,
            responseTimeMs: 1000,
            status: 'success' as const,
          },
          {
            attemptNumber: 2,
            commitMessage: 'feat: test',
            metrics: { clarity: 8, conventionalFormat: 9, scope: 6, specificity: 7 },
            overallScore: 7.5,
            responseTimeMs: 1000,
            status: 'success' as const,
          },
          {
            attemptNumber: 3,
            commitMessage: 'feat: test',
            metrics: { clarity: 8, conventionalFormat: 9, scope: 6, specificity: 7 },
            overallScore: 7.5,
            responseTimeMs: 1000,
            status: 'success' as const,
          },
        ],
        bestAttempt: 1,
        consistencyScore: 7.5,
        errorRateImpact: 0,
        finalScore: 8.0,
        reasoning: 'Codex reasoning',
        successRate: '3/3',
      },
      fixture: 'test-fixture',
      winner: 'tie' as const,
    };

    const parsed = evalComparisonSchema.parse(comparison);
    expect(parsed.winner).toBe('tie');
  });
});
