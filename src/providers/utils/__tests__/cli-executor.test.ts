import type { Result } from 'execa';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProviderError, ProviderTimeoutError } from '../../errors';
import { CLIExecutor } from '../cli-executor';

// Mock execa
vi.mock('execa');

// Helper to create properly typed execa mock result
function createExecaResult(overrides: Partial<Result> = {}): Result {
  return {
    command: 'test-command',
    escapedCommand: 'test-command',
    exitCode: 0,
    stdout: '',
    stderr: '',
    failed: false,
    timedOut: false,
    isCanceled: false,
    killed: false,
    signal: undefined,
    signalDescription: undefined,
    cwd: process.cwd(),
    durationMs: 0,
    pipedFrom: [],
    ...overrides,
  } as Result;
}

describe('CLIExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should execute command and return stdout', async () => {
      const { execa } = await import('execa');
      vi.mocked(execa).mockResolvedValue(
        createExecaResult({
          stdout: 'success output',
        }),
      );

      const result = await CLIExecutor.execute('test-command', ['arg1', 'arg2']);

      expect(result).toBe('success output');
      expect(execa).toHaveBeenCalledWith('test-command', ['arg1', 'arg2'], {
        cwd: undefined,
        env: undefined,
        input: undefined,
        timeout: undefined,
        stdin: undefined,
        reject: false,
      });
    });

    it('should pass cwd option to execa', async () => {
      const { execa } = await import('execa');
      vi.mocked(execa).mockResolvedValue(
        createExecaResult({
          stdout: 'output',
        }),
      );

      await CLIExecutor.execute('test-command', [], { cwd: '/test/dir' });

      expect(execa).toHaveBeenCalledWith(
        'test-command',
        [],
        expect.objectContaining({ cwd: '/test/dir' }),
      );
    });

    it('should pass env vars to execa', async () => {
      const { execa } = await import('execa');
      vi.mocked(execa).mockResolvedValue(
        createExecaResult({
          stdout: 'output',
        }),
      );

      const env = { TEST_VAR: 'test-value' };
      await CLIExecutor.execute('test-command', [], { env });

      expect(execa).toHaveBeenCalledWith('test-command', [], expect.objectContaining({ env }));
    });

    it('should pass timeout to execa', async () => {
      const { execa } = await import('execa');
      vi.mocked(execa).mockResolvedValue(
        createExecaResult({
          stdout: 'output',
        }),
      );

      await CLIExecutor.execute('test-command', [], { timeout: 5000 });

      expect(execa).toHaveBeenCalledWith(
        'test-command',
        [],
        expect.objectContaining({ timeout: 5000 }),
      );
    });

    it('should pass input to execa when provided', async () => {
      const { execa } = await import('execa');
      vi.mocked(execa).mockResolvedValue(
        createExecaResult({
          stdout: 'output',
        }),
      );

      await CLIExecutor.execute('test-command', [], { input: 'test input' });

      expect(execa).toHaveBeenCalledWith(
        'test-command',
        [],
        expect.objectContaining({
          input: 'test input',
          stdin: 'pipe',
        }),
      );
    });

    it('should throw ProviderError on non-zero exit code', async () => {
      const { execa } = await import('execa');
      vi.mocked(execa).mockResolvedValue(
        createExecaResult({
          stderr: 'error message',
          exitCode: 1,
        }),
      );

      await expect(CLIExecutor.execute('test-command', [])).rejects.toThrow(ProviderError);
      await expect(CLIExecutor.execute('test-command', [])).rejects.toThrow(
        'Command failed with exit code 1',
      );
    });

    it('should throw ProviderTimeoutError on timeout', async () => {
      const { execa } = await import('execa');
      const timeoutError = new Error('Command timed out');
      Object.assign(timeoutError, { timedOut: true });
      vi.mocked(execa).mockRejectedValue(timeoutError);

      await expect(CLIExecutor.execute('test-command', [], { timeout: 1000 })).rejects.toThrow(
        ProviderTimeoutError,
      );
    });

    it('should throw ProviderError on command not found', async () => {
      const { execa } = await import('execa');
      vi.mocked(execa).mockRejectedValue(new Error('Command not found'));

      await expect(CLIExecutor.execute('nonexistent-command', [])).rejects.toThrow(ProviderError);
    });
  });

  describe('checkAvailable', () => {
    it('should return true when --version succeeds', async () => {
      const { execa } = await import('execa');
      vi.mocked(execa).mockResolvedValue(createExecaResult());

      const result = await CLIExecutor.checkAvailable('test-command');

      expect(result).toBe(true);
      expect(execa).toHaveBeenCalledWith('test-command', ['--version'], {
        reject: false,
        timeout: 5000,
      });
    });

    it('should try --help if --version fails', async () => {
      const { execa } = await import('execa');
      vi.mocked(execa)
        .mockResolvedValueOnce(
          createExecaResult({
            exitCode: 1,
          }),
        )
        .mockResolvedValueOnce(createExecaResult());

      const result = await CLIExecutor.checkAvailable('test-command');

      expect(result).toBe(true);
      expect(execa).toHaveBeenCalledWith('test-command', ['--version'], expect.any(Object));
      expect(execa).toHaveBeenCalledWith('test-command', ['--help'], expect.any(Object));
    });

    it('should return false when both --version and --help fail', async () => {
      const { execa } = await import('execa');
      vi.mocked(execa).mockResolvedValue(
        createExecaResult({
          exitCode: 1,
        }),
      );

      const result = await CLIExecutor.checkAvailable('test-command');

      expect(result).toBe(false);
    });

    it('should return false when command throws error', async () => {
      const { execa } = await import('execa');
      vi.mocked(execa).mockRejectedValue(new Error('Command not found'));

      const result = await CLIExecutor.checkAvailable('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('executeRaw', () => {
    it('should return full result object', async () => {
      const { execa } = await import('execa');
      vi.mocked(execa).mockResolvedValue(
        createExecaResult({
          stdout: 'output',
          stderr: 'error',
        }),
      );

      const result = await CLIExecutor.executeRaw('test-command', []);

      expect(result).toEqual(
        expect.objectContaining({
          stdout: 'output',
          stderr: 'error',
          exitCode: 0,
          timedOut: false,
        }),
      );
    });

    it('should not throw on non-zero exit code', async () => {
      const { execa } = await import('execa');
      vi.mocked(execa).mockResolvedValue(
        createExecaResult({
          stderr: 'error',
          exitCode: 1,
        }),
      );

      const result = await CLIExecutor.executeRaw('test-command', []);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe('error');
    });

    it('should throw ProviderTimeoutError on timeout', async () => {
      const { execa } = await import('execa');
      const timeoutError = new Error('Timeout');
      Object.assign(timeoutError, { timedOut: true });
      vi.mocked(execa).mockRejectedValue(timeoutError);

      await expect(CLIExecutor.executeRaw('test-command', [], { timeout: 1000 })).rejects.toThrow(
        ProviderTimeoutError,
      );
    });

    it('should include timedOut flag in result', async () => {
      const { execa } = await import('execa');
      vi.mocked(execa).mockResolvedValue(
        createExecaResult({
          exitCode: 124, // Common timeout exit code
          timedOut: true,
        }),
      );

      const result = await CLIExecutor.executeRaw('test-command', [], { timeout: 1000 });

      expect(result.timedOut).toBe(true);
    });

    it('should handle missing timedOut property', async () => {
      const { execa } = await import('execa');
      vi.mocked(execa).mockResolvedValue(
        createExecaResult({
          stdout: 'output',
        }),
      );

      const result = await CLIExecutor.executeRaw('test-command', []);

      expect(result.timedOut).toBe(false);
    });
  });
});
