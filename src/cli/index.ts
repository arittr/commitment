/**
 * CLI schemas and validation utilities
 *
 * This module provides Zod schemas and validation functions for CLI option
 * parsing and error formatting.
 */

export type { CliOptions } from './schemas';

export {
  cliOptionsSchema,
  formatValidationError,
  safeValidateCliOptions,
  validateCliOptions,
} from './schemas';
