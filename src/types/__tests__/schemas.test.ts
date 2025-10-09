import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import type { CommitMessageGeneratorConfig, CommitMessageOptions, CommitTask } from '../schemas';

import {
  commitMessageGeneratorConfigSchema,
  commitMessageOptionsSchema,
  commitTaskSchema,
  safeValidateCommitOptions,
  safeValidateCommitTask,
  safeValidateGeneratorConfig,
  validateCommitOptions,
  validateCommitTask,
  validateGeneratorConfig,
} from '../schemas';

describe('Core Schemas', () => {
  describe('commitTaskSchema', () => {
    describe('valid tasks', () => {
      it('should validate a minimal valid task', () => {
        const task = {
          title: 'Add feature',
          description: 'Implement new feature',
          produces: [],
        };

        const result = commitTaskSchema.parse(task);

        expect(result).toEqual(task);
      });

      it('should validate task with produces array', () => {
        const task = {
          title: 'Add authentication',
          description: 'Implement JWT-based auth',
          produces: ['src/auth.ts', 'src/middleware/auth.ts'],
        };

        const result = commitTaskSchema.parse(task);

        expect(result).toEqual(task);
      });

      it('should apply default empty array for produces if missing', () => {
        const task = {
          title: 'Update docs',
          description: 'Fix typos in README',
        };

        const result = commitTaskSchema.parse(task);

        expect(result.produces).toEqual([]);
      });

      it('should validate task with maximum length title', () => {
        const task = {
          title: 'a'.repeat(200),
          description: 'Test description',
          produces: [],
        };

        const result = commitTaskSchema.parse(task);

        expect(result.title).toHaveLength(200);
      });

      it('should validate task with maximum length description', () => {
        const task = {
          title: 'Test title',
          description: 'a'.repeat(1000),
          produces: [],
        };

        const result = commitTaskSchema.parse(task);

        expect(result.description).toHaveLength(1000);
      });

      it('should validate task with many files in produces', () => {
        const task = {
          title: 'Refactor components',
          description: 'Break down large components',
          produces: Array.from({ length: 50 }, (_, index) => `src/component-${index}.ts`),
        };

        const result = commitTaskSchema.parse(task);

        expect(result.produces).toHaveLength(50);
      });
    });

    describe('invalid tasks', () => {
      it('should reject empty title', () => {
        const task = {
          title: '',
          description: 'Valid description',
          produces: [],
        };

        expect(() => commitTaskSchema.parse(task)).toThrow(ZodError);
      });

      it('should reject title exceeding max length', () => {
        const task = {
          title: 'a'.repeat(201),
          description: 'Valid description',
          produces: [],
        };

        expect(() => commitTaskSchema.parse(task)).toThrow(ZodError);
      });

      it('should reject empty description', () => {
        const task = {
          title: 'Valid title',
          description: '',
          produces: [],
        };

        expect(() => commitTaskSchema.parse(task)).toThrow(ZodError);
      });

      it('should reject description exceeding max length', () => {
        const task = {
          title: 'Valid title',
          description: 'a'.repeat(1001),
          produces: [],
        };

        expect(() => commitTaskSchema.parse(task)).toThrow(ZodError);
      });

      it('should reject missing title field', () => {
        const task = {
          description: 'Valid description',
          produces: [],
        };

        expect(() => commitTaskSchema.parse(task)).toThrow(ZodError);
      });

      it('should reject missing description field', () => {
        const task = {
          title: 'Valid title',
          produces: [],
        };

        expect(() => commitTaskSchema.parse(task)).toThrow(ZodError);
      });

      it('should reject non-string title', () => {
        const task = {
          title: 123,
          description: 'Valid description',
          produces: [],
        };

        expect(() => commitTaskSchema.parse(task)).toThrow(ZodError);
      });

      it('should reject non-string description', () => {
        const task = {
          title: 'Valid title',
          description: { text: 'Not a string' },
          produces: [],
        };

        expect(() => commitTaskSchema.parse(task)).toThrow(ZodError);
      });

      it('should reject non-array produces', () => {
        const task = {
          title: 'Valid title',
          description: 'Valid description',
          produces: 'not-an-array',
        };

        expect(() => commitTaskSchema.parse(task)).toThrow(ZodError);
      });

      it('should reject produces array with non-string elements', () => {
        const task = {
          title: 'Valid title',
          description: 'Valid description',
          produces: ['valid', 123, 'also-valid'],
        };

        expect(() => commitTaskSchema.parse(task)).toThrow(ZodError);
      });
    });
  });

  describe('commitMessageOptionsSchema', () => {
    describe('valid options', () => {
      it('should validate minimal valid options', () => {
        const options = {
          workdir: '/path/to/project',
        };

        const result = commitMessageOptionsSchema.parse(options);

        expect(result).toEqual(options);
      });

      it('should validate options with files array', () => {
        const options = {
          workdir: '/path/to/project',
          files: ['src/index.ts', 'src/utils.ts'],
        };

        const result = commitMessageOptionsSchema.parse(options);

        expect(result).toEqual(options);
      });

      it('should validate options with output string', () => {
        const options = {
          workdir: '/path/to/project',
          output: 'Build successful',
        };

        const result = commitMessageOptionsSchema.parse(options);

        expect(result).toEqual(options);
      });

      it('should validate options with all fields', () => {
        const options = {
          workdir: '/path/to/project',
          files: ['src/index.ts'],
          output: 'Tests passed',
        };

        const result = commitMessageOptionsSchema.parse(options);

        expect(result).toEqual(options);
      });

      it('should validate options with empty files array', () => {
        const options = {
          workdir: '/path/to/project',
          files: [],
        };

        const result = commitMessageOptionsSchema.parse(options);

        expect(result).toEqual(options);
      });

      it('should validate options with empty output string', () => {
        const options = {
          workdir: '/path/to/project',
          output: '',
        };

        const result = commitMessageOptionsSchema.parse(options);

        expect(result).toEqual(options);
      });

      it('should validate options with many files', () => {
        const options = {
          workdir: '/path/to/project',
          files: Array.from({ length: 100 }, (_, index) => `src/file-${index}.ts`),
        };

        const result = commitMessageOptionsSchema.parse(options);

        expect(result.files).toHaveLength(100);
      });
    });

    describe('invalid options', () => {
      it('should reject empty workdir', () => {
        const options = {
          workdir: '',
        };

        expect(() => commitMessageOptionsSchema.parse(options)).toThrow(ZodError);
      });

      it('should reject missing workdir', () => {
        const options = {
          files: ['src/index.ts'],
        };

        expect(() => commitMessageOptionsSchema.parse(options)).toThrow(ZodError);
      });

      it('should reject non-string workdir', () => {
        const options = {
          workdir: 123,
        };

        expect(() => commitMessageOptionsSchema.parse(options)).toThrow(ZodError);
      });

      it('should reject non-array files', () => {
        const options = {
          workdir: '/path/to/project',
          files: 'not-an-array',
        };

        expect(() => commitMessageOptionsSchema.parse(options)).toThrow(ZodError);
      });

      it('should reject files array with non-string elements', () => {
        const options = {
          workdir: '/path/to/project',
          files: ['valid.ts', 123, null],
        };

        expect(() => commitMessageOptionsSchema.parse(options)).toThrow(ZodError);
      });

      it('should reject non-string output', () => {
        const options = {
          workdir: '/path/to/project',
          output: { message: 'not a string' },
        };

        expect(() => commitMessageOptionsSchema.parse(options)).toThrow(ZodError);
      });
    });
  });

  describe('commitMessageGeneratorConfigSchema', () => {
    describe('valid configurations', () => {
      it('should validate empty config', () => {
        const config = {};

        const result = commitMessageGeneratorConfigSchema.parse(config);

        expect(result).toEqual(config);
      });

      it('should validate config with enableAI', () => {
        const config = {
          enableAI: true,
        };

        const result = commitMessageGeneratorConfigSchema.parse(config);

        expect(result).toEqual(config);
      });

      it('should validate config with provider config', () => {
        const config = {
          provider: { type: 'cli', provider: 'claude' },
        };

        const result = commitMessageGeneratorConfigSchema.parse(config);

        expect(result).toEqual(config);
      });

      it('should validate config with provider instance', () => {
        const mockProvider = {
          generateCommitMessage: async () => 'test',
          isAvailable: async () => true,
          getName: () => 'Test Provider',
          getProviderType: () => 'cli' as const,
        };

        const config = {
          provider: mockProvider,
        };

        const result = commitMessageGeneratorConfigSchema.parse(config);

        expect(result.provider).toBe(mockProvider);
      });

      it('should validate config with providerChain', () => {
        const config = {
          providerChain: [
            { type: 'cli', provider: 'claude' },
            { type: 'cli', provider: 'codex' },
          ],
        };

        const result = commitMessageGeneratorConfigSchema.parse(config);

        expect(result).toEqual(config);
      });

      it('should validate config with signature', () => {
        const config = {
          signature: 'Custom signature',
        };

        const result = commitMessageGeneratorConfigSchema.parse(config);

        expect(result).toEqual(config);
      });

      it('should validate config with logger', () => {
        const logger = {
          warn: (message: string) => {
            console.warn(message);
          },
        };

        const config = {
          logger,
        };

        const result = commitMessageGeneratorConfigSchema.parse(config);

        expect(result.logger).toBeDefined();
        expect(result.logger?.warn).toBeTypeOf('function');
      });

      it('should validate config with deprecated aiCommand', () => {
        const config = {
          aiCommand: 'custom-claude',
        };

        const result = commitMessageGeneratorConfigSchema.parse(config);

        expect(result).toEqual(config);
      });

      it('should validate config with deprecated aiTimeout', () => {
        const config = {
          aiTimeout: 60_000,
        };

        const result = commitMessageGeneratorConfigSchema.parse(config);

        expect(result).toEqual(config);
      });

      it('should validate config with autoDetect', () => {
        const config = {
          autoDetect: true,
        };

        const result = commitMessageGeneratorConfigSchema.parse(config);

        expect(result).toEqual(config);
      });

      it('should validate config with all optional fields', () => {
        const logger = {
          warn: (message: string) => {
            console.warn(message);
          },
        };

        const config = {
          enableAI: true,
          provider: { type: 'cli', provider: 'claude' },
          signature: 'Custom signature',
          logger,
          aiCommand: 'claude',
          aiTimeout: 120_000,
          autoDetect: false,
        };

        const result = commitMessageGeneratorConfigSchema.parse(config);

        expect(result.enableAI).toBe(true);
        expect(result.provider).toEqual({ type: 'cli', provider: 'claude' });
        expect(result.signature).toBe('Custom signature');
        expect(result.logger).toBeDefined();
        expect(result.logger?.warn).toBeTypeOf('function');
        expect(result.aiCommand).toBe('claude');
        expect(result.aiTimeout).toBe(120_000);
        expect(result.autoDetect).toBe(false);
      });
    });

    describe('invalid configurations', () => {
      it('should reject negative aiTimeout', () => {
        const config = {
          aiTimeout: -1000,
        };

        expect(() => commitMessageGeneratorConfigSchema.parse(config)).toThrow(ZodError);
      });

      it('should reject zero aiTimeout', () => {
        const config = {
          aiTimeout: 0,
        };

        expect(() => commitMessageGeneratorConfigSchema.parse(config)).toThrow(ZodError);
      });

      it('should reject non-boolean enableAI', () => {
        const config = {
          enableAI: 'true',
        };

        expect(() => commitMessageGeneratorConfigSchema.parse(config)).toThrow(ZodError);
      });

      it('should reject non-string signature', () => {
        const config = {
          signature: 123,
        };

        expect(() => commitMessageGeneratorConfigSchema.parse(config)).toThrow(ZodError);
      });

      it('should reject invalid logger (missing warn method)', () => {
        const config = {
          logger: {
            log: (message: string) => {
              console.log(message);
            },
          },
        };

        expect(() => commitMessageGeneratorConfigSchema.parse(config)).toThrow(ZodError);
      });

      it('should reject invalid provider config', () => {
        const config = {
          provider: { type: 'invalid', provider: 'claude' },
        };

        expect(() => commitMessageGeneratorConfigSchema.parse(config)).toThrow(ZodError);
      });

      it('should reject invalid provider instance (missing methods)', () => {
        const config = {
          provider: {
            generateCommitMessage: async () => 'test',
            // Missing isAvailable, getName, getProviderType
          },
        };

        expect(() => commitMessageGeneratorConfigSchema.parse(config)).toThrow(ZodError);
      });

      it('should reject empty providerChain array', () => {
        const config = {
          providerChain: [],
        };

        expect(() => commitMessageGeneratorConfigSchema.parse(config)).toThrow(ZodError);
      });

      it('should reject providerChain with invalid configs', () => {
        const config = {
          providerChain: [
            { type: 'cli', provider: 'claude' },
            { type: 'invalid', provider: 'test' },
          ],
        };

        expect(() => commitMessageGeneratorConfigSchema.parse(config)).toThrow(ZodError);
      });

      it('should reject both provider and providerChain', () => {
        const config = {
          provider: { type: 'cli', provider: 'claude' },
          providerChain: [{ type: 'cli', provider: 'codex' }],
        };

        expect(() => commitMessageGeneratorConfigSchema.parse(config)).toThrow(ZodError);
      });

      it('should provide helpful error message for mutual exclusivity', () => {
        const config = {
          provider: { type: 'cli', provider: 'claude' },
          providerChain: [{ type: 'cli', provider: 'codex' }],
        };

        try {
          commitMessageGeneratorConfigSchema.parse(config);
          expect.fail('Should have thrown ZodError');
        } catch (error) {
          expect(error).toBeInstanceOf(ZodError);
          const zodError = error as ZodError;
          expect(zodError.issues[0]?.message).toContain('provider');
          expect(zodError.issues[0]?.message).toContain('providerChain');
        }
      });
    });
  });

  describe('Validation Helper Functions', () => {
    describe('validateCommitTask', () => {
      it('should validate valid task', () => {
        const task = {
          title: 'Add feature',
          description: 'Implement new feature',
          produces: ['src/feature.ts'],
        };

        const result = validateCommitTask(task);

        expect(result).toEqual(task);
      });

      it('should throw ZodError for invalid task', () => {
        const task = {
          title: '',
          description: 'Valid description',
          produces: [],
        };

        expect(() => validateCommitTask(task)).toThrow(ZodError);
      });

      it('should provide detailed error messages', () => {
        const task = {
          title: '',
          description: '',
          produces: 'not-an-array',
        };

        try {
          validateCommitTask(task);
          expect.fail('Should have thrown ZodError');
        } catch (error) {
          expect(error).toBeInstanceOf(ZodError);
          const zodError = error as ZodError;
          expect(zodError.issues.length).toBeGreaterThan(0);
        }
      });

      it('should handle non-object input', () => {
        expect(() => validateCommitTask(null)).toThrow(ZodError);
        expect(() => validateCommitTask(undefined)).toThrow(ZodError);
        expect(() => validateCommitTask('string')).toThrow(ZodError);
        expect(() => validateCommitTask(123)).toThrow(ZodError);
      });
    });

    describe('validateCommitOptions', () => {
      it('should validate valid options', () => {
        const options = {
          workdir: '/path/to/project',
          files: ['src/index.ts'],
          output: 'Build successful',
        };

        const result = validateCommitOptions(options);

        expect(result).toEqual(options);
      });

      it('should throw ZodError for invalid options', () => {
        const options = {
          workdir: '',
        };

        expect(() => validateCommitOptions(options)).toThrow(ZodError);
      });

      it('should provide detailed error messages', () => {
        const options = {
          workdir: 123,
          files: 'not-an-array',
        };

        try {
          validateCommitOptions(options);
          expect.fail('Should have thrown ZodError');
        } catch (error) {
          expect(error).toBeInstanceOf(ZodError);
          const zodError = error as ZodError;
          expect(zodError.issues.length).toBeGreaterThan(0);
        }
      });

      it('should handle non-object input', () => {
        expect(() => validateCommitOptions(null)).toThrow(ZodError);
        expect(() => validateCommitOptions(undefined)).toThrow(ZodError);
        expect(() => validateCommitOptions('string')).toThrow(ZodError);
        expect(() => validateCommitOptions([])).toThrow(ZodError);
      });
    });

    describe('validateGeneratorConfig', () => {
      it('should validate valid config', () => {
        const config = {
          enableAI: true,
          provider: { type: 'cli', provider: 'claude' },
          signature: 'Custom signature',
        };

        const result = validateGeneratorConfig(config);

        expect(result).toEqual(config);
      });

      it('should throw ZodError for invalid config', () => {
        const config = {
          aiTimeout: -1000,
        };

        expect(() => validateGeneratorConfig(config)).toThrow(ZodError);
      });

      it('should throw ZodError for mutual exclusivity violation', () => {
        const config = {
          provider: { type: 'cli', provider: 'claude' },
          providerChain: [{ type: 'cli', provider: 'codex' }],
        };

        expect(() => validateGeneratorConfig(config)).toThrow(ZodError);
      });

      it('should provide detailed error messages', () => {
        const config = {
          enableAI: 'not-a-boolean',
          aiTimeout: -100,
        };

        try {
          validateGeneratorConfig(config);
          expect.fail('Should have thrown ZodError');
        } catch (error) {
          expect(error).toBeInstanceOf(ZodError);
          const zodError = error as ZodError;
          expect(zodError.issues.length).toBeGreaterThan(0);
        }
      });

      it('should handle non-object input', () => {
        expect(() => validateGeneratorConfig(null)).toThrow(ZodError);
        expect(() => validateGeneratorConfig('string')).toThrow(ZodError);
        expect(() => validateGeneratorConfig([])).toThrow(ZodError);
      });

      it('should validate empty object as valid config', () => {
        const result = validateGeneratorConfig({});

        expect(result).toEqual({});
      });
    });
  });

  describe('Safe Validation Helper Functions', () => {
    describe('safeValidateCommitTask', () => {
      it('should return success for valid task', () => {
        const task = {
          title: 'Add feature',
          description: 'Implement new feature',
          produces: ['src/feature.ts'],
        };

        const result = safeValidateCommitTask(task);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(task);
        }
      });

      it('should return error for invalid task', () => {
        const task = {
          title: '',
          description: 'Valid description',
          produces: [],
        };

        const result = safeValidateCommitTask(task);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(ZodError);
        }
      });

      it('should not throw for invalid input', () => {
        expect(() => safeValidateCommitTask(null)).not.toThrow();
        expect(() => safeValidateCommitTask(undefined)).not.toThrow();
        expect(() => safeValidateCommitTask('string')).not.toThrow();
      });

      it('should provide error details in result', () => {
        const task = {
          title: '',
          description: '',
        };

        const result = safeValidateCommitTask(task);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.length).toBeGreaterThan(0);
        }
      });
    });

    describe('safeValidateCommitOptions', () => {
      it('should return success for valid options', () => {
        const options = {
          workdir: '/path/to/project',
          files: ['src/index.ts'],
        };

        const result = safeValidateCommitOptions(options);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(options);
        }
      });

      it('should return error for invalid options', () => {
        const options = {
          workdir: '',
        };

        const result = safeValidateCommitOptions(options);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(ZodError);
        }
      });

      it('should not throw for invalid input', () => {
        expect(() => safeValidateCommitOptions(null)).not.toThrow();
        expect(() => safeValidateCommitOptions([])).not.toThrow();
        expect(() => safeValidateCommitOptions(123)).not.toThrow();
      });

      it('should provide error details in result', () => {
        const options = {
          workdir: 123,
          files: 'not-an-array',
        };

        const result = safeValidateCommitOptions(options);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.length).toBeGreaterThan(0);
        }
      });
    });

    describe('safeValidateGeneratorConfig', () => {
      it('should return success for valid config', () => {
        const config = {
          enableAI: true,
          provider: { type: 'cli', provider: 'claude' },
        };

        const result = safeValidateGeneratorConfig(config);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(config);
        }
      });

      it('should return error for invalid config', () => {
        const config = {
          aiTimeout: -1000,
        };

        const result = safeValidateGeneratorConfig(config);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(ZodError);
        }
      });

      it('should return error for mutual exclusivity violation', () => {
        const config = {
          provider: { type: 'cli', provider: 'claude' },
          providerChain: [{ type: 'cli', provider: 'codex' }],
        };

        const result = safeValidateGeneratorConfig(config);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('provider');
        }
      });

      it('should not throw for invalid input', () => {
        expect(() => safeValidateGeneratorConfig(null)).not.toThrow();
        expect(() => safeValidateGeneratorConfig('string')).not.toThrow();
        expect(() => safeValidateGeneratorConfig([])).not.toThrow();
      });

      it('should return success for empty config', () => {
        const result = safeValidateGeneratorConfig({});

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual({});
        }
      });
    });
  });

  describe('Type Inference', () => {
    it('should infer correct CommitTask type', () => {
      const task: CommitTask = {
        title: 'Test',
        description: 'Test description',
        produces: ['file.ts'],
      };

      expect(task.title).toBe('Test');
      expect(task.description).toBe('Test description');
      expect(task.produces).toEqual(['file.ts']);
    });

    it('should infer correct CommitMessageOptions type', () => {
      const options: CommitMessageOptions = {
        workdir: '/path',
        files: ['test.ts'],
        output: 'output',
      };

      expect(options.workdir).toBe('/path');
      expect(options.files).toEqual(['test.ts']);
      expect(options.output).toBe('output');
    });

    it('should infer correct CommitMessageGeneratorConfig type', () => {
      const config: CommitMessageGeneratorConfig = {
        enableAI: true,
        signature: 'test',
      };

      expect(config.enableAI).toBe(true);
      expect(config.signature).toBe('test');
    });

    it('should allow optional fields in inferred types', () => {
      // Note: produces has a default [], so it's optional in input but required in output
      const inputTask = {
        title: 'Test',
        description: 'Test',
      };

      const validatedTask = commitTaskSchema.parse(inputTask);

      expect(validatedTask.produces).toEqual([]);
    });

    it('should allow partial config with only some fields', () => {
      const config: CommitMessageGeneratorConfig = {
        enableAI: false,
      };

      expect(config.enableAI).toBe(false);
      expect(config.provider).toBeUndefined();
    });
  });
});
