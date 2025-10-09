import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import type { APIProviderConfig, CLIProviderConfig } from '../types';

import { ClaudeProvider } from '../implementations/claude-provider';
import { CodexProvider } from '../implementations/codex-provider';
import { createProvider, createProviders, ProviderNotImplementedError } from '../provider-factory';

describe('ProviderFactory', () => {
  describe('createProvider', () => {
    describe('CLI providers', () => {
      it('should create ClaudeProvider for claude config', () => {
        const config: CLIProviderConfig = {
          type: 'cli',
          provider: 'claude',
        };

        const provider = createProvider(config);
        expect(provider).toBeInstanceOf(ClaudeProvider);
        expect(provider.getName()).toBe('Claude CLI');
      });

      it('should create CodexProvider for codex config', () => {
        const config: CLIProviderConfig = {
          type: 'cli',
          provider: 'codex',
        };

        const provider = createProvider(config);
        expect(provider).toBeInstanceOf(CodexProvider);
        expect(provider.getName()).toBe('Codex CLI');
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

      it('should include helpful message in NotImplementedError for unimplemented providers', () => {
        const config: CLIProviderConfig = {
          type: 'cli',
          provider: 'cursor',
        };

        try {
          createProvider(config);
        } catch (error) {
          expect(error).toBeInstanceOf(ProviderNotImplementedError);
          if (error instanceof ProviderNotImplementedError) {
            expect(error.providerName).toBe('cursor');
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

        const provider = createProvider(config);
        expect(provider).toBeInstanceOf(ClaudeProvider);
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
        { type: 'cli' as const, provider: 'codex' as const },
      ];

      const providers = createProviders(configs);
      expect(providers).toHaveLength(2);
      expect(providers[0]).toBeInstanceOf(ClaudeProvider);
      expect(providers[1]).toBeInstanceOf(CodexProvider);
    });

    it('should throw on first unimplemented provider', () => {
      const configs = [
        { type: 'cli' as const, provider: 'claude' as const },
        { type: 'cli' as const, provider: 'cursor' as const },
      ];

      expect(() => createProviders(configs)).toThrow(ProviderNotImplementedError);
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

  describe('config validation in factory', () => {
    it('should validate config before creating provider', () => {
      const config = {
        type: 'cli',
        provider: 'claude',
      };

      const provider = createProvider(config as CLIProviderConfig);
      expect(provider).toBeInstanceOf(ClaudeProvider);
    });

    it('should throw ZodError for invalid config type', () => {
      const config = {
        type: 'invalid-type',
        provider: 'claude',
      };

      expect(() => createProvider(config as any)).toThrow(ZodError);
    });

    it('should throw ZodError for missing required fields', () => {
      const config = {
        type: 'api',
        provider: 'openai',
        // Missing apiKey
      };

      expect(() => createProvider(config as any)).toThrow(ZodError);
    });

    it('should throw ZodError for invalid timeout value', () => {
      const config = {
        type: 'cli',
        provider: 'claude',
        timeout: -1000, // Invalid negative timeout
      };

      expect(() => createProvider(config as any)).toThrow(ZodError);
    });

    it('should throw ZodError for empty API key', () => {
      const config = {
        type: 'api',
        provider: 'openai',
        apiKey: '', // Empty string not allowed
      };

      expect(() => createProvider(config as any)).toThrow(ZodError);
    });

    it('should throw ZodError for invalid endpoint URL', () => {
      const config = {
        type: 'api',
        provider: 'openai',
        apiKey: 'sk-test123',
        endpoint: 'not-a-url', // Invalid URL format
      };

      expect(() => createProvider(config as any)).toThrow(ZodError);
    });

    it('should accept valid config with all optional fields', () => {
      const config: CLIProviderConfig = {
        type: 'cli',
        provider: 'claude',
        command: 'custom-claude',
        args: ['--custom'],
        timeout: 15_000,
      };

      const provider = createProvider(config);
      expect(provider).toBeInstanceOf(ClaudeProvider);
    });
  });
});
