import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AIProvider, GenerateOptions } from '../types';

import { ProviderError, ProviderNotAvailableError } from '../errors';
import {
  formatProviderChainError,
  isProviderChainError,
  ProviderChain,
  ProviderChainError,
} from '../provider-chain';
import { ProviderType } from '../types';

// Mock provider implementation for testing
class MockProvider implements AIProvider {
  constructor(
    private readonly name: string,
    private readonly shouldSucceed: boolean = true,
    private readonly available: boolean = true,
    private readonly errorToThrow?: Error,
  ) {}

  async generateCommitMessage(prompt: string, _options: GenerateOptions): Promise<string> {
    if (this.shouldSucceed) {
      return `Message from ${this.name}: ${prompt}`;
    }
    throw this.errorToThrow ?? new Error(`${this.name} failed`);
  }

  async isAvailable(): Promise<boolean> {
    return this.available;
  }

  getName(): string {
    return this.name;
  }

  getProviderType(): ProviderType {
    return ProviderType.CLI;
  }
}

describe('ProviderChain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create chain with single provider', () => {
      const provider = new MockProvider('Provider1');
      const chain = new ProviderChain([provider]);

      expect(chain.getProviderCount()).toBe(1);
      expect(chain.getProviders()).toHaveLength(1);
    });

    it('should create chain with multiple providers', () => {
      const providers = [
        new MockProvider('Provider1'),
        new MockProvider('Provider2'),
        new MockProvider('Provider3'),
      ];
      const chain = new ProviderChain(providers);

      expect(chain.getProviderCount()).toBe(3);
      expect(chain.getProviders()).toHaveLength(3);
    });

    it('should throw error if no providers provided', () => {
      expect(() => new ProviderChain([])).toThrow('ProviderChain requires at least one provider');
    });

    it('should return immutable copy of providers', () => {
      const providers = [new MockProvider('Provider1')];
      const chain = new ProviderChain(providers);

      const retrieved = chain.getProviders();
      expect(retrieved).not.toBe(providers); // Different array instance
      expect(retrieved).toHaveLength(1);
    });
  });

  describe('generateCommitMessage', () => {
    it('should succeed with first provider', async () => {
      const chain = new ProviderChain([
        new MockProvider('Provider1', true),
        new MockProvider('Provider2', true),
      ]);

      const result = await chain.generateCommitMessage('test prompt', {});

      expect(result).toBe('Message from Provider1: test prompt');
    });

    it('should fallback to second provider when first fails', async () => {
      const chain = new ProviderChain([
        new MockProvider('Provider1', false),
        new MockProvider('Provider2', true),
      ]);

      const result = await chain.generateCommitMessage('test prompt', {});

      expect(result).toBe('Message from Provider2: test prompt');
    });

    it('should fallback through multiple providers', async () => {
      const chain = new ProviderChain([
        new MockProvider('Provider1', false),
        new MockProvider('Provider2', false),
        new MockProvider('Provider3', true),
      ]);

      const result = await chain.generateCommitMessage('test prompt', {});

      expect(result).toBe('Message from Provider3: test prompt');
    });

    it('should throw ProviderChainError when all providers fail', async () => {
      const chain = new ProviderChain([
        new MockProvider('Provider1', false),
        new MockProvider('Provider2', false),
        new MockProvider('Provider3', false),
      ]);

      await expect(chain.generateCommitMessage('test prompt', {})).rejects.toThrow(
        ProviderChainError,
      );

      try {
        await chain.generateCommitMessage('test prompt', {});
      } catch (error) {
        expect(isProviderChainError(error)).toBe(true);
        if (error instanceof ProviderChainError) {
          expect(error.attemptedProviders).toEqual(['Provider1', 'Provider2', 'Provider3']);
          expect(error.errors).toHaveLength(3);
          expect(error.message).toContain('All 3 providers failed');
        }
      }
    });

    it('should collect all errors from failed providers', async () => {
      const error1 = new ProviderNotAvailableError('Provider1', 'not found');
      const error2 = new ProviderError('Provider2 error', 'Provider2');
      const error3 = new Error('Generic error');

      const chain = new ProviderChain([
        new MockProvider('Provider1', false, true, error1),
        new MockProvider('Provider2', false, true, error2),
        new MockProvider('Provider3', false, true, error3),
      ]);

      try {
        await chain.generateCommitMessage('prompt', {});
      } catch (error) {
        if (error instanceof ProviderChainError) {
          expect(error.errors).toEqual([error1, error2, error3]);
        }
      }
    });

    it('should handle non-Error rejections', async () => {
      const mockProvider = new MockProvider('Provider1');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing edge case where promise rejects with non-Error value (string) to verify error handling
      vi.spyOn(mockProvider, 'generateCommitMessage').mockRejectedValue('string error' as any);

      const chain = new ProviderChain([mockProvider]);

      try {
        await chain.generateCommitMessage('prompt', {});
      } catch (error) {
        if (error instanceof ProviderChainError) {
          expect(error.errors[0]!.message).toContain('Unknown error from provider Provider1');
        }
      }
    });

    it('should pass options to each provider', async () => {
      const mockProvider = new MockProvider('Provider1', true);
      const spy = vi.spyOn(mockProvider, 'generateCommitMessage');

      const chain = new ProviderChain([mockProvider]);

      await chain.generateCommitMessage('prompt', {
        workdir: '/test',
        timeout: 5000,
        metadata: { test: true },
      });

      expect(spy).toHaveBeenCalledWith('prompt', {
        workdir: '/test',
        timeout: 5000,
        metadata: { test: true },
      });
    });
  });

  describe('isAvailable', () => {
    it('should return true if first provider is available', async () => {
      const chain = new ProviderChain([
        new MockProvider('Provider1', true, true),
        new MockProvider('Provider2', true, false),
      ]);

      const result = await chain.isAvailable();
      expect(result).toBe(true);
    });

    it('should return true if any provider is available', async () => {
      const chain = new ProviderChain([
        new MockProvider('Provider1', true, false),
        new MockProvider('Provider2', true, true),
        new MockProvider('Provider3', true, false),
      ]);

      const result = await chain.isAvailable();
      expect(result).toBe(true);
    });

    it('should return false if no providers are available', async () => {
      const chain = new ProviderChain([
        new MockProvider('Provider1', true, false),
        new MockProvider('Provider2', true, false),
      ]);

      const result = await chain.isAvailable();
      expect(result).toBe(false);
    });

    it('should check all providers in parallel', async () => {
      const provider1 = new MockProvider('Provider1', true, true);
      const provider2 = new MockProvider('Provider2', true, true);
      const provider3 = new MockProvider('Provider3', true, true);

      const spy1 = vi.spyOn(provider1, 'isAvailable');
      const spy2 = vi.spyOn(provider2, 'isAvailable');
      const spy3 = vi.spyOn(provider3, 'isAvailable');

      const chain = new ProviderChain([provider1, provider2, provider3]);

      await chain.isAvailable();

      // All should have been called
      expect(spy1).toHaveBeenCalled();
      expect(spy2).toHaveBeenCalled();
      expect(spy3).toHaveBeenCalled();
    });

    it('should handle provider isAvailable errors gracefully', async () => {
      const mockProvider = new MockProvider('Provider1', true, true);
      vi.spyOn(mockProvider, 'isAvailable').mockRejectedValue(new Error('Check failed'));

      const chain = new ProviderChain([mockProvider]);

      const result = await chain.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('getName', () => {
    it('should return composite name for single provider', () => {
      const chain = new ProviderChain([new MockProvider('Provider1')]);
      expect(chain.getName()).toBe('ProviderChain[Provider1]');
    });

    it('should return composite name for multiple providers', () => {
      const chain = new ProviderChain([
        new MockProvider('Claude'),
        new MockProvider('OpenAI'),
        new MockProvider('Gemini'),
      ]);
      expect(chain.getName()).toBe('ProviderChain[Claude, OpenAI, Gemini]');
    });
  });

  describe('getProviderType', () => {
    it('should return type of first provider', () => {
      const chain = new ProviderChain([
        new MockProvider('Provider1'),
        new MockProvider('Provider2'),
      ]);
      expect(chain.getProviderType()).toBe(ProviderType.CLI);
    });
  });

  describe('formatProviderChainError', () => {
    it('should format error with all provider failures', () => {
      const error = new ProviderChainError(
        'All providers failed',
        ['Provider1', 'Provider2', 'Provider3'],
        [new Error('Error 1'), new Error('Error 2'), new Error('Error 3')],
      );

      const formatted = formatProviderChainError(error);

      expect(formatted).toContain('All providers failed');
      expect(formatted).toContain('1. Provider1:');
      expect(formatted).toContain('Error 1');
      expect(formatted).toContain('2. Provider2:');
      expect(formatted).toContain('Error 2');
      expect(formatted).toContain('3. Provider3:');
      expect(formatted).toContain('Error 3');
    });

    it('should format ProviderError details', () => {
      const providerError = new ProviderNotAvailableError('TestProvider', 'not configured');
      const error = new ProviderChainError('Failed', ['TestProvider'], [providerError]);

      const formatted = formatProviderChainError(error);

      expect(formatted).toContain("Provider 'TestProvider' is not available: not configured");
    });

    it('should handle errors without messages', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument -- Testing edge case where error array contains undefined to verify error formatting handles missing errors gracefully
      const error = new ProviderChainError('Failed', ['Provider1'], [undefined as any]);

      const formatted = formatProviderChainError(error);

      expect(formatted).toContain('Unknown error');
    });
  });

  describe('isProviderChainError', () => {
    it('should return true for ProviderChainError', () => {
      const error = new ProviderChainError('message', [], []);
      expect(isProviderChainError(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isProviderChainError(new Error('test'))).toBe(false);
      expect(isProviderChainError('not an error')).toBe(false);
      expect(isProviderChainError(null)).toBe(false);
      expect(isProviderChainError(undefined)).toBe(false);
    });
  });
});
