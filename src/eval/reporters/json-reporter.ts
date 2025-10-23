/**
 * JSON reporter for structured result storage
 *
 * Saves evaluation results to JSON files with:
 * - Timestamped filenames for versioning
 * - Symlinks to latest files for easy access
 * - Validated JSON structure
 *
 * @example
 * ```typescript
 * const reporter = new JSONReporter('/path/to/results');
 *
 * const result: EvalResult = {
 *   attempts: [...],
 *   finalScore: 8.5,
 *   consistencyScore: 8.0,
 *   errorRateImpact: 0,
 *   successRate: '3/3',
 *   reasoning: '...',
 *   bestAttempt: 1
 * };
 *
 * const filename = await reporter.saveResults(result, 'simple-fixture');
 * // Creates: simple-fixture-2025-10-23T12-34-56.789Z.json
 * // Symlink: latest-simple-fixture.json -> simple-fixture-2025-10-23T12-34-56.789Z.json
 * ```
 */

import { existsSync, mkdirSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { EvalResult } from '../core/types.js';

/**
 * JSON reporter for structured evaluation results
 *
 * Saves results to timestamped JSON files and maintains symlinks to latest files.
 */
export class JSONReporter {
  /**
   * Directory where results are stored
   */
  private readonly resultsDir: string;

  /**
   * Shared run directory for this eval session (set on first save)
   */
  private runDir: string | null = null;

  /**
   * Create a new JSON reporter
   *
   * @param resultsDir - Directory to store JSON results (default: .eval-results)
   *
   * @example
   * ```typescript
   * const reporter = new JSONReporter('/path/to/results');
   * ```
   */
  constructor(resultsDir: string = join(process.cwd(), '.eval-results')) {
    this.resultsDir = resultsDir;
  }

  /**
   * Save evaluation results to timestamped JSON file
   *
   * Creates:
   * 1. Run subdirectory: YYYY-MM-DDTHH-MM-SS.sssZ/
   * 2. JSON file: YYYY-MM-DDTHH-MM-SS.sssZ/{fixture}.json
   * 3. Symlink: latest-{fixture}.json -> YYYY-MM-DDTHH-MM-SS.sssZ/{fixture}.json
   *
   * @param result - Evaluation result to save
   * @param fixtureName - Name of the fixture
   * @returns Filename of created file (relative to resultsDir)
   * @throws {Error} If unable to write file or create symlink
   *
   * @example
   * ```typescript
   * const filename = await reporter.saveResults(result, 'simple');
   * // Returns: '2025-10-23T12-34-56.789Z/simple.json'
   * ```
   */
  async saveResults(result: EvalResult, fixtureName: string): Promise<string> {
    // Ensure results directory exists
    if (!existsSync(this.resultsDir)) {
      mkdirSync(this.resultsDir, { recursive: true });
    }

    // Create or reuse run directory (shared across all saves in this eval session)
    if (!this.runDir) {
      const now = new Date();
      this.runDir = now.toISOString().replaceAll(':', '-'); // e.g., "2025-10-23T12-34-56.789Z"
    }

    const runDirPath = join(this.resultsDir, this.runDir);

    // Ensure run subdirectory exists
    if (!existsSync(runDirPath)) {
      mkdirSync(runDirPath, { recursive: true });
    }

    // Generate filename (just fixture name, timestamp is in directory)
    const filename = `${fixtureName}.json`;
    const relativeFilepath = join(this.runDir, filename); // Relative to resultsDir
    const absoluteFilepath = join(this.resultsDir, relativeFilepath);

    // Save JSON file
    writeFileSync(absoluteFilepath, JSON.stringify(result, null, 2), 'utf-8');

    // Create or update symlink to latest file (in root of resultsDir)
    const symlinkPath = join(this.resultsDir, `latest-${fixtureName}.json`);

    // Remove existing symlink if it exists
    try {
      unlinkSync(symlinkPath);
    } catch {
      // Symlink doesn't exist, continue
    }

    // Create new symlink pointing to timestamped file (relative path)
    symlinkSync(relativeFilepath, symlinkPath);

    return relativeFilepath;
  }

  /**
   * Get the run directory for this eval session
   *
   * Initializes the run directory if not already set.
   * Used to ensure markdown reporter uses the same directory.
   *
   * @returns Run directory name (e.g., "2025-10-23T12-34-56.789Z")
   */
  getRunDir(): string {
    if (!this.runDir) {
      const now = new Date();
      this.runDir = now.toISOString().replaceAll(':', '-');
    }
    return this.runDir;
  }
}
