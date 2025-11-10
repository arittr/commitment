/**
 * Pure utility functions for AI agent implementations
 *
 * This module provides stateless, side-effect-free functions that agents use for:
 * - Cleaning AI-generated responses (removing artifacts, formatting issues)
 * - Validating conventional commit message format
 * - Detecting CLI-not-found errors (ENOENT)
 *
 * Design Philosophy:
 * - All functions are pure (no state, no side effects)
 * - Each function has a single responsibility
 * - Functions are composable and testable in isolation
 * - No dependencies on agent implementations
 *
 * @example
 * ```typescript
 * import { cleanAIResponse, validateConventionalCommit, isCLINotFoundError } from './agent-utils';
 *
 * // Clean AI response
 * const cleaned = cleanAIResponse(rawOutput);
 *
 * // Validate commit message format
 * const isValid = validateConventionalCommit(message);
 *
 * // Check for CLI not found error
 * if (isCLINotFoundError(error)) {
 *   throw AgentError.cliNotFound('claude', 'Claude CLI');
 * }
 * ```
 */

/**
 * Remove commit message markers from AI response
 *
 * Removes markers like:
 * - <<<COMMIT_MESSAGE_START>>>
 * - <<<COMMIT_MESSAGE_END>>>
 * - Variations with different spacing
 *
 * This is a pure function with no side effects.
 *
 * @param output - Raw output from AI agent that may contain commit message markers
 * @returns Output with all commit message markers removed
 *
 * @example
 * ```typescript
 * const raw = '<<<COMMIT_MESSAGE_START>>>\nfeat: add feature\n<<<COMMIT_MESSAGE_END>>>';
 * const clean = cleanCommitMessageMarkers(raw);
 * // => "feat: add feature"
 *
 * const withSpacing = '<<<COMMIT_MESSAGE_START>>>   \nfeat: add feature\n  <<<COMMIT_MESSAGE_END>>>';
 * const clean2 = cleanCommitMessageMarkers(withSpacing);
 * // => "feat: add feature"
 * ```
 */
export function cleanCommitMessageMarkers(output: string): string {
  let cleaned = output;

  // Remove start marker with optional trailing whitespace
  cleaned = cleaned.replaceAll(/<<<COMMIT_MESSAGE_START>>>\s*/g, '');

  // Remove end marker with optional leading whitespace
  cleaned = cleaned.replaceAll(/\s*<<<COMMIT_MESSAGE_END>>>/g, '');

  return cleaned;
}

/**
 * Remove common AI preambles from response
 *
 * Removes specific preamble phrases like:
 * - "here is the commit message:"
 * - "here's a commit message:"
 * - "commit message:"
 * - Case-insensitive matching
 *
 * **Only removes recognized preamble patterns, not arbitrary text.**
 * For example, "here is some other text" will NOT be removed because
 * it doesn't match the pattern "here is the/a commit message:".
 *
 * This is a pure function with no side effects.
 *
 * @param output - Raw output from AI agent that may contain preambles
 * @returns Output with recognized AI preambles removed
 *
 * @example
 * ```typescript
 * const raw = 'Here is the commit message:\nfeat: add feature';
 * const clean = cleanAIPreambles(raw);
 * // => "feat: add feature"
 *
 * const raw2 = 'here is some other text\nfeat: add feature';
 * const clean2 = cleanAIPreambles(raw2);
 * // => "here is some other text\nfeat: add feature" (unchanged - not a preamble)
 * ```
 */
