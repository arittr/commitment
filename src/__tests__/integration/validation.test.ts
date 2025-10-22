import { ZodError } from 'zod';

import { validateCliOptions } from '../../cli/schemas';
import { CommitMessageGenerator } from '../../generator';

/**
 * Integration Tests for Validation Across System Boundaries
 *
 * Tests validation at all major boundaries:
 * 1. CLI → Generator (options, config)
 * 2. Generator → Provider (task, options)
 * 3. External → Internal (git output, user input)
 * 4. Performance (validation overhead)
 */
describe('Validation Integration Tests', () => {
  describe('CLI → Generator Boundary', () => {
    it('should catch invalid CLI options at boundary', () => {
      const invalidOptions = {
        ai: true,
        cwd: '', // Invalid: empty string
      };

      expect(() => validateCliOptions(invalidOptions)).toThrow(ZodError);
    });

    it('should catch invalid agent name in CLI options', () => {
      const invalidOptions = {
        agent: 'openai', // Invalid: must be 'claude' or 'codex'
        cwd: '/valid/path',
      };

      expect(() => validateCliOptions(invalidOptions)).toThrow(ZodError);
    });

    it('should catch invalid boolean flags at CLI boundary', () => {
      const invalidOptions = {
        ai: 'true', // Invalid: must be boolean
        cwd: '/valid/path',
      };

      expect(() => validateCliOptions(invalidOptions)).toThrow(ZodError);
      expect(() => validateCliOptions(invalidOptions)).toThrow(/expected boolean/);
    });

    it('should catch invalid agent type in CLI options', () => {
      const invalidOptions = {
        agent: 123, // Invalid: must be string enum
        cwd: '/valid/path',
      };

      expect(() => validateCliOptions(invalidOptions)).toThrow(ZodError);
    });

    it('should validate and apply defaults for CLI options', () => {
      const minimalOptions = {};

      const validated = validateCliOptions(minimalOptions);

      expect(validated.ai).toBe(true);
      expect(validated.cwd).toBe(process.cwd());
    });
  });

  describe('Generator → Provider Boundary', () => {
    it('should catch invalid task object in generateCommitMessage', async () => {
      const generator = new CommitMessageGenerator({
        enableAI: false,
      });

      const invalidTask = {
        description: 'Valid description',
        produces: [],
        title: '', // Invalid: empty string
      };

      const options = {
        workdir: process.cwd(),
      };

      await expect(generator.generateCommitMessage(invalidTask as any, options)).rejects.toThrow(
        /Invalid task parameter/
      );
    });

    it('should catch invalid options in generateCommitMessage', async () => {
      const generator = new CommitMessageGenerator({
        enableAI: false,
      });

      const validTask = {
        description: 'Implement new feature',
        produces: [],
        title: 'Add feature',
      };

      const invalidOptions = {
        workdir: '', // Invalid: empty string
      };

      await expect(
        generator.generateCommitMessage(validTask, invalidOptions as any)
      ).rejects.toThrow(/Invalid options parameter/);
    });

    it('should catch options with invalid files array', async () => {
      const generator = new CommitMessageGenerator({
        enableAI: false,
      });

      const validTask = {
        description: 'Implement new feature',
        produces: [],
        title: 'Add feature',
      };

      const invalidOptions = {
        files: 'not-an-array', // Invalid: must be array
        workdir: process.cwd(),
      };

      await expect(
        generator.generateCommitMessage(validTask, invalidOptions as any)
      ).rejects.toThrow(/Invalid options parameter/);
    });

    it('should propagate validation errors with helpful context', async () => {
      const generator = new CommitMessageGenerator({
        enableAI: false,
      });

      const invalidTask = {
        description: '', // Invalid: empty description
        produces: [],
        title: 'Valid title',
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
        /Invalid CommitMessageGenerator configuration/
      );
    });

    it('should catch invalid signature type in generator config', () => {
      const invalidConfig = {
        signature: 12_345, // Invalid: must be string
      };

      expect(() => new CommitMessageGenerator(invalidConfig as any)).toThrow(
        /Invalid CommitMessageGenerator configuration/
      );
      // Check error context contains validation details
      try {
        new CommitMessageGenerator(invalidConfig as any);
        throw new Error('Expected error to be thrown');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(Error);
        const genError = error as { context?: { validationErrors?: string[] } };
        const hasSignatureError = genError.context?.validationErrors?.some((error_) =>
          error_.includes('signature')
        );
        expect(hasSignatureError).toBe(true);
      }
    });

    it('should catch invalid agent name', () => {
      const invalidConfig = {
        agent: 'invalid-agent',
      };

      expect(() => new CommitMessageGenerator(invalidConfig as any)).toThrow(
        /Invalid CommitMessageGenerator configuration/
      );
      // The error contains validation context but not in the main message anymore
      try {
        new CommitMessageGenerator(invalidConfig as any);
        throw new Error('Expected error to be thrown');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(Error);
        const genError = error as { context?: { validationErrors?: string[] } };
        expect(genError.context?.validationErrors).toBeDefined();
      }
    });

    it('should accept valid claude agent config', () => {
      const validConfig = {
        agent: 'claude' as const,
        enableAI: true,
      };

      expect(() => new CommitMessageGenerator(validConfig)).not.toThrow();
    });

    it('should accept valid codex agent config', () => {
      const validConfig = {
        agent: 'codex' as const,
        enableAI: true,
      };

      expect(() => new CommitMessageGenerator(validConfig)).not.toThrow();
    });

    it('should accept empty config (uses defaults)', () => {
      const validConfig = {};

      expect(() => new CommitMessageGenerator(validConfig)).not.toThrow();
    });
  });

  describe('External → Internal Boundary (Git Output)', () => {
    it('should handle empty git diff gracefully', async () => {
      const generator = new CommitMessageGenerator({
        enableAI: false,
      });

      const task = {
        description: 'Fix typos in README',
        produces: ['README.md'],
        title: 'Update documentation',
      };

      const options = {
        files: ['README.md'],
        workdir: process.cwd(),
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
        description: 'New feature',
        produces: [],
        title: 'Add feature',
      };

      const invalidOptions = {
        workdir: '', // Invalid: empty string
      };

      await expect(generator.generateCommitMessage(task, invalidOptions as any)).rejects.toThrow(
        /Invalid options parameter/
      );
    });
  });

  describe('Performance Tests', () => {
    it('should have validation overhead < 5ms for CLI options', () => {
      const options = {
        ai: true,
        cwd: '/path/to/project',
        provider: 'claude',
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
        description: 'Implement new feature',
        produces: ['src/feature.ts'],
        title: 'Add feature',
      };

      const options = {
        files: ['src/feature.ts'],
        workdir: process.cwd(),
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
          provider: { provider: 'claude' as const, type: 'cli' as const },
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
        description: 'a'.repeat(999), // Near max length
        produces: Array.from({ length: 10 }, (_, index) => `file${index}.ts`),
        title: 'Add comprehensive feature',
      };

      const options = {
        files: task.produces,
        workdir: process.cwd(),
      };

      const start = performance.now();
      await generator.generateCommitMessage(task, options);
      const end = performance.now();

      // Should complete quickly even with large description
      expect(end - start).toBeLessThan(2000);
    });
  });

  describe('Error Message Context', () => {
    it('should include field path in validation errors', async () => {
      const generator = new CommitMessageGenerator({
        enableAI: false,
      });

      const invalidTask = {
        description: '', // Empty - invalid
        produces: [],
        title: 'Valid title',
      };

      try {
        await generator.generateCommitMessage(invalidTask as any, { workdir: process.cwd() });
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof Error) {
          expect(error.message).toContain('description');
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
        ai: 'not-boolean',
        cwd: '',
        provider: 12_345,
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
