import { execa } from 'execa';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClaudeAgent } from '../claude';

// Mock execa before importing ClaudeAgent
vi.mock('execa', () => ({
  execa: vi.fn(),
}));

describe('ClaudeAgent', () => {
  let agent: ClaudeAgent;
  let mockExeca: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    agent = new ClaudeAgent();
    mockExeca = vi.mocked(execa);
    mockExeca.mockReset();
  });

  describe('name', () => {
    it('should return correct agent name', () => {
      expect(agent.name).toBe('Claude CLI');
    });
  });

  describe('generate', () => {
    it('should generate commit message from prompt', async () => {
      // Mock execa to return a valid commit message
      mockExeca.mockResolvedValue({
        stdout: 'feat: add dark mode toggle\n\nImplement theme switching functionality',
      } as never);

      const prompt = 'Generate commit message for adding dark mode';
      const workdir = '/tmp/test-repo';

      const message = await agent.generate(prompt, workdir);

      expect(message).toBe('feat: add dark mode toggle\n\nImplement theme switching functionality');
      expect(mockExeca).toHaveBeenCalledWith(
        'claude',
        ['--print'],
        expect.objectContaining({
          cwd: workdir,
          input: prompt,
        })
      );
    });

    it('should clean AI artifacts from response', async () => {
      // Mock execa to return response with AI artifacts
      mockExeca.mockResolvedValue({
        stdout: '```\nfeat: add feature\n\nDetails here\n```',
      } as never);

      const message = await agent.generate('prompt', '/tmp');

      // Should clean markdown code blocks
      expect(message).toBe('feat: add feature\n\nDetails here');
    });

    it('should throw error when CLI is not found', async () => {
      mockExeca.mockRejectedValue({
        code: 'ENOENT',
        message: 'spawn claude ENOENT',
      });

      await expect(agent.generate('prompt', '/tmp')).rejects.toThrow(
        /Claude CLI is not installed or not found in PATH/
      );
    });

    it('should show installation instructions in CLI not found error', async () => {
      mockExeca.mockRejectedValue({
        code: 'ENOENT',
        message: 'spawn claude ENOENT',
      });

      try {
        await agent.generate('prompt', '/tmp');
        throw new Error('Expected error to be thrown');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(Error);
        const agentError = error as { suggestedAction?: string };
        expect(agentError.suggestedAction).toContain('npm install -g');
        expect(agentError.suggestedAction).toContain('brew install');
      }
    });

    it('should throw error when CLI execution fails', async () => {
      mockExeca.mockRejectedValue({
        code: 1,
        message: 'Command failed',
        stderr: 'API key not configured',
      });

      await expect(agent.generate('prompt', '/tmp')).rejects.toThrow(/Claude CLI execution failed/);
    });

    it('should include error details in execution failure', async () => {
      mockExeca.mockRejectedValue({
        code: 1,
        message: 'Command failed',
        stderr: 'API key not configured',
      });

      await expect(agent.generate('prompt', '/tmp')).rejects.toThrow(/API key not configured/);

      try {
        await agent.generate('prompt', '/tmp');
        throw new Error('Expected error to be thrown');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(Error);
        const agentError = error as { suggestedAction?: string };
        expect(agentError.suggestedAction).toContain('Please check:');
      }
    });

    it('should throw error when response is empty', async () => {
      mockExeca.mockResolvedValue({
        stdout: '',
      } as never);

      await expect(agent.generate('prompt', '/tmp')).rejects.toThrow(/Empty response/);
    });

    it('should throw error when response is whitespace only', async () => {
      mockExeca.mockResolvedValue({
        stdout: '   \n\n  ',
      } as never);

      await expect(agent.generate('prompt', '/tmp')).rejects.toThrow(/Empty response/);
    });

    it('should throw error when response is malformed', async () => {
      mockExeca.mockResolvedValue({
        stdout: 'Not a valid commit message format',
      } as never);

      await expect(agent.generate('prompt', '/tmp')).rejects.toThrow(/malformed response/);
    });

    it('should include diagnostic context in malformed response error', async () => {
      mockExeca.mockResolvedValue({
        stdout: 'Invalid response with special characters: @#$%',
      } as never);

      await expect(agent.generate('prompt', '/tmp')).rejects.toThrow(/Received:/);
      await expect(agent.generate('prompt', '/tmp')).rejects.toThrow(/Invalid response/);
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
        mockExeca.mockResolvedValue({
          stdout: message,
        } as never);

        const result = await agent.generate('prompt', '/tmp');
        expect(result).toBe(message);
      }
    });

    it('should clean multiple types of AI artifacts', async () => {
      mockExeca.mockResolvedValue({
        stdout: '```typescript\nfeat: add feature\n```',
      } as never);

      const message = await agent.generate('prompt', '/tmp');
      expect(message).toBe('feat: add feature');
    });

    it('should handle timeout parameter', async () => {
      mockExeca.mockResolvedValue({
        stdout: 'feat: test',
      } as never);

      await agent.generate('prompt', '/tmp');

      expect(mockExeca).toHaveBeenCalledWith(
        'claude',
        ['--print'],
        expect.objectContaining({
          timeout: 120_000,
        })
      );
    });

    it('should clean COMMIT_MESSAGE markers from response', async () => {
      // Mock execa to return response with commit message markers
      mockExeca.mockResolvedValue({
        stdout: `<<<COMMIT_MESSAGE_START>>>
feat: add constitution v2 and improve documentation

- Add comprehensive v2 constitution
- Update CLAUDE.md with v2 references
<<<COMMIT_MESSAGE_END>>>`,
      } as never);

      const message = await agent.generate('prompt', '/tmp');

      // Should clean markers and return only the commit message
      expect(message).toBe(
        `feat: add constitution v2 and improve documentation

- Add comprehensive v2 constitution
- Update CLAUDE.md with v2 references`
      );
    });

    it('should clean COMMIT_MESSAGE markers with extra whitespace', async () => {
      // Mock execa to return response with markers and extra whitespace
      mockExeca.mockResolvedValue({
        stdout: `
<<<COMMIT_MESSAGE_START>>>

feat: add feature

- Implement new functionality
<<<COMMIT_MESSAGE_END>>>
`,
      } as never);

      const message = await agent.generate('prompt', '/tmp');

      // Should clean markers and trim whitespace
      expect(message).toBe(`feat: add feature

- Implement new functionality`);
    });
  });
});
