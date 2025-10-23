/**
 * Error classes for evaluation system
 *
 * This module defines the EvaluationError class with factory methods
 * for different error scenarios. All errors follow the "what, why, how-to-fix"
 * pattern for actionable error messages.
 *
 * @example
 * ```typescript
 * // Meta-evaluation failed
 * throw EvaluationError.metaEvaluationFailed('complex-fixture', apiError);
 *
 * // Invalid attempt count
 * throw EvaluationError.invalidAttemptCount(2, 3);
 *
 * // Missing fixture
 * throw EvaluationError.missingFixture('nonexistent-fixture');
 * ```
 */

/**
 * Error codes for categorization
 */
export type EvaluationErrorCode =
  | 'META_EVALUATION_FAILED'
  | 'INVALID_ATTEMPT_COUNT'
  | 'MISSING_FIXTURE'
  | 'ALL_ATTEMPTS_FAILED'
  | 'INVALID_METRICS';

/**
 * Custom error class for evaluation system
 *
 * Extends Error with error codes and factory methods for common scenarios.
 * All error messages follow "what, why, how-to-fix" pattern.
 *
 * @example
 * ```typescript
 * try {
 *   // ... meta-evaluation ...
 * } catch (error) {
 *   throw EvaluationError.metaEvaluationFailed('fixture-name', error);
 * }
 * ```
 */
export class EvaluationError extends Error {
  /**
   * Error code for categorization
   */
  public readonly code: EvaluationErrorCode;

  /**
   * Create a new EvaluationError
   *
   * @param message - Error message following "what, why, how-to-fix" pattern
   * @param code - Error code for categorization
   * @param cause - Optional underlying cause
   */
  constructor(message: string, code: EvaluationErrorCode, cause?: Error) {
    super(message);
    this.name = 'EvaluationError';
    this.code = code;
    if (cause) {
      this.cause = cause;
    }
  }

  /**
   * Create error for meta-evaluation failure
   *
   * What: Meta-evaluation failed for a fixture
   * Why: ChatGPT API error or invalid response
   * How: Check API connectivity, review error logs
   *
   * @param fixtureName - Name of fixture that failed
   * @param cause - Underlying error
   * @returns EvaluationError with actionable message
   *
   * @example
   * ```typescript
   * try {
   *   await chatGPT.evaluate(attempts);
   * } catch (error) {
   *   throw EvaluationError.metaEvaluationFailed('complex-feature', error);
   * }
   * ```
   */
  static metaEvaluationFailed(fixtureName: string, cause: Error): EvaluationError {
    const message =
      `Meta-evaluation failed for fixture "${fixtureName}".\n\n` +
      `Reason: ${cause.message}\n\n` +
      `How to fix:\n` +
      `- Check OpenAI API connectivity and credentials\n` +
      `- Review error logs for specific API issues\n` +
      `- Verify fixture has valid diff and changeset\n` +
      `- Ensure ChatGPT agent is properly configured`;

    return new EvaluationError(message, 'META_EVALUATION_FAILED', cause);
  }

  /**
   * Create error for invalid attempt count
   *
   * What: Wrong number of attempts received
   * Why: Expected exactly 3 attempts but got different count
   * How: Ensure runner completes all 3 attempts
   *
   * @param received - Actual number of attempts
   * @param expected - Expected number (always 3)
   * @returns EvaluationError with actionable message
   *
   * @example
   * ```typescript
   * if (attempts.length !== 3) {
   *   throw EvaluationError.invalidAttemptCount(attempts.length, 3);
   * }
   * ```
   */
  static invalidAttemptCount(received: number, expected: number): EvaluationError {
    const message =
      `Invalid attempt count: expected ${expected} attempts but received ${received}.\n\n` +
      `How to fix:\n` +
      `- Ensure AttemptRunner executes all ${expected} attempts\n` +
      `- Verify no early returns or short-circuits in attempt loop\n` +
      `- Check that failures don't stop subsequent attempts`;

    return new EvaluationError(message, 'INVALID_ATTEMPT_COUNT');
  }

  /**
   * Create error for missing fixture
   *
   * What: Fixture not found
   * Why: Requested fixture doesn't exist in fixtures directory
   * How: Verify fixture name and check fixtures directory
   *
   * @param fixtureName - Name of missing fixture
   * @returns EvaluationError with actionable message
   *
   * @example
   * ```typescript
   * if (!fixtureExists(name)) {
   *   throw EvaluationError.missingFixture(name);
   * }
   * ```
   */
  static missingFixture(fixtureName: string): EvaluationError {
    const message =
      `Fixture not found: "${fixtureName}".\n\n` +
      `How to fix:\n` +
      `- Check fixture name spelling\n` +
      `- Verify fixture exists in src/eval/fixtures/\n` +
      `- Ensure fixture has metadata.json, mock-diff.txt, and mock-status.txt`;

    return new EvaluationError(message, 'MISSING_FIXTURE');
  }

  /**
   * Create error when all 3 attempts fail
   *
   * What: All 3 attempts failed for an agent
   * Why: Agent couldn't generate valid commit messages
   * How: Review failure reasons, check agent configuration
   *
   * @param fixtureName - Name of fixture where all attempts failed
   * @param agentName - Name of agent that failed
   * @returns EvaluationError with actionable message
   *
   * @example
   * ```typescript
   * const successCount = attempts.filter(a => a.status === 'success').length;
   * if (successCount === 0) {
   *   throw EvaluationError.allAttemptsFailed(fixtureName, agentName);
   * }
   * ```
   */
  static allAttemptsFailed(fixtureName: string, agentName: string): EvaluationError {
    const message =
      `All 3 attempts failed for agent "${agentName}" on fixture "${fixtureName}".\n\n` +
      `How to fix:\n` +
      `- Review failure reasons for each attempt\n` +
      `- Check agent CLI availability and configuration\n` +
      `- Verify fixture has valid git diff and status\n` +
      `- Ensure agent can generate conventional commit messages`;

    return new EvaluationError(message, 'ALL_ATTEMPTS_FAILED');
  }

  /**
   * Create error for invalid metrics
   *
   * What: Metrics validation failed
   * Why: Scores out of range or invalid structure
   * How: Ensure all scores are 0-10
   *
   * @param reason - Specific validation failure reason
   * @returns EvaluationError with actionable message
   *
   * @example
   * ```typescript
   * if (metrics.clarity > 10) {
   *   throw EvaluationError.invalidMetrics('Clarity score exceeds 10');
   * }
   * ```
   */
  static invalidMetrics(reason: string): EvaluationError {
    const message =
      `Invalid metrics: ${reason}\n\n` +
      `How to fix:\n` +
      `- Ensure all metric scores are between 0 and 10\n` +
      `- Verify metrics structure matches schema\n` +
      `- Check that overallScore is calculated correctly`;

    return new EvaluationError(message, 'INVALID_METRICS');
  }
}
