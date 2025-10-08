import { ProviderError } from '../errors';

/**
 * Options for response parsing
 */
export type ParserOptions = {
  /** Allow empty responses (default: false) */
  allowEmpty?: boolean;
  /** Expect JSON output (try JSON parsing first) */
  expectJSON?: boolean;
  /** Trim whitespace (default: true) */
  trimWhitespace?: boolean;
};

/**
 * CLI response parser for handling various output formats
 * Handles both JSON and plain text responses from AI CLI tools
 *
 * @example
 * ```typescript
 * // Parse plain text
 * const message = CLIResponseParser.parse('feat: add feature');
 *
 * // Parse JSON response
 * const json = '{"content": "feat: add feature"}';
 * const message = CLIResponseParser.parse(json);
 *
 * // Validate commit message
 * const valid = CLIResponseParser.validateCommitMessage('feat: add feature');
 * ```
 */
export const CLIResponseParser = {
  /**
   * Parse CLI output - automatically detects JSON or plain text
   *
   * @param output - Raw CLI output
   * @param options - Parser options
   * @returns Parsed commit message
   * @throws ProviderError if output is invalid
   */
  parse(output: string, options: ParserOptions = {}): string {
    const { expectJSON = false, allowEmpty = false, trimWhitespace = true } = options;

    // Try JSON parsing first if expected or if output looks like JSON
    if (expectJSON || output.trim().startsWith('{')) {
      const jsonResult = this.parseJSON(output);
      if (jsonResult !== null) {
        return trimWhitespace ? jsonResult.trim() : jsonResult;
      }
    }

    // Fall back to plain text parsing
    const plainText = this.parsePlainText(output, trimWhitespace);

    // Result already has trimming applied based on option
    const result = plainText;

    // Validate non-empty
    if (!allowEmpty && result === '') {
      throw new ProviderError('CLI Parser', 'Received empty response from provider');
    }

    // Validate commit message format
    if (!allowEmpty && !this.validateCommitMessage(result)) {
      throw new ProviderError(
        'CLI Parser',
        `Invalid commit message format: ${result.slice(0, 100)}`,
      );
    }

    return result;
  },

  /**
   * Extract text from JSON response
   * Handles common JSON structures from AI CLI tools
   *
   * @param output - Potentially JSON output
   * @returns Extracted text or null if not valid JSON
   */
  parseJSON(output: string): string | null {
    try {
      const parsed = JSON.parse(output.trim()) as unknown;

      // Handle common JSON structures
      if (typeof parsed === 'object' && parsed !== null) {
        // Try common field names
        if ('content' in parsed && typeof parsed.content === 'string') {
          return parsed.content;
        }
        if ('message' in parsed && typeof parsed.message === 'string') {
          return parsed.message;
        }
        if ('text' in parsed && typeof parsed.text === 'string') {
          return parsed.text;
        }
      }

      // If it's a plain string in JSON
      if (typeof parsed === 'string') {
        return parsed;
      }

      return null;
    } catch {
      // Not valid JSON
      return null;
    }
  },

  /**
   * Parse plain text response
   * Cleans up formatting but preserves message structure
   *
   * @param output - Plain text output
   * @returns Cleaned text
   */
  parsePlainText(output: string, trimWhitespace = true): string {
    let result = output
      .replaceAll(/^\s*```\s*/gm, '') // Remove code block markers
      .replaceAll('\r\n', '\n'); // Normalize line endings

    if (trimWhitespace) {
      result = result.trim();
    }

    return result;
  },

  /**
   * Validate that output contains a valid commit message
   * Checks for minimum length and basic format
   *
   * @param message - Commit message to validate
   * @returns true if valid
   */
  validateCommitMessage(message: string): boolean {
    // Must be non-empty after trimming
    const trimmed = message.trim();
    if (trimmed === '') {
      return false;
    }

    // Must have at least a minimum length (e.g., "fix: bug")
    if (trimmed.length < 5) {
      return false;
    }

    // Must not be just whitespace or special characters
    if (!/[\da-z]/i.test(trimmed)) {
      return false;
    }

    return true;
  },

  /**
   * Clean AI response artifacts from commit message
   * Removes common preamble and explanatory text
   *
   * @param message - Raw message from AI
   * @returns Cleaned commit message
   */
  cleanAIArtifacts(message: string): string {
    let cleaned = message.trim();

    // Remove common AI preamble patterns
    cleaned = cleaned
      .replace(/^here's? (?:the |a )?commit message:?\s*/i, '')
      .replace(/^based on (?:the )?git diff.*$/im, '')
      .replace(/^looking at (?:the )?changes.*$/im, '')
      .replace(/^analyzing (?:the )?changes.*$/im, '')
      .replace(/^from (?:the )?changes.*$/im, '')
      .replace(/^i can see (?:that )?this.*$/im, '')
      .trim();

    // Extract content between sentinel markers if present
    const startTag = '<<<COMMIT_MESSAGE_START>>>';
    const endTag = '<<<COMMIT_MESSAGE_END>>>';
    const startIndex = cleaned.indexOf(startTag);
    const endIndex = cleaned.indexOf(endTag);

    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      cleaned = cleaned.slice(startIndex + startTag.length, endIndex).trim();
    }

    return cleaned;
  },
};
