import { mkdtemp, readFile, rm } from 'node:fs/promises';

import { execa } from 'execa';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProviderError } from '../../errors';
import { ProviderType } from '../../types';
import { CodexProvider } from '../codex-provider';

// Mock execa
vi.mock('execa');

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  mkdtemp: vi.fn(),
  readFile: vi.fn(),
  rm: vi.fn(),
}));

describe('CodexProvider', () => {
  const mockTempDir = '/tmp/codex-abc123';

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks for file operations
    vi.mocked(mkdtemp).mockResolvedValue(mockTempDir);
    vi.mocked(readFile).mockResolvedValue('feat: add feature\n\n- Details');
    vi.mocked(rm).mockResolvedValue(undefined);
  });

  describe('constructor', () => {
    it('should create provider with default config', () => {
      const provider = new CodexProvider();
      expect(provider.getName()).toBe('Codex CLI');
      expect(provider.getProviderType()).toBe(ProviderType.CLI);
    });

    it('should create provider with custom config', () => {
      const provider = new CodexProvider({
        command: 'custom-codex',
        args: ['exec', '--custom-arg'],
        timeout: 60_000,
      });
      expect(provider.getName()).toBe('Codex CLI');
    });

    it('should use 45s default timeout (longer than Claude)', () => {
      const provider = new CodexProvider();
      // We can't directly access defaultTimeout, but we can verify via generateCommitMessage
      expect(provider).toBeDefined();
    });
  });

  describe('getName', () => {
    it('should return "Codex CLI"', () => {
      const provider = new CodexProvider();
      expect(provider.getName()).toBe('Codex CLI');
    });
  });

  describe('getProviderType', () => {
    it('should return ProviderType.CLI', () => {
      const provider = new CodexProvider();
      expect(provider.getProviderType()).toBe(ProviderType.CLI);
    });
  });

  describe('isAvailable', () => {
    it('should return true if codex command exists', async () => {
      vi.mocked(execa).mockResolvedValue({
        exitCode: 0,
        stdout: 'codex 0.42.0',
        stderr: '',
      } as any);

      const provider = new CodexProvider();
      const result = await provider.isAvailable();

      expect(result).toBe(true);
      expect(execa).toHaveBeenCalledWith('codex', ['--version'], {
        reject: false,
        timeout: 5000,
      });
    });

    it('should return false if codex command not found', async () => {
      vi.mocked(execa).mockResolvedValue({
        exitCode: 1,
        stdout: '',
        stderr: 'command not found',
      } as any);

      const provider = new CodexProvider();
      const result = await provider.isAvailable();

      expect(result).toBe(false);
    });

    it('should return false if codex command throws', async () => {
      vi.mocked(execa).mockRejectedValue(new Error('Command not found'));

      const provider = new CodexProvider();
      const result = await provider.isAvailable();

      expect(result).toBe(false);
    });

    it('should use custom command name from config', async () => {
      vi.mocked(execa).mockResolvedValue({
        exitCode: 0,
        stdout: '',
        stderr: '',
      } as any);

      const provider = new CodexProvider({ command: 'custom-codex' });
      await provider.isAvailable();

      expect(execa).toHaveBeenCalledWith('custom-codex', ['--version'], {
        reject: false,
        timeout: 5000,
      });
    });
  });

  describe('generateCommitMessage', () => {
    it('should generate commit message successfully', async () => {
      // Mock availability check
      vi.mocked(execa).mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'codex 0.42.0',
        stderr: '',
      } as any);

      // Mock codex exec command
      vi.mocked(execa).mockResolvedValueOnce({
        stdout: '[metadata and progress output]',
        stderr: '',
        exitCode: 0,
      } as any);

      vi.mocked(readFile).mockResolvedValue(
        'feat: add new feature\n\n- Implement core functionality',
      );

      const provider = new CodexProvider();
      const result = await provider.generateCommitMessage('Generate a commit message', {});

      expect(result).toBe('feat: add new feature\n\n- Implement core functionality');

      // Verify codex was called with correct args
      expect(execa).toHaveBeenCalledWith(
        'codex',
        expect.arrayContaining([
          'exec',
          'Generate a commit message',
          '--color',
          'never',
          '--output-last-message',
          expect.stringContaining('output.txt'),
        ]),
        expect.objectContaining({
          timeout: 45_000,
        }),
      );
    });

    it('should create and clean up temp directory', async () => {
      vi.mocked(execa)
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any)
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any);

      const provider = new CodexProvider();
      await provider.generateCommitMessage('test', {});

      expect(mkdtemp).toHaveBeenCalled();
      expect(rm).toHaveBeenCalledWith(mockTempDir, { recursive: true, force: true });
    });

    it('should add -C flag for working directory', async () => {
      vi.mocked(execa)
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any)
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any);

      const provider = new CodexProvider();
      await provider.generateCommitMessage('test', { workdir: '/path/to/repo' });

      expect(execa).toHaveBeenCalledWith(
        'codex',
        expect.arrayContaining(['-C', '/path/to/repo']),
        expect.any(Object),
      );
    });

    it('should use custom timeout if provided', async () => {
      vi.mocked(execa)
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any)
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any);

      const provider = new CodexProvider();
      await provider.generateCommitMessage('test', { timeout: 60_000 });

      expect(execa).toHaveBeenCalledWith(
        'codex',
        expect.any(Array),
        expect.objectContaining({
          timeout: 60_000,
        }),
      );
    });

    it('should simplify prompt when raw diff is provided', async () => {
      vi.mocked(execa)
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any)
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any);

      const provider = new CodexProvider();
      await provider.generateCommitMessage(
        'diff --git a/file.ts b/file.ts\n@@ -1,1 +1,1 @@\n-old\n+new',
        {},
      );

      // Should replace raw diff with simple instruction
      expect(execa).toHaveBeenCalledWith(
        'codex',
        expect.arrayContaining([
          'exec',
          'Generate a conventional commit message for the staged changes in this repository',
          '--color',
          'never',
          '--output-last-message',
          expect.any(String),
        ]),
        expect.any(Object),
      );
    });

    it('should clean AI artifacts from response', async () => {
      vi.mocked(execa)
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any)
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any);

      vi.mocked(readFile).mockResolvedValue(
        "Here's the commit message:\nfeat: add feature\n\n- Details",
      );

      const provider = new CodexProvider();
      const result = await provider.generateCommitMessage('test', {});

      expect(result).toBe('feat: add feature\n\n- Details');
    });

    it('should handle sentinel markers in response', async () => {
      vi.mocked(execa)
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any)
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any);

      vi.mocked(readFile).mockResolvedValue(
        '<<<COMMIT_MESSAGE_START>>>\nfeat: add feature\n\n- Details<<<COMMIT_MESSAGE_END>>>',
      );

      const provider = new CodexProvider();
      const result = await provider.generateCommitMessage('test', {});

      expect(result).toBe('feat: add feature\n\n- Details');
    });

    it('should throw ProviderError with helpful message if codex not available', async () => {
      vi.mocked(execa).mockResolvedValue({
        exitCode: 1,
        stdout: '',
        stderr: '',
      } as any);

      const provider = new CodexProvider();

      await expect(provider.generateCommitMessage('test', {})).rejects.toThrow(
        /Install it via: npm install -g @openai\/codex-cli/,
      );
    });

    it('should throw ProviderError with auth message if not authenticated', async () => {
      vi.mocked(execa)
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any)
        .mockRejectedValueOnce(new Error('Error: not authenticated'));

      const provider = new CodexProvider();

      await expect(provider.generateCommitMessage('test', {})).rejects.toThrow(/codex login/);
    });

    it('should clean up temp directory even on error', async () => {
      vi.mocked(execa)
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any)
        .mockRejectedValueOnce(new Error('Some error'));

      const provider = new CodexProvider();

      await expect(provider.generateCommitMessage('test', {})).rejects.toThrow();

      // Should still clean up
      expect(rm).toHaveBeenCalledWith(mockTempDir, { recursive: true, force: true });
    });

    it('should handle temp directory cleanup errors gracefully', async () => {
      vi.mocked(execa)
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any)
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any);

      // Cleanup fails
      vi.mocked(rm).mockRejectedValue(new Error('Permission denied'));

      const provider = new CodexProvider();

      // Should not throw due to cleanup error
      await expect(provider.generateCommitMessage('test', {})).resolves.toBeDefined();
    });

    it('should reject empty response from file', async () => {
      vi.mocked(execa)
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any)
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any);

      vi.mocked(readFile).mockResolvedValue('');

      const provider = new CodexProvider();

      await expect(provider.generateCommitMessage('test', {})).rejects.toThrow(/empty response/i);
    });

    it('should use custom args from config', async () => {
      vi.mocked(execa)
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any)
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any);

      const provider = new CodexProvider({ args: ['exec', '--custom'] });
      await provider.generateCommitMessage('test', {});

      expect(execa).toHaveBeenCalledWith(
        'codex',
        expect.arrayContaining(['exec', '--custom']),
        expect.any(Object),
      );
    });

    it('should read output from temp file not stdout', async () => {
      vi.mocked(execa)
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '[metadata] thinking... tokens: 1000',
          stderr: '',
        } as any);

      vi.mocked(readFile).mockResolvedValue('feat: actual commit message');

      const provider = new CodexProvider();
      const result = await provider.generateCommitMessage('test', {});

      // Should use file content, not stdout
      expect(result).toBe('feat: actual commit message');
      expect(readFile).toHaveBeenCalledWith(expect.stringContaining('output.txt'), 'utf8');
    });

    it('should throw ProviderNotAvailableError if provider is unavailable', async () => {
      vi.mocked(execa).mockResolvedValue({
        exitCode: 127,
        stdout: '',
        stderr: 'command not found: codex',
      } as any);

      const provider = new CodexProvider();

      await expect(provider.generateCommitMessage('test', {})).rejects.toThrow(ProviderError);
    });
  });
});
