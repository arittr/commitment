/**
 * Consolidated error system for commitment
 *
 * This module provides two consolidated error classes that replace 5+ provider error types:
 * - AgentError: For AI agent execution failures (CLI not found, execution failed, malformed response)
 * - GeneratorError: For commit message generation failures (no changes, invalid inputs, AI failures)
 *
 * All errors follow the "what, why, how-to-fix" pattern with actionable messages.
 *
 * @example
 * ```typescript
 * // Agent error with actionable message
 * throw AgentError.cliNotFound('claude', 'Claude CLI');
 * // Error includes installation instructions
 *
 * // Generator error with git add example
 * throw GeneratorError.noStagedChanges('/path/to/repo');
 * // Error shows how to stage changes
 * ```
 */

/**
 * Options for creating an AgentError
 */
export type AgentErrorOptions = {
  /** Name of the agent that failed (e.g., "Claude CLI", "Codex CLI") */
  agentName?: string;
  /** Original error that caused this error */
  cause?: Error;
  /** Additional context about the error (command, workdir, etc.) */
  context?: Record<string, unknown>;
  /** Actionable suggestion for how to fix the error */
  suggestedAction?: string;
};

/**
 * Options for creating a GeneratorError
 */
export type GeneratorErrorOptions = {
  /** Original error that caused this error */
  cause?: Error;
  /** Additional context about the error (workdir, files, etc.) */
  context?: Record<string, unknown>;
  /** Actionable suggestion for how to fix the error */
  suggestedAction?: string;
};

/**
 * Error thrown when an AI agent fails to execute or generate a commit message
 *
 * This error consolidates multiple agent-related failures:
 * - CLI not found (ENOENT)
 * - CLI execution failed (non-zero exit code)
 * - Malformed response (invalid format)
 * - Empty response
 *
 * All errors include actionable messages following the "what, why, how-to-fix" pattern.
 *
 * @example
 * ```typescript
 * // CLI not found error with installation instructions
 * throw AgentError.cliNotFound('claude', 'Claude CLI');
 *
 * // Execution failed with diagnostic context
 * const cause = new Error('API key not configured');
 * throw AgentError.executionFailed('Claude CLI', 1, 'stderr output', cause);
 *
 * // Malformed response with expected format
 * throw AgentError.malformedResponse('Claude CLI', 'bad output', 'Expected: feat: ...');
 * ```
 */
export class AgentError extends Error {
  /** Name of the error class */
  public override readonly name = 'AgentError';

  /** Name of the agent that failed (e.g., "Claude CLI") */
  public readonly agentName?: string;

  /** Original error that caused this failure */
  public override readonly cause?: Error;

  /** Additional context (command, workdir, output, etc.) */
  public readonly context?: Record<string, unknown>;

  /** Actionable suggestion for how to fix the error */
  public readonly suggestedAction?: string;

