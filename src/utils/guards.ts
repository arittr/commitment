/**
 * Type guard utilities for strict boolean expressions
 */

/**
 * Check if a string has content (not null, undefined, or empty after trimming)
 *
 * @example
 * ```typescript
 * const input: string | null = getUserInput();
 * if (hasContent(input)) {
 *   // input is string here
 *   console.log(input.toUpperCase());
 * }
 * ```
 */
export function hasContent(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Check if an array is non-empty with proper type narrowing
 *
 * @example
 * ```typescript
 * const items: string[] = getItems();
 * if (isNonEmptyArray(items)) {
 *   // items is [string, ...string[]] here
 *   const first = items[0]; // No undefined check needed
 * }
 * ```
 */
/* eslint-disable no-redeclare -- TypeScript function overloads */
export function isNonEmptyArray<T>(value: T[]): value is [T, ...T[]];
export function isNonEmptyArray<T>(value: readonly T[]): value is readonly [T, ...T[]];
export function isNonEmptyArray<T>(
  value: T[] | readonly T[]
): value is [T, ...T[]] | readonly [T, ...T[]] {
  return Array.isArray(value) && value.length > 0;
}
/* eslint-enable no-redeclare */

/**
 * Check if a value is defined (not null or undefined)
 *
 * @example
 * ```typescript
 * const value: string | null | undefined = getValue();
 * if (isDefined(value)) {
 *   // value is string here
 *   console.log(value.length);
 * }
 * ```
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Check if a value is a valid object (not null, not array)
 *
 * @example
 * ```typescript
 * const data: unknown = JSON.parse(input);
 * if (isObject(data)) {
 *   // data is Record<string, unknown> here
 *   console.log(Object.keys(data));
 * }
 * ```
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Check if a value is an Error instance
 *
 * @example
 * ```typescript
 * try {
 *   throw new Error('Oops');
 * } catch (error) {
 *   if (isError(error)) {
 *     // error is Error here
 *     console.log(error.message);
 *   }
 * }
 * ```
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Check if a value is a string
 *
 * @example
 * ```typescript
 * const data: unknown = JSON.parse(input);
 * if (isString(data)) {
 *   // data is string here
 *   console.log(data.toUpperCase());
 * }
 * ```
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Check if a value is a number (excludes NaN)
 *
 * @example
 * ```typescript
 * const input: unknown = getUserInput();
 * if (isNumber(input)) {
 *   // input is number here (and not NaN)
 *   console.log(input.toFixed(2));
 * }
 * ```
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

/**
 * Check if a string is a valid file path (non-empty, contains valid characters)
 *
 * @example
 * ```typescript
 * const path: string | null = getFilePath();
 * if (isFilePath(path)) {
 *   // path is string here
 *   await fs.readFile(path);
 * }
 * ```
 */
export function isFilePath(value: unknown): value is string {
  if (!isString(value) || !hasContent(value)) {
    return false;
  }

  // Check for null bytes (invalid in file paths)
  if (value.includes('\0')) {
    return false;
  }

  // Basic path validation - must not be only whitespace or dots
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === '.' || trimmed === '..') {
    return false;
  }

  return true;
}

/**
 * Check if an object has a specific property with type safety
 *
 * @example
 * ```typescript
 * const obj: unknown = JSON.parse(input);
 * if (hasProperty(obj, 'name')) {
 *   // obj is { name: unknown } & object here
 *   console.log(obj.name);
 * }
 * ```
 */
export function hasProperty<K extends PropertyKey>(
  value: unknown,
  property: K
): value is { [P in K]: unknown } & object {
  return isObject(value) && property in value;
}

/**
 * Check if a value is an array of a specific type
 *
 * @example
 * ```typescript
 * const data: unknown = JSON.parse(input);
 * if (isArrayOf(data, isString)) {
 *   // data is string[] here
 *   data.forEach(s => console.log(s.toUpperCase()));
 * }
 * ```
 */
export function isArrayOf<T>(value: unknown, guard: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every((item) => guard(item));
}