export function cleanAIPreambles(output: string): string {
  let cleaned = output;

  // Remove "here is/here's the/a commit message:" patterns (case-insensitive)
  // Matches: "here is the commit message:", "here's a commit message:", etc.
  cleaned = cleaned.replace(/^(here is|here's) (the|a) commit message:?\s*/i, '');

  // Remove standalone "commit message:" pattern (case-insensitive)
  cleaned = cleaned.replace(/^commit message:?\s*/i, '');

  return cleaned;
}

/**
 * Clean AI-generated response by removing common artifacts
 *
 * Removes (in order):
 * 1. Commit message markers (<<<COMMIT_MESSAGE_START>>>, <<<COMMIT_MESSAGE_END>>>)
 * 2. Markdown code blocks (```...```) - MUST be before preambles
 * 3. AI preambles ("here is the commit message:", etc.)
 * 4. Thinking tags (<thinking>...</thinking> and plain "thinking" prefixes)
 * 5. Excessive newlines (more than 2 consecutive)
 * 6. Leading/trailing whitespace
 *
 * **Order matters:** Code blocks must be removed before preambles because preamble
 * removal slices the string from the first conventional commit pattern, which could
 * break code block pairs (removing opening ``` while leaving closing ``` orphaned).
 *
 * This is a pure function with no side effects. It does not modify the input string.
 *
 * @param output - Raw output from AI agent (may contain markdown, thinking tags, etc.)
 * @returns Cleaned output with artifacts removed and normalized whitespace
 *
 * @example
 * ```typescript
 * const raw = '```\nfeat: add feature\n\nDescription here\n```';
 * const clean = cleanAIResponse(raw);
 * // => "feat: add feature\n\nDescription here"
 *
 * const withThinking = 'thinking: analyzing...\n\nfeat: add feature';
 * const clean2 = cleanAIResponse(withThinking);
 * // => "feat: add feature"
 *
 * const withTags = '<thinking>hmm</thinking>\nfeat: add feature';
 * const clean3 = cleanAIResponse(withTags);
 * // => "feat: add feature"
 * ```
 */
export function cleanAIResponse(output: string): string {
  let cleaned = output;

  // Step 1: Remove commit message markers (must be first to avoid interfering with other patterns)
  cleaned = cleanCommitMessageMarkers(cleaned);

  // Step 2: Remove markdown code block delimiters but keep content
  // MUST happen before preamble removal to avoid breaking code blocks
  // Matches code blocks with optional language specifier
  // Replace with content inside (captured group 2)
  cleaned = cleaned.replace(/```[\w]*\n?([\s\S]*?)```/g, '$1');

  // Step 3: Remove AI preambles (do this after code block removal)
  // This step slices the string, so code blocks must be extracted first
  cleaned = cleanAIPreambles(cleaned);

  // Step 4: Remove thinking tags and content
  // Matches both <thinking>...</thinking> and "thinking:" prefix patterns
  cleaned = cleaned.replace(/^(thinking|<thinking>)[\s\S]*?(<\/thinking>|$)/gim, '');

  // Step 5: Remove excessive newlines (more than 2 consecutive)
  // Normalize to maximum 2 newlines for proper paragraph spacing
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Step 6: Trim leading and trailing whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Validate that a message follows conventional commit format
 *
 * Validates the basic structure:
 * - Type: One of the standard conventional commit types
 * - Scope: Optional scope in parentheses
 * - Separator: Colon followed by space
 * - Description: At least one character after the separator
 *
 * Valid format: `type(scope): description` or `type: description`
 *
 * Valid types: feat, fix, docs, style, refactor, test, chore, perf, build, ci
 *
 * This is a basic format check. It does not validate:
 * - Description quality or length
 * - Scope validity
 * - Breaking change markers (!)
 * - Body or footer sections
 *
 * @param message - Commit message to validate
 * @returns True if message follows basic conventional commit format, false otherwise
 *
 * @example
 * ```typescript
 * validateConventionalCommit('feat: add feature');
 * // => true
 *
 * validateConventionalCommit('fix(core): resolve bug');
 * // => true
 *
 * validateConventionalCommit('chore: update deps');
 * // => true
 *
 * validateConventionalCommit('invalid message');
 * // => false
 *
 * validateConventionalCommit('FEAT: wrong case');
 * // => false
 * ```
 */
export function validateConventionalCommit(message: string): boolean {
  // Pattern matches: type(scope?): description
  // - type: feat, fix, docs, style, refactor, test, chore, perf, build, ci
  // - scope: optional, any word characters in parentheses
  // - colon: required
  // - description: at least one non-whitespace character after colon
  const conventionalCommitPattern =
    /^(feat|fix|docs|style|refactor|test|chore|perf|build|ci)(\(.+\))?:\s*\S+/;

  return conventionalCommitPattern.test(message);
}

/**
 * Type guard to detect CLI-not-found errors (ENOENT)
 *
 * Safely checks if an unknown error is a Node.js ENOENT error,
 * which indicates a command or file was not found.
 *
 * Common scenarios:
 * - CLI command not installed (e.g., `claude` not in PATH)
 * - Command doesn't exist on system
 * - File path not found
 *
 * This is a pure function with no side effects. It only reads error properties.
 *
 * @param error - Unknown error to check (from catch block)
 * @returns True if error is an ENOENT error (command/file not found), false otherwise
 *
 * @example
 * ```typescript
 * try {
 *   await execa('claude', ['--version']);
 * } catch (error) {
 *   if (isCLINotFoundError(error)) {
 *     // CLI is not installed
 *     throw AgentError.cliNotFound('claude', 'Claude CLI');
 *   }
 *   // Some other error
 *   throw error;
 * }
 *
 * // Safe to call with any value
 * isCLINotFoundError(null); // => false
 * isCLINotFoundError(undefined); // => false
 * isCLINotFoundError('string'); // => false
 * isCLINotFoundError(new Error('other')); // => false
 * ```
 */
export function isCLINotFoundError(error: unknown): boolean {
  // Type guard: Check if error is an object with a code property
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  // Check if code property exists and equals 'ENOENT'
  return 'code' in error && error.code === 'ENOENT';
}
