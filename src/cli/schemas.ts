import { z } from 'zod';

import { providerConfigSchema } from '../providers/types';

/**
 * Schema for CLI options from commander
 *
 * Validates all CLI flags and options passed to the commitment CLI tool.
 * Maps directly to the commander program.opts() output.
 *
 * @example
 * ```typescript
 * const options = {
 *   ai: true,
 *   cwd: '/path/to/project',
 *   provider: 'claude'
 * };
 *
 * const validated = validateCliOptions(options);
 * ```
 */
export const cliOptionsSchema = z.object({
  /**
   * Enable/disable AI generation (default: true)
   * Negated by --no-ai flag
   */
  ai: z.boolean().default(true),

  /**
   * Auto-detect first available AI provider
   */
  autoDetect: z.boolean().optional(),

  /**
   * Check if selected provider is available
   */
  checkProvider: z.boolean().optional(),

  /**
   * Working directory for git operations
   */
  cwd: z.string().min(1, 'Working directory must not be empty').default(process.cwd()),

  /**
   * Generate message without creating commit
   */
  dryRun: z.boolean().optional(),

  /**
   * Fallback providers (can specify multiple)
   */
  fallback: z.array(z.string()).optional(),

  /**
   * List all available AI providers
   */
  listProviders: z.boolean().optional(),

  /**
   * Output only the commit message (no commit)
   */
  messageOnly: z.boolean().optional(),

  /**
   * AI provider to use (claude, codex, openai, cursor, gemini)
   */
  provider: z.string().optional(),

  /**
   * Provider configuration as JSON string
   */
  providerConfig: z.string().optional(),

  /**
   * Custom signature to append to commits
   */
  signature: z.string().optional(),
});

/**
 * Schema for parsed provider config from JSON string
 *
 * Handles the parsing and validation of --provider-config JSON strings
 * into structured ProviderConfig objects.
 *
 * @example
 * ```typescript
 * const jsonString = '{"type":"cli","provider":"claude","timeout":60000}';
 * const config = parseProviderConfigJson(jsonString);
 * ```
 */
export const parsedProviderConfigSchema = providerConfigSchema;

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
  options: unknown,
): { data: CliOptions; success: true } | { error: z.ZodError; success: false } {
  return cliOptionsSchema.safeParse(options);
}

/**
 * Parse and validate provider config from JSON string
 *
 * Handles JSON parsing and validation in one step, with clear error messages
 * for both JSON syntax errors and schema validation failures.
 *
 * @param jsonString - JSON string to parse and validate
 * @returns Validated provider configuration
 * @throws Error with clear message for JSON parsing failures
 * @throws ZodError for schema validation failures
 *
 * @example
 * ```typescript
 * const jsonString = '{"type":"cli","provider":"claude","timeout":60000}';
 * const config = parseProviderConfigJson(jsonString);
 * // config is typed as ProviderConfig
 * ```
 *
 * @example
 * ```typescript
 * // Error handling
 * try {
 *   const config = parseProviderConfigJson('invalid json');
 * } catch (error) {
 *   if (error instanceof SyntaxError) {
 *     console.error('Invalid JSON:', error.message);
 *   } else if (error instanceof z.ZodError) {
 *     console.error('Invalid config structure:', error.message);
 *   }
 * }
 * ```
 */
export function parseProviderConfigJson(jsonString: string): z.infer<typeof providerConfigSchema> {
  // First parse JSON - this can throw SyntaxError
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (error) {
    throw new Error(
      `Invalid JSON in provider config: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Then validate against schema - this can throw ZodError
  try {
    return parsedProviderConfigSchema.parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Format Zod errors into user-friendly message
      const errorMessages = error.issues.map((issue) => {
        const path = issue.path.join('.');
        return `${path}: ${issue.message}`;
      });
      throw new Error(`Invalid provider configuration: ${errorMessages.join('; ')}`);
    }
    throw error;
  }
}

/**
 * Safely parse and validate provider config from JSON string
 *
 * @param jsonString - JSON string to parse and validate
 * @returns Success result with validated config or failure result with error message
 *
 * @example
 * ```typescript
 * const result = safeParseProviderConfigJson(jsonString);
 *
 * if (result.success) {
 *   console.log('Valid config:', result.data);
 * } else {
 *   console.error('Parse failed:', result.error);
 * }
 * ```
 */
export function safeParseProviderConfigJson(
  jsonString: string,
):
  | { data: z.infer<typeof providerConfigSchema>; success: true }
  | { error: string; success: false } {
  try {
    const config = parseProviderConfigJson(jsonString);
    return { success: true, data: config };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
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
