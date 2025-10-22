import { beforeEach, describe, expect, it, mock } from 'bun:test';

// Mock the shell module BEFORE importing CodexAgent
const mockExec = mock(() => Promise.resolve({ exitCode: 0, stderr: '', stdout: '' }));

mock.module('../../utils/shell.js', () => ({
  exec: mockExec,
}));

import { CodexAgent } from '../codex';

describe('CodexAgent', () => {
  let agent: CodexAgent;

  beforeEach(() => {
    agent = new CodexAgent();
    mockExec.mockClear();
  });

  /**
   * Helper to mock successful which + codex command
   */
  const mockSuccessfulGeneration = (output: string): void => {
    mockExec
      .mockResolvedValueOnce({
        // First call: which Codex CLI
        exitCode: 0,
        stderr: '',
        stdout: '/usr/bin/codex',
      })
      .mockResolvedValueOnce({
        // Second call: codex command
        exitCode: 0,
        stderr: '',
        stdout: output,
      });
  };

  describe('name', () => {
    it('should return correct agent name', () => {
      expect(agent.name).toBe('Codex CLI');
    });
  });

  describe('generate', () => {
    it('should generate commit message from prompt', async () => {
      mockSuccessfulGeneration(
        'feat: add dark mode toggle\n\nImplement theme switching functionality'
      );

      const prompt = 'Generate commit message for adding dark mode';
      const workdir = '/test/repo';

      const message = await agent.generate(prompt, workdir);

      expect(message).toBe('feat: add dark mode toggle\n\nImplement theme switching functionality');
      expect(mockExec).toHaveBeenNthCalledWith(1, 'which', ['Codex CLI'], { cwd: workdir });
      expect(mockExec).toHaveBeenNthCalledWith(
        2,
        'codex',
        [
          'exec',
          '--output-last-message',
          expect.stringMatching(/\/tmp\/codex-output-\d+\.txt/),
          prompt,
        ],
        expect.objectContaining({
          cwd: workdir,
        })
      );
    });

    it('should clean AI artifacts from response', async () => {
      mockSuccessfulGeneration('```\nfeat: add feature\n\nImplement new feature\n```');

      const message = await agent.generate('test prompt', '/test/repo');

      // Should remove code fences
      expect(message).toBe('feat: add feature\n\nImplement new feature');
    });

    it('should clean AI prefix artifacts from response', async () => {
      mockSuccessfulGeneration(
        'Here is the commit message:\nfeat: add feature\n\nImplement new feature'
      );

      const message = await agent.generate('test prompt', '/test/repo');

      // Should remove AI prefix (handled by BaseAgent.cleanResponse)
      expect(message).toBe('feat: add feature\n\nImplement new feature');
    });

    it('should throw error when CLI is not found', async () => {
      // Mock ENOENT error for which command
      const error = new Error('Command "which" not found');
      mockExec.mockRejectedValue(error);

      await expect(agent.generate('test prompt', '/test/repo')).rejects.toThrow(
        /Command "which" not found/
      );
    });

    it('should throw error when response is empty', async () => {
      mockSuccessfulGeneration('');

      // Empty response fails validation in BaseAgent
      await expect(agent.generate('test prompt', '/test/repo')).rejects.toThrow(
        /Invalid conventional commit format/
      );
    });

    it('should throw error when response is only whitespace', async () => {
      mockSuccessfulGeneration('   \n\n   ');

      // Whitespace-only response fails validation in BaseAgent
      await expect(agent.generate('test prompt', '/test/repo')).rejects.toThrow(
        /Invalid conventional commit format/
      );
    });

    it('should throw error when response is malformed', async () => {
      mockSuccessfulGeneration('This is not a conventional commit message at all');

      // Malformed response fails validation in BaseAgent
      await expect(agent.generate('test prompt', '/test/repo')).rejects.toThrow(
        /Invalid conventional commit format/
      );
    });

    it('should accept valid conventional commit types', async () => {
      const validTypes = [
        'feat: add feature',
        'fix: resolve bug',
        'docs: update readme',
        'style: format code',
        'refactor: restructure module',
        'test: add tests',
        'chore: update dependencies',
        'perf: improve performance',
      ];

      for (const commitMessage of validTypes) {
        mockSuccessfulGeneration(commitMessage);

        const message = await agent.generate('test prompt', '/test/repo');
        expect(message).toBe(commitMessage);
      }
    });

    it('should accept commit messages with scope', async () => {
      mockSuccessfulGeneration('feat(auth): add OAuth support');

      const message = await agent.generate('test prompt', '/test/repo');
      expect(message).toBe('feat(auth): add OAuth support');
    });

    it('should clean COMMIT_MESSAGE markers from response', async () => {
      mockSuccessfulGeneration(`<<<COMMIT_MESSAGE_START>>>
feat: add feature

- Implement new functionality
<<<COMMIT_MESSAGE_END>>>`);

      const message = await agent.generate('test prompt', '/test/repo');
      expect(message).toBe('feat: add feature\n\n- Implement new functionality');
    });

    it('should clean COMMIT_MESSAGE markers with extra whitespace', async () => {
      mockSuccessfulGeneration(`
<<<COMMIT_MESSAGE_START>>>

feat: add feature

- Implement new functionality
<<<COMMIT_MESSAGE_END>>>
`);

      const message = await agent.generate('test prompt', '/test/repo');
      expect(message).toBe('feat: add feature\n\n- Implement new functionality');
    });

    it('should clean Codex activity logs from response', async () => {
      mockSuccessfulGeneration(`[2025-10-22T00:50:28] OpenAI Codex v0.42.0 (research preview)
--------
workdir: /Users/user/project

feat: add feature

- Implement new functionality`);

      const message = await agent.generate('test prompt', '/test/repo');
      expect(message).toBe('feat: add feature\n\n- Implement new functionality');
    });

    it('should clean Codex configuration metadata from response', async () => {
      mockSuccessfulGeneration(`model: gpt-5-codex
provider: openai
approval: never
sandbox: read-only
reasoning effort: none

feat: add feature

- Implement new functionality`);

      const message = await agent.generate('test prompt', '/test/repo');
      expect(message).toBe('feat: add feature\n\n- Implement new functionality');
    });
  });
});
