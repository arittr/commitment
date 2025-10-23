/**
 * Attempt runner for 3-attempt evaluation loop
 *
 * Executes exactly 3 attempts per agent per fixture with error handling.
 * All 3 attempts always complete - no short-circuiting on failure.
 *
 * Each attempt is independent with try/catch error handling:
 * - Success: Generate → Evaluate → Create success outcome
 * - Failure: Catch error → Categorize → Create failure outcome
 *
 * @example
 * ```typescript
 * const runner = new AttemptRunner(generator, evaluator, reporter);
 *
 * const outcomes = await runner.runAttempts('claude', fixture);
 * // Returns exactly 3 AttemptOutcomes (mix of success/failure)
 * console.log(outcomes.length); // 3
 * console.log(outcomes[0].attemptNumber); // 1
 * console.log(outcomes[1].attemptNumber); // 2
 * console.log(outcomes[2].attemptNumber); // 3
 * ```
 */

import type { CommitMessageGenerator } from '../../generator.js';
import type { AttemptOutcome } from '../core/types.js';
import type { SingleAttemptEvaluator } from '../evaluators/single-attempt.js';
import type { CLIReporter } from '../reporters/cli-reporter.js';
import { categorizeError } from '../utils/error-categorization.js';

/**
 * Fixture representation for attempts
 */
export interface Fixture {
  /** Git diff content */
  diff: string;
  /** Fixture name */
  name: string;
  /** Git status output */
  status: string;
}

/**
 * Attempt runner for executing 3 independent attempts
 *
 * Orchestrates the attempt loop with error handling and reporting.
 * Each attempt is independent - failures don't stop subsequent attempts.
 */
export class AttemptRunner {
  /**
   * Create a new attempt runner
   *
   * @param generator - Commit message generator instance
   * @param evaluator - Single-attempt evaluator instance
   * @param reporter - CLI reporter for progress updates
   */
  constructor(
    private readonly generator: CommitMessageGenerator,
    private readonly evaluator: SingleAttemptEvaluator,
    private readonly reporter: CLIReporter
  ) {}

  /**
   * Run exactly 3 attempts for an agent on a fixture
   *
   * @param _agentName - Name of agent (currently unused, reserved for future use)
   *
   * Each attempt is independent with error handling:
   * 1. Report attempt start
   * 2. Try to generate commit message
   * 3. If success: evaluate and create success outcome
   * 4. If failure: categorize error and create failure outcome
   * 5. Report result
   *
   * **Critical:** All 3 attempts ALWAYS complete. No early returns.
   *
   * @param agentName - Name of agent to use ('claude' | 'codex')
   * @param fixture - Fixture to evaluate
   * @returns Array of exactly 3 attempt outcomes
   *
   * @example
   * ```typescript
   * const outcomes = await runner.runAttempts('claude', {
   *   name: 'simple',
   *   diff: 'diff --git...',
   *   status: 'M  file.ts'
   * });
   *
   * // Always exactly 3 outcomes
   * console.log(outcomes.length); // 3
   *
   * // Check success/failure
   * outcomes.forEach(outcome => {
   *   if (outcome.status === 'success') {
   *     console.log(outcome.commitMessage, outcome.overallScore);
   *   } else {
   *     console.log(outcome.failureType, outcome.failureReason);
   *   }
   * });
   * ```
   */
  async runAttempts(_agentName: string, fixture: Fixture): Promise<AttemptOutcome[]> {
    const outcomes: AttemptOutcome[] = [];

    // Execute exactly 3 attempts (no early returns!)
    for (let attemptNumber = 1; attemptNumber <= 3; attemptNumber++) {
      this.reporter.reportAttemptStart(attemptNumber);

      try {
        // Attempt to generate commit message
        const commitMessage = await this._generateMessage(fixture);

        // Evaluate the generated message
        const evaluation = await this.evaluator.evaluate(commitMessage, fixture.diff, fixture.name);

        // Create success outcome
        const successOutcome: AttemptOutcome = {
          attemptNumber,
          commitMessage,
          metrics: evaluation.metrics,
          overallScore: evaluation.overallScore,
          status: 'success',
        };

        outcomes.push(successOutcome);

        // Report success
        this.reporter.reportAttemptSuccess(attemptNumber, evaluation.overallScore);
      } catch (error) {
        // Categorize the error
        const failureType = categorizeError(error);
        const failureReason = error instanceof Error ? error.message : String(error);

        // Create failure outcome
        const failureOutcome: AttemptOutcome = {
          attemptNumber,
          failureReason,
          failureType,
          status: 'failure',
        };

        outcomes.push(failureOutcome);

        // Report failure
        this.reporter.reportAttemptFailure(attemptNumber, failureType);
      }
    }

    // Guarantee: We ALWAYS return exactly 3 outcomes
    return outcomes;
  }

  /**
   * Generate commit message using the generator
   *
   * Creates a task from fixture metadata and calls generator.
   *
   * @param fixture - Fixture to generate message for
   * @returns Generated commit message
   * @throws {Error} If generation fails
   */
  private async _generateMessage(fixture: Fixture): Promise<string> {
    // Create task from fixture
    const task = {
      description: `Generate conventional commit message for ${fixture.name} changeset`,
      produces: this._extractFilesFromStatus(fixture.status),
      title: `Generate commit for ${fixture.name} fixture`,
    };

    // Use temporary directory for fixture evaluation
    // (Fixtures use mocked git status/diff, not actual repo)
    const workdir = '/tmp/eval-fixture';

    // Generate commit message
    const message = await this.generator.generateCommitMessage(task, { workdir });

    return message;
  }

  /**
   * Extract file paths from git status output
   *
   * Parses git status lines to extract file paths.
   *
   * @param status - Git status output
   * @returns Array of file paths
   */
  private _extractFilesFromStatus(status: string): string[] {
    const lines = status.split('\n').filter((line) => line.trim().length > 0);

    return lines
      .map((line) => {
        // Git status format: "XY filename"
        // Extract filename (skip first 3 chars: status code + space)
        if (line.length > 3) {
          return line.slice(3).trim();
        }
        return '';
      })
      .filter((file) => file.length > 0);
  }
}
