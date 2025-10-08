/**
 * Type guard utilities for strict boolean expressions
 */

/**
 * Check if a string has content (not null, undefined, or empty after trimming)
 */
export function hasContent(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
