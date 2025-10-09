import { describe, expect, it } from 'vitest';
import { z, ZodError } from 'zod';

import type { CliOptions } from '../schemas';

import {
  cliOptionsSchema,
  formatValidationError,
  parseProviderConfigJson,
  safeParseProviderConfigJson,
  safeValidateCliOptions,
  validateCliOptions,
} from '../schemas';

describe('CLI Schemas', () => {
  describe('cliOptionsSchema', () => {
    describe('valid options', () => {
      it('should validate minimal valid options with defaults', () => {
        const options = {};

        const result = cliOptionsSchema.parse(options);

        expect(result.ai).toBe(true);
        expect(result.cwd).toBe(process.cwd());
      });

      it('should validate options with ai flag', () => {
        const options = {
          ai: false,
        };

        const result = cliOptionsSchema.parse(options);

        expect(result.ai).toBe(false);
      });

      it('should validate options with custom cwd', () => {
        const options = {
          cwd: '/custom/path',
        };

        const result = cliOptionsSchema.parse(options);

        expect(result.cwd).toBe('/custom/path');
      });

      it('should validate options with provider', () => {
        const options = {
          provider: 'claude',
        };

        const result = cliOptionsSchema.parse(options);

        expect(result.provider).toBe('claude');
      });

      it('should validate options with providerConfig', () => {
        const options = {
          providerConfig: '{"type":"cli","provider":"claude"}',
        };

        const result = cliOptionsSchema.parse(options);

        expect(result.providerConfig).toBe('{"type":"cli","provider":"claude"}');
      });

      it('should validate options with signature', () => {
        const options = {
          signature: 'Custom signature',
        };

        const result = cliOptionsSchema.parse(options);

        expect(result.signature).toBe('Custom signature');
      });

      it('should validate options with dryRun flag', () => {
        const options = {
          dryRun: true,
        };

        const result = cliOptionsSchema.parse(options);

        expect(result.dryRun).toBe(true);
      });

      it('should validate options with messageOnly flag', () => {
        const options = {
          messageOnly: true,
        };

        const result = cliOptionsSchema.parse(options);

        expect(result.messageOnly).toBe(true);
      });

      it('should validate options with listProviders flag', () => {
        const options = {
          listProviders: true,
        };

        const result = cliOptionsSchema.parse(options);

        expect(result.listProviders).toBe(true);
      });

      it('should validate options with checkProvider flag', () => {
        const options = {
          checkProvider: true,
        };

        const result = cliOptionsSchema.parse(options);

        expect(result.checkProvider).toBe(true);
      });

      it('should validate options with autoDetect flag', () => {
        const options = {
          autoDetect: true,
        };

        const result = cliOptionsSchema.parse(options);

        expect(result.autoDetect).toBe(true);
      });

      it('should validate options with fallback array', () => {
        const options = {
          fallback: ['claude', 'codex'],
        };

        const result = cliOptionsSchema.parse(options);

        expect(result.fallback).toEqual(['claude', 'codex']);
      });

      it('should validate options with all fields', () => {
        const options = {
          ai: true,
          autoDetect: false,
          checkProvider: false,
          cwd: '/custom/path',
          dryRun: true,
          fallback: ['codex'],
          listProviders: false,
          messageOnly: true,
          provider: 'claude',
          providerConfig: '{"type":"cli","provider":"claude"}',
          signature: 'Custom',
        };

        const result = cliOptionsSchema.parse(options);

        expect(result).toEqual(options);
      });
    });

    describe('invalid options', () => {
      it('should reject empty cwd', () => {
        const options = {
          cwd: '',
        };

        expect(() => cliOptionsSchema.parse(options)).toThrow(ZodError);
      });

      it('should reject non-boolean ai', () => {
        const options = {
          ai: 'true',
        };

        expect(() => cliOptionsSchema.parse(options)).toThrow(ZodError);
      });

      it('should reject non-boolean dryRun', () => {
        const options = {
          dryRun: 'yes',
        };

        expect(() => cliOptionsSchema.parse(options)).toThrow(ZodError);
      });

      it('should reject non-boolean messageOnly', () => {
        const options = {
          messageOnly: 1,
        };

        expect(() => cliOptionsSchema.parse(options)).toThrow(ZodError);
      });

      it('should reject non-boolean listProviders', () => {
        const options = {
          listProviders: 'true',
        };

        expect(() => cliOptionsSchema.parse(options)).toThrow(ZodError);
      });

      it('should reject non-boolean checkProvider', () => {
        const options = {
          checkProvider: 0,
        };

        expect(() => cliOptionsSchema.parse(options)).toThrow(ZodError);
      });

      it('should reject non-boolean autoDetect', () => {
        const options = {
          autoDetect: 'false',
        };

        expect(() => cliOptionsSchema.parse(options)).toThrow(ZodError);
      });

      it('should reject non-string provider', () => {
        const options = {
          provider: 123,
        };

        expect(() => cliOptionsSchema.parse(options)).toThrow(ZodError);
      });

      it('should reject non-string providerConfig', () => {
        const options = {
          providerConfig: { type: 'cli', provider: 'claude' },
        };

        expect(() => cliOptionsSchema.parse(options)).toThrow(ZodError);
      });

      it('should reject non-string signature', () => {
        const options = {
          signature: 123,
        };

        expect(() => cliOptionsSchema.parse(options)).toThrow(ZodError);
      });

      it('should reject non-string cwd', () => {
        const options = {
          cwd: 123,
        };

        expect(() => cliOptionsSchema.parse(options)).toThrow(ZodError);
      });

      it('should reject non-array fallback', () => {
        const options = {
          fallback: 'claude,codex',
        };

        expect(() => cliOptionsSchema.parse(options)).toThrow(ZodError);
      });

      it('should reject fallback array with non-string elements', () => {
        const options = {
          fallback: ['claude', 123, 'codex'],
        };

        expect(() => cliOptionsSchema.parse(options)).toThrow(ZodError);
      });
    });
  });

  describe('validateCliOptions', () => {
    it('should validate valid options', () => {
      const options = {
        cwd: '/path/to/project',
        provider: 'claude',
      };

      const result = validateCliOptions(options);

      expect(result.cwd).toBe('/path/to/project');
      expect(result.provider).toBe('claude');
    });

    it('should apply defaults to missing fields', () => {
      const options = {};

      const result = validateCliOptions(options);

      expect(result.ai).toBe(true);
    });

    it('should throw ZodError for invalid options', () => {
      const options = {
        cwd: '',
      };

      expect(() => validateCliOptions(options)).toThrow(ZodError);
    });

    it('should throw ZodError for non-object input', () => {
      expect(() => validateCliOptions(null)).toThrow(ZodError);
      expect(() => validateCliOptions(undefined)).toThrow(ZodError);
      expect(() => validateCliOptions('string')).toThrow(ZodError);
    });
  });

  describe('safeValidateCliOptions', () => {
    it('should return success for valid options', () => {
      const options = {
        cwd: '/path/to/project',
      };

      const result = safeValidateCliOptions(options);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cwd).toBe('/path/to/project');
      }
    });

    it('should return error for invalid options', () => {
      const options = {
        cwd: '',
      };

      const result = safeValidateCliOptions(options);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ZodError);
      }
    });

    it('should not throw for invalid input', () => {
      expect(() => safeValidateCliOptions(null)).not.toThrow();
      expect(() => safeValidateCliOptions(undefined)).not.toThrow();
      expect(() => safeValidateCliOptions('string')).not.toThrow();
    });

    it('should provide error details in result', () => {
      const options = {
        cwd: '',
        ai: 'not-a-boolean',
      };

      const result = safeValidateCliOptions(options);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });
  });

  describe('parseProviderConfigJson', () => {
    it('should parse valid CLI provider config', () => {
      const jsonString = '{"type":"cli","provider":"claude"}';

      const result = parseProviderConfigJson(jsonString);

      expect(result).toEqual({
        type: 'cli',
        provider: 'claude',
      });
    });

    it('should parse CLI provider config with all fields', () => {
      const jsonString =
        '{"type":"cli","provider":"claude","command":"custom-claude","args":["--print"],"timeout":60000}';

      const result = parseProviderConfigJson(jsonString);

      expect(result).toEqual({
        type: 'cli',
        provider: 'claude',
        command: 'custom-claude',
        args: ['--print'],
        timeout: 60_000,
      });
    });

    it('should parse valid API provider config', () => {
      const jsonString = '{"type":"api","provider":"openai","apiKey":"sk-test123"}';

      const result = parseProviderConfigJson(jsonString);

      expect(result).toEqual({
        type: 'api',
        provider: 'openai',
        apiKey: 'sk-test123',
      });
    });

    it('should parse API provider config with optional fields', () => {
      const jsonString =
        '{"type":"api","provider":"gemini","apiKey":"key123","endpoint":"https://custom.api","model":"gemini-pro","timeout":30000}';

      const result = parseProviderConfigJson(jsonString);

      expect(result).toEqual({
        type: 'api',
        provider: 'gemini',
        apiKey: 'key123',
        endpoint: 'https://custom.api',
        model: 'gemini-pro',
        timeout: 30_000,
      });
    });

    it('should throw clear error for invalid JSON', () => {
      const jsonString = '{invalid json}';

      expect(() => parseProviderConfigJson(jsonString)).toThrow('Invalid JSON in provider config');
    });

    it('should throw clear error for malformed JSON', () => {
      const jsonString = '{"type":"cli"';

      expect(() => parseProviderConfigJson(jsonString)).toThrow('Invalid JSON in provider config');
    });

    it('should throw clear error for invalid schema', () => {
      const jsonString = '{"type":"invalid","provider":"claude"}';

      expect(() => parseProviderConfigJson(jsonString)).toThrow('Invalid provider configuration');
    });

    it('should throw clear error for missing required fields', () => {
      const jsonString = '{"type":"cli"}';

      expect(() => parseProviderConfigJson(jsonString)).toThrow('Invalid provider configuration');
    });

    it('should throw clear error for API provider without apiKey', () => {
      const jsonString = '{"type":"api","provider":"openai"}';

      expect(() => parseProviderConfigJson(jsonString)).toThrow('Invalid provider configuration');
    });

    it('should throw clear error for invalid timeout', () => {
      const jsonString = '{"type":"cli","provider":"claude","timeout":-1000}';

      expect(() => parseProviderConfigJson(jsonString)).toThrow('Invalid provider configuration');
    });

    it('should throw clear error for invalid provider name', () => {
      const jsonString = '{"type":"cli","provider":"invalid"}';

      expect(() => parseProviderConfigJson(jsonString)).toThrow('Invalid provider configuration');
    });

    it('should throw clear error for invalid endpoint URL', () => {
      const jsonString = '{"type":"api","provider":"openai","apiKey":"key","endpoint":"not-a-url"}';

      expect(() => parseProviderConfigJson(jsonString)).toThrow('Invalid provider configuration');
    });
  });

  describe('safeParseProviderConfigJson', () => {
    it('should return success for valid config', () => {
      const jsonString = '{"type":"cli","provider":"claude"}';

      const result = safeParseProviderConfigJson(jsonString);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          type: 'cli',
          provider: 'claude',
        });
      }
    });

    it('should return error for invalid JSON', () => {
      const jsonString = '{invalid}';

      const result = safeParseProviderConfigJson(jsonString);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid JSON');
      }
    });

    it('should return error for invalid schema', () => {
      const jsonString = '{"type":"invalid","provider":"claude"}';

      const result = safeParseProviderConfigJson(jsonString);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid provider configuration');
      }
    });

    it('should not throw for any input', () => {
      expect(() => safeParseProviderConfigJson('')).not.toThrow();
      expect(() => safeParseProviderConfigJson('null')).not.toThrow();
      expect(() => safeParseProviderConfigJson('{}')).not.toThrow();
    });
  });

  describe('formatValidationError', () => {
    it('should format single issue error', () => {
      const options = {
        cwd: '',
      };

      try {
        cliOptionsSchema.parse(options);
        expect.fail('Should have thrown ZodError');
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError);
        const formatted = formatValidationError(error as ZodError);
        expect(formatted).toContain('Validation failed');
        expect(formatted).toContain('cwd');
      }
    });

    it('should format multiple issue error', () => {
      const options = {
        cwd: '',
        ai: 'not-boolean',
        provider: 12_345,
      };

      try {
        cliOptionsSchema.parse(options);
        expect.fail('Should have thrown ZodError');
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError);
        const formatted = formatValidationError(error as ZodError);
        expect(formatted).toContain('Validation failed');
        expect(formatted).toContain('cwd');
        expect(formatted).toContain('ai');
      }
    });

    it('should format nested path error', () => {
      const jsonString = '{"type":"cli","provider":"claude","args":"not-array"}';

      try {
        parseProviderConfigJson(jsonString);
        expect.fail('Should have thrown error');
      } catch (error) {
        if (error instanceof Error && error.message.includes('Invalid provider configuration')) {
          expect(error.message).toContain('args');
        }
      }
    });

    it('should handle error with empty path', () => {
      const schema = z.string();

      try {
        schema.parse(123);
        expect.fail('Should have thrown ZodError');
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError);
        const formatted = formatValidationError(error as ZodError);
        expect(formatted).toContain('input');
      }
    });
  });

  describe('Type Inference', () => {
    it('should infer correct CliOptions type', () => {
      const options: CliOptions = {
        ai: true,
        cwd: '/path',
      };

      expect(options.ai).toBe(true);
      expect(options.cwd).toBe('/path');
    });

    it('should allow optional fields in CliOptions', () => {
      const options: CliOptions = {
        ai: true,
        cwd: '/path',
        provider: 'claude',
      };

      expect(options.provider).toBe('claude');
      expect(options.signature).toBeUndefined();
    });

    it('should enforce required fields in CliOptions', () => {
      // This test demonstrates type safety at compile time

      const options: CliOptions = {
        ai: true,
        cwd: '/custom',
      };

      expect(options.cwd).toBeDefined();
    });
  });
});
