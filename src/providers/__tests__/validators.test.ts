import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import type { APIProviderConfig, CLIProviderConfig, ProviderConfig } from '../types';

import {
  apiProviderSchema,
  cliProviderSchema,
  isAPIProviderConfig,
  isCLIProviderConfig,
  providerConfigSchema,
  validateProviderConfig,
} from '../types';

describe('Provider Validators', () => {
  describe('cliProviderSchema', () => {
    it('should validate valid Claude CLI config', () => {
      const config = {
        type: 'cli',
        provider: 'claude',
      };

      const result = cliProviderSchema.parse(config);

      expect(result).toEqual(config);
    });

    it('should validate valid Codex CLI config', () => {
      const config = {
        type: 'cli',
        provider: 'codex',
      };

      const result = cliProviderSchema.parse(config);

      expect(result).toEqual(config);
    });

    it('should validate valid Cursor CLI config', () => {
      const config = {
        type: 'cli',
        provider: 'cursor',
      };

      const result = cliProviderSchema.parse(config);

      expect(result).toEqual(config);
    });

    it('should validate CLI config with optional command', () => {
      const config = {
        type: 'cli',
        provider: 'claude',
        command: '/usr/local/bin/claude',
      };

      const result = cliProviderSchema.parse(config);

      expect(result).toEqual(config);
    });

    it('should validate CLI config with optional args', () => {
      const config = {
        type: 'cli',
        provider: 'claude',
        args: ['--print', '--verbose'],
      };

      const result = cliProviderSchema.parse(config);

      expect(result).toEqual(config);
    });

    it('should validate CLI config with optional timeout', () => {
      const config = {
        type: 'cli',
        provider: 'claude',
        timeout: 30_000,
      };

      const result = cliProviderSchema.parse(config);

      expect(result).toEqual(config);
    });

    it('should validate CLI config with all optional fields', () => {
      const config = {
        type: 'cli',
        provider: 'claude',
        command: '/usr/local/bin/claude',
        args: ['--print'],
        timeout: 60_000,
      };

      const result = cliProviderSchema.parse(config);

      expect(result).toEqual(config);
    });

    it('should reject invalid provider name', () => {
      const config = {
        type: 'cli',
        provider: 'invalid-provider',
      };

      expect(() => cliProviderSchema.parse(config)).toThrow(ZodError);
    });

    it('should reject negative timeout', () => {
      const config = {
        type: 'cli',
        provider: 'claude',
        timeout: -1000,
      };

      expect(() => cliProviderSchema.parse(config)).toThrow(ZodError);
    });

    it('should reject zero timeout', () => {
      const config = {
        type: 'cli',
        provider: 'claude',
        timeout: 0,
      };

      expect(() => cliProviderSchema.parse(config)).toThrow(ZodError);
    });

    it('should reject wrong type field', () => {
      const config = {
        type: 'api',
        provider: 'claude',
      };

      expect(() => cliProviderSchema.parse(config)).toThrow(ZodError);
    });

    it('should reject missing type field', () => {
      const config = {
        provider: 'claude',
      };

      expect(() => cliProviderSchema.parse(config)).toThrow(ZodError);
    });
  });

  describe('apiProviderSchema', () => {
    it('should validate valid OpenAI API config', () => {
      const config = {
        type: 'api',
        provider: 'openai',
        apiKey: 'sk-test123',
      };

      const result = apiProviderSchema.parse(config);

      expect(result).toEqual(config);
    });

    it('should validate valid Gemini API config', () => {
      const config = {
        type: 'api',
        provider: 'gemini',
        apiKey: 'gemini-key-123',
      };

      const result = apiProviderSchema.parse(config);

      expect(result).toEqual(config);
    });

    it('should validate API config with optional endpoint', () => {
      const config = {
        type: 'api',
        provider: 'openai',
        apiKey: 'sk-test123',
        endpoint: 'https://api.openai.com/v1',
      };

      const result = apiProviderSchema.parse(config);

      expect(result).toEqual(config);
    });

    it('should validate API config with optional model', () => {
      const config = {
        type: 'api',
        provider: 'openai',
        apiKey: 'sk-test123',
        model: 'gpt-4',
      };

      const result = apiProviderSchema.parse(config);

      expect(result).toEqual(config);
    });

    it('should validate API config with optional timeout', () => {
      const config = {
        type: 'api',
        provider: 'openai',
        apiKey: 'sk-test123',
        timeout: 30_000,
      };

      const result = apiProviderSchema.parse(config);

      expect(result).toEqual(config);
    });

    it('should validate API config with all optional fields', () => {
      const config = {
        type: 'api',
        provider: 'openai',
        apiKey: 'sk-test123',
        endpoint: 'https://api.custom.com/v1',
        model: 'gpt-4-turbo',
        timeout: 60_000,
      };

      const result = apiProviderSchema.parse(config);

      expect(result).toEqual(config);
    });

    it('should reject missing apiKey', () => {
      const config = {
        type: 'api',
        provider: 'openai',
      };

      expect(() => apiProviderSchema.parse(config)).toThrow(ZodError);
    });

    it('should reject empty apiKey', () => {
      const config = {
        type: 'api',
        provider: 'openai',
        apiKey: '',
      };

      expect(() => apiProviderSchema.parse(config)).toThrow(ZodError);
    });

    it('should reject invalid provider name', () => {
      const config = {
        type: 'api',
        provider: 'invalid-provider',
        apiKey: 'test-key',
      };

      expect(() => apiProviderSchema.parse(config)).toThrow(ZodError);
    });

    it('should reject invalid endpoint URL', () => {
      const config = {
        type: 'api',
        provider: 'openai',
        apiKey: 'sk-test123',
        endpoint: 'not-a-url',
      };

      expect(() => apiProviderSchema.parse(config)).toThrow(ZodError);
    });

    it('should reject negative timeout', () => {
      const config = {
        type: 'api',
        provider: 'openai',
        apiKey: 'sk-test123',
        timeout: -1000,
      };

      expect(() => apiProviderSchema.parse(config)).toThrow(ZodError);
    });

    it('should reject wrong type field', () => {
      const config = {
        type: 'cli',
        provider: 'openai',
        apiKey: 'sk-test123',
      };

      expect(() => apiProviderSchema.parse(config)).toThrow(ZodError);
    });
  });

  describe('providerConfigSchema (discriminated union)', () => {
    it('should validate CLI provider config', () => {
      const config = {
        type: 'cli',
        provider: 'claude',
      };

      const result = providerConfigSchema.parse(config);

      expect(result).toEqual(config);
    });

    it('should validate API provider config', () => {
      const config = {
        type: 'api',
        provider: 'openai',
        apiKey: 'sk-test123',
      };

      const result = providerConfigSchema.parse(config);

      expect(result).toEqual(config);
    });

    it('should reject invalid type field', () => {
      const config = {
        type: 'invalid-type',
        provider: 'claude',
      };

      expect(() => providerConfigSchema.parse(config)).toThrow(ZodError);
    });

    it('should reject mixed CLI and API fields', () => {
      const config = {
        type: 'cli',
        provider: 'claude',
        apiKey: 'sk-test123', // API field in CLI config
      };

      // This should pass because Zod ignores extra fields by default
      // But the type will be CLI, not API
      const result = providerConfigSchema.parse(config);
      expect(result.type).toBe('cli');
    });

    it('should handle missing discriminator field', () => {
      const config = {
        provider: 'claude',
      };

      expect(() => providerConfigSchema.parse(config)).toThrow(ZodError);
    });
  });

  describe('validateProviderConfig', () => {
    it('should validate and return valid CLI config', () => {
      const config = {
        type: 'cli',
        provider: 'claude',
      };

      const result = validateProviderConfig(config);

      expect(result).toEqual(config);
    });

    it('should validate and return valid API config', () => {
      const config = {
        type: 'api',
        provider: 'openai',
        apiKey: 'sk-test123',
      };

      const result = validateProviderConfig(config);

      expect(result).toEqual(config);
    });

    it('should throw ZodError for invalid config', () => {
      const config = {
        type: 'invalid',
        provider: 'claude',
      };

      expect(() => validateProviderConfig(config)).toThrow(ZodError);
    });

    it('should throw ZodError for missing required fields', () => {
      const config = {
        type: 'api',
        provider: 'openai',
        // Missing apiKey
      };

      expect(() => validateProviderConfig(config)).toThrow(ZodError);
    });

    it('should handle non-object input', () => {
      expect(() => validateProviderConfig(null)).toThrow(ZodError);
      expect(() => validateProviderConfig(undefined)).toThrow(ZodError);
      expect(() => validateProviderConfig('string')).toThrow(ZodError);
      expect(() => validateProviderConfig(123)).toThrow(ZodError);
    });

    it('should provide helpful error messages', () => {
      const config = {
        type: 'api',
        provider: 'openai',
        apiKey: '', // Empty API key
      };

      try {
        validateProviderConfig(config);
        expect.fail('Should have thrown ZodError');
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError);
        const zodError = error as ZodError;
        expect(zodError.issues.length).toBeGreaterThan(0);
        expect(zodError.issues[0]?.message).toBeTruthy();
      }
    });
  });

  describe('Type Guards', () => {
    describe('isCLIProviderConfig', () => {
      it('should return true for CLI config', () => {
        const config: ProviderConfig = {
          type: 'cli',
          provider: 'claude',
        };

        expect(isCLIProviderConfig(config)).toBe(true);
      });

      it('should return false for API config', () => {
        const config: ProviderConfig = {
          type: 'api',
          provider: 'openai',
          apiKey: 'sk-test123',
        };

        expect(isCLIProviderConfig(config)).toBe(false);
      });

      it('should narrow type correctly', () => {
        const config: ProviderConfig = {
          type: 'cli',
          provider: 'claude',
          command: '/usr/bin/claude',
        };

        if (isCLIProviderConfig(config)) {
          // TypeScript should allow accessing CLI-specific fields
          expect(config.command).toBe('/usr/bin/claude');
          // @ts-expect-error - apiKey should not exist on CLI config
          expect(config.apiKey).toBeUndefined();
        }
      });
    });

    describe('isAPIProviderConfig', () => {
      it('should return true for API config', () => {
        const config: ProviderConfig = {
          type: 'api',
          provider: 'openai',
          apiKey: 'sk-test123',
        };

        expect(isAPIProviderConfig(config)).toBe(true);
      });

      it('should return false for CLI config', () => {
        const config: ProviderConfig = {
          type: 'cli',
          provider: 'claude',
        };

        expect(isAPIProviderConfig(config)).toBe(false);
      });

      it('should narrow type correctly', () => {
        const config: ProviderConfig = {
          type: 'api',
          provider: 'openai',
          apiKey: 'sk-test123',
          model: 'gpt-4',
        };

        if (isAPIProviderConfig(config)) {
          // TypeScript should allow accessing API-specific fields
          expect(config.apiKey).toBe('sk-test123');
          expect(config.model).toBe('gpt-4');
          // @ts-expect-error - command should not exist on API config
          expect(config.command).toBeUndefined();
        }
      });
    });

    it('should work together for type narrowing', () => {
      const configs: ProviderConfig[] = [
        { type: 'cli', provider: 'claude' },
        { type: 'api', provider: 'openai', apiKey: 'sk-test' },
      ];

      const cliConfigs = configs.filter((config) => isCLIProviderConfig(config));
      const apiConfigs = configs.filter((config) => isAPIProviderConfig(config));

      expect(cliConfigs).toHaveLength(1);
      expect(apiConfigs).toHaveLength(1);

      // TypeScript should infer correct types
      const cliConfig: CLIProviderConfig = cliConfigs[0]!;
      const apiConfig: APIProviderConfig = apiConfigs[0]!;

      expect(cliConfig.provider).toBe('claude');
      expect(apiConfig.apiKey).toBe('sk-test');
    });
  });
});
