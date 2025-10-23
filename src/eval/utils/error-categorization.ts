/**
 * Error categorization utility for multi-attempt evaluation
 *
 * Provides pattern-based error detection to categorize failures into
 * one of four types: api_error, validation, cleaning, or generation.
 *
 * @module error-categorization
 *
 * @example
 * ```typescript
 * import { categorizeError } from './error-categorization.js';
 *
 * // API error (ENOENT)
 * const error1 = new Error('Command failed');
 * error1.code = 'ENOENT';
 * categorizeError(error1); // 'api_error'
 *
 * // Validation error
 * const error2 = new Error('Invalid conventional commit format');
 * categorizeError(error2); // 'validation'
 *
 * // Cleaning error
 * const error3 = new Error('Failed to clean thinking artifacts');
 * categorizeError(error3); // 'cleaning'
 *
 * // Generation error (default)
 * const error4 = new Error('Agent timeout');
 * categorizeError(error4); // 'generation'
 * ```
 */

import type { FailureType } from '../core/types.js';

/**
 * Categorize an error into a failure type using pattern matching
 *
 * This is a pure function that uses pattern matching to categorize errors
 * into one of four types. Detection is case-insensitive and checks patterns
 * in priority order:
 *
 * 1. **api_error** (highest priority):
 *    - Error has `code` property equal to 'ENOENT'
 *    - Message contains "command not found"
 *    - Message contains "not found"
 *    - Message contains "network error"
 *
 * 2. **cleaning**:
 *    - Message contains "failed to clean"
 *    - Message contains "thinking"
 *    - Message contains "COT" (Chain of Thought)
 *    - Message contains "markdown code block"
 *
 * 3. **validation**:
 *    - Message contains "invalid conventional commit"
 *    - Message contains "does not follow conventional"
 *    - Message contains "missing type"
 *    - Message contains "invalid format"
 *
 * 4. **generation** (default):
 *    - Message contains "timeout"
 *    - Message contains "failed to generate"
 *    - Message contains "execution failed"
 *    - Message contains "malformed"
 *    - Any unrecognized error
 *
 * @param error - Error to categorize (can be Error, string, or unknown)
 * @returns Failure type enum value
 *
 * @example
 * ```typescript
 * // ENOENT error
 * const err = new Error('Command failed');
 * err.code = 'ENOENT';
 * categorizeError(err); // 'api_error'
 *
 * // Validation error
 * categorizeError(new Error('Invalid conventional commit')); // 'validation'
 *
 * // Cleaning error
 * categorizeError(new Error('Failed to clean COT artifacts')); // 'cleaning'
 *
 * // Unknown error defaults to generation
 * categorizeError(new Error('Something went wrong')); // 'generation'
 * ```
 */
export function categorizeError(error: unknown): FailureType {
  // Extract error message and code
  let message = '';
  let code: string | undefined;

  if (error instanceof Error) {
    message = error.message;
    // @ts-expect-error - Error might have code property
    code = error.code;
  } else if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object' && 'message' in error) {
    message = String(error.message);
    if ('code' in error) {
      code = String(error.code);
    }
  }

  // Convert to lowercase for case-insensitive matching
  const lowerMessage = message.toLowerCase();

  // Priority 1: API errors (highest priority)
  // Check code property first (most specific)
  if (code === 'ENOENT') {
    return 'api_error';
  }

  // Check message patterns for API errors
  if (
    lowerMessage.includes('command not found') ||
    lowerMessage.includes('not found') ||
    lowerMessage.includes('network error') ||
    lowerMessage.includes('enoent') ||
    lowerMessage.includes('econnrefused')
  ) {
    return 'api_error';
  }

  // Priority 2: Cleaning errors
  if (
    lowerMessage.includes('failed to clean') ||
    lowerMessage.includes('thinking') ||
    lowerMessage.includes('cot') ||
    lowerMessage.includes('markdown code block')
  ) {
    return 'cleaning';
  }

  // Priority 3: Validation errors
  if (
    lowerMessage.includes('invalid conventional commit') ||
    lowerMessage.includes('does not follow conventional') ||
    lowerMessage.includes('missing type') ||
    lowerMessage.includes('invalid format')
  ) {
    return 'validation';
  }

  // Priority 4: Generation errors (default)
  // Explicit generation patterns
  if (
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('timed out') ||
    lowerMessage.includes('failed to generate') ||
    lowerMessage.includes('execution failed') ||
    lowerMessage.includes('malformed') ||
    lowerMessage.includes('agent failed')
  ) {
    return 'generation';
  }

  // Default: Unknown errors are categorized as generation failures
  return 'generation';
}