  /**
   * Create a new AgentError
   *
   * @param message - Error message describing what failed
   * @param options - Additional error context and metadata
   *
   * @example
   * ```typescript
   * throw new AgentError('Claude CLI execution failed', {
   *   agentName: 'Claude CLI',
   *   cause: originalError,
   *   context: { command: 'claude', workdir: '/tmp' },
   *   suggestedAction: 'Check API key configuration: claude config'
   * });
   * ```
   */
  constructor(message: string, options?: AgentErrorOptions) {
    super(message);
    this.agentName = options?.agentName;
    this.cause = options?.cause;
    this.context = options?.context;
    this.suggestedAction = options?.suggestedAction;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AgentError.prototype);
  }

  /**
   * Create an error for when a CLI command is not found
   *
   * Includes installation instructions for the specific CLI.
   *
   * @param command - The CLI command that was not found (e.g., "claude", "codex-sh")
   * @param agentName - Human-readable name of the agent (e.g., "Claude CLI")
   * @returns AgentError with installation instructions
   *
   * @example
   * ```typescript
   * throw AgentError.cliNotFound('claude', 'Claude CLI');
   * // Error includes npm and brew installation instructions
   * ```
   */
  static cliNotFound(command: string, agentName: string): AgentError {
    let installInstructions = '';

    if (command === 'claude') {
      installInstructions = `To install Claude CLI:
  npm install -g @anthropic-ai/claude-cli
  # or
  brew install claude-cli

Documentation: https://docs.anthropic.com/claude/docs/claude-cli`;
    } else if (command === 'codex-sh') {
      installInstructions = `To install Codex CLI:
  npm install -g codex-sh

For more information: https://github.com/your-org/codex-sh`;
    } else {
      installInstructions = `Please install the ${command} CLI and ensure it's in your PATH.`;
    }

    return new AgentError(
      `${agentName} is not installed or not found in PATH.\n\nThe '${command}' command was not found on your system.`,
      {
        agentName,
        context: { command },
        suggestedAction: installInstructions,
      },
    );
  }

  /**
   * Create an error for when CLI execution fails
   *
   * Includes diagnostic context and suggestions for common issues.
   *
   * @param agentName - Human-readable name of the agent
   * @param exitCode - Exit code from the CLI process
   * @param stderr - Error output from the CLI
   * @param cause - Original error from execution
   * @returns AgentError with diagnostic context
   *
   * @example
   * ```typescript
   * throw AgentError.executionFailed('Claude CLI', 1, 'API key not configured', originalError);
   * ```
   */
  static executionFailed(
    agentName: string,
    exitCode: number | string,
    stderr?: string,
    cause?: Error,
  ): AgentError {
    const details = stderr ?? 'Unknown error';

    return new AgentError(
      `${agentName} execution failed (code: ${exitCode}).\n\nDetails: ${details}`,
      {
        agentName,
        cause,
        context: { exitCode, stderr },
        suggestedAction: `Please check:
  - API key is configured (e.g., claude config)
  - Network connection is working
  - Service is available and responding`,
      },
    );
  }

  /**
   * Create an error for when AI response is malformed or invalid
   *
   * Includes the received output (truncated) and expected format.
   *
   * @param agentName - Human-readable name of the agent
   * @param receivedOutput - The malformed output from the AI (will be truncated)
   * @param expectedFormat - Optional description of expected format
   * @returns AgentError with diagnostic context
   *
   * @example
   * ```typescript
   * throw AgentError.malformedResponse(
   *   'Claude CLI',
   *   'bad output...',
   *   'Expected conventional commit format: type: description'
   * );
   * ```
   */
  static malformedResponse(
    agentName: string,
    receivedOutput: string,
    expectedFormat?: string,
  ): AgentError {
    // Truncate long output to avoid overwhelming error messages
    const maxLength = 100;
    const truncatedOutput =
      receivedOutput.length > maxLength
        ? `${receivedOutput.slice(0, maxLength)}...`
        : receivedOutput;

    const formatMessage =
      expectedFormat ?? 'Expected conventional commit format (e.g., "feat: description")';

    return new AgentError(
      `${agentName} returned malformed response.\n\n${formatMessage}\n\nReceived: ${truncatedOutput}`,
      {
        agentName,
        context: { receivedOutput: truncatedOutput },
        suggestedAction: `Ensure the AI is properly configured to return conventional commit messages.

Valid format:
  type: description

  - Bullet point details
  - Additional context

Types: feat, fix, docs, style, refactor, test, chore, perf`,
      },
    );
  }
}

/**
 * Error thrown when commit message generation fails
 *
 * This error consolidates multiple generation-related failures:
 * - No staged changes in git
 * - Invalid task or options parameters
 * - AI generation failed (with fallback suggestion)
 * - Invalid configuration
 *
 * All errors include actionable messages following the "what, why, how-to-fix" pattern.
 *
 * @example
 * ```typescript
 * // No staged changes error
 * throw GeneratorError.noStagedChanges('/path/to/repo');
 * // Includes git add example
 *
 * // Invalid task error
 * throw GeneratorError.invalidTask(['title: Required', 'description: Too long']);
 *
 * // AI generation failed
 * throw GeneratorError.aiGenerationFailed('Claude CLI', agentError);
 * // Suggests using --no-ai flag
 * ```
 */
export class GeneratorError extends Error {
  /** Name of the error class */
  public override readonly name = 'GeneratorError';

  /** Original error that caused this failure */
  public override readonly cause?: Error;

  /** Additional context (workdir, files, task, etc.) */
  public readonly context?: Record<string, unknown>;

  /** Actionable suggestion for how to fix the error */
  public readonly suggestedAction?: string;

