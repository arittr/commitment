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
   * Create a new JSON reporter
   *
   * @param resultsDir - Directory to store JSON results (default: src/eval/results)
   *
   * @example
   * ```typescript
   * const reporter = new JSONReporter('/path/to/results');
   * ```
   */
  constructor(resultsDir: string = join(process.cwd(), 'src/eval/results')) {
    this.resultsDir = resultsDir;
  }

  /**
   * Save evaluation results to timestamped JSON file
   *
   * Creates:
   * 1. Timestamped file: {fixture}-{timestamp}.json
   * 2. Symlink: latest-{fixture}.json -> timestamped file
   *
   * @param result - Evaluation result to save
   * @param fixtureName - Name of the fixture
   * @returns Filename of created file (not full path)
   * @throws {Error} If unable to write file or create symlink
   *
   * @example
   * ```typescript
   * const filename = await reporter.saveResults(result, 'simple');
   * // Returns: 'simple-2025-10-23T12-34-56.789Z.json'
   * ```
   */
  async saveResults(result: EvalResult, fixtureName: string): Promise<string> {
    // Ensure results directory exists
    if (!existsSync(this.resultsDir)) {
      mkdirSync(this.resultsDir, { recursive: true });
    }

    // Generate timestamped filename
    const timestamp = new Date().toISOString().replaceAll(':', '-');
    const filename = `${fixtureName}-${timestamp}.json`;
    const filepath = join(this.resultsDir, filename);

    // Save JSON file
    writeFileSync(filepath, JSON.stringify(result, null, 2), 'utf-8');

    // Create or update symlink to latest file
    const symlinkPath = join(this.resultsDir, `latest-${fixtureName}.json`);

    // Remove existing symlink if it exists
    try {
      unlinkSync(symlinkPath);
    } catch {
      // Symlink doesn't exist, continue
    }

    // Create new symlink pointing to timestamped file
    symlinkSync(filename, symlinkPath);

    return filename;
  }
}
