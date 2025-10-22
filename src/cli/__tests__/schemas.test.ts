import { describe, expect, it } from 'vitest';
import { ZodError, z } from 'zod';
import type { CliOptions } from '../schemas.ts';
import {
  cliOptionsSchema,
  formatValidationError,
  safeValidateCliOptions,
  validateCliOptions,
} from '../schemas.ts';

describe('CLI Schemas', () => {
  describe('cliOptionsSchema', () => {
    describe('valid options', () => {
      it('should validate minimal valid options with defaults', () => {
        const options = {};

        const result = cliOptionsSchema.parse(options);

        expect(result.ai).toBe(true);
        expect(result.cwd).toBe(process.cwd());
        expect(result.agent).toBeUndefined();
        expect(result.dryRun).toBeUndefined();
        expect(result.messageOnly).toBeUndefined();
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

      it('should validate options with agent claude', () => {
        const options = {
          agent: 'claude',
        };

        const result = cliOptionsSchema.parse(options);

        expect(result.agent).toBe('claude');
      });

      it('should validate options with agent codex', () => {
        const options = {
          agent: 'codex',
        };

        const result = cliOptionsSchema.parse(options);

        expect(result.agent).toBe('codex');
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

      it('should validate options with all fields', () => {
        const options = {
          agent: 'claude',
          ai: true,
          cwd: '/custom/path',
          dryRun: true,
          messageOnly: true,
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

      it('should reject invalid agent name', () => {
        const options = {
          agent: 'openai',
        };

        expect(() => cliOptionsSchema.parse(options)).toThrow(ZodError);
      });

      it('should reject non-string agent', () => {
        const options = {
          agent: 123,
        };

        expect(() => cliOptionsSchema.parse(options)).toThrow(ZodError);
      });

      it('should reject non-string cwd', () => {
        const options = {
          cwd: 123,
        };

        expect(() => cliOptionsSchema.parse(options)).toThrow(ZodError);
      });
    });
  });

  describe('validateCliOptions', () => {
    it('should validate valid options', () => {
      const options = {
        agent: 'claude',
        cwd: '/path/to/project',
      };

      const result = validateCliOptions(options);

      expect(result.cwd).toBe('/path/to/project');
      expect(result.agent).toBe('claude');
    });

    it('should apply defaults to missing fields', () => {
      const options = {};

      const result = validateCliOptions(options);

      expect(result.ai).toBe(true);
      expect(result.cwd).toBe(process.cwd());
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

    it('should throw ZodError for invalid agent', () => {
      const options = {
        agent: 'invalid-agent',
      };

      expect(() => validateCliOptions(options)).toThrow(ZodError);
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
        ai: 'not-a-boolean',
        cwd: '',
      };

      const result = safeValidateCliOptions(options);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });

    it('should return error for invalid agent', () => {
      const options = {
        agent: 'invalid',
      };

      const result = safeValidateCliOptions(options);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
        expect(result.error.issues[0]?.path).toContain('agent');
      }
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
        agent: 'invalid',
        ai: 'not-boolean',
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
        expect(formatted).toContain('ai');
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
        agent: 'claude',
        ai: true,
        cwd: '/path',
      };

      expect(options.agent).toBe('claude');
      expect(options.dryRun).toBeUndefined();
    });

    it('should enforce required fields in CliOptions', () => {
      // This test demonstrates type safety at compile time

      const options: CliOptions = {
        ai: true,
        cwd: '/custom',
      };

      expect(options.cwd).toBeDefined();
    });

    it('should only allow valid agent values', () => {
      const options: CliOptions = {
        agent: 'claude', // Only 'claude' or 'codex' allowed
        ai: true,
        cwd: '/path',
      };

      expect(options.agent).toBe('claude');
    });
  });
});
