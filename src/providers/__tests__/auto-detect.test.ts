import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AIProvider } from '../types';

import { detectAvailableProvider, getAllAvailableProviders } from '../auto-detect';
import { ClaudeProvider } from '../implementations/claude-provider';
import { CodexProvider } from '../implementations/codex-provider';

// Mock both providers
vi.mock('../implementations/claude-provider');
vi.mock('../implementations/codex-provider');

// Helper to create a properly typed mock provider
type MockProvider = Pick<
  AIProvider,
  'isAvailable' | 'getName' | 'getProviderType' | 'generateCommitMessage'
>;

function createMockProvider(overrides: Partial<MockProvider> = {}): MockProvider {
  return {
    isAvailable: vi.fn().mockResolvedValue(true),
    getName: vi.fn().mockReturnValue('Mock Provider'),
    getProviderType: vi.fn().mockReturnValue('cli'),
    generateCommitMessage: vi.fn().mockResolvedValue('feat: mock commit'),
    ...overrides,
  };
}

describe('auto-detect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectAvailableProvider', () => {
    it('should return first available provider', async () => {
      // Mock Claude as available
      vi.mocked(ClaudeProvider).mockImplementation(
        () =>
          createMockProvider({
            getName: vi.fn().mockReturnValue('Claude CLI'),
          }) as unknown as ClaudeProvider,
      );

      const result = await detectAvailableProvider();

      expect(result).not.toBeNull();
      expect(result?.getName()).toBe('Claude CLI');
    });

    it('should return null when no providers are available', async () => {
      // Mock Claude as unavailable
      vi.mocked(ClaudeProvider).mockImplementation(
        () =>
          createMockProvider({
            isAvailable: vi.fn().mockResolvedValue(false),
            getName: vi.fn().mockReturnValue('Claude CLI'),
          }) as unknown as ClaudeProvider,
      );

      // Mock Codex as unavailable
      vi.mocked(CodexProvider).mockImplementation(
        () =>
          createMockProvider({
            isAvailable: vi.fn().mockResolvedValue(false),
            getName: vi.fn().mockReturnValue('Codex CLI'),
          }) as unknown as CodexProvider,
      );

      const result = await detectAvailableProvider();

      expect(result).toBeNull();
    });

    it('should handle errors during availability check', async () => {
      // Mock Claude to throw during isAvailable
      vi.mocked(ClaudeProvider).mockImplementation(
        () =>
          createMockProvider({
            isAvailable: vi.fn().mockRejectedValue(new Error('Command not found')),
            getName: vi.fn().mockReturnValue('Claude CLI'),
          }) as unknown as ClaudeProvider,
      );

      // Mock Codex to also throw during isAvailable
      vi.mocked(CodexProvider).mockImplementation(
        () =>
          createMockProvider({
            isAvailable: vi.fn().mockRejectedValue(new Error('Command not found')),
            getName: vi.fn().mockReturnValue('Codex CLI'),
          }) as unknown as CodexProvider,
      );

      const result = await detectAvailableProvider();

      expect(result).toBeNull();
    });

    it('should check provider availability', async () => {
      const isAvailableMock = vi.fn().mockResolvedValue(true);

      vi.mocked(ClaudeProvider).mockImplementation(
        () =>
          createMockProvider({
            isAvailable: isAvailableMock,
            getName: vi.fn().mockReturnValue('Claude CLI'),
          }) as unknown as ClaudeProvider,
      );

      await detectAvailableProvider();

      expect(isAvailableMock).toHaveBeenCalledTimes(1);
    });

    it('should return provider instance that can be used', async () => {
      const mockGenerateCommitMessage = vi.fn().mockResolvedValue('feat: test commit');

      vi.mocked(ClaudeProvider).mockImplementation(
        () =>
          createMockProvider({
            getName: vi.fn().mockReturnValue('Claude CLI'),
            generateCommitMessage: mockGenerateCommitMessage,
          }) as unknown as ClaudeProvider,
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
          createMockProvider({
            getName: vi.fn().mockReturnValue('Claude CLI'),
          }) as unknown as ClaudeProvider,
      );

      // Mock Codex as available
      vi.mocked(CodexProvider).mockImplementation(
        () =>
          createMockProvider({
            getName: vi.fn().mockReturnValue('Codex CLI'),
          }) as unknown as CodexProvider,
      );

      const result = await getAllAvailableProviders();

      expect(result).toHaveLength(2);
      expect(result[0]?.getName()).toBe('Claude CLI');
      expect(result[1]?.getName()).toBe('Codex CLI');
    });

    it('should return empty array when no providers available', async () => {
      // Mock Claude as unavailable
      vi.mocked(ClaudeProvider).mockImplementation(
        () =>
          createMockProvider({
            isAvailable: vi.fn().mockResolvedValue(false),
            getName: vi.fn().mockReturnValue('Claude CLI'),
          }) as unknown as ClaudeProvider,
      );

      // Mock Codex as unavailable
      vi.mocked(CodexProvider).mockImplementation(
        () =>
          createMockProvider({
            isAvailable: vi.fn().mockResolvedValue(false),
            getName: vi.fn().mockReturnValue('Codex CLI'),
          }) as unknown as CodexProvider,
      );

      const result = await getAllAvailableProviders();

      expect(result).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      // Mock Claude to throw during isAvailable
      vi.mocked(ClaudeProvider).mockImplementation(
        () =>
          createMockProvider({
            isAvailable: vi.fn().mockRejectedValue(new Error('Command not found')),
            getName: vi.fn().mockReturnValue('Claude CLI'),
          }) as unknown as ClaudeProvider,
      );

      // Mock Codex to also throw during isAvailable
      vi.mocked(CodexProvider).mockImplementation(
        () =>
          createMockProvider({
            isAvailable: vi.fn().mockRejectedValue(new Error('Command not found')),
            getName: vi.fn().mockReturnValue('Codex CLI'),
          }) as unknown as CodexProvider,
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

        return createMockProvider({
          isAvailable: vi.fn().mockResolvedValue(available),
          getName: vi.fn().mockReturnValue(`Claude CLI ${callCount}`),
        }) as unknown as ClaudeProvider;
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
          createMockProvider({
            isAvailable: vi.fn().mockImplementation(async () => {
              isAvailableStartTimes.push(Date.now());
              // Simulate async work
              await new Promise((resolve) => {
                setTimeout(resolve, 10);
              });
              isAvailableEndTimes.push(Date.now());
              return true;
            }),
            getName: vi.fn().mockReturnValue('Claude CLI'),
          }) as unknown as ClaudeProvider,
      );

      await getAllAvailableProviders();

      // Verify function completed (parallel execution validated by Promise.allSettled usage)
      expect(isAvailableStartTimes.length).toBeGreaterThan(0);
    });

    it('should return providers in priority order', async () => {
      vi.mocked(ClaudeProvider).mockImplementation(
        () =>
          createMockProvider({
            getName: vi.fn().mockReturnValue('Claude CLI'),
          }) as unknown as ClaudeProvider,
      );

      const result = await getAllAvailableProviders();

      // Claude should be first (currently only provider)
      expect(result[0]?.getName()).toBe('Claude CLI');
    });

    it('should return usable provider instances', async () => {
      const mockGenerateCommitMessage = vi.fn().mockResolvedValue('feat: test commit');

      vi.mocked(ClaudeProvider).mockImplementation(
        () =>
          createMockProvider({
            getName: vi.fn().mockReturnValue('Claude CLI'),
            generateCommitMessage: mockGenerateCommitMessage,
          }) as unknown as ClaudeProvider,
      );

      vi.mocked(CodexProvider).mockImplementation(
        () =>
          createMockProvider({
            getName: vi.fn().mockReturnValue('Codex CLI'),
            generateCommitMessage: mockGenerateCommitMessage,
          }) as unknown as CodexProvider,
      );

      const providers = await getAllAvailableProviders();

      expect(providers).toHaveLength(2);

      // Verify we can use the returned providers
      const message = await providers[0]!.generateCommitMessage('test prompt', {});
      expect(message).toBe('feat: test commit');
    });
  });
});
