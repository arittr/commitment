import { z } from 'zod';

import type { AIProvider, ProviderConfig } from '../providers/index';

/**
 * Schema for commit task validation
 *
 * Represents a minimal task interface for commit message generation.
 * Can be fulfilled by any task object with these properties.
 *
 * @example
 * ```typescript
 * const task = {
 *   title: 'Add user authentication',
 *   description: 'Implement JWT-based authentication',
 *   produces: ['src/auth.ts', 'src/middleware/auth.ts']
 * };
 *
 * const validatedTask = validateCommitTask(task);
 * ```
 */
export const commitTaskSchema = z.object({
  /**
   * Short, descriptive title of the task
   */
  title: z
    .string()
    .min(1, 'Task title must not be empty')
    .max(200, 'Task title must not exceed 200 characters'),

  /**
   * Detailed description of what the task accomplishes
   */
  description: z
    .string()
    .min(1, 'Task description must not be empty')
    .max(1000, 'Task description must not exceed 1000 characters'),

  /**
   * List of files or outputs produced by this task
   */
  produces: z.array(z.string()).min(0, 'Produces array must be defined').default([]),
});

/**
 * Schema for commit message options validation
 *
 * Defines the context and options for generating a commit message.
 *
 * @example
 * ```typescript
 * const options = {
 *   workdir: '/path/to/project',
 *   files: ['src/auth.ts'],
 *   output: 'Build successful'
 * };
 *
 * const validatedOptions = validateCommitOptions(options);
 * ```
 */
export const commitMessageOptionsSchema = z.object({
  /**
   * Working directory for git operations (required)
   */
  workdir: z.string().min(1, 'Working directory must not be empty'),

  /**
   * Specific files involved in the change (optional)
   */
  files: z.array(z.string()).optional(),

  /**
   * Task execution output or additional context (optional)
   */
  output: z.string().optional(),
});

/**
 * Schema for logger configuration
 */
const loggerSchema = z.object({
  warn: z.function(),
});

/**
 * Schema for commit message generator configuration
 *
 * Provides comprehensive validation for the CommitMessageGenerator config,
 * including mutual exclusivity between provider and providerChain.
 *
 * @example
 * ```typescript
 * // Single provider configuration
 * const config = {
 *   enableAI: true,
 *   provider: { type: 'cli', provider: 'claude' }
 * };
 *
 * const validatedConfig = validateGeneratorConfig(config);
 * ```
 *
 * @example
 * ```typescript
 * // Provider chain configuration
 * const config = {
 *   enableAI: true,
 *   providerChain: [
 *     { type: 'cli', provider: 'claude' },
 *     { type: 'cli', provider: 'codex' }
 *   ]
 * };
 *
 * const validatedConfig = validateGeneratorConfig(config);
 * ```
 */
export const commitMessageGeneratorConfigSchema = z
  .object({
    /**
     * Auto-detect first available provider (default: false)
     */
    autoDetect: z.boolean().optional(),

    /**
     * Enable/disable AI generation (default: true)
     */
    enableAI: z.boolean().optional(),

    /**
     * Custom logger function
     */
    logger: loggerSchema.optional(),

    /**
     * AI provider (config or instance)
     * Mutually exclusive with providerChain
     */
    provider: z
      .union([
        z.custom<AIProvider>((value) => {
          // Type guard: check if it has the AIProvider interface
          return (
            typeof value === 'object' &&
            value !== null &&
            'generateCommitMessage' in value &&
            'isAvailable' in value &&
            'getName' in value &&
            'getProviderType' in value
          );
        }, 'Must be a valid AIProvider instance'),
        z.custom<ProviderConfig>((value) => {
          // Type guard: check if it has the ProviderConfig shape
          return (
            typeof value === 'object' &&
            value !== null &&
            'type' in value &&
            (value.type === 'cli' || value.type === 'api')
          );
        }, 'Must be a valid ProviderConfig object'),
      ])
      .optional(),

    /**
     * Provider chain configs for fallback support
     * Mutually exclusive with provider
     */
    providerChain: z
      .array(
        z.custom<ProviderConfig>((value) => {
          return (
            typeof value === 'object' &&
            value !== null &&
            'type' in value &&
            (value.type === 'cli' || value.type === 'api')
          );
        }, 'Each item must be a valid ProviderConfig object'),
      )
      .min(1, 'Provider chain must contain at least one provider')
      .optional(),

    /**
     * Custom signature to append to commits
     */
    signature: z.string().optional(),
  })
  .refine(
    (data) => {
      // Ensure provider and providerChain are mutually exclusive
      const hasProvider = data.provider !== undefined;
      const hasProviderChain = data.providerChain !== undefined;

      // Both can be undefined (uses default), but not both defined
      return !(hasProvider && hasProviderChain);
    },
    {
      message: 'Cannot specify both "provider" and "providerChain". Use one or the other.',
      path: ['provider'], // Attach error to provider field
    },
  );

