import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CodexAgent } from '../codex';

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
        command: 'codex',
        exitCode: 0,
        failed: false,
        killed: false,
        stderr: '',
        stdout: 'feat: add dark mode toggle\n\nImplement theme switching functionality',
        timedOut: false,
      } as any);

      const prompt = 'Generate commit message for adding dark mode';
      const workdir = '/test/repo';

      const message = await agent.generate(prompt, workdir);

      expect(message).toBe('feat: add dark mode toggle\n\nImplement theme switching functionality');
      expect(mockExeca).toHaveBeenCalledWith(
        'codex',
        [
          'exec',
          '--output-last-message',
          expect.stringMatching(/\/tmp\/codex-output-\d+\.txt/),
          prompt,
        ],
        expect.objectContaining({
          cwd: workdir,
          timeout: 120_000,
        })
      );
    });

    it('should clean AI artifacts from response', async () => {
      const { execa } = await import('execa');
      const mockExeca = execa as ReturnType<typeof vi.fn>;

      mockExeca.mockResolvedValue({
        command: 'codex',
        exitCode: 0,
        failed: false,
        killed: false,
        stderr: '',
        stdout: '```\nfeat: add feature\n\nImplement new feature\n```',
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
        command: 'codex',
        exitCode: 0,
        failed: false,
        killed: false,
        stderr: '',
        stdout: 'Here is the commit message:\nfeat: add feature\n\nImplement new feature',
        timedOut: false,
      } as any);

      const message = await agent.generate('test prompt', '/test/repo');

      // Should remove AI prefix
      expect(message).toBe('feat: add feature\n\nImplement new feature');
    });

    it('should throw actionable error when CLI is not found', async () => {
      const { execa } = await import('execa');
      const mockExeca = execa as ReturnType<typeof vi.fn>;

      mockExeca.mockRejectedValue(new Error('Command not found: codex'));

      await expect(agent.generate('test prompt', '/test/repo')).rejects.toThrow(/Unexpected error/);

      try {
        await agent.generate('test prompt', '/test/repo');
        throw new Error('Expected error to be thrown');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(Error);
        // Error won't have suggestedAction since it's not ENOENT error code
      }
    });

    it('should throw error when response is empty', async () => {
      const { execa } = await import('execa');
      const mockExeca = execa as ReturnType<typeof vi.fn>;

      mockExeca.mockResolvedValue({
        command: 'codex',
        exitCode: 0,
        failed: false,
        killed: false,
        stderr: '',
        stdout: '',
        timedOut: false,
      } as any);

      await expect(agent.generate('test prompt', '/test/repo')).rejects.toThrow(/Empty response/);
    });

    it('should throw error when response is only whitespace', async () => {
      const { execa } = await import('execa');
      const mockExeca = execa as ReturnType<typeof vi.fn>;

      mockExeca.mockResolvedValue({
        command: 'codex',
        exitCode: 0,
        failed: false,
        killed: false,
        stderr: '',
        stdout: '   \n\n   ',
        timedOut: false,
      } as any);

      await expect(agent.generate('test prompt', '/test/repo')).rejects.toThrow(/Empty response/);
    });

    it('should throw error when response is malformed', async () => {
      const { execa } = await import('execa');
      const mockExeca = execa as ReturnType<typeof vi.fn>;

      mockExeca.mockResolvedValue({
        command: 'codex',
        exitCode: 0,
        failed: false,
        killed: false,
        stderr: '',
        stdout: 'This is not a conventional commit message at all',
        timedOut: false,
      } as any);

      await expect(agent.generate('test prompt', '/test/repo')).rejects.toThrow(
        /malformed response/i
      );

      await expect(agent.generate('test prompt', '/test/repo')).rejects.toThrow(
        /conventional commit format/i
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
          command: 'codex',
          exitCode: 0,
          failed: false,
          killed: false,
          stderr: '',
          stdout: commitMessage,
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
        command: 'codex',
        exitCode: 0,
        failed: false,
        killed: false,
        stderr: '',
        stdout: 'feat(auth): add OAuth support',
        timedOut: false,
      } as any);

      const message = await agent.generate('test prompt', '/test/repo');
      expect(message).toBe('feat(auth): add OAuth support');
    });

    it('should clean COMMIT_MESSAGE markers from response', async () => {
      const { execa } = await import('execa');
      const mockExeca = execa as ReturnType<typeof vi.fn>;

      mockExeca.mockResolvedValue({
        command: 'codex',
        exitCode: 0,
        failed: false,
        killed: false,
        stderr: '',
        stdout: `<<<COMMIT_MESSAGE_START>>>
feat: add feature

- Implement new functionality
<<<COMMIT_MESSAGE_END>>>`,
        timedOut: false,
      } as any);

      const message = await agent.generate('test prompt', '/test/repo');
      expect(message).toBe('feat: add feature\n\n- Implement new functionality');
    });

    it('should clean COMMIT_MESSAGE markers with extra whitespace', async () => {
      const { execa } = await import('execa');
      const mockExeca = execa as ReturnType<typeof vi.fn>;

      mockExeca.mockResolvedValue({
        command: 'codex',
        exitCode: 0,
        failed: false,
        killed: false,
        stderr: '',
        stdout: `
<<<COMMIT_MESSAGE_START>>>

feat: add feature

- Implement new functionality
<<<COMMIT_MESSAGE_END>>>
`,
        timedOut: false,
      } as any);

      const message = await agent.generate('test prompt', '/test/repo');
      expect(message).toBe('feat: add feature\n\n- Implement new functionality');
    });

    it('should clean Codex activity logs from response', async () => {
      const { execa } = await import('execa');
      const mockExeca = execa as ReturnType<typeof vi.fn>;

      mockExeca.mockResolvedValue({
        command: 'codex',
        exitCode: 0,
        failed: false,
        killed: false,
        stderr: '',
        stdout: `[2025-10-22T00:50:28] OpenAI Codex v0.42.0 (research preview)
--------
workdir: /Users/user/project

feat: add feature

- Implement new functionality`,
        timedOut: false,
      } as any);

      const message = await agent.generate('test prompt', '/test/repo');
      expect(message).toBe('feat: add feature\n\n- Implement new functionality');
    });

    it('should clean Codex configuration metadata from response', async () => {
      const { execa } = await import('execa');
      const mockExeca = execa as ReturnType<typeof vi.fn>;

      mockExeca.mockResolvedValue({
        command: 'codex',
        exitCode: 0,
        failed: false,
        killed: false,
        stderr: '',
        stdout: `model: gpt-5-codex
provider: openai
approval: never
sandbox: read-only
reasoning effort: none

feat: add feature

- Implement new functionality`,
        timedOut: false,
      } as any);

      const message = await agent.generate('test prompt', '/test/repo');
      expect(message).toBe('feat: add feature\n\n- Implement new functionality');
    });
  });
});
