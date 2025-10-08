import { describe, expect, it } from 'vitest';

import type { APIProviderConfig, CLIProviderConfig } from '../types';

import { createProvider, createProviders, ProviderNotImplementedError } from '../provider-factory';

describe('ProviderFactory', () => {
  describe('createProvider', () => {
    describe('CLI providers', () => {
      it('should throw ProviderNotImplementedError for claude provider', () => {
        const config: CLIProviderConfig = {
          type: 'cli',
          provider: 'claude',
        };

        expect(() => createProvider(config)).toThrow(ProviderNotImplementedError);
        expect(() => createProvider(config)).toThrow(
          /Provider 'claude' \(cli\) is not yet implemented/,
        );
      });

      it('should throw ProviderNotImplementedError for codex provider', () => {
        const config: CLIProviderConfig = {
          type: 'cli',
          provider: 'codex',
        };

        expect(() => createProvider(config)).toThrow(ProviderNotImplementedError);
        expect(() => createProvider(config)).toThrow(
          /Provider 'codex' \(cli\) is not yet implemented/,
        );
      });

      it('should throw ProviderNotImplementedError for cursor provider', () => {
        const config: CLIProviderConfig = {
          type: 'cli',
          provider: 'cursor',
        };

        expect(() => createProvider(config)).toThrow(ProviderNotImplementedError);
        expect(() => createProvider(config)).toThrow(
          /Provider 'cursor' \(cli\) is not yet implemented/,
        );
      });

      it('should include helpful message in NotImplementedError', () => {
        const config: CLIProviderConfig = {
          type: 'cli',
          provider: 'claude',
        };

        try {
          createProvider(config);
        } catch (error) {
          expect(error).toBeInstanceOf(ProviderNotImplementedError);
          if (error instanceof ProviderNotImplementedError) {
            expect(error.providerName).toBe('claude');
            expect(error.providerType).toBe('cli');
            expect(error.message).toContain('contribute an implementation');
          }
        }
      });
    });

    describe('API providers', () => {
      it('should throw ProviderNotImplementedError for openai provider', () => {
        const config: APIProviderConfig = {
          type: 'api',
          provider: 'openai',
          apiKey: 'test-key',
        };

        expect(() => createProvider(config)).toThrow(ProviderNotImplementedError);
        expect(() => createProvider(config)).toThrow(
          /Provider 'openai' \(api\) is not yet implemented/,
        );
      });

      it('should throw ProviderNotImplementedError for gemini provider', () => {
        const config: APIProviderConfig = {
          type: 'api',
          provider: 'gemini',
          apiKey: 'test-key',
        };

        expect(() => createProvider(config)).toThrow(ProviderNotImplementedError);
        expect(() => createProvider(config)).toThrow(
          /Provider 'gemini' \(api\) is not yet implemented/,
        );
      });
    });

    describe('type safety', () => {
      it('should accept valid CLI config with all optional fields', () => {
        const config: CLIProviderConfig = {
          type: 'cli',
          provider: 'claude',
          command: 'custom-claude',
          args: ['--custom-arg'],
          timeout: 10_000,
        };

        expect(() => createProvider(config)).toThrow(ProviderNotImplementedError);
      });

      it('should accept valid API config with all optional fields', () => {
        const config: APIProviderConfig = {
          type: 'api',
          provider: 'openai',
          apiKey: 'sk-test123',
          endpoint: 'https://api.custom.com/v1',
          model: 'gpt-4',
          timeout: 15_000,
        };

        expect(() => createProvider(config)).toThrow(ProviderNotImplementedError);
      });
    });
  });

  describe('createProviders', () => {
    it('should create multiple providers from configs', () => {
      const configs = [
        { type: 'cli' as const, provider: 'claude' as const },
        { type: 'api' as const, provider: 'openai' as const, apiKey: 'test' },
        { type: 'cli' as const, provider: 'codex' as const },
      ];

      // All should throw NotImplementedError
      expect(() => createProviders(configs)).toThrow(ProviderNotImplementedError);
    });

    it('should throw on first unimplemented provider', () => {
      const configs = [
        { type: 'cli' as const, provider: 'claude' as const },
        { type: 'cli' as const, provider: 'codex' as const },
      ];

      try {
        createProviders(configs);
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderNotImplementedError);
        if (error instanceof ProviderNotImplementedError) {
          expect(error.providerName).toBe('claude');
        }
      }
    });

    it('should return empty array for empty config array', () => {
      const result = createProviders([]);
      expect(result).toEqual([]);
    });
  });

  describe('ProviderNotImplementedError', () => {
    it('should have correct structure', () => {
      const error = new ProviderNotImplementedError('test-provider', 'test-type');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ProviderNotImplementedError');
      expect(error.providerName).toBe('test-provider');
      expect(error.providerType).toBe('test-type');
      expect(error.message).toContain('test-provider');
      expect(error.message).toContain('test-type');
    });

    it('should suggest using a different provider', () => {
      const error = new ProviderNotImplementedError('provider', 'type');
      expect(error.message).toContain('use a different provider');
    });

    it('should suggest contributing', () => {
      const error = new ProviderNotImplementedError('provider', 'type');
      expect(error.message).toContain('contribute an implementation');
    });
  });
});
