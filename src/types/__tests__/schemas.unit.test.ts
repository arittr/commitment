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
 * - ✅ Custom validation (business rules beyond Zod)
 * - ✅ Business logic (domain-specific behavior)
 *
 * Rationale: Zod is well-tested. We focus on behavior we own.
 *
 * See: @docs/constitutions/current/schema-rules.md
 */

import { describe, expect, it } from 'bun:test';
import type { CommitMessageGeneratorConfig, CommitMessageOptions, CommitTask } from '../schemas';
import { commitTaskSchema } from '../schemas';

describe('Core Schemas', () => {
  describe('Type Inference', () => {
    it('should infer correct CommitTask type', () => {
      const task: CommitTask = {
        description: 'Test description',
        produces: ['file.ts'],
        title: 'Test',
      };

      expect(task.title).toBe('Test');
      expect(task.description).toBe('Test description');
      expect(task.produces).toEqual(['file.ts']);
    });

    it('should infer correct CommitMessageOptions type', () => {
      const options: CommitMessageOptions = {
        files: ['test.ts'],
        output: 'output',
        workdir: '/path',
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
        description: 'Test',
        title: 'Test',
      };

      const validatedTask = commitTaskSchema.parse(inputTask);

      expect(validatedTask.produces).toEqual([]);
    });

    it('should allow partial config with only some fields', () => {
      const config: CommitMessageGeneratorConfig = {
        enableAI: false,
      };

      expect(config.enableAI).toBe(false);
      expect(config.agent).toBeUndefined();
    });
  });
});
