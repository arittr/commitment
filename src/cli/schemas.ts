import { z } from 'zod';

/**
 * Schema for CLI options from commander
 *
 * Validates all CLI flags and options passed to the commitment CLI tool.
 * Maps directly to the commander program.opts() output.
 *
 * Simplified to exactly 5 flags for clarity and usability:
 * - --agent: Choose AI agent (claude or codex)
 * - --no-ai: Disable AI generation
 * - --dry-run: Generate message without committing
 * - --message-only: Output only the message
 * - --cwd: Working directory
 *
 * @example
 * ```typescript
 * const options = {
 *   ai: true,
 *   cwd: '/path/to/project',
 *   agent: 'claude'
 * };
 *
 * const validated = validateCliOptions(options);
 * ```
 */
export const cliOptionsSchema = z.object({
  /**
   * AI agent to use (claude or codex)
   * Defaults to 'claude' if not specified
   */
  agent: z.enum(['claude', 'codex']).optional(),

  /**
   * Enable/disable AI generation (default: true)
   * Negated by --no-ai flag
   */
  ai: z.boolean().default(true),

  /**
   * Working directory for git operations
   */
  cwd: z.string().min(1, 'Working directory must not be empty').default(process.cwd()),

  /**
   * Generate message without creating commit
   */
  dryRun: z.boolean().optional(),

  /**
   * Output only the commit message (no commit)
   */
  messageOnly: z.boolean().optional(),
});

/**
 * TypeScript types inferred from Zod schemas
 */
export type CliOptions = z.infer<typeof cliOptionsSchema>;

/**
 * Validates CLI options from commander
 *
 * @param options - Unknown options object to validate
 * @returns Validated and typed CLI options with defaults applied
 * @throws ZodError if validation fails with detailed error messages
 *
 * @example
 * ```typescript
 * const rawOptions = program.opts();
 * const validated = validateCliOptions(rawOptions);
 * // validated.cwd will always be a string (defaults to process.cwd())
 * // validated.ai will always be a boolean (defaults to true)
 * ```
 */
export function validateCliOptions(options: unknown): CliOptions {
  return cliOptionsSchema.parse(options);
}

/**
 * Safely validates CLI options with error handling
 *
 * @param options - Unknown options object to validate
 * @returns Success result with validated options or failure result with error
 *
 * @example
 * ```typescript
 * const result = safeValidateCliOptions(unknownOptions);
 *
 * if (result.success) {
 *   console.log('Valid options:', result.data);
 * } else {
 *   console.error('Validation failed:', result.error);
 * }
 * ```
 */
export function safeValidateCliOptions(
  options: unknown
): { data: CliOptions; success: true } | { error: z.ZodError; success: false } {
  return cliOptionsSchema.safeParse(options);
}

/**
 * Format Zod validation error into user-friendly CLI message
 *
 * Converts ZodError issues into human-readable error messages
 * suitable for displaying in the CLI.
 *
 * @param error - Zod validation error
 * @returns Formatted error message
 *
 * @example
 * ```typescript
 * try {
 *   validateCliOptions(invalidOptions);
 * } catch (error) {
 *   if (error instanceof z.ZodError) {
 *     console.error(formatValidationError(error));
 *   }
 * }
 * ```
 */
export function formatValidationError(error: z.ZodError): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `"${issue.path.join('.')}"` : 'input';
    return `  - ${path}: ${issue.message}`;
  });

  return `Validation failed:\n${issues.join('\n')}`;
}
