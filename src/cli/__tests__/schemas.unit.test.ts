import { describe, expect, it } from 'bun:test';

/**
 * Schema Tests - Testing Philosophy
 *
 * We DON'T test Zod's validation logic:
 * - ❌ "rejects non-string input"
 * - ❌ "rejects empty string"
 * - ❌ "applies default values"
 *
 * We DO test our custom logic built on schemas:
 * - ✅ Type inference (z.infer<> produces correct types)
 * - ✅ Data transformations (custom parsing logic)
 * - ✅ Custom validation (formatValidationError - business logic)
 * - ✅ Business logic (domain-specific behavior)
 *
 * Rationale: Zod is well-tested. We focus on behavior we own.
 *
 * See: @docs/constitutions/current/schema-rules.md
 */

import { ZodError, z } from 'zod';
import type { CliOptions } from '../schemas';
import { cliOptionsSchema, formatValidationError } from '../schemas';

describe('CLI Schemas', () => {
  describe('formatValidationError', () => {
    it('should format single issue error', () => {
      const options = {
        cwd: '',
      };

      try {
        cliOptionsSchema.parse(options);
        throw new Error('Should have thrown ZodError');
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
        cwd: '',
        quiet: 'not-boolean',
      };

      try {
        cliOptionsSchema.parse(options);
        throw new Error('Should have thrown ZodError');
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError);
        const formatted = formatValidationError(error as ZodError);
        expect(formatted).toContain('Validation failed');
        expect(formatted).toContain('cwd');
        expect(formatted).toContain('quiet');
      }
    });

    it('should handle error with empty path', () => {
      const schema = z.string();

      try {
        schema.parse(123);
        throw new Error('Should have thrown ZodError');
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
        cwd: '/path',
        quiet: false,
      };

      expect(options.quiet).toBe(false);
      expect(options.cwd).toBe('/path');
    });

    it('should allow optional fields in CliOptions', () => {
      const options: CliOptions = {
        agent: 'claude',
        cwd: '/path',
        quiet: true,
      };

      expect(options.agent).toBe('claude');
      expect(options.quiet).toBe(true);
      expect(options.dryRun).toBeUndefined();
    });

    it('should enforce required fields in CliOptions', () => {
      // This test demonstrates type safety at compile time

      const options: CliOptions = {
        cwd: '/custom',
        quiet: false,
      };

      expect(options.cwd).toBeDefined();
    });

    it('should only allow valid agent values', () => {
      const options: CliOptions = {
        agent: 'claude', // 'claude', 'codex', or 'gemini' allowed
        cwd: '/path',
        quiet: false,
      };

      expect(options.agent).toBe('claude');
    });

    it('should default quiet to false', () => {
      const parsed = cliOptionsSchema.parse({ cwd: '/path' });

      expect(parsed.quiet).toBe(false);
    });
  });
});
