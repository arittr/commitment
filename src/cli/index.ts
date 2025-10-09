/**
 * CLI schemas and validation utilities
 *
 * This module provides Zod schemas and validation functions for CLI option
 * parsing, provider configuration from JSON, and error formatting.
 */

export type { CliOptions } from './schemas';

export {
  buildProviderConfigFromOptions,
  cliOptionsSchema,
  formatValidationError,
  parsedProviderConfigSchema,
  parseProviderConfigJson,
  safeParseProviderConfigJson,
  safeValidateCliOptions,
  validateCliOptions,
} from './schemas';
