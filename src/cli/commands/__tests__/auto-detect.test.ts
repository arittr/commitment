import { beforeEach, describe, expect, it, vi } from 'vitest';

import { autoDetectCommand } from '../auto-detect';

// Mock the providers module
vi.mock('../../../providers/index', () => ({
  detectAvailableProvider: vi.fn(),
}));

describe('autoDetectCommand', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.resetModules();
  });

  it('should return detected provider when available', async () => {
    const { detectAvailableProvider } = await import('../../../providers/index');
    const mockProvider = {
      getName: vi.fn(() => 'Claude CLI'),
      isAvailable: vi.fn(async () => true),
      generateCommitMessage: vi.fn(),
      getProviderType: vi.fn(() => 'cli'),
    };

    vi.mocked(detectAvailableProvider).mockResolvedValue(mockProvider as never);

    const result = await autoDetectCommand();

    expect(result).toBe(mockProvider);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Auto-detected provider: Claude CLI'),
    );
  });

  it('should return null when no provider available', async () => {
    const { detectAvailableProvider } = await import('../../../providers/index');

    vi.mocked(detectAvailableProvider).mockResolvedValue(null);

    const result = await autoDetectCommand();

    expect(result).toBeNull();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('No AI providers detected, will use rule-based generation'),
    );
  });

  it('should display success message with provider name', async () => {
    const { detectAvailableProvider } = await import('../../../providers/index');
    const mockProvider = {
      getName: vi.fn(() => 'Codex CLI'),
      isAvailable: vi.fn(async () => true),
      generateCommitMessage: vi.fn(),
      getProviderType: vi.fn(() => 'cli'),
    };

    vi.mocked(detectAvailableProvider).mockResolvedValue(mockProvider as never);

    await autoDetectCommand();

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Auto-detected provider: Codex CLI'),
    );
  });

  it('should call detectAvailableProvider', async () => {
    const { detectAvailableProvider } = await import('../../../providers/index');

    vi.mocked(detectAvailableProvider).mockResolvedValue(null);

    await autoDetectCommand();

    expect(detectAvailableProvider).toHaveBeenCalled();
  });
});
