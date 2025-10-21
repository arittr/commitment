import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CodexAgent } from '../codex.js';

// Mock execa module
vi.mock('execa', () => ({
  execa: vi.fn(),
}));

describe('CodexAgent', () => {
  let agent: CodexAgent;

  beforeEach(() => {
    agent = new CodexAgent();
    vi.clearAllMocks();
  });

  describe('name', () => {
    it('should return correct agent name', () => {
      expect(agent.name).toBe('Codex CLI');
    });
  });

  describe('generate', () => {
    it('should generate commit message from prompt', async () => {
      const { execa } = await import('execa');
      const mockExeca = execa as ReturnType<typeof vi.fn>;

      mockExeca.mockResolvedValue({
        stdout: 'feat: add dark mode toggle\n\nImplement theme switching functionality',
        stderr: '',
        exitCode: 0,
        command: 'codex-sh',
        failed: false,
        killed: false,
        timedOut: false,
      } as any);

      const prompt = 'Generate commit message for adding dark mode';
      const workdir = '/test/repo';

      const message = await agent.generate(prompt, workdir);

      expect(message).toBe('feat: add dark mode toggle\n\nImplement theme switching functionality');
      expect(mockExeca).toHaveBeenCalledWith(
        'codex-sh',
        ['--print'],
        expect.objectContaining({
          input: prompt,
          cwd: workdir,
          timeout: 120_000,
        }),
      );
    });

    it('should clean AI artifacts from response', async () => {
      const { execa } = await import('execa');
      const mockExeca = execa as ReturnType<typeof vi.fn>;

      mockExeca.mockResolvedValue({
        stdout: '```\nfeat: add feature\n\nImplement new feature\n```',
        stderr: '',
        exitCode: 0,
        command: 'codex-sh',
        failed: false,
        killed: false,
        timedOut: false,
      } as any);

      const message = await agent.generate('test prompt', '/test/repo');

      // Should remove code fences
      expect(message).toBe('feat: add feature\n\nImplement new feature');
    });

    it('should clean AI prefix artifacts from response', async () => {
      const { execa } = await import('execa');
      const mockExeca = execa as ReturnType<typeof vi.fn>;

      mockExeca.mockResolvedValue({
        stdout: 'Here is the commit message:\nfeat: add feature\n\nImplement new feature',
        stderr: '',
        exitCode: 0,
        command: 'codex-sh',
        failed: false,
        killed: false,
        timedOut: false,
      } as any);

      const message = await agent.generate('test prompt', '/test/repo');

      // Should remove AI prefix
      expect(message).toBe('feat: add feature\n\nImplement new feature');
    });

    it('should throw actionable error when CLI is not found', async () => {
      const { execa } = await import('execa');
      const mockExeca = execa as ReturnType<typeof vi.fn>;

      mockExeca.mockRejectedValue(new Error('Command not found: codex-sh'));

      await expect(agent.generate('test prompt', '/test/repo')).rejects.toThrow(
        /codex cli not available/i,
      );

      await expect(agent.generate('test prompt', '/test/repo')).rejects.toThrow(
        /npm install -g codex-sh/i,
      );
    });

    it('should throw error when response is empty', async () => {
      const { execa } = await import('execa');
      const mockExeca = execa as ReturnType<typeof vi.fn>;

      mockExeca.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
        command: 'codex-sh',
        failed: false,
        killed: false,
        timedOut: false,
      } as any);

      await expect(agent.generate('test prompt', '/test/repo')).rejects.toThrow(
        /empty or invalid/i,
      );
    });

    it('should throw error when response is only whitespace', async () => {
      const { execa } = await import('execa');
      const mockExeca = execa as ReturnType<typeof vi.fn>;

      mockExeca.mockResolvedValue({
        stdout: '   \n\n   ',
        stderr: '',
        exitCode: 0,
        command: 'codex-sh',
        failed: false,
        killed: false,
        timedOut: false,
      } as any);

      await expect(agent.generate('test prompt', '/test/repo')).rejects.toThrow(
        /empty or invalid/i,
      );
    });

    it('should throw error when response is malformed', async () => {
      const { execa } = await import('execa');
      const mockExeca = execa as ReturnType<typeof vi.fn>;

      mockExeca.mockResolvedValue({
        stdout: 'This is not a conventional commit message at all',
        stderr: '',
        exitCode: 0,
        command: 'codex-sh',
        failed: false,
        killed: false,
        timedOut: false,
      } as any);

      await expect(agent.generate('test prompt', '/test/repo')).rejects.toThrow(
        /malformed response/i,
      );

      await expect(agent.generate('test prompt', '/test/repo')).rejects.toThrow(
        /conventional commit format/i,
      );
    });

    it('should accept valid conventional commit types', async () => {
      const { execa } = await import('execa');
      const mockExeca = execa as ReturnType<typeof vi.fn>;

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
        mockExeca.mockResolvedValue({
          stdout: commitMessage,
          stderr: '',
          exitCode: 0,
          command: 'codex-sh',
          failed: false,
          killed: false,
          timedOut: false,
        } as any);

        const message = await agent.generate('test prompt', '/test/repo');
        expect(message).toBe(commitMessage);
      }
    });

    it('should accept commit messages with scope', async () => {
      const { execa } = await import('execa');
      const mockExeca = execa as ReturnType<typeof vi.fn>;

      mockExeca.mockResolvedValue({
        stdout: 'feat(auth): add OAuth support',
        stderr: '',
        exitCode: 0,
        command: 'codex-sh',
        failed: false,
        killed: false,
        timedOut: false,
      } as any);

      const message = await agent.generate('test prompt', '/test/repo');
      expect(message).toBe('feat(auth): add OAuth support');
    });
  });
});