  /**
   * Create a new GeneratorError
   *
   * @param message - Error message describing what failed
   * @param options - Additional error context and metadata
   *
   * @example
   * ```typescript
   * throw new GeneratorError('No staged changes found', {
   *   context: { workdir: '/tmp' },
   *   suggestedAction: 'Run: git add <files>'
   * });
   * ```
   */
  constructor(message: string, options?: GeneratorErrorOptions) {
    super(message);
    this.cause = options?.cause;
    this.context = options?.context;
    this.suggestedAction = options?.suggestedAction;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, GeneratorError.prototype);
  }

  /**
   * Create an error for when there are no staged changes
   *
   * Includes git add example with placeholder for files.
   *
   * @param workdir - Working directory where git status was checked
   * @returns GeneratorError with git add example
   *
   * @example
   * ```typescript
   * throw GeneratorError.noStagedChanges('/home/user/project');
   * ```
   */
  static noStagedChanges(workdir: string): GeneratorError {
    return new GeneratorError(
      'No staged changes found in git index.\n\nCannot generate commit message without staged changes.',
      {
        context: { workdir },
        suggestedAction: `Stage your changes first:
  git add <files>

Or stage all changes:
  git add .

Then run commitment again.`,
      },
    );
  }

  /**
   * Create an error for invalid task parameter
   *
   * Includes validation errors and reference to CommitTask type.
   *
   * @param validationErrors - Array of validation error messages
   * @returns GeneratorError with validation details
   *
   * @example
   * ```typescript
   * throw GeneratorError.invalidTask(['title: Required', 'description: Too long']);
   * ```
   */
  static invalidTask(validationErrors: string[]): GeneratorError {
    const errorList = validationErrors.map((error) => `  - ${error}`).join('\n');

    return new GeneratorError(`Invalid task parameter:\n${errorList}`, {
      context: { validationErrors },
      suggestedAction: `Please provide a valid CommitTask object with:
  - title: string (1-200 characters)
  - description: string (1-1000 characters)
  - produces: string[] (array of file paths)`,
    });
  }

  /**
   * Create an error for invalid options parameter
   *
   * Includes validation errors and reference to CommitMessageOptions type.
   *
   * @param validationErrors - Array of validation error messages
   * @returns GeneratorError with validation details
   *
   * @example
   * ```typescript
   * throw GeneratorError.invalidOptions(['workdir: Required']);
   * ```
   */
  static invalidOptions(validationErrors: string[]): GeneratorError {
    const errorList = validationErrors.map((error) => `  - ${error}`).join('\n');

    return new GeneratorError(`Invalid options parameter:\n${errorList}`, {
      context: { validationErrors },
      suggestedAction: `Please provide valid CommitMessageOptions with:
  - workdir: string (required, absolute path)
  - files: string[] (optional, array of file paths)
  - output: string (optional, task execution output)`,
    });
  }

  /**
   * Create an error for when AI generation fails
   *
   * Suggests using --no-ai flag to fall back to rule-based generation.
   *
   * @param agentName - Human-readable name of the agent that failed
   * @param cause - Original error from the agent
   * @returns GeneratorError with fallback suggestion
   *
   * @example
   * ```typescript
   * const agentError = new AgentError('CLI not found');
   * throw GeneratorError.aiGenerationFailed('Claude CLI', agentError);
   * ```
   */
  static aiGenerationFailed(agentName: string, cause: Error): GeneratorError {
    return new GeneratorError(`AI generation failed using ${agentName}.\n\n${cause.message}`, {
      cause,
      context: { agentName },
      suggestedAction: `Try one of these options:
  1. Fix the agent error (see error details above)
  2. Use a different agent: commitment --agent codex
  3. Use rule-based generation: commitment --no-ai`,
    });
  }
}

/**
 * Type guard to check if an error is an AgentError
 *
 * @param error - Error to check
 * @returns True if error is an AgentError instance
 *
 * @example
 * ```typescript
 * try {
 *   await agent.generate(prompt, workdir);
 * } catch (error) {
 *   if (isAgentError(error)) {
 *     console.error('Agent failed:', error.agentName, error.suggestedAction);
 *   }
 * }
 * ```
 */
export function isAgentError(error: unknown): error is AgentError {
  return error instanceof AgentError;
}

/**
 * Type guard to check if an error is a GeneratorError
 *
 * @param error - Error to check
 * @returns True if error is a GeneratorError instance
 *
 * @example
 * ```typescript
 * try {
 *   const message = await generator.generateCommitMessage(task, options);
 * } catch (error) {
 *   if (isGeneratorError(error)) {
 *     console.error('Generation failed:', error.suggestedAction);
 *   }
 * }
 * ```
 */
export function isGeneratorError(error: unknown): error is GeneratorError {
  return error instanceof GeneratorError;
}
