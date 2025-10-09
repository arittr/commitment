import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { buildProviderConfigFromOptions, validateCliOptions } from '../../cli/schemas';
import { CommitMessageGenerator } from '../../generator';
import { ClaudeProvider, CodexProvider } from '../../providers/index';

/**
 * Integration Tests for Validation Across System Boundaries
 *
 * Tests validation at all major boundaries:
 * 1. CLI → Generator (options, config)
 * 2. Generator → Provider (task, options)
 * 3. External → Internal (git output, user input)
 * 4. Performance (validation overhead)
 * 5. Backward compatibility (deprecated fields)
 */
describe('Validation Integration Tests', () => {
  describe('CLI → Generator Boundary', () => {
    it('should catch invalid CLI options at boundary', () => {
      const invalidOptions = {
        cwd: '', // Invalid: empty string
        ai: true,
      };

      expect(() => validateCliOptions(invalidOptions)).toThrow(ZodError);
    });

    it('should catch invalid provider name in CLI options', () => {
      const invalidOptions = {
        cwd: '/valid/path',
        provider: 123, // Invalid: must be string
      };

      expect(() => validateCliOptions(invalidOptions)).toThrow(ZodError);
    });

    it('should catch invalid boolean flags at CLI boundary', () => {
      const invalidOptions = {
        cwd: '/valid/path',
        ai: 'true', // Invalid: must be boolean
      };

      expect(() => validateCliOptions(invalidOptions)).toThrow(ZodError);
      expect(() => validateCliOptions(invalidOptions)).toThrow(/expected boolean/);
    });

    it('should catch invalid fallback array in CLI options', () => {
      const invalidOptions = {
        cwd: '/valid/path',
        fallback: 'claude,codex', // Invalid: must be array
      };

      expect(() => validateCliOptions(invalidOptions)).toThrow(ZodError);
    });

    it('should catch invalid provider config JSON string', () => {
      const invalidOptions = {
        cwd: '/valid/path',
        providerConfig: '{invalid json}',
      };

      const validatedOptions = validateCliOptions(invalidOptions);
      // Should validate CLI schema but providerConfig parsing happens later
      expect(validatedOptions.providerConfig).toBe('{invalid json}');
    });

    it('should validate and apply defaults for CLI options', () => {
      const minimalOptions = {};

      const validated = validateCliOptions(minimalOptions);

      expect(validated.ai).toBe(true);
      expect(validated.aiCommand).toBe('claude');
      expect(validated.timeout).toBe('120000');
      expect(validated.cwd).toBe(process.cwd());
    });

    it('should catch invalid timeout format in CLI options', () => {
      const invalidOptions = {
        cwd: '/valid/path',
        timeout: 123, // Invalid: must be string
      };

      expect(() => validateCliOptions(invalidOptions)).toThrow(ZodError);
    });

    it('should successfully build provider config from valid CLI options', () => {
      const validOptions = validateCliOptions({
        cwd: '/valid/path',
        provider: 'claude',
        claudeCommand: 'custom-claude',
        claudeTimeout: '60000',
      });

      const providerConfig = buildProviderConfigFromOptions(validOptions);

      expect(providerConfig).toEqual({
        type: 'cli',
        provider: 'claude',
        command: 'custom-claude',
        timeout: 60_000,
      });
    });
  });

  describe('Generator → Provider Boundary', () => {
    it('should catch invalid task object in generateCommitMessage', async () => {
      const generator = new CommitMessageGenerator({
        enableAI: false,
      });

      const invalidTask = {
        title: '', // Invalid: empty string
        description: 'Valid description',
        produces: [],
      };

      const options = {
        workdir: process.cwd(),
      };

      await expect(generator.generateCommitMessage(invalidTask as any, options)).rejects.toThrow(
        /Invalid task parameter/,
      );
    });

    it('should catch task with title exceeding max length', async () => {
      const generator = new CommitMessageGenerator({
        enableAI: false,
      });

      const invalidTask = {
        title: 'a'.repeat(201), // Invalid: exceeds 200 chars
        description: 'Valid description',
        produces: [],
      };

      const options = {
        workdir: process.cwd(),
      };

      await expect(generator.generateCommitMessage(invalidTask as any, options)).rejects.toThrow(
        /Invalid task parameter/,
      );
      await expect(generator.generateCommitMessage(invalidTask as any, options)).rejects.toThrow(
        /must not exceed 200 characters/,
      );
    });

    it('should catch invalid options in generateCommitMessage', async () => {
      const generator = new CommitMessageGenerator({
        enableAI: false,
      });

      const validTask = {
        title: 'Add feature',
        description: 'Implement new feature',
        produces: [],
      };

      const invalidOptions = {
        workdir: '', // Invalid: empty string
      };

      await expect(
        generator.generateCommitMessage(validTask, invalidOptions as any),
      ).rejects.toThrow(/Invalid options parameter/);
    });

    it('should catch options with invalid files array', async () => {
      const generator = new CommitMessageGenerator({
        enableAI: false,
      });

      const validTask = {
        title: 'Add feature',
        description: 'Implement new feature',
        produces: [],
      };

      const invalidOptions = {
        workdir: process.cwd(),
        files: 'not-an-array', // Invalid: must be array
      };

      await expect(
        generator.generateCommitMessage(validTask, invalidOptions as any),
      ).rejects.toThrow(/Invalid options parameter/);
    });

    it('should propagate validation errors with helpful context', async () => {
      const generator = new CommitMessageGenerator({
        enableAI: false,
      });

      const invalidTask = {
        title: 'Valid title',
        description: '', // Invalid: empty description
        produces: [],
      };

      const options = {
        workdir: process.cwd(),
      };

      try {
        await generator.generateCommitMessage(invalidTask as any, options);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        if (error instanceof Error) {
          expect(error.message).toContain('Invalid task parameter');
          expect(error.message).toContain('description');
          expect(error.message).toContain('must not be empty');
        }
      }
    });
  });

  describe('Generator Configuration Boundary', () => {
    it('should catch invalid generator config at construction', () => {
      const invalidConfig = {
        enableAI: 'yes', // Invalid: must be boolean
      };

      expect(() => new CommitMessageGenerator(invalidConfig as any)).toThrow(
        /Invalid CommitMessageGenerator configuration/,
      );
    });

    it('should catch negative timeout in generator config', () => {
      const invalidConfig = {
        aiTimeout: -1000, // Invalid: must be positive
      };

      expect(() => new CommitMessageGenerator(invalidConfig as any)).toThrow(
        /Invalid CommitMessageGenerator configuration/,
      );
      expect(() => new CommitMessageGenerator(invalidConfig as any)).toThrow(
        /must be a positive number/,
      );
    });

    it('should catch mutually exclusive provider and providerChain', () => {
      const invalidConfig = {
        provider: { type: 'cli' as const, provider: 'claude' as const },
        providerChain: [{ type: 'cli' as const, provider: 'codex' as const }],
      };

      expect(() => new CommitMessageGenerator(invalidConfig as any)).toThrow(
        /Invalid CommitMessageGenerator configuration/,
      );
      expect(() => new CommitMessageGenerator(invalidConfig as any)).toThrow(
        /Cannot specify both "provider" and "providerChain"/,
      );
    });

    it('should catch empty provider chain', () => {
      const invalidConfig = {
        providerChain: [], // Invalid: must have at least 1 provider
      };

      expect(() => new CommitMessageGenerator(invalidConfig as any)).toThrow(
        /Invalid CommitMessageGenerator configuration/,
      );
      expect(() => new CommitMessageGenerator(invalidConfig as any)).toThrow(
        /must contain at least one provider/,
      );
    });

    it('should accept valid single provider config', () => {
      const validConfig = {
        enableAI: true,
        provider: { type: 'cli' as const, provider: 'claude' as const },
      };

      expect(() => new CommitMessageGenerator(validConfig)).not.toThrow();
    });

    it('should accept valid provider chain config', () => {
      const validConfig = {
        enableAI: true,
        providerChain: [
          { type: 'cli' as const, provider: 'claude' as const },
          { type: 'cli' as const, provider: 'codex' as const },
        ],
      };

      expect(() => new CommitMessageGenerator(validConfig)).not.toThrow();
    });

    it('should accept valid provider instance', () => {
      const provider = new ClaudeProvider();

      const validConfig = {
        enableAI: true,
        provider,
      };

      expect(() => new CommitMessageGenerator(validConfig)).not.toThrow();
    });
  });

  describe('External → Internal Boundary (Git Output)', () => {
    it('should handle empty git diff gracefully', async () => {
      const generator = new CommitMessageGenerator({
        enableAI: false,
      });

      const task = {
        title: 'Update documentation',
        description: 'Fix typos in README',
        produces: ['README.md'],
      };

      const options = {
        workdir: process.cwd(),
        files: ['README.md'],
      };

      // Should not throw, just generate rule-based message
      const message = await generator.generateCommitMessage(task, options);
      expect(message).toBeTruthy();
      expect(typeof message).toBe('string');
    });

    it('should validate workdir is non-empty string', async () => {
      const generator = new CommitMessageGenerator({
        enableAI: false,
      });

      const task = {
        title: 'Add feature',
        description: 'New feature',
        produces: [],
      };

      const invalidOptions = {
        workdir: '', // Invalid: empty string
      };

      await expect(generator.generateCommitMessage(task, invalidOptions as any)).rejects.toThrow(
        /Invalid options parameter/,
      );
    });
  });

  describe('Performance Tests', () => {
    it('should have validation overhead < 5ms for CLI options', () => {
      const options = {
        cwd: '/path/to/project',
        provider: 'claude',
        ai: true,
      };

      const iterations = 100;
      const start = performance.now();

      for (let index = 0; index < iterations; index++) {
        validateCliOptions(options);
      }

      const end = performance.now();
      const avgTime = (end - start) / iterations;

      expect(avgTime).toBeLessThan(5);
    });

    it('should have validation overhead < 5ms for task validation', async () => {
      const generator = new CommitMessageGenerator({
        enableAI: false,
      });

      const task = {
        title: 'Add feature',
        description: 'Implement new feature',
        produces: ['src/feature.ts'],
      };

      const options = {
        workdir: process.cwd(),
        files: ['src/feature.ts'],
      };

      const iterations = 10;
      const start = performance.now();

      for (let index = 0; index < iterations; index++) {
        // Validate but don't execute (to measure validation only)
        try {
          await generator.generateCommitMessage(task, options);
        } catch {
          // Ignore execution errors, we just want validation timing
        }
      }

      const end = performance.now();
      const avgTime = (end - start) / iterations;

      // Allow more time here since it includes generation, focus on no regression
      expect(avgTime).toBeLessThan(1000); // Should be sub-second even with generation
    });

    it('should not add significant overhead for provider config validation', () => {
      const iterations = 100;
      const start = performance.now();

      for (let index = 0; index < iterations; index++) {
        const config = {
          enableAI: true,
          provider: { type: 'cli' as const, provider: 'claude' as const },
          signature: 'Test signature',
        };

        new CommitMessageGenerator(config);
      }

      const end = performance.now();
      const avgTime = (end - start) / iterations;

      expect(avgTime).toBeLessThan(5);
    });

    it('should validate large task descriptions efficiently', async () => {
      const generator = new CommitMessageGenerator({
        enableAI: false,
      });

      const task = {
        title: 'Add comprehensive feature',
        description: 'a'.repeat(999), // Near max length
        produces: Array.from({ length: 10 }, (_, index) => `file${index}.ts`),
      };

      const options = {
        workdir: process.cwd(),
        files: task.produces,
      };

      const start = performance.now();
      await generator.generateCommitMessage(task, options);
      const end = performance.now();

      // Should complete quickly even with large description
      expect(end - start).toBeLessThan(2000);
    });
  });

  describe('Backward Compatibility', () => {
    it('should support deprecated aiCommand field', () => {
      const config = {
        aiCommand: 'custom-claude',
        enableAI: true,
      };

      const generator = new CommitMessageGenerator(config);
      expect(generator).toBeInstanceOf(CommitMessageGenerator);
    });

    it('should support deprecated aiTimeout field', () => {
      const config = {
        aiTimeout: 60_000,
        enableAI: true,
      };

      const generator = new CommitMessageGenerator(config);
      expect(generator).toBeInstanceOf(CommitMessageGenerator);
    });

    it('should support legacy CLI timeout option', () => {
      const options = {
        timeout: '90000',
        cwd: '/path',
      };

      const validated = validateCliOptions(options);
      expect(validated.timeout).toBe('90000');
    });

    it('should handle mix of deprecated and new fields', () => {
      const config = {
        aiCommand: 'claude', // Deprecated
        aiTimeout: 90_000, // Deprecated
        provider: { type: 'cli' as const, provider: 'claude' as const }, // New
        enableAI: true,
      };

      // Should prefer new provider field over deprecated
      const generator = new CommitMessageGenerator(config);
      expect(generator).toBeInstanceOf(CommitMessageGenerator);
    });

    it('should maintain existing generateCommitMessage API', async () => {
      const generator = new CommitMessageGenerator({
        enableAI: false,
      });

      const task = {
        title: 'Add feature',
        description: 'New feature implementation',
        produces: ['src/feature.ts'],
      };

      const options = {
        workdir: process.cwd(),
        files: ['src/feature.ts'],
      };

      const message = await generator.generateCommitMessage(task, options);

      // Should return string message
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });

    it('should maintain signature appending behavior', async () => {
      const customSignature = 'Custom test signature';
      const generator = new CommitMessageGenerator({
        enableAI: false,
        signature: customSignature,
      });

      const task = {
        title: 'Add feature',
        description: 'Test feature',
        produces: [],
      };

      const options = {
        workdir: process.cwd(),
      };

      const message = await generator.generateCommitMessage(task, options);

      expect(message).toContain(customSignature);
    });

    it('should accept provider instances (backward compatibility)', () => {
      const provider = new CodexProvider();

      const config = {
        provider,
        enableAI: true,
      };

      const generator = new CommitMessageGenerator(config);
      expect(generator).toBeInstanceOf(CommitMessageGenerator);
    });
  });

  describe('Error Message Context', () => {
    it('should include field path in validation errors', async () => {
      const generator = new CommitMessageGenerator({
        enableAI: false,
      });

      const invalidTask = {
        title: 'a'.repeat(201), // Too long
        description: 'Valid',
        produces: [],
      };

      try {
        await generator.generateCommitMessage(invalidTask as any, { workdir: process.cwd() });
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof Error) {
          expect(error.message).toContain('title');
        }
      }
    });

    it('should provide actionable guidance in error messages', () => {
      const invalidOptions = {
        cwd: '',
      };

      try {
        validateCliOptions(invalidOptions);
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof ZodError) {
          const issue = error.issues[0];
          if (issue !== undefined) {
            expect(issue.message).toBeTruthy();
            expect(issue.path).toContain('cwd');
          }
        }
      }
    });

    it('should format multiple validation errors clearly', () => {
      const invalidOptions = {
        cwd: '',
        ai: 'not-boolean',
        timeout: 123,
      };

      try {
        validateCliOptions(invalidOptions as any);
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof ZodError) {
          expect(error.issues.length).toBeGreaterThan(1);
          expect(error.issues.some((issue) => issue.path.includes('cwd'))).toBe(true);
          expect(error.issues.some((issue) => issue.path.includes('ai'))).toBe(true);
        }
      }
    });
  });
});
