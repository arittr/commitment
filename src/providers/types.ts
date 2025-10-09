import { z } from 'zod';

/**
 * Provider type categorization
 */
export enum ProviderType {
  CLI = 'cli',
  API = 'api',
}

/**
 * Common options for provider operations
 */
export type GenerateOptions = {
  /** Additional context or metadata */
  metadata?: Record<string, unknown>;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Working directory for context */
  workdir?: string;
};

/**
 * Core interface that all AI providers must implement
 */
export type AIProvider = {
  /**
   * Generate a commit message from the given prompt
   * @param prompt - The formatted prompt with git diff and context
   * @param options - Provider-specific options
   * @returns The generated commit message
   * @throws Error if generation fails
   */
  generateCommitMessage(prompt: string, options: GenerateOptions): Promise<string>;

  /**
   * Get the human-readable name of this provider
   * @returns Provider name (e.g., "Claude CLI", "OpenAI API")
   */
  getName(): string;

  /**
   * Get the provider type for categorization
   * @returns Provider type enum
   */
  getProviderType(): ProviderType;

  /**
   * Check if this provider is available and configured correctly
   * @returns true if provider can be used
   */
  isAvailable(): Promise<boolean>;
};

/**
 * Base schema for common provider fields
 */
const baseProviderSchema = z.object({
  timeout: z.number().positive().optional(),
});

/**
 * Configuration for CLI-based providers (Claude, Codex, Cursor)
 *
 * @example
 * ```typescript
 * const config = {
 *   type: 'cli',
 *   provider: 'claude',
 *   command: 'claude-custom',
 *   timeout: 60000
 * };
 * const validated = validateProviderConfig(config);
 * ```
 */
export const cliProviderSchema = baseProviderSchema.extend({
  type: z.literal('cli'),
  provider: z.enum(['claude', 'codex', 'cursor']),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
});

/**
 * Configuration for API-based providers (OpenAI, Gemini)
 *
 * @example
 * ```typescript
 * const config = {
 *   type: 'api',
 *   provider: 'openai',
 *   apiKey: 'sk-test123',
 *   endpoint: 'https://api.openai.com/v1',
 *   model: 'gpt-4'
 * };
 * const validated = validateProviderConfig(config);
 * ```
 */
export const apiProviderSchema = baseProviderSchema.extend({
  type: z.literal('api'),
  provider: z.enum(['openai', 'gemini']),
  apiKey: z.string().min(1),
  endpoint: z.string().url().optional(),
  model: z.string().optional(),
});

/**
 * Discriminated union schema for all provider configurations
 *
 * Uses TypeScript discriminated unions for type-safe provider handling.
 * The 'type' field determines which schema is used for validation.
 *
 * @example
 * ```typescript
 * // CLI provider
 * const cliConfig = validateProviderConfig({
 *   type: 'cli',
 *   provider: 'claude'
 * });
 *
 * // API provider
 * const apiConfig = validateProviderConfig({
 *   type: 'api',
 *   provider: 'openai',
 *   apiKey: 'sk-test'
 * });
 *
 * // Type narrowing
 * if (cliConfig.type === 'cli') {
 *   console.log(cliConfig.command); // TypeScript knows this exists
 * }
 * ```
 */
export const providerConfigSchema = z.discriminatedUnion('type', [
  cliProviderSchema,
  apiProviderSchema,
]);

/**
 * TypeScript types inferred from Zod schemas
 */
export type CLIProviderConfig = z.infer<typeof cliProviderSchema>;
export type APIProviderConfig = z.infer<typeof apiProviderSchema>;
export type ProviderConfig = z.infer<typeof providerConfigSchema>;

/**
 * Validation helper for provider configurations
 *
 * Validates and type-checks provider configuration objects.
 * Throws detailed ZodError if validation fails.
 *
 * @param config - Unknown configuration object
 * @returns Validated and typed provider configuration
 * @throws ZodError if validation fails with detailed error messages
 *
 * @example
 * ```typescript
 * // Valid config
 * const config = validateProviderConfig({
 *   type: 'cli',
 *   provider: 'claude',
 *   timeout: 30000
 * });
 *
 * // Invalid config throws ZodError
 * try {
 *   validateProviderConfig({ type: 'invalid' });
 * } catch (error) {
 *   if (error instanceof z.ZodError) {
 *     console.error(error.format());
 *   }
 * }
 * ```
 */
export function validateProviderConfig(config: unknown): ProviderConfig {
  return providerConfigSchema.parse(config);
}

/**
 * Type guard to check if config is CLI provider
 *
 * @param config - Validated provider configuration
 * @returns true if config is CLI provider configuration
 *
 * @example
 * ```typescript
 * const config = validateProviderConfig(unknownConfig);
 *
 * if (isCLIProviderConfig(config)) {
 *   // TypeScript knows config is CLIProviderConfig
 *   console.log('CLI command:', config.command);
 * }
 * ```
 */
export function isCLIProviderConfig(config: ProviderConfig): config is CLIProviderConfig {
  return config.type === 'cli';
}

/**
 * Type guard to check if config is API provider
 *
 * @param config - Validated provider configuration
 * @returns true if config is API provider configuration
 *
 * @example
 * ```typescript
 * const config = validateProviderConfig(unknownConfig);
 *
 * if (isAPIProviderConfig(config)) {
 *   // TypeScript knows config is APIProviderConfig
 *   console.log('API key:', config.apiKey.slice(0, 8) + '...');
 * }
 * ```
 */
export function isAPIProviderConfig(config: ProviderConfig): config is APIProviderConfig {
  return config.type === 'api';
}

/**
 * Validation result types for detailed validation feedback
 */
export type ValidationSuccess<T> = {
  data: T;
  success: true;
};

export type ValidationFailure = {
  error: z.ZodError;
  success: false;
};

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/**
 * Validates provider configuration with detailed error handling
 * Returns a result object instead of throwing
 *
 * @param config - Unknown configuration object to validate
 * @returns ValidationResult with either validated config or detailed errors
 *
 * @example
 * ```typescript
 * const result = validateProviderConfigWithDetails({ type: 'cli', provider: 'claude' });
 *
 * if (result.success) {
 *   const provider = createProvider(result.data);
 * } else {
 *   console.error('Validation failed:', result.error.format());
 * }
 * ```
 */
export function validateProviderConfigWithDetails(
  config: unknown,
): ValidationResult<ProviderConfig> {
  return providerConfigSchema.safeParse(config);
}

/**
 * Creates a provider config with validation and default values
 * Throws on validation failure with clear error messages
 *
 * @param config - Partial or complete provider configuration
 * @returns Fully validated and typed provider configuration
 * @throws ZodError if validation fails
 *
 * @example
 * ```typescript
 * // CLI provider with defaults
 * const cliConfig = createProviderConfig({
 *   type: 'cli',
 *   provider: 'claude',
 *   timeout: 30000
 * });
 *
 * // API provider with all fields
 * const apiConfig = createProviderConfig({
 *   type: 'api',
 *   provider: 'openai',
 *   apiKey: 'sk-test123',
 *   endpoint: 'https://api.openai.com/v1'
 * });
 * ```
 */
export function createProviderConfig(config: unknown): ProviderConfig {
  // First validate the basic structure
  const validated = validateProviderConfig(config);

  // Return the validated config (schemas already handle defaults)
  return validated;
}
