import type { Result } from 'execa';

import { execa } from 'execa';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CLIProviderConfig } from '../types';

import { BaseCLIProvider } from '../base/base-cli-provider';
import {
  isProviderNotAvailableError,
  isProviderTimeoutError,
  ProviderNotAvailableError,
  ProviderTimeoutError,
} from '../errors';
import { ProviderType } from '../types';

// Mock execa
vi.mock('execa');

// Helper to create properly typed execa mock result
function createExecaResult(overrides: Partial<Result> = {}): Result {
  return {
    command: 'test-cli',
    escapedCommand: 'test-cli',
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

// Concrete test implementation
class TestCLIProvider extends BaseCLIProvider {
  private available: boolean = true;

  constructor(config: CLIProviderConfig, available = true) {
    super(config);
    this.available = available;
  }

  protected getCommand(): string {
    return this.config.command ?? 'test-cli';
  }

  protected getArgs(): string[] {
    return this.config.args ?? ['--test-arg'];
  }

  getName(): string {
    return 'TestCLIProvider';
  }

  async isAvailable(): Promise<boolean> {
    return this.available;
  }

  // Expose for testing
  setAvailable(available: boolean): void {
    this.available = available;
  }
}

describe('BaseCLIProvider', () => {
  const mockConfig: CLIProviderConfig = {
    type: 'cli',
    provider: 'claude',
    timeout: 5000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateCommitMessage', () => {
    it('should successfully generate commit message', async () => {
      const provider = new TestCLIProvider(mockConfig);
      const mockStdout = 'feat: add new feature';

      vi.mocked(execa).mockResolvedValue(
        createExecaResult({
          stdout: mockStdout,
        }),
      );

      const result = await provider.generateCommitMessage('test prompt', {});

      expect(result).toBe(mockStdout);
      expect(execa).toHaveBeenCalledWith(
        'test-cli',
        ['--test-arg'],
        expect.objectContaining({
          cwd: undefined,
          timeout: 5000,
          input: 'test prompt',
        }),
      );
    });

    it('should use custom command and args from config', async () => {
      const customConfig: CLIProviderConfig = {
        type: 'cli',
        provider: 'claude',
        command: 'custom-cmd',
        args: ['--custom', '--args'],
        timeout: 3000,
      };
      const provider = new TestCLIProvider(customConfig);

      vi.mocked(execa).mockResolvedValue(
        createExecaResult({
          stdout: 'test output',
        }),
      );

      await provider.generateCommitMessage('prompt', {});

      expect(execa).toHaveBeenCalledWith(
        'custom-cmd',
        ['--custom', '--args'],
        expect.objectContaining({
          cwd: undefined,
          timeout: 3000,
          input: 'prompt',
        }),
      );
    });

    it('should use options workdir if provided', async () => {
      const provider = new TestCLIProvider(mockConfig);

      vi.mocked(execa).mockResolvedValue(
        createExecaResult({
          stdout: 'output',
        }),
      );

      await provider.generateCommitMessage('prompt', {
        workdir: '/test/dir',
      });

      expect(execa).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          cwd: '/test/dir',
        }),
      );
    });

    it('should use options timeout if provided', async () => {
      const provider = new TestCLIProvider(mockConfig);

      vi.mocked(execa).mockResolvedValue(
        createExecaResult({
          stdout: 'output',
        }),
      );

      await provider.generateCommitMessage('prompt', {
        timeout: 10_000,
      });

      expect(execa).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          timeout: 10_000,
        }),
      );
    });

    it('should use default timeout (30s) if not configured', async () => {
      const configWithoutTimeout: CLIProviderConfig = {
        type: 'cli',
        provider: 'claude',
      };
      const provider = new TestCLIProvider(configWithoutTimeout);

      vi.mocked(execa).mockResolvedValue(
        createExecaResult({
          stdout: 'output',
        }),
      );

      await provider.generateCommitMessage('prompt', {});

      expect(execa).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          timeout: 30_000,
        }),
      );
    });

    it('should trim whitespace from output', async () => {
      const provider = new TestCLIProvider(mockConfig);

      vi.mocked(execa).mockResolvedValue(
        createExecaResult({
          stdout: '  \n  feat: add feature  \n  ',
        }),
      );

      const result = await provider.generateCommitMessage('prompt', {});

      expect(result).toBe('feat: add feature');
    });

    it('should throw ProviderNotAvailableError if provider is not available', async () => {
      const provider = new TestCLIProvider(mockConfig, false);

      await expect(provider.generateCommitMessage('prompt', {})).rejects.toThrow(
        ProviderNotAvailableError,
      );

      await expect(provider.generateCommitMessage('prompt', {})).rejects.toThrow(
        'Provider is not available or not properly configured',
      );

      // Should not call execa if provider is unavailable
      expect(execa).not.toHaveBeenCalled();
    });

    it('should throw ProviderTimeoutError on timeout', async () => {
      const provider = new TestCLIProvider(mockConfig);

      const timeoutError = Object.assign(new Error('Timeout'), { timedOut: true });
      vi.mocked(execa).mockRejectedValue(timeoutError);

      await expect(provider.generateCommitMessage('prompt', {})).rejects.toThrow(
        ProviderTimeoutError,
      );

      try {
        await provider.generateCommitMessage('prompt', {});
      } catch (error) {
        expect(isProviderTimeoutError(error)).toBe(true);
        if (isProviderTimeoutError(error)) {
          expect(error.timeoutMs).toBe(5000);
          expect(error.providerName).toBe('TestCLIProvider');
        }
      }
    });

    it('should wrap generic errors in ProviderNotAvailableError', async () => {
      const provider = new TestCLIProvider(mockConfig);

      vi.mocked(execa).mockRejectedValue(new Error('Command not found'));

      await expect(provider.generateCommitMessage('prompt', {})).rejects.toThrow(
        ProviderNotAvailableError,
      );

      try {
        await provider.generateCommitMessage('prompt', {});
      } catch (error) {
        expect(isProviderNotAvailableError(error)).toBe(true);
        if (isProviderNotAvailableError(error)) {
          expect(error.message).toContain('Command not found');
          expect(error.providerName).toBe('TestCLIProvider');
        }
      }
    });

    it('should handle non-Error rejections', async () => {
      const provider = new TestCLIProvider(mockConfig);

      vi.mocked(execa).mockRejectedValue('string error');

      await expect(provider.generateCommitMessage('prompt', {})).rejects.toThrow(
        ProviderNotAvailableError,
      );
    });
  });

  describe('getProviderType', () => {
    it('should return CLI provider type', () => {
      const provider = new TestCLIProvider(mockConfig);
      expect(provider.getProviderType()).toBe(ProviderType.CLI);
    });
  });

  describe('prepareInput', () => {
    it('should allow custom input preparation via override', async () => {
      class CustomInputProvider extends TestCLIProvider {
        protected override prepareInput(prompt: string): string {
          return `[CUSTOM] ${prompt} [/CUSTOM]`;
        }
      }

      const provider = new CustomInputProvider(mockConfig);

      vi.mocked(execa).mockResolvedValue(
        createExecaResult({
          stdout: 'output',
        }),
      );

      await provider.generateCommitMessage('test', {});

      expect(execa).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          input: '[CUSTOM] test [/CUSTOM]',
        }),
      );
    });
  });
});
