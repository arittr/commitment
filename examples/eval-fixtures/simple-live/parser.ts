/**
 * Parser utility for processing input strings
 */
export interface ParsedResult {
  value: string;
  length: number;
}

/**
 * Parse and validate input string
 * @param input - String to parse
 * @returns Parsed result with value and length
 * @throws {Error} If input is empty
 */
export function parseInput(input: string): ParsedResult {
  const trimmed = input?.trim() ?? '';
  if (!trimmed) {
    throw new Error('Input cannot be empty');
  }
  return {
    value: trimmed,
    length: trimmed.length,
  };
}
