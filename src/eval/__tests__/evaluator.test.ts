import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
/**
 * Unit tests for Evaluator module
 *
 * Tests the orchestration of ChatGPT-based commit message evaluation.
 */

/* eslint-disable jest/unbound-method */


import { EvaluationError } from '../../errors';
import type { ChatGPTAgent } from '../chatgpt-agent';
import { Evaluator } from '../evaluator';
import type { EvalMetrics } from '../schemas';

// Mock ChatGPT agent
mock.module('../chatgpt-agent', () => ({
  ChatGPTAgent: mock(() => ({
    name: 'chatgpt',
    evaluate: mock(() => Promise.resolve({
      metrics: { accuracy: 0, clarity: 0, conventionalCompliance: 0, detailLevel: 0 },
      feedback: '',
    })),
  })),
}));

describe('Evaluator', () => {
  let evaluator: Evaluator;
  let mockChatGptAgent: ChatGPTAgent;

  beforeEach(() => {
    // Reset mocks
    mock.restore();

    // Create evaluator instance
    evaluator = new Evaluator();

    // Get mocked ChatGPT agent instance

    mockChatGptAgent = (evaluator as unknown as { agent: ChatGPTAgent }).agent;
  });

  describe('evaluate', () => {
    it('should call ChatGPT agent with correct parameters', async () => {
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

      // Mock ChatGPT agent response
      spyOn(mockChatGptAgent, 'evaluate').mockResolvedValue({
        feedback: mockFeedback,
        metrics: mockMetrics,
      });

      // Act
      await evaluator.evaluate(commitMessage, gitStatus, gitDiff, fixtureName, agentName);

      // Assert
      expect(mockChatGptAgent.evaluate).toHaveBeenCalledWith(commitMessage, gitDiff, gitStatus);
    });

    it('should return complete EvalResult with all fields', async () => {
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

      spyOn(mockChatGptAgent, 'evaluate').mockResolvedValue({
        feedback: mockFeedback,
        metrics: mockMetrics,
      });

      // Act
      const result = await evaluator.evaluate(
        commitMessage,
        gitStatus,
        gitDiff,
        fixtureName,
        agentName
      );

      // Assert - check all required fields
      expect(result.fixture).toBe(fixtureName);
      expect(result.agent).toBe(agentName);
      expect(result.commitMessage).toBe(commitMessage);
      expect(result.metrics).toEqual(mockMetrics);
      expect(result.feedback).toBe(mockFeedback);
      expect(result.timestamp).toBeTruthy();
      expect(result.overallScore).toBeTruthy();

      // Verify timestamp is valid ISO string
      expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
    });

    it('should calculate overall score correctly as average of 4 metrics', async () => {
      // Arrange
      const commitMessage = 'fix: add null safety check';
      const gitStatus = 'M  src/parser.ts';
      const gitDiff = 'diff...';
      const fixtureName = 'test';
      const agentName = 'claude';

      const mockMetrics: EvalMetrics = {
        accuracy: 9,
        clarity: 8,
        conventionalCompliance: 10,
        detailLevel: 7,
      };

      spyOn(mockChatGptAgent, 'evaluate').mockResolvedValue({
        feedback: 'Good',
        metrics: mockMetrics,
      });

      // Act
      const result = await evaluator.evaluate(
        commitMessage,
        gitStatus,
        gitDiff,
        fixtureName,
        agentName
      );

      // Assert - overall score should be (10 + 8 + 9 + 7) / 4 = 8.5
      expect(result.overallScore).toBe(8.5);
    });

    it('should handle perfect scores correctly', async () => {
      // Arrange
      const commitMessage = 'feat: perfect commit';
      const gitStatus = 'A  src/file.ts';
      const gitDiff = 'diff...';
      const fixtureName = 'test';
      const agentName = 'codex';

      const mockMetrics: EvalMetrics = {
        accuracy: 10,
        clarity: 10,
        conventionalCompliance: 10,
        detailLevel: 10,
      };

      spyOn(mockChatGptAgent, 'evaluate').mockResolvedValue({
        feedback: 'Perfect commit message',
        metrics: mockMetrics,
      });

      // Act
      const result = await evaluator.evaluate(
        commitMessage,
        gitStatus,
        gitDiff,
        fixtureName,
        agentName
      );

      // Assert
      expect(result.overallScore).toBe(10);
    });

    it('should handle minimum scores correctly', async () => {
      // Arrange
      const commitMessage = 'bad commit';
      const gitStatus = 'M  file.txt';
      const gitDiff = 'diff...';
      const fixtureName = 'test';
      const agentName = 'claude';

      const mockMetrics: EvalMetrics = {
        accuracy: 0,
        clarity: 0,
        conventionalCompliance: 0,
        detailLevel: 0,
      };

      spyOn(mockChatGptAgent, 'evaluate').mockResolvedValue({
        feedback: 'Poor commit message',
        metrics: mockMetrics,
      });

      // Act
      const result = await evaluator.evaluate(
        commitMessage,
        gitStatus,
        gitDiff,
        fixtureName,
        agentName
      );

      // Assert
      expect(result.overallScore).toBe(0);
    });

    it('should propagate EvaluationError from ChatGPT agent', async () => {
      // Arrange
      const commitMessage = 'fix: test';
      const gitStatus = 'M  file.ts';
      const gitDiff = 'diff...';
      const fixtureName = 'test';
      const agentName = 'claude';

      const mockError = EvaluationError.apiKeyMissing('OpenAI');

      spyOn(mockChatGptAgent, 'evaluate').mockRejectedValue(mockError);

      // Act & Assert
      await expect(
        evaluator.evaluate(commitMessage, gitStatus, gitDiff, fixtureName, agentName)
      ).rejects.toThrow(EvaluationError);

      await expect(
        evaluator.evaluate(commitMessage, gitStatus, gitDiff, fixtureName, agentName)
      ).rejects.toThrow('OpenAI API key is not configured');
    });

    it('should propagate evaluation failed error from ChatGPT agent', async () => {
      // Arrange
      const commitMessage = 'fix: test';
      const gitStatus = 'M  file.ts';
      const gitDiff = 'diff...';
      const fixtureName = 'test';
      const agentName = 'codex';

      const mockError = EvaluationError.evaluationFailed('API rate limit exceeded');

      spyOn(mockChatGptAgent, 'evaluate').mockRejectedValue(mockError);

      // Act & Assert
      await expect(
        evaluator.evaluate(commitMessage, gitStatus, gitDiff, fixtureName, agentName)
      ).rejects.toThrow(EvaluationError);

      await expect(
        evaluator.evaluate(commitMessage, gitStatus, gitDiff, fixtureName, agentName)
      ).rejects.toThrow('API rate limit exceeded');
    });

    it('should work with codex agent name', async () => {
      // Arrange
      const commitMessage = 'feat: add feature';
      const gitStatus = 'A  src/feature.ts';
      const gitDiff = 'diff...';
      const fixtureName = 'complex';
      const agentName = 'codex';

      const mockMetrics: EvalMetrics = {
        accuracy: 8,
        clarity: 9,
        conventionalCompliance: 9,
        detailLevel: 8,
      };

      spyOn(mockChatGptAgent, 'evaluate').mockResolvedValue({
        feedback: 'Well structured',
        metrics: mockMetrics,
      });

      // Act
      const result = await evaluator.evaluate(
        commitMessage,
        gitStatus,
        gitDiff,
        fixtureName,
        agentName
      );

      // Assert
      expect(result.agent).toBe('codex');
      expect(result.overallScore).toBe(8.5); // (8 + 9 + 9 + 8) / 4
    });

    it('should include all metrics in result', async () => {
      // Arrange
      const commitMessage = 'test: commit';
      const gitStatus = 'M  test.ts';
      const gitDiff = 'diff...';
      const fixtureName = 'test';
      const agentName = 'claude';

      const mockMetrics: EvalMetrics = {
        accuracy: 7,
        clarity: 6,
        conventionalCompliance: 8,
        detailLevel: 9,
      };

      spyOn(mockChatGptAgent, 'evaluate').mockResolvedValue({
        feedback: 'Test feedback',
        metrics: mockMetrics,
      });

      // Act
      const result = await evaluator.evaluate(
        commitMessage,
        gitStatus,
        gitDiff,
        fixtureName,
        agentName
      );

      // Assert - verify all individual metrics are present
      expect(result.metrics.conventionalCompliance).toBe(8);
      expect(result.metrics.clarity).toBe(6);
      expect(result.metrics.accuracy).toBe(7);
      expect(result.metrics.detailLevel).toBe(9);
    });

    it('should handle floating point scores correctly', async () => {
      // Arrange
      const commitMessage = 'fix: update';
      const gitStatus = 'M  file.ts';
      const gitDiff = 'diff...';
      const fixtureName = 'test';
      const agentName = 'claude';

      const mockMetrics: EvalMetrics = {
        accuracy: 8.5,
        clarity: 7.5,
        conventionalCompliance: 9,
        detailLevel: 8,
      };

      spyOn(mockChatGptAgent, 'evaluate').mockResolvedValue({
        feedback: 'Good',
        metrics: mockMetrics,
      });

      // Act
      const result = await evaluator.evaluate(
        commitMessage,
        gitStatus,
        gitDiff,
        fixtureName,
        agentName
      );

      // Assert - (8.5 + 7.5 + 9.0 + 8.0) / 4 = 8.25
      expect(result.overallScore).toBeCloseTo(8.25, 2);
    });
  });
});