/**
 * TypeScript types inferred from Zod schemas
 */
export type CommitTask = z.infer<typeof commitTaskSchema>;
export type CommitMessageOptions = z.infer<typeof commitMessageOptionsSchema>;
export type CommitMessageGeneratorConfig = z.infer<typeof commitMessageGeneratorConfigSchema>;

/**
 * Validates a commit task object
 *
 * @param task - Unknown task object to validate
 * @returns Validated and typed commit task
 * @throws ZodError if validation fails with detailed error messages
 *
 * @example
 * ```typescript
 * const task = {
 *   title: 'Add feature',
 *   description: 'Implement new feature',
 *   produces: ['src/feature.ts']
 * };
 *
 * const validated = validateCommitTask(task);
 * // validated is now typed as CommitTask
 * ```
 */
export function validateCommitTask(task: unknown): CommitTask {
  return commitTaskSchema.parse(task);
}

/**
 * Validates commit message options
 *
 * @param options - Unknown options object to validate
 * @returns Validated and typed commit message options
 * @throws ZodError if validation fails with detailed error messages
 *
 * @example
 * ```typescript
 * const options = {
 *   workdir: process.cwd(),
 *   files: ['src/index.ts'],
 *   output: 'Build successful'
 * };
 *
 * const validated = validateCommitOptions(options);
 * // validated is now typed as CommitMessageOptions
 * ```
 */
export function validateCommitOptions(options: unknown): CommitMessageOptions {
  return commitMessageOptionsSchema.parse(options);
}

/**
 * Validates commit message generator configuration
 *
 * @param config - Unknown config object to validate
 * @returns Validated and typed generator configuration
 * @throws ZodError if validation fails with detailed error messages
 *
 * @example
 * ```typescript
 * const config = {
 *   enableAI: true,
 *   provider: { type: 'cli', provider: 'claude' },
 *   signature: 'Generated by commitment'
 * };
 *
 * const validated = validateGeneratorConfig(config);
 * // validated is now typed as CommitMessageGeneratorConfig
 * ```
 */
export function validateGeneratorConfig(config: unknown): CommitMessageGeneratorConfig {
  return commitMessageGeneratorConfigSchema.parse(config);
}

/**
 * Safely validates a commit task with error handling
 *
 * @param task - Unknown task object to validate
 * @returns Success result with validated task or failure result with error
 *
 * @example
 * ```typescript
 * const result = safeValidateCommitTask(unknownTask);
 *
 * if (result.success) {
 *   console.log('Valid task:', result.data);
 * } else {
 *   console.error('Validation failed:', result.error);
 * }
 * ```
 */
export function safeValidateCommitTask(
  task: unknown,
): { data: CommitTask; success: true } | { error: z.ZodError; success: false } {
  return commitTaskSchema.safeParse(task);
}

/**
 * Safely validates commit message options with error handling
 *
 * @param options - Unknown options object to validate
 * @returns Success result with validated options or failure result with error
 *
 * @example
 * ```typescript
 * const result = safeValidateCommitOptions(unknownOptions);
 *
 * if (result.success) {
 *   console.log('Valid options:', result.data);
 * } else {
 *   console.error('Validation failed:', result.error);
 * }
 * ```
 */
export function safeValidateCommitOptions(
  options: unknown,
): { data: CommitMessageOptions; success: true } | { error: z.ZodError; success: false } {
  return commitMessageOptionsSchema.safeParse(options);
}

/**
 * Safely validates generator configuration with error handling
 *
 * @param config - Unknown config object to validate
 * @returns Success result with validated config or failure result with error
 *
 * @example
 * ```typescript
 * const result = safeValidateGeneratorConfig(unknownConfig);
 *
 * if (result.success) {
 *   console.log('Valid config:', result.data);
 * } else {
 *   console.error('Validation failed:', result.error);
 * }
 * ```
 */
export function safeValidateGeneratorConfig(
  config: unknown,
): { data: CommitMessageGeneratorConfig; success: true } | { error: z.ZodError; success: false } {
  return commitMessageGeneratorConfigSchema.safeParse(config);
}
