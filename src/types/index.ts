/**
 * Type definitions and validation schemas for commitment
 *
 * This module provides comprehensive type safety using Zod schemas as the
 * single source of truth for all core types. TypeScript types are inferred
 * from these schemas to ensure consistency between runtime validation and
 * compile-time type checking.
 *
 * @module types
 */

export type { CommitMessageGeneratorConfig, CommitMessageOptions, CommitTask } from './schemas.ts';
export {
  commitMessageGeneratorConfigSchema,
  commitMessageOptionsSchema,
  commitTaskSchema,
  safeValidateCommitOptions,
  safeValidateCommitTask,
  safeValidateGeneratorConfig,
  validateCommitOptions,
  validateCommitTask,
  validateGeneratorConfig,
} from './schemas.ts';
