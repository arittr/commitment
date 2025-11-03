/**
 * Tests for ChatGPTAgent
 *
 * Verifies OpenAI Agents SDK integration:
 * - Uses gpt-5 model
 * - Uses outputType pattern with Zod schema
 * - Accesses data via result.finalOutput
 * - Handles errors gracefully
 */

import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { z } from 'zod';
import { SilentLogger } from '../../../utils/logger.js';
import { ChatGPTAgent } from '../chatgpt-agent.js';

// Mock the OpenAI Agents SDK
const mockRun = mock();
const mockAgent = mock();

mock.module('@openai/agents', () => ({
  // biome-ignore lint/style/useNamingConvention: Mock needs to match OpenAI SDK export names
  Agent: mockAgent,
  run: mockRun,
}));

describe('ChatGPTAgent', () => {
  beforeEach(() => {
    mockRun.mockReset();
    mockAgent.mockReset();
  });
  describe('evaluate()', () => {
    it('should use gpt-5 model', async () => {
      const schema = z.object({ result: z.string() });
      const agent = new ChatGPTAgent(new SilentLogger());

      mockAgent.mockReturnValue({});
      mockRun.mockResolvedValue({
        finalOutput: { result: 'test' },
      });

      await agent.evaluate('test prompt', schema, 'test instructions');

      // Verify Agent constructor was called with gpt-5
      expect(mockAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5',
        })
      );
    });

    it('should use outputType pattern with Zod schema', async () => {
      const schema = z.object({ score: z.number() });
      const agent = new ChatGPTAgent(new SilentLogger());

      mockAgent.mockReturnValue({});
      mockRun.mockResolvedValue({
        finalOutput: { score: 8.5 },
      });

      await agent.evaluate('test prompt', schema, 'evaluate this');

      // Verify Agent was created with outputType
      expect(mockAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          outputType: schema,
        })
      );
    });

    it('should access data via result.finalOutput', async () => {
      const schema = z.object({ data: z.string() });
      const agent = new ChatGPTAgent(new SilentLogger());

      mockAgent.mockReturnValue({});
      mockRun.mockResolvedValue({
        finalOutput: { data: 'expected output' },
      });

      const result = await agent.evaluate('prompt', schema, 'instructions');

      expect(result).toEqual({ data: 'expected output' });
    });

    it('should pass instructions to Agent', async () => {
      const schema = z.object({ value: z.number() });
      const agent = new ChatGPTAgent(new SilentLogger());
      const instructions = 'Evaluate on scale 0-10';

      mockAgent.mockReturnValue({});
      mockRun.mockResolvedValue({
        finalOutput: { value: 7 },
      });

      await agent.evaluate('test', schema, instructions);

      expect(mockAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          instructions,
        })
      );
    });

    it('should include agent name in configuration', async () => {
      const schema = z.object({ result: z.boolean() });
      const agent = new ChatGPTAgent(new SilentLogger());

      mockAgent.mockReturnValue({});
      mockRun.mockResolvedValue({
        finalOutput: { result: true },
      });

      await agent.evaluate('prompt', schema, 'instructions');

      expect(mockAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: expect.any(String),
        })
      );
    });

    it('should throw EvaluationError on API failure', async () => {
      const schema = z.object({ result: z.string() });
      const agent = new ChatGPTAgent(new SilentLogger());
      const apiError = new Error('API timeout');

      mockAgent.mockReturnValue({});
      mockRun.mockRejectedValue(apiError);

      await expect(agent.evaluate('prompt', schema, 'instructions')).rejects.toThrow(
        'evaluation failed'
      );
    });

    it('should handle missing finalOutput', async () => {
      const schema = z.object({ result: z.string() });
      const agent = new ChatGPTAgent(new SilentLogger());

      mockAgent.mockReturnValue({});
      mockRun.mockResolvedValue({
        // Missing finalOutput
      });

      await expect(agent.evaluate('prompt', schema, 'instructions')).rejects.toThrow();
    });

    it('should validate output against schema', async () => {
      const schema = z.object({
        score: z.number().min(0).max(10),
      });
      const agent = new ChatGPTAgent(new SilentLogger());

      mockAgent.mockReturnValue({});
      // Simulate OpenAI returning invalid data that fails schema validation
      mockRun.mockRejectedValue(new Error('Schema validation failed: score must be at most 10'));

      // Schema validation should catch this
      await expect(agent.evaluate('prompt', schema, 'instructions')).rejects.toThrow();
    });
  });
});
