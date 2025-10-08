import { execa } from 'execa';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClaudeProvider } from '../claude-provider';
import { ProviderNotAvailableError, ProviderTimeoutError } from '../errors';
import { ProviderType } from '../types';

// Mock execa
vi.mock('execa');

describe('ClaudeProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create provider with default config', () => {
      const provider = new ClaudeProvider();
      expect(provider.getName()).toBe('Claude CLI');
      expect(provider.getProviderType()).toBe(ProviderType.CLI);
    });

    it('should create provider with custom config', () => {
      const provider = new ClaudeProvider({
        command: 'custom-claude',
        args: ['--custom-arg'],
        timeout: 5000,
      });
      expect(provider.getName()).toBe('Claude CLI');
    });
  });

  describe('isAvailable', () => {
    it('should return true if claude command exists', async () => {
      vi.mocked(execa).mockResolvedValue({
        exitCode: 0,
        stdout: '',
        stderr: '',
      } as any);

      const provider = new ClaudeProvider();
      const result = await provider.isAvailable();

      expect(result).toBe(true);
      expect(execa).toHaveBeenCalledWith('claude', ['--version'], {
        reject: false,
        timeout: 5000,
      });
    });

    it('should return false if claude command not found', async () => {
      vi.mocked(execa).mockResolvedValue({
        exitCode: 1,
        stdout: '',
        stderr: '',
      } as any);

      const provider = new ClaudeProvider();
      const result = await provider.isAvailable();

      expect(result).toBe(false);
    });

    it('should return false if claude command throws', async () => {
      vi.mocked(execa).mockRejectedValue(new Error('Command not found'));

      const provider = new ClaudeProvider();
      const result = await provider.isAvailable();

      expect(result).toBe(false);
    });

    it('should use custom command name from config', async () => {
      vi.mocked(execa).mockResolvedValue({
        exitCode: 0,
        stdout: '',
        stderr: '',
      } as any);

      const provider = new ClaudeProvider({ command: 'custom-claude' });
      await provider.isAvailable();

      expect(execa).toHaveBeenCalledWith('custom-claude', ['--version'], {
        reject: false,
        timeout: 5000,
      });
    });
  });

  describe('generateCommitMessage', () => {
    it('should generate commit message successfully', async () => {
      vi.mocked(execa)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '',
          stderr: '',
        } as any)
        .mockResolvedValueOnce({
          stdout: 'feat: add new feature\n\n- Implement core functionality',
          stderr: '',
          exitCode: 0,
        } as any);

      const provider = new ClaudeProvider();
      const result = await provider.generateCommitMessage('test prompt', {});

      expect(result).toBe('feat: add new feature\n\n- Implement core functionality');
      expect(execa).toHaveBeenCalledWith(
        'claude',
        ['--print'],
        expect.objectContaining({
          stdin: 'pipe',
          input: 'test prompt',
        }),
      );
    });

    it('should clean response with sentinel markers', async () => {
      vi.mocked(execa)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '',
          stderr: '',
        } as any)
        .mockResolvedValueOnce({
          stdout:
            '<<<COMMIT_MESSAGE_START>>>\nfeat: add feature\n\n- Details<<<COMMIT_MESSAGE_END>>>',
          stderr: '',
          exitCode: 0,
        } as any);

      const provider = new ClaudeProvider();
      const result = await provider.generateCommitMessage('test prompt', {});

      expect(result).toBe('feat: add feature\n\n- Details');
    });

    it('should remove common AI preamble', async () => {
      vi.mocked(execa)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '',
          stderr: '',
        } as any)
        .mockResolvedValueOnce({
          stdout: "Here's the commit message:\nfeat: add feature\n\n- Details",
          stderr: '',
          exitCode: 0,
        } as any);

      const provider = new ClaudeProvider();
      const result = await provider.generateCommitMessage('test prompt', {});

      expect(result).toBe('feat: add feature\n\n- Details');
    });

    it('should handle responses with looking/analyzing preamble', async () => {
      vi.mocked(execa)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '',
          stderr: '',
        } as any)
        .mockResolvedValueOnce({
          stdout: 'Looking at the changes\nAnalyzing the code\nfeat: add feature\n\n- Details',
          stderr: '',
          exitCode: 0,
        } as any);

      const provider = new ClaudeProvider();
      const result = await provider.generateCommitMessage('test prompt', {});

      expect(result).toBe('feat: add feature\n\n- Details');
    });

    it('should use custom workdir if provided', async () => {
      vi.mocked(execa)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '',
          stderr: '',
        } as any)
        .mockResolvedValueOnce({
          stdout: 'feat: add feature',
          stderr: '',
          exitCode: 0,
        } as any);

      const provider = new ClaudeProvider();
      await provider.generateCommitMessage('test prompt', { workdir: '/test/dir' });

      expect(execa).toHaveBeenCalledWith(
        'claude',
        ['--print'],
        expect.objectContaining({
          cwd: '/test/dir',
        }),
      );
    });

    it('should use custom timeout if provided', async () => {
      vi.mocked(execa)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '',
          stderr: '',
        } as any)
        .mockResolvedValueOnce({
          stdout: 'feat: add feature',
          stderr: '',
          exitCode: 0,
        } as any);

      const provider = new ClaudeProvider();
      await provider.generateCommitMessage('test prompt', { timeout: 10_000 });

      expect(execa).toHaveBeenCalledWith(
        'claude',
        ['--print'],
        expect.objectContaining({
          timeout: 10_000,
        }),
      );
    });

    it('should use custom args from config', async () => {
      vi.mocked(execa)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '',
          stderr: '',
        } as any)
        .mockResolvedValueOnce({
          stdout: 'feat: add feature',
          stderr: '',
          exitCode: 0,
        } as any);

      const provider = new ClaudeProvider({ args: ['--custom', '--args'] });
      await provider.generateCommitMessage('test prompt', {});

      expect(execa).toHaveBeenCalledWith('claude', ['--custom', '--args'], expect.any(Object));
    });

    it('should throw ProviderNotAvailableError if provider is unavailable', async () => {
      vi.mocked(execa).mockResolvedValue({
        exitCode: 1,
        stdout: '',
        stderr: '',
      } as any);

      const provider = new ClaudeProvider();
      await expect(provider.generateCommitMessage('test prompt', {})).rejects.toThrow(
        ProviderNotAvailableError,
      );
    });

    it('should throw ProviderTimeoutError on timeout', async () => {
      const timeoutError = new Error('Timeout');
      (timeoutError as any).timedOut = true;

      vi.mocked(execa)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '',
          stderr: '',
        } as any)
        .mockRejectedValueOnce(timeoutError);

      const provider = new ClaudeProvider();
      await expect(provider.generateCommitMessage('test prompt', {})).rejects.toThrow(
        ProviderTimeoutError,
      );
    });

    it('should handle empty response gracefully', async () => {
      vi.mocked(execa)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '',
          stderr: '',
        } as any)
        .mockResolvedValueOnce({
          stdout: '',
          stderr: '',
          exitCode: 0,
        } as any);

      const provider = new ClaudeProvider();
      const result = await provider.generateCommitMessage('test prompt', {});

      expect(result).toBe('');
    });

    it('should clean code blocks from response', async () => {
      vi.mocked(execa)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '',
          stderr: '',
        } as any)
        .mockResolvedValueOnce({
          stdout: '```\nfeat: add feature\n\n- Details\n```',
          stderr: '',
          exitCode: 0,
        } as any);

      const provider = new ClaudeProvider();
      const result = await provider.generateCommitMessage('test prompt', {});

      expect(result).toBe('feat: add feature\n\n- Details');
    });

    it('should keep bullet points in cleaned response', async () => {
      vi.mocked(execa)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '',
          stderr: '',
        } as any)
        .mockResolvedValueOnce({
          stdout: 'feat: add feature\n\n- Point 1\n- Point 2\n- Point 3',
          stderr: '',
          exitCode: 0,
        } as any);

      const provider = new ClaudeProvider();
      const result = await provider.generateCommitMessage('test prompt', {});

      expect(result).toBe('feat: add feature\n\n- Point 1\n- Point 2\n- Point 3');
    });
  });
});
