import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

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
   * Helper to mock successful command -v + codex command
   */
  const mockSuccessfulGeneration = (output: string): void => {
    mockExec
      .mockResolvedValueOnce({
        // First call: command -v codex
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
      expect(agent.name).toBe('codex');
    });
  });

  describe('generate', () => {
    it('should generate commit message from prompt', async () => {
      mockSuccessfulGeneration(
        'feat: add dark mode toggle\n\nImplement theme switching functionality'
      );

      const prompt = 'Generate commit message for adding dark mode';
      const workdir = '/tmp/test-repo';

      const message = await agent.generate(prompt, workdir);

      expect(message).toBe('feat: add dark mode toggle\n\nImplement theme switching functionality');
      expect(mockExec).toHaveBeenNthCalledWith(1, '/bin/sh', ['-c', 'command -v codex'], {
        cwd: '/tmp',
      });
      expect(mockExec).toHaveBeenNthCalledWith(2, 'codex', ['exec', '--skip-git-repo-check'], {
        cwd: workdir,
        input: prompt,
        timeout: 120000,
      });
    });

    it('should clean AI artifacts from response', async () => {
      mockSuccessfulGeneration('```\nfeat: add feature\n\nDetails here\n```');

      const message = await agent.generate('prompt', '/tmp');

      // Should clean markdown code blocks (via BaseAgent.cleanResponse)
      expect(message).toBe('feat: add feature\n\nDetails here');
    });

    it('should clean AI prefix artifacts from response', async () => {
      mockSuccessfulGeneration(
        'Here is the commit message:\nfeat: add feature\n\nImplement new feature'
      );

      const message = await agent.generate('prompt', '/tmp');

      // Should remove AI prefix (handled by BaseAgent.cleanResponse)
      expect(message).toBe('feat: add feature\n\nImplement new feature');
    });

    it('should throw error when CLI is not found', async () => {
      // Mock command -v to fail (CLI not found)
      const error = new Error('Command "command" not found');
      mockExec.mockRejectedValue(error);

      expect(agent.generate('test prompt', '/tmp')).rejects.toThrow(/Command "command" not found/);
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
      mockSuccessfulGeneration(`<<<COMMIT_MESSAGE_START>>>
feat: add codex integration

- Add CodexAgent implementation
- Update CLI to support codex agent
<<<COMMIT_MESSAGE_END>>>`);

      const message = await agent.generate('prompt', '/tmp');

      // Should clean markers via BaseAgent.cleanResponse
      expect(message).toBe(
        `feat: add codex integration

- Add CodexAgent implementation
- Update CLI to support codex agent`
      );
    });

    it('should clean COMMIT_MESSAGE markers with extra whitespace', async () => {
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

    it('should extract message from markers and discard Codex activity logs', async () => {
      mockSuccessfulGeneration(`[2025-10-22T00:50:28] OpenAI Codex v0.42.0 (research preview)
--------
workdir: /Users/user/project
model: gpt-5-codex
provider: openai

<<<COMMIT_MESSAGE_START>>>
feat: add feature

- Implement new functionality
<<<COMMIT_MESSAGE_END>>>

[2025-10-22T00:50:29] tokens used: 123`);

      const message = await agent.generate('prompt', '/tmp');
      expect(message).toBe('feat: add feature\n\n- Implement new functionality');
    });

    it('should extract message from markers and discard all metadata', async () => {
      mockSuccessfulGeneration(`[2025-10-22T00:50:28] OpenAI Codex v0.42.0
--------
model: gpt-5-codex
provider: openai
approval: never
sandbox: read-only
reasoning effort: none
--------
[2025-10-22T00:50:28] User instructions:
Generate a commit message...

<<<COMMIT_MESSAGE_START>>>
feat: add feature

- Implement new functionality
<<<COMMIT_MESSAGE_END>>>

[2025-10-22T00:50:29] tokens used: 456`);

      const message = await agent.generate('prompt', '/tmp');
      expect(message).toBe('feat: add feature\n\n- Implement new functionality');
    });

    it('should handle codex-specific timeout of 120 seconds', async () => {
      mockSuccessfulGeneration('feat: add feature');

      await agent.generate('prompt', '/tmp');

      // Verify timeout is set to 120 seconds (120000 ms)
      expect(mockExec).toHaveBeenNthCalledWith(
        2,
        'codex',
        ['exec', '--skip-git-repo-check'],
        expect.objectContaining({
          timeout: 120000,
        })
      );
    });
  });
});
