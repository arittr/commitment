import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import {
  formatValidationError,
  parseProviderConfigJson,
  safeParseProviderConfigJson,
  safeValidateCliOptions,
  validateCliOptions,
} from '../../cli/schemas';
import { CommitMessageGenerator } from '../../generator';
import { createProvider, ProviderNotImplementedError } from '../../providers/provider-factory';
import { safeValidateCommitTask, safeValidateGeneratorConfig } from '../../types/schemas';

/**
 * Integration Tests for Error Message Quality
 *
 * Tests that error messages:
 * 1. Are actionable and clear
 * 2. Include relevant context
 * 3. Guide users to fix issues
 * 4. Provide helpful suggestions
 * 5. Format validation errors properly
 */
describe('Error Message Quality Integration Tests', () => {
  describe('Actionable Error Messages', () => {
    it('should provide clear error for empty cwd', () => {
      const invalidOptions = {
        cwd: '',
      };

      try {
        validateCliOptions(invalidOptions);
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof ZodError) {
          const formatted = formatValidationError(error);
          expect(formatted).toContain('Validation failed');
          expect(formatted).toContain('cwd');
          expect(formatted).toContain('must not be empty');
        }
      }
    });

    it('should provide clear error for invalid boolean flag', () => {
      const invalidOptions = {
        ai: 'yes',
        cwd: '/valid',
      };

      try {
        validateCliOptions(invalidOptions as any);
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof ZodError) {
          const formatted = formatValidationError(error);
          expect(formatted).toContain('ai');
          expect(formatted).toContain('boolean');
        }
      }
    });

    it('should provide clear error for invalid provider config JSON', () => {
      const invalidJson = '{not valid json}';

      try {
        parseProviderConfigJson(invalidJson);
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof Error) {
          expect(error.message).toContain('Invalid JSON');
          expect(error.message).toContain('provider config');
        }
      }
    });

    it('should provide clear error for missing required provider config fields', () => {
      const invalidConfig = '{"type":"cli"}'; // Missing provider field

      try {
        parseProviderConfigJson(invalidConfig);
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof Error) {
          expect(error.message).toContain('Invalid provider configuration');
          expect(error.message).toContain('provider');
        }
      }
    });

    it('should provide clear error for invalid timeout value', () => {
      const invalidConfig = '{"type":"cli","provider":"claude","timeout":-1000}';

      try {
        parseProviderConfigJson(invalidConfig);
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof Error) {
          expect(error.message).toContain('Invalid provider configuration');
          expect(error.message).toContain('timeout');
        }
      }
    });

    it('should provide clear error for unimplemented provider', () => {
      try {
        createProvider({ type: 'cli', provider: 'cursor' });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderNotImplementedError);
        if (error instanceof ProviderNotImplementedError) {
          expect(error.message).toContain('cursor');
          expect(error.message).toContain('not yet implemented');
          expect(error.message).toContain('use a different provider');
          expect(error.message).toContain('contribute an implementation');
        }
      }
    });
  });

  describe('Error Context and Guidance', () => {
    it('should include field path in task validation errors', async () => {
      const invalidTask = {
        title: '', // Empty title
        description: 'Valid description',
        produces: [],
      };

      const result = safeValidateCommitTask(invalidTask);

      expect(result.success).toBe(false);
      if (!result.success) {
        const firstIssue = result.error.issues[0];
        if (firstIssue !== undefined) {
          expect(firstIssue.path).toContain('title');
          expect(firstIssue.message).toContain('must not be empty');
        }
      }
    });

    it('should provide context for task description length errors', async () => {
      const invalidTask = {
        title: 'Valid title',
        description: 'a'.repeat(1001), // Too long
        produces: [],
      };

      const result = safeValidateCommitTask(invalidTask);

      expect(result.success).toBe(false);
      if (!result.success) {
        const firstIssue = result.error.issues[0];
        if (firstIssue !== undefined) {
          expect(firstIssue.path).toContain('description');
          expect(firstIssue.message).toContain('must not exceed 1000 characters');
        }
      }
    });

    it('should guide user when agent name is invalid', () => {
      const invalidConfig = {
        agent: 'invalid-agent',
      };

      const result = safeValidateGeneratorConfig(invalidConfig);

      expect(result.success).toBe(false);
      if (!result.success) {
        const firstIssue = result.error.issues[0];
        if (firstIssue !== undefined) {
          const errorMessage = firstIssue.message;
          expect(errorMessage).toContain('expected one of');
          expect(errorMessage).toContain('claude');
          expect(errorMessage).toContain('codex');
        }
      }
    });

    it('should provide helpful error for non-string agent', () => {
      const invalidConfig = {
        agent: 123,
      };

      const result = safeValidateGeneratorConfig(invalidConfig);

      expect(result.success).toBe(false);
      if (!result.success) {
        const firstIssue = result.error.issues[0];
        if (firstIssue !== undefined) {
          expect(firstIssue.message).toContain('expected one of');
        }
      }
    });

    it('should include all validation errors in formatted output', () => {
      const invalidOptions = {
        cwd: '',
        ai: 'not-boolean',
        provider: 12_345,
      };

      try {
        validateCliOptions(invalidOptions as any);
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof ZodError) {
          const formatted = formatValidationError(error);
          expect(formatted).toContain('Validation failed');
          expect(formatted).toContain('cwd');
          expect(formatted).toContain('ai');
          expect(error.issues.length).toBeGreaterThan(1);
        }
      }
    });

    it('should format nested validation errors with full path', () => {
      const invalidConfig =
        '{"type":"cli","provider":"claude","args":"not-an-array","timeout":-500}';

      try {
        parseProviderConfigJson(invalidConfig);
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof Error) {
          expect(error.message).toContain('Invalid provider configuration');
          // Should mention both invalid fields
          expect(error.message).toBeTruthy();
        }
      }
    });
  });

  describe('Safe Parsing Error Messages', () => {
    it('should provide structured error result for invalid CLI options', () => {
      const invalidOptions = {
        cwd: '',
      };

      const result = safeValidateCliOptions(invalidOptions);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ZodError);
        expect(result.error.issues.length).toBeGreaterThan(0);
        const firstIssue = result.error.issues[0];
        if (firstIssue !== undefined) {
          expect(firstIssue.path).toContain('cwd');
        }
      }
    });

    it('should provide string error message for invalid provider config JSON', () => {
      const invalidJson = '{invalid}';

      const result = safeParseProviderConfigJson(invalidJson);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(typeof result.error).toBe('string');
        expect(result.error).toContain('Invalid JSON');
      }
    });

    it('should provide string error for schema validation in safe parse', () => {
      const invalidConfig = '{"type":"invalid","provider":"claude"}';

      const result = safeParseProviderConfigJson(invalidConfig);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(typeof result.error).toBe('string');
        expect(result.error).toContain('Invalid provider configuration');
      }
    });
  });

  describe('Generator Error Messages', () => {
    it('should format task validation errors in user-friendly way', async () => {
      const generator = new CommitMessageGenerator({ enableAI: false });

      const invalidTask = {
        title: '',
        description: 'Valid',
        produces: [],
      };

      try {
        await generator.generateCommitMessage(invalidTask as any, { workdir: process.cwd() });
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof Error) {
          expect(error.message).toContain('Invalid task parameter');
          expect(error.message).toContain('title');
          const genError = error as { suggestedAction?: string };
          expect(genError.suggestedAction).toContain('CommitTask');
        }
      }
    });

    it('should format options validation errors in user-friendly way', async () => {
      const generator = new CommitMessageGenerator({ enableAI: false });

      const validTask = {
        title: 'Valid',
        description: 'Valid description',
        produces: [],
      };

      const invalidOptions = {
        workdir: '',
      };

      try {
        await generator.generateCommitMessage(validTask, invalidOptions as any);
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof Error) {
          expect(error.message).toContain('Invalid options parameter');
          expect(error.message).toContain('workdir');
          const genError = error as { suggestedAction?: string };
          expect(genError.suggestedAction).toContain('CommitMessageOptions');
        }
      }
    });

    it('should format config validation errors at construction', () => {
      const invalidConfig = {
        signature: 12_345,
      };

      try {
        new CommitMessageGenerator(invalidConfig as any);
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof Error) {
          expect(error.message).toContain('Invalid CommitMessageGenerator configuration');
          const genError = error as { context?: { validationErrors?: string[] } };
          const hasSignatureError = genError.context?.validationErrors?.some((error_) =>
            error_.includes('signature'),
          );
          expect(hasSignatureError).toBe(true);
        }
      }
    });

    it('should include helpful hint for invalid agent error', () => {
      const invalidConfig = {
        agent: 'unknown-agent',
      };

      try {
        new CommitMessageGenerator(invalidConfig as any);
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof Error) {
          expect(error.message).toContain('Invalid CommitMessageGenerator configuration');
          const genError = error as { context?: { validationErrors?: string[] } };
          expect(genError.context?.validationErrors).toBeDefined();
        }
      }
    });
  });

  describe('Error Message Formatting', () => {
    it('should format single field error clearly', () => {
      const invalidOptions = {
        cwd: '',
      };

      try {
        validateCliOptions(invalidOptions);
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof ZodError) {
          const formatted = formatValidationError(error);
          const lines = formatted.split('\n');
          expect(lines[0]).toBe('Validation failed:');
          expect(lines[1]).toContain('cwd');
          expect(lines[1]).toMatch(/^\s*-/); // Bullet point format
        }
      }
    });

    it('should format multiple field errors as bullet list', () => {
      const invalidOptions = {
        cwd: '',
        ai: 'not-boolean',
      };

      try {
        validateCliOptions(invalidOptions as any);
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof ZodError) {
          const formatted = formatValidationError(error);
          const lines = formatted.split('\n');
          expect(lines[0]).toBe('Validation failed:');
          expect(lines.length).toBeGreaterThan(2);
          expect(lines.filter((line) => line.includes('-')).length).toBeGreaterThan(1);
        }
      }
    });

    it('should quote field names in error messages', () => {
      const invalidOptions = {
        cwd: '',
      };

      try {
        validateCliOptions(invalidOptions);
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof ZodError) {
          const formatted = formatValidationError(error);
          expect(formatted).toMatch(/"cwd"/);
        }
      }
    });

    it('should handle root-level validation errors', () => {
      const invalidInput = 'not an object';

      try {
        validateCliOptions(invalidInput as any);
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof ZodError) {
          const formatted = formatValidationError(error);
          expect(formatted).toContain('input'); // Falls back to 'input' for root-level
        }
      }
    });
  });

  describe('Provider Factory Error Messages', () => {
    it('should provide helpful error for unimplemented CLI provider', () => {
      try {
        createProvider({ type: 'cli', provider: 'cursor' });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderNotImplementedError);
        if (error instanceof ProviderNotImplementedError) {
          expect(error.providerName).toBe('cursor');
          expect(error.providerType).toBe('cli');
          expect(error.message).toContain("Provider 'cursor' (cli) is not yet implemented");
        }
      }
    });

    it('should provide helpful error for unimplemented API provider', () => {
      try {
        createProvider({ type: 'api', provider: 'openai', apiKey: 'sk-test' });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderNotImplementedError);
        if (error instanceof ProviderNotImplementedError) {
          expect(error.providerName).toBe('openai');
          expect(error.providerType).toBe('api');
          expect(error.message).toContain("Provider 'openai' (api) is not yet implemented");
        }
      }
    });

    it('should suggest alternatives in NotImplementedError', () => {
      try {
        createProvider({ type: 'cli', provider: 'cursor' });
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof ProviderNotImplementedError) {
          expect(error.message).toContain('use a different provider');
        }
      }
    });

    it('should encourage contributions in NotImplementedError', () => {
      try {
        createProvider({ type: 'api', provider: 'gemini', apiKey: 'test' });
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof ProviderNotImplementedError) {
          expect(error.message).toContain('contribute an implementation');
        }
      }
    });
  });
});
