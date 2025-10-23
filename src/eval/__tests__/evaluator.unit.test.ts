import { beforeEach, describe, expect, it, mock } from 'bun:test';

/**
 * Unit tests for Evaluator module
 *
 * Tests the orchestration of evaluation using dependency injection.
 *
 * NOTE: These tests verify the public API by injecting a mock agent.
 */

import { EvaluationError } from '../../errors';
import { Evaluator } from '../evaluator';
import type { EvalMetrics } from '../schemas';

describe('Evaluator', () => {
  let evaluator: Evaluator;
  let mockEvaluate: ReturnType<typeof mock>;

  beforeEach(() => {
    // Create a mock evaluate function
    mockEvaluate = mock(async () => ({
      feedback: '',
      metrics: { accuracy: 0, clarity: 0, conventionalCompliance: 0, detailLevel: 0 },
    }));

    // Create mock agent with evaluate method
    const mockAgent = {
      name: 'chatgpt',
      evaluate: mockEvaluate,
    } as any;

    // Inject mock agent via constructor
    evaluator = new Evaluator(mockAgent);
  });

  describe('evaluate', () => {
    it('should evaluate commit message and return complete result', async () => {
      // Arrange
      const commitMessage = 'fix: add null safety check to parser';
      const gitStatus = 'M  src/utils/parser.ts';
      const gitDiff = 'diff --git a/src/utils/parser.ts...';
      const fixtureName = 'simple-bugfix';
      const agentName = 'claude';

      const mockMetrics: EvalMetrics = {
        accuracy: 9,
        clarity: 8,
        conventionalCompliance: 9,
        detailLevel: 7,
      };

      const mockFeedback = 'Good conventional commit format. Clear description.';

      // Configure mock to return specific response
      mockEvaluate.mockResolvedValue({
        feedback: mockFeedback,
        metrics: mockMetrics,
      });

      // Act
      const result = await evaluator.evaluate(
        commitMessage,
        gitStatus,
        gitDiff,
        fixtureName,
        agentName,
      );

      // Assert - verify the evaluator produces correct output
      expect(result.commitMessage).toBe(commitMessage);
      expect(result.fixture).toBe(fixtureName);
      expect(result.agent).toBe(agentName);
      expect(result.metrics).toEqual(mockMetrics);
      expect(result.feedback).toBe(mockFeedback);
      expect(result.overallScore).toBe(8.25); // (9 + 8 + 9 + 7) / 4
      expect(result.timestamp).toBeTruthy();
    });

    it('should include valid timestamp in ISO format', async () => {
      // Arrange
      mockEvaluate.mockResolvedValue({
        feedback: 'Good',
        metrics: { accuracy: 8, clarity: 8, conventionalCompliance: 8, detailLevel: 8 },
      });

      // Act
      const result = await evaluator.evaluate('fix: test', 'M  file.ts', 'diff...', 'test', 'claude');

      // Assert - verify timestamp
      expect(result.timestamp).toBeTruthy();
      expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
    });

    it('should calculate overall score correctly as average of 4 metrics', async () => {
      // Arrange
      mockEvaluate.mockResolvedValue({
        feedback: 'Good',
        metrics: { accuracy: 9, clarity: 8, conventionalCompliance: 10, detailLevel: 7 },
      });

      // Act
      const result = await evaluator.evaluate('fix: test', 'M  file.ts', 'diff...', 'test', 'claude');

      // Assert - overall score should be (9 + 8 + 10 + 7) / 4 = 8.5
      expect(result.overallScore).toBe(8.5);
    });

    it('should handle perfect scores correctly', async () => {
      // Arrange
      mockEvaluate.mockResolvedValue({
        feedback: 'Perfect',
        metrics: { accuracy: 10, clarity: 10, conventionalCompliance: 10, detailLevel: 10 },
      });

      // Act
      const result = await evaluator.evaluate('feat: perfect', 'A  file.ts', 'diff...', 'test', 'codex');

      // Assert
      expect(result.overallScore).toBe(10);
    });

    it('should handle minimum scores correctly', async () => {
      // Arrange
      mockEvaluate.mockResolvedValue({
        feedback: 'Poor',
        metrics: { accuracy: 0, clarity: 0, conventionalCompliance: 0, detailLevel: 0 },
      });

      // Act
      const result = await evaluator.evaluate('bad', 'M  file.txt', 'diff...', 'test', 'claude');

      // Assert
      expect(result.overallScore).toBe(0);
    });

    it('should propagate EvaluationError from agent', async () => {
      // Arrange
      const mockError = EvaluationError.apiKeyMissing('OpenAI');
      mockEvaluate.mockRejectedValue(mockError);

      // Act & Assert
      await expect(
        evaluator.evaluate('fix: test', 'M  file.ts', 'diff...', 'test', 'claude'),
      ).rejects.toThrow(EvaluationError);

      await expect(
        evaluator.evaluate('fix: test', 'M  file.ts', 'diff...', 'test', 'claude'),
      ).rejects.toThrow('OpenAI API key is not configured');
    });

    it('should propagate evaluation failed error from agent', async () => {
      // Arrange
      const mockError = EvaluationError.evaluationFailed('API rate limit exceeded');
      mockEvaluate.mockRejectedValue(mockError);

      // Act & Assert
      await expect(
        evaluator.evaluate('fix: test', 'M  file.ts', 'diff...', 'test', 'codex'),
      ).rejects.toThrow(EvaluationError);

      await expect(
        evaluator.evaluate('fix: test', 'M  file.ts', 'diff...', 'test', 'codex'),
      ).rejects.toThrow('API rate limit exceeded');
    });

    it('should work with codex agent name', async () => {
      // Arrange
      mockEvaluate.mockResolvedValue({
        feedback: 'Well structured',
        metrics: { accuracy: 8, clarity: 9, conventionalCompliance: 9, detailLevel: 8 },
      });

      // Act
      const result = await evaluator.evaluate('feat: add feature', 'A  file.ts', 'diff...', 'test', 'codex');

      // Assert
      expect(result.agent).toBe('codex');
      expect(result.overallScore).toBe(8.5); // (8 + 9 + 9 + 8) / 4
    });

    it('should include all metrics in result', async () => {
      // Arrange
      mockEvaluate.mockResolvedValue({
        feedback: 'Test feedback',
        metrics: { accuracy: 7, clarity: 6, conventionalCompliance: 8, detailLevel: 9 },
      });

      // Act
      const result = await evaluator.evaluate('test: commit', 'M  test.ts', 'diff...', 'test', 'claude');

      // Assert - verify all individual metrics are present
      expect(result.metrics.conventionalCompliance).toBe(8);
      expect(result.metrics.clarity).toBe(6);
      expect(result.metrics.accuracy).toBe(7);
      expect(result.metrics.detailLevel).toBe(9);
    });

    it('should handle floating point scores correctly', async () => {
      // Arrange
      mockEvaluate.mockResolvedValue({
        feedback: 'Good',
        metrics: { accuracy: 8.5, clarity: 7.5, conventionalCompliance: 9, detailLevel: 8 },
      });

      // Act
      const result = await evaluator.evaluate('fix: update', 'M  file.ts', 'diff...', 'test', 'claude');

      // Assert - (8.5 + 7.5 + 9.0 + 8.0) / 4 = 8.25
      expect(result.overallScore).toBeCloseTo(8.25, 2);
    });
  });
});
