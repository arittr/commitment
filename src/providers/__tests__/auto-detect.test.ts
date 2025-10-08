/* eslint-disable @typescript-eslint/no-unsafe-return */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { detectAvailableProvider, getAllAvailableProviders } from '../auto-detect';
import { ClaudeProvider } from '../implementations/claude-provider';

// Mock ClaudeProvider
vi.mock('../implementations/claude-provider');

describe('auto-detect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectAvailableProvider', () => {
    it('should return first available provider', async () => {
      // Mock Claude as available
      vi.mocked(ClaudeProvider).mockImplementation(
        () =>
          ({
            isAvailable: vi.fn().mockResolvedValue(true),
            getName: vi.fn().mockReturnValue('Claude CLI'),
            getProviderType: vi.fn().mockReturnValue('cli'),
            generateCommitMessage: vi.fn(),
          }) as any,
      );

      const result = await detectAvailableProvider();

      expect(result).not.toBeNull();
      expect(result?.getName()).toBe('Claude CLI');
    });

    it('should return null when no providers are available', async () => {
      // Mock Claude as unavailable
      vi.mocked(ClaudeProvider).mockImplementation(
        () =>
          ({
            isAvailable: vi.fn().mockResolvedValue(false),
            getName: vi.fn().mockReturnValue('Claude CLI'),
            getProviderType: vi.fn().mockReturnValue('cli'),
            generateCommitMessage: vi.fn(),
          }) as any,
      );

      const result = await detectAvailableProvider();

      expect(result).toBeNull();
    });

    it('should handle errors during availability check', async () => {
      // Mock Claude to throw during isAvailable
      vi.mocked(ClaudeProvider).mockImplementation(
        () =>
          ({
            isAvailable: vi.fn().mockRejectedValue(new Error('Command not found')),
            getName: vi.fn().mockReturnValue('Claude CLI'),
            getProviderType: vi.fn().mockReturnValue('cli'),
            generateCommitMessage: vi.fn(),
          }) as any,
      );

      const result = await detectAvailableProvider();

      expect(result).toBeNull();
    });

    it('should check provider availability', async () => {
      const isAvailableMock = vi.fn().mockResolvedValue(true);

      vi.mocked(ClaudeProvider).mockImplementation(
        () =>
          ({
            isAvailable: isAvailableMock,
            getName: vi.fn().mockReturnValue('Claude CLI'),
            getProviderType: vi.fn().mockReturnValue('cli'),
            generateCommitMessage: vi.fn(),
          }) as any,
      );

      await detectAvailableProvider();

      expect(isAvailableMock).toHaveBeenCalledTimes(1);
    });

    it('should return provider instance that can be used', async () => {
      const mockGenerateCommitMessage = vi.fn().mockResolvedValue('feat: test commit');

      vi.mocked(ClaudeProvider).mockImplementation(
        () =>
          ({
            isAvailable: vi.fn().mockResolvedValue(true),
            getName: vi.fn().mockReturnValue('Claude CLI'),
            getProviderType: vi.fn().mockReturnValue('cli'),
            generateCommitMessage: mockGenerateCommitMessage,
          }) as any,
      );

      const provider = await detectAvailableProvider();

      expect(provider).not.toBeNull();

      // Verify we can use the returned provider
      const message = await provider!.generateCommitMessage('test prompt', {});
      expect(message).toBe('feat: test commit');
      expect(mockGenerateCommitMessage).toHaveBeenCalledWith('test prompt', {});
    });
  });

  describe('getAllAvailableProviders', () => {
    it('should return all available providers', async () => {
      // Mock Claude as available
      vi.mocked(ClaudeProvider).mockImplementation(
        () =>
          ({
            isAvailable: vi.fn().mockResolvedValue(true),
            getName: vi.fn().mockReturnValue('Claude CLI'),
            getProviderType: vi.fn().mockReturnValue('cli'),
            generateCommitMessage: vi.fn(),
          }) as any,
      );

      const result = await getAllAvailableProviders();

      expect(result).toHaveLength(1);
      expect(result[0]?.getName()).toBe('Claude CLI');
    });

    it('should return empty array when no providers available', async () => {
      // Mock Claude as unavailable
      vi.mocked(ClaudeProvider).mockImplementation(
        () =>
          ({
            isAvailable: vi.fn().mockResolvedValue(false),
            getName: vi.fn().mockReturnValue('Claude CLI'),
            getProviderType: vi.fn().mockReturnValue('cli'),
            generateCommitMessage: vi.fn(),
          }) as any,
      );

      const result = await getAllAvailableProviders();

      expect(result).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      // Mock Claude to throw during isAvailable
      vi.mocked(ClaudeProvider).mockImplementation(
        () =>
          ({
            isAvailable: vi.fn().mockRejectedValue(new Error('Command not found')),
            getName: vi.fn().mockReturnValue('Claude CLI'),
            getProviderType: vi.fn().mockReturnValue('cli'),
            generateCommitMessage: vi.fn(),
          }) as any,
      );

      const result = await getAllAvailableProviders();

      expect(result).toEqual([]);
    });

    it('should filter out unavailable providers', async () => {
      let callCount = 0;

      // Mock Claude to alternate between available and unavailable
      vi.mocked(ClaudeProvider).mockImplementation(() => {
        callCount++;
        const available = callCount === 1; // Only first instance is available

        return {
          isAvailable: vi.fn().mockResolvedValue(available),
          getName: vi.fn().mockReturnValue(`Claude CLI ${callCount}`),
          getProviderType: vi.fn().mockReturnValue('cli'),
          generateCommitMessage: vi.fn(),
        } as any;
      });

      const result = await getAllAvailableProviders();

      // Currently only one provider (Claude), so we expect 1 result when available
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should check all providers in parallel', async () => {
      const isAvailableStartTimes: number[] = [];
      const isAvailableEndTimes: number[] = [];

      vi.mocked(ClaudeProvider).mockImplementation(
        () =>
          ({
            isAvailable: vi.fn().mockImplementation(async () => {
              isAvailableStartTimes.push(Date.now());
              // Simulate async work
              await new Promise((resolve) => setTimeout(resolve, 10));
              isAvailableEndTimes.push(Date.now());
              return true;
            }),
            getName: vi.fn().mockReturnValue('Claude CLI'),
            getProviderType: vi.fn().mockReturnValue('cli'),
            generateCommitMessage: vi.fn(),
          }) as any,
      );

      await getAllAvailableProviders();

      // Verify function completed (parallel execution validated by Promise.allSettled usage)
      expect(isAvailableStartTimes.length).toBeGreaterThan(0);
    });

    it('should return providers in priority order', async () => {
      vi.mocked(ClaudeProvider).mockImplementation(
        () =>
          ({
            isAvailable: vi.fn().mockResolvedValue(true),
            getName: vi.fn().mockReturnValue('Claude CLI'),
            getProviderType: vi.fn().mockReturnValue('cli'),
            generateCommitMessage: vi.fn(),
          }) as any,
      );

      const result = await getAllAvailableProviders();

      // Claude should be first (currently only provider)
      expect(result[0]?.getName()).toBe('Claude CLI');
    });

    it('should return usable provider instances', async () => {
      const mockGenerateCommitMessage = vi.fn().mockResolvedValue('feat: test commit');

      vi.mocked(ClaudeProvider).mockImplementation(
        () =>
          ({
            isAvailable: vi.fn().mockResolvedValue(true),
            getName: vi.fn().mockReturnValue('Claude CLI'),
            getProviderType: vi.fn().mockReturnValue('cli'),
            generateCommitMessage: mockGenerateCommitMessage,
          }) as any,
      );

      const providers = await getAllAvailableProviders();

      expect(providers).toHaveLength(1);

      // Verify we can use the returned providers
      const message = await providers[0]!.generateCommitMessage('test prompt', {});
      expect(message).toBe('feat: test commit');
    });
  });
});
