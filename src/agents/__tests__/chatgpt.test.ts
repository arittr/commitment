/**
 * Unit tests for ChatGPTAgent
 *
 * Tests the ChatGPT evaluation agent with mocked OpenAI SDK responses.
 * Covers success cases, error cases, and edge cases.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EvalError } from '../../errors';
import { ChatGPTAgent } from '../chatgpt';

// Mock the OpenAI Agents SDK
vi.mock('@openai/agents', () => {
  return {
    Agent: vi.fn(),
  };
});

describe('ChatGPTAgent', () => {
  let agent: ChatGPTAgent;
  let mockAgent: {
    run: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Create mock agent instance
    mockAgent = {
      run: vi.fn(),
    };

    // Mock the Agent constructor to return our mock instance
    const { Agent } = await import('@openai/agents');
    vi.mocked(Agent).mockImplementation(() => mockAgent as unknown as InstanceType<typeof Agent>);

    agent = new ChatGPTAgent();
  });

  describe('constructor', () => {
    it('should set name to "chatgpt"', () => {
      expect(agent.name).toBe('chatgpt');
    });
  });

  describe('evaluate', () => {
    const commitMessage = 'fix: add null safety check to parser';
    const gitDiff = `diff --git a/src/parser.ts b/src/parser.ts
--- a/src/parser.ts
+++ b/src/parser.ts
@@ -10,7 +10,7 @@
 export function parse(input: string) {
-  return input.trim();
+  return input?.trim() ?? '';
 }`;
    const gitStatus = 'M  src/parser.ts';

    describe('success cases', () => {
      beforeEach(() => {
        // Set API key for success tests
        process.env.OPENAI_API_KEY = 'test-api-key';
      });

      it('should evaluate commit message and return metrics + feedback', async () => {
        // Mock successful evaluation
        mockAgent.run.mockResolvedValue({
          toolCalls: [
            {
              arguments: {
                accuracy: 9,
                clarity: 8,
                conventionalCompliance: 9,
                detailLevel: 7,
                feedback: 'Good conventional commit format. Clear description of null safety fix.',
              },
            },
          ],
        });

        const result = await agent.evaluate(commitMessage, gitDiff, gitStatus);

        // Verify metrics structure
        expect(result.metrics).toEqual({
          accuracy: 9,
          clarity: 8,
          conventionalCompliance: 9,
          detailLevel: 7,
        });

        // Verify feedback
        expect(result.feedback).toBe(
          'Good conventional commit format. Clear description of null safety fix.'
        );
      });

      it('should call OpenAI agent with correct context', async () => {
        mockAgent.run.mockResolvedValue({
          toolCalls: [
            {
              arguments: {
                accuracy: 9,
                clarity: 8,
                conventionalCompliance: 9,
                detailLevel: 7,
                feedback: 'Test feedback',
              },
            },
          ],
        });

        await agent.evaluate(commitMessage, gitDiff, gitStatus);

        // Verify agent.run was called
        expect(mockAgent.run).toHaveBeenCalledTimes(1);

        // Verify the message contains all context
        const callArgs = mockAgent.run.mock.calls[0]?.[0];
        expect(callArgs).toBeDefined();
        expect(callArgs?.message).toContain(commitMessage);
        expect(callArgs?.message).toContain(gitDiff);
        expect(callArgs?.message).toContain(gitStatus);
        expect(callArgs?.message).toContain('score_commit');
      });

      it('should handle perfect scores (all 10s)', async () => {
        mockAgent.run.mockResolvedValue({
          toolCalls: [
            {
              arguments: {
                accuracy: 10,
                clarity: 10,
                conventionalCompliance: 10,
                detailLevel: 10,
                feedback: 'Perfect commit message in every dimension.',
              },
            },
          ],
        });

        const result = await agent.evaluate(commitMessage, gitDiff, gitStatus);

        expect(result.metrics.conventionalCompliance).toBe(10);
        expect(result.metrics.clarity).toBe(10);
        expect(result.metrics.accuracy).toBe(10);
        expect(result.metrics.detailLevel).toBe(10);
      });

      it('should handle low scores (all 0s)', async () => {
        mockAgent.run.mockResolvedValue({
          toolCalls: [
            {
              arguments: {
                accuracy: 0,
                clarity: 0,
                conventionalCompliance: 0,
                detailLevel: 0,
                feedback: 'Poor commit message. Missing conventional format, unclear, inaccurate.',
              },
            },
          ],
        });

        const result = await agent.evaluate(commitMessage, gitDiff, gitStatus);

        expect(result.metrics.conventionalCompliance).toBe(0);
        expect(result.metrics.clarity).toBe(0);
        expect(result.metrics.accuracy).toBe(0);
        expect(result.metrics.detailLevel).toBe(0);
        expect(result.feedback).toContain('Poor commit message');
      });

      it('should handle decimal scores', async () => {
        mockAgent.run.mockResolvedValue({
          toolCalls: [
            {
              arguments: {
                accuracy: 9,
                clarity: 7.5,
                conventionalCompliance: 8.5,
                detailLevel: 6.5,
                feedback: 'Generally good with minor issues.',
              },
            },
          ],
        });

        const result = await agent.evaluate(commitMessage, gitDiff, gitStatus);

        expect(result.metrics.conventionalCompliance).toBe(8.5);
        expect(result.metrics.clarity).toBe(7.5);
        expect(result.metrics.accuracy).toBe(9);
        expect(result.metrics.detailLevel).toBe(6.5);
      });
    });

    describe('error cases', () => {
      it('should throw EvalError.apiKeyMissing when OPENAI_API_KEY is not set', async () => {
        // Save and clear API key
        const originalKey = process.env.OPENAI_API_KEY;
        delete process.env.OPENAI_API_KEY;

        await expect(agent.evaluate(commitMessage, gitDiff, gitStatus)).rejects.toThrow(EvalError);

        await expect(agent.evaluate(commitMessage, gitDiff, gitStatus)).rejects.toThrow(
          /OpenAI API key is not configured/
        );

        // Restore API key
        process.env.OPENAI_API_KEY = originalKey;
      });

      it('should throw EvalError.evaluationFailed on API errors', async () => {
        // Set API key so we get past that check
        process.env.OPENAI_API_KEY = 'test-key';

        // Mock API error
        mockAgent.run.mockRejectedValue(new Error('API rate limit exceeded'));

        await expect(agent.evaluate(commitMessage, gitDiff, gitStatus)).rejects.toThrow(EvalError);

        await expect(agent.evaluate(commitMessage, gitDiff, gitStatus)).rejects.toThrow(
          /evaluation failed/i
        );

        await expect(agent.evaluate(commitMessage, gitDiff, gitStatus)).rejects.toThrow(
          /API rate limit exceeded/
        );
      });

      it('should throw EvalError.evaluationFailed when no tool calls in response', async () => {
        process.env.OPENAI_API_KEY = 'test-key';

        // Mock response with no tool calls
        mockAgent.run.mockResolvedValue({
          toolCalls: [],
        });

        await expect(agent.evaluate(commitMessage, gitDiff, gitStatus)).rejects.toThrow(EvalError);

        await expect(agent.evaluate(commitMessage, gitDiff, gitStatus)).rejects.toThrow(
          /No tool call in response/
        );
      });

      it('should throw EvalError.evaluationFailed when toolCalls is undefined', async () => {
        process.env.OPENAI_API_KEY = 'test-key';

        // Mock response with undefined toolCalls
        mockAgent.run.mockResolvedValue({});

        await expect(agent.evaluate(commitMessage, gitDiff, gitStatus)).rejects.toThrow(EvalError);
      });

      it('should throw EvalError.evaluationFailed on network errors', async () => {
        process.env.OPENAI_API_KEY = 'test-key';

        // Mock network error
        mockAgent.run.mockRejectedValue(new Error('Network error: ECONNREFUSED'));

        await expect(agent.evaluate(commitMessage, gitDiff, gitStatus)).rejects.toThrow(
          /Network error/
        );
      });

      it('should throw EvalError.evaluationFailed on unknown errors', async () => {
        process.env.OPENAI_API_KEY = 'test-key';

        // Mock non-Error object
        mockAgent.run.mockRejectedValue('Unknown error');

        await expect(agent.evaluate(commitMessage, gitDiff, gitStatus)).rejects.toThrow(EvalError);

        await expect(agent.evaluate(commitMessage, gitDiff, gitStatus)).rejects.toThrow(
          /Unknown error/
        );
      });
    });

    describe('edge cases', () => {
      beforeEach(() => {
        process.env.OPENAI_API_KEY = 'test-key';
      });

      it('should handle very long commit messages', async () => {
        const longMessage = `fix: ${'very long description '.repeat(100)}`;

        mockAgent.run.mockResolvedValue({
          toolCalls: [
            {
              arguments: {
                accuracy: 8,
                clarity: 6,
                conventionalCompliance: 7,
                detailLevel: 4, // Too verbose
                feedback: 'Message is too verbose. Could be more concise.',
              },
            },
          ],
        });

        const result = await agent.evaluate(longMessage, gitDiff, gitStatus);

        expect(result.metrics.detailLevel).toBe(4);
        expect(result.feedback).toContain('verbose');
      });

      it('should handle empty git diff', async () => {
        mockAgent.run.mockResolvedValue({
          toolCalls: [
            {
              arguments: {
                accuracy: 0, // No changes to evaluate
                clarity: 5,
                conventionalCompliance: 5,
                detailLevel: 5,
                feedback: 'No changes in diff. Cannot evaluate accuracy.',
              },
            },
          ],
        });

        const result = await agent.evaluate(commitMessage, '', gitStatus);

        expect(result.metrics.accuracy).toBe(0);
      });

      it('should handle multiline feedback', async () => {
        const multilineFeedback = `Strengths:
- Good conventional format
- Clear description

Weaknesses:
- Could add more context in body
- Missing references to related issues`;

        mockAgent.run.mockResolvedValue({
          toolCalls: [
            {
              arguments: {
                accuracy: 9,
                clarity: 7,
                conventionalCompliance: 8,
                detailLevel: 6,
                feedback: multilineFeedback,
              },
            },
          ],
        });

        const result = await agent.evaluate(commitMessage, gitDiff, gitStatus);

        expect(result.feedback).toBe(multilineFeedback);
        expect(result.feedback).toContain('Strengths:');
        expect(result.feedback).toContain('Weaknesses:');
      });

      it('should handle special characters in feedback', async () => {
        const feedbackWithSpecialChars = 'Good! But needs improvement: `type` → `fix` (not `feat`)';

        mockAgent.run.mockResolvedValue({
          toolCalls: [
            {
              arguments: {
                accuracy: 9,
                clarity: 8,
                conventionalCompliance: 7,
                detailLevel: 7,
                feedback: feedbackWithSpecialChars,
              },
            },
          ],
        });

        const result = await agent.evaluate(commitMessage, gitDiff, gitStatus);

        expect(result.feedback).toBe(feedbackWithSpecialChars);
      });
    });

    describe('Agent SDK initialization', () => {
      it('should initialize Agent with correct configuration', async () => {
        process.env.OPENAI_API_KEY = 'test-key';

        mockAgent.run.mockResolvedValue({
          toolCalls: [
            {
              arguments: {
                accuracy: 9,
                clarity: 8,
                conventionalCompliance: 9,
                detailLevel: 7,
                feedback: 'Test',
              },
            },
          ],
        });

        await agent.evaluate(commitMessage, gitDiff, gitStatus);

        // Verify Agent constructor was called
        const { Agent } = await import('@openai/agents');
        expect(Agent).toHaveBeenCalled();

        // Verify configuration
        const config = vi.mocked(Agent).mock.calls[0]?.[0];
        expect(config).toBeDefined();
        expect(config?.name).toBe('commit-evaluator');
        expect(config?.model).toBe('gpt-4');
        expect(config?.instructions).toContain('Conventional Commits');
        expect(config?.tools).toHaveLength(1);
        expect(config?.tools?.[0]?.name).toBe('score_commit');
      });

      it('should define tool with all required parameters', async () => {
        process.env.OPENAI_API_KEY = 'test-key';

        mockAgent.run.mockResolvedValue({
          toolCalls: [
            {
              arguments: {
                accuracy: 9,
                clarity: 8,
                conventionalCompliance: 9,
                detailLevel: 7,
                feedback: 'Test',
              },
            },
          ],
        });

        await agent.evaluate(commitMessage, gitDiff, gitStatus);

        const { Agent } = await import('@openai/agents');
        const config = vi.mocked(Agent).mock.calls[0]?.[0];
        expect(config).toBeDefined();
        expect(config?.tools).toBeDefined();
        expect(config?.tools?.length).toBeGreaterThan(0);

        const tool = config?.tools?.[0] as unknown as {
          name: string;
          parameters: {
            properties: Record<string, unknown>;
            required: string[];
          };
        };

        expect(tool.parameters.properties).toHaveProperty('conventionalCompliance');
        expect(tool.parameters.properties).toHaveProperty('clarity');
        expect(tool.parameters.properties).toHaveProperty('accuracy');
        expect(tool.parameters.properties).toHaveProperty('detailLevel');
        expect(tool.parameters.properties).toHaveProperty('feedback');

        expect(tool.parameters.required).toEqual([
          'conventionalCompliance',
          'clarity',
          'accuracy',
          'detailLevel',
          'feedback',
        ]);
      });
    });
  });
});
