import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProviderConfig } from '../../../providers/index';

import { checkProviderCommand } from '../check-provider';

// Mock the providers module
vi.mock('../../../providers/index', () => ({
  createProvider: vi.fn(),
}));

describe('checkProviderCommand', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);

    vi.resetModules();
  });

  it('should check default Claude provider when no config provided', async () => {
    const { createProvider } = await import('../../../providers/index');
    const mockProvider = {
      getName: vi.fn(() => 'Claude CLI'),
      isAvailable: vi.fn(async () => true),
    };

    vi.mocked(createProvider).mockReturnValue(mockProvider as never);

    await expect(checkProviderCommand()).rejects.toThrow('process.exit called');

    expect(createProvider).toHaveBeenCalledWith({ type: 'cli', provider: 'claude' });
    expect(mockProvider.isAvailable).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Provider 'Claude CLI' is available"),
    );
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  it('should check custom provider when config provided', async () => {
    const { createProvider } = await import('../../../providers/index');
    const mockProvider = {
      getName: vi.fn(() => 'Codex CLI'),
      isAvailable: vi.fn(async () => true),
    };

    vi.mocked(createProvider).mockReturnValue(mockProvider as never);

    const config: ProviderConfig = {
      type: 'cli',
      provider: 'codex',
    };

    await expect(checkProviderCommand(config)).rejects.toThrow('process.exit called');

    expect(createProvider).toHaveBeenCalledWith(config);
    expect(mockProvider.isAvailable).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Provider 'Codex CLI' is available"),
    );
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  it('should exit with code 1 when provider is not available', async () => {
    const { createProvider } = await import('../../../providers/index');
    const mockProvider = {
      getName: vi.fn(() => 'Claude CLI'),
      isAvailable: vi.fn(async () => false),
    };

    vi.mocked(createProvider).mockReturnValue(mockProvider as never);

    await expect(checkProviderCommand()).rejects.toThrow('process.exit called');

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Provider 'Claude CLI' is not available"),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Make sure the CLI tool is installed'),
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle errors during provider creation', async () => {
    const { createProvider } = await import('../../../providers/index');

    vi.mocked(createProvider).mockImplementation(() => {
      throw new Error('Provider creation failed');
    });

    await expect(checkProviderCommand()).rejects.toThrow('process.exit called');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error checking provider'),
      expect.stringContaining('Provider creation failed'),
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle errors during availability check', async () => {
    const { createProvider } = await import('../../../providers/index');
    const mockProvider = {
      getName: vi.fn(() => 'Claude CLI'),
      isAvailable: vi.fn(async () => {
        throw new Error('Availability check failed');
      }),
    };

    vi.mocked(createProvider).mockReturnValue(mockProvider as never);

    await expect(checkProviderCommand()).rejects.toThrow('process.exit called');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error checking provider'),
      expect.stringContaining('Availability check failed'),
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
