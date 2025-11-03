/**
 * Tests for SingleAttemptEvaluator
 *
 * Verifies single-attempt evaluation:
 * - Evaluates commit message quality on 4 dimensions
 * - Calculates overall score
 * - Uses ChatGPTAgent for evaluation
 * - Handles errors gracefully
 */

import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { SilentLogger } from '../../../utils/logger.js';
import { SingleAttemptEvaluator } from '../single-attempt.js';

// Mock ChatGPTAgent
const mockEvaluate = mock();

mock.module('../chatgpt-agent.js', () => ({
  // biome-ignore lint/style/useNamingConvention: Mock needs to match exported class name
  ChatGPTAgent: class MockChatGPTAgent {
    // biome-ignore lint/complexity/noUselessConstructor: Mock needs constructor for logger parameter
    constructor(_logger: any) {} // Accept logger parameter
    evaluate = mockEvaluate;
  },
}));

describe('SingleAttemptEvaluator', () => {
  beforeEach(() => {
    mockEvaluate.mockReset();
  });
  describe('evaluate()', () => {
    it('should evaluate commit message with 4 metrics', async () => {
      const evaluator = new SingleAttemptEvaluator(new SilentLogger());
      const mockMetrics = {
        clarity: 9,
        conventionalFormat: 10,
        scope: 7,
        specificity: 8,
      };

      mockEvaluate.mockResolvedValue(mockMetrics);

      const result = await evaluator.evaluate(
        'feat: add new feature',
        'diff --git a/file.ts...',
        'complex-feature'
      );

      expect(result.metrics).toEqual(mockMetrics);
    });

    it('should calculate overall score as average of metrics', async () => {
      const evaluator = new SingleAttemptEvaluator(new SilentLogger());
      const mockMetrics = {
        clarity: 8,
        conventionalFormat: 9,
        scope: 7,
        specificity: 6,
      };

      mockEvaluate.mockResolvedValue(mockMetrics);

      const result = await evaluator.evaluate('fix: resolve bug', 'diff --git...', 'simple-fix');

      // Average: (8 + 6 + 9 + 7) / 4 = 7.5
      expect(result.overallScore).toBe(7.5);
    });

    it('should pass commit message to ChatGPT', async () => {
      const evaluator = new SingleAttemptEvaluator(new SilentLogger());
      const commitMessage = 'feat(api): add user endpoint';

      mockEvaluate.mockResolvedValue({
        clarity: 8,
        conventionalFormat: 9,
        scope: 8,
        specificity: 8,
      });

      await evaluator.evaluate(commitMessage, 'diff', 'fixture');

      expect(mockEvaluate).toHaveBeenCalled();
      const callArgs = mockEvaluate.mock.calls[0];
      expect(callArgs).toBeDefined();
      expect(callArgs?.[0]).toContain(commitMessage);
    });

    it('should include diff in evaluation context', async () => {
      const evaluator = new SingleAttemptEvaluator(new SilentLogger());
      const diff = 'diff --git a/src/api.ts b/src/api.ts\n+new code';

      mockEvaluate.mockResolvedValue({
        clarity: 7,
        conventionalFormat: 8,
        scope: 7,
        specificity: 7,
      });

      await evaluator.evaluate('commit', diff, 'fixture');

      expect(mockEvaluate).toHaveBeenCalled();
      const callArgs = mockEvaluate.mock.calls[0];
      expect(callArgs).toBeDefined();
      expect(callArgs?.[0]).toContain(diff);
    });

    it('should include fixture name in context', async () => {
      const evaluator = new SingleAttemptEvaluator(new SilentLogger());
      const fixtureName = 'complex-refactoring';

      mockEvaluate.mockResolvedValue({
        clarity: 6,
        conventionalFormat: 8,
        scope: 6,
        specificity: 7,
      });

      await evaluator.evaluate('message', 'diff', fixtureName);

      expect(mockEvaluate).toHaveBeenCalled();
      const callArgs = mockEvaluate.mock.calls[0];
      expect(callArgs).toBeDefined();
      expect(callArgs?.[0]).toContain(fixtureName);
    });

    it('should validate metrics are in 0-10 range', async () => {
      const evaluator = new SingleAttemptEvaluator(new SilentLogger());

      // Simulate ChatGPT returning invalid metrics that fail schema validation
      mockEvaluate.mockRejectedValue(
        new Error('Schema validation failed: clarity must be at most 10')
      );

      await expect(evaluator.evaluate('message', 'diff', 'fixture')).rejects.toThrow();
    });

    it('should handle ChatGPT evaluation errors', async () => {
      const evaluator = new SingleAttemptEvaluator(new SilentLogger());

      mockEvaluate.mockRejectedValue(new Error('API timeout'));

      await expect(evaluator.evaluate('message', 'diff', 'fixture')).rejects.toThrow();
    });

    it('should handle edge case: all metrics are 10', async () => {
      const evaluator = new SingleAttemptEvaluator(new SilentLogger());

      mockEvaluate.mockResolvedValue({
        clarity: 10,
        conventionalFormat: 10,
        scope: 10,
        specificity: 10,
      });

      const result = await evaluator.evaluate('perfect', 'diff', 'fixture');

      expect(result.overallScore).toBe(10);
    });

    it('should handle edge case: all metrics are 0', async () => {
      const evaluator = new SingleAttemptEvaluator(new SilentLogger());

      mockEvaluate.mockResolvedValue({
        clarity: 0,
        conventionalFormat: 0,
        scope: 0,
        specificity: 0,
      });

      const result = await evaluator.evaluate('bad', 'diff', 'fixture');

      expect(result.overallScore).toBe(0);
    });

    it('should round overall score to 1 decimal place', async () => {
      const evaluator = new SingleAttemptEvaluator(new SilentLogger());

      mockEvaluate.mockResolvedValue({
        clarity: 7,
        conventionalFormat: 9,
        scope: 6,
        specificity: 8,
      });

      const result = await evaluator.evaluate('message', 'diff', 'fixture');

      // Average: (7 + 8 + 9 + 6) / 4 = 7.5
      expect(result.overallScore).toBe(7.5);
      expect(Number.isInteger(result.overallScore * 10)).toBe(true);
    });
  });
});
