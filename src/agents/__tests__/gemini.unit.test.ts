import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// Mock the shell module BEFORE importing GeminiAgent
const mockExec = mock(() => Promise.resolve({ exitCode: 0, stderr: '', stdout: '' }));

mock.module('../../utils/shell.js', () => ({
  exec: mockExec,
}));

import { GeminiAgent } from '../gemini';

describe('GeminiAgent', () => {
  let agent: GeminiAgent;

  beforeEach(() => {
    agent = new GeminiAgent();
    mockExec.mockClear();
  });

  afterEach(() => {
    // Reset mock after each test to clear any pending mock implementations
    mockExec.mockClear();
  });

  afterAll(() => {
    // CRITICAL: Restore module mocks immediately after this test suite completes
    // to prevent pollution to integration tests or other test files
    mock.restore();
  });

  /**
   * Helper to mock successful command -v + gemini command
   */
  const mockSuccessfulGeneration = (output: string): void => {
    mockExec
      .mockResolvedValueOnce({
        // First call: command -v gemini
        exitCode: 0,
        stderr: '',
        stdout: '/usr/local/bin/gemini',
      })
      .mockResolvedValueOnce({
        // Second call: gemini command
        exitCode: 0,
        stderr: '',
        stdout: output,
      });
  };

  describe('name', () => {
    it('should return correct agent name', () => {
      expect(agent.name).toBe('gemini');
    });
  });

  describe('generate', () => {
    it('should generate commit message from prompt', async () => {
      // Mock successful command -v + gemini command
      mockSuccessfulGeneration(
        'feat: add dark mode toggle\n\nImplement theme switching functionality'
      );

      const prompt = 'Generate commit message for adding dark mode';
      const workdir = '/tmp/test-repo';

      const message = await agent.generate(prompt, workdir);

      expect(message).toBe('feat: add dark mode toggle\n\nImplement theme switching functionality');
      expect(mockExec).toHaveBeenNthCalledWith(1, '/bin/sh', ['-c', 'command -v gemini'], {
        cwd: '/tmp',
      });
      expect(mockExec).toHaveBeenNthCalledWith(2, 'gemini', ['-p', prompt], {
        cwd: workdir,
        timeout: 120000,
      });
    });

    it('should clean AI artifacts from response', async () => {
      // Mock successful command -v + gemini command with markdown artifacts
      mockSuccessfulGeneration('```\nfeat: add feature\n\nDetails here\n```');

      const message = await agent.generate('prompt', '/tmp');

      // Should clean markdown code blocks (via BaseAgent.cleanResponse)
      expect(message).toBe('feat: add feature\n\nDetails here');
    });

    it('should throw error when CLI is not found', async () => {
      // Mock command -v to return empty (CLI not found)
      mockExec.mockResolvedValueOnce({
        exitCode: 0,
        stderr: '',
        stdout: '', // Empty stdout means CLI not found
      });

      expect(agent.generate('prompt', '/tmp')).rejects.toThrow(
        /Command "gemini" not found. Please ensure it is installed and in your PATH./
      );
    });

    it('should throw error when response is empty', async () => {
      mockSuccessfulGeneration('');

      expect(agent.generate('prompt', '/tmp')).rejects.toThrow(
        /Invalid conventional commit format/
      );
    });

    it('should throw error when response is whitespace only', async () => {
      mockSuccessfulGeneration('   \n\n  ');

      expect(agent.generate('prompt', '/tmp')).rejects.toThrow(
        /Invalid conventional commit format/
      );
    });

    it('should throw error when response is malformed', async () => {
      mockSuccessfulGeneration('Not a valid commit message format');

      expect(agent.generate('prompt', '/tmp')).rejects.toThrow(
        /Invalid conventional commit format/
      );
    });

    it('should accept valid conventional commit types', async () => {
      const validTypes = [
        'feat: add feature',
        'fix: fix bug',
        'docs: update docs',
        'style: format code',
        'refactor: refactor code',
        'perf: improve performance',
        'test: add tests',
        'chore: update tooling',
        'build: update build',
        'ci: update ci',
      ];

      for (const message of validTypes) {
        mockSuccessfulGeneration(message);

        const result = await agent.generate('prompt', '/tmp');
        expect(result).toBe(message);
      }
    });

    it('should clean multiple types of AI artifacts', async () => {
      mockSuccessfulGeneration('```typescript\nfeat: add feature\n```');

      const message = await agent.generate('prompt', '/tmp');
      expect(message).toBe('feat: add feature');
    });

    it('should clean COMMIT_MESSAGE markers from response', async () => {
      // Mock successful generation with commit message markers
      mockSuccessfulGeneration(`<<<COMMIT_MESSAGE_START>>>
feat: add gemini integration

- Add GeminiAgent implementation
- Update CLI to support gemini agent
<<<COMMIT_MESSAGE_END>>>`);

      const message = await agent.generate('prompt', '/tmp');

      // Should clean markers via BaseAgent.cleanResponse
      expect(message).toBe(
        `feat: add gemini integration

- Add GeminiAgent implementation
- Update CLI to support gemini agent`
      );
    });

    it('should clean COMMIT_MESSAGE markers with extra whitespace', async () => {
      // Mock successful generation with markers and extra whitespace
      mockSuccessfulGeneration(`
<<<COMMIT_MESSAGE_START>>>

feat: add feature

- Implement new functionality
<<<COMMIT_MESSAGE_END>>>
`);

      const message = await agent.generate('prompt', '/tmp');

      // Should clean markers and trim whitespace
      expect(message).toBe(`feat: add feature

- Implement new functionality`);
    });

    it('should handle gemini-specific timeout of 120 seconds', async () => {
      mockSuccessfulGeneration('feat: add feature');

      await agent.generate('prompt', '/tmp');

      // Verify timeout is set to 120 seconds (120000 ms)
      expect(mockExec).toHaveBeenNthCalledWith(
        2,
        'gemini',
        ['-p', 'prompt'],
        expect.objectContaining({
          timeout: 120000,
        })
      );
    });
  });
});
