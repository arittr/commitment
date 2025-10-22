/**
 * Runner module for executing fixtures through generation + evaluation pipeline
 *
 * This module coordinates the full evaluation flow:
 * 1. Load fixture (mocked or live git)
 * 2. Generate commit messages using Claude AND Codex
 * 3. Evaluate both messages using ChatGPT
 * 4. Compare results and determine winner
 *
 * Supports two modes:
 * - Mocked: Fast, uses pre-recorded git output from fixture files
 * - Live: Comprehensive, executes real git commands in fixture directory
 *
 * @example
 * ```typescript
 * const runner = new EvalRunner();
 *
 * // Load and run a single fixture
 * const fixture = runner.loadFixture('simple', 'mocked');
 * const comparison = await runner.runFixture(fixture);
 * console.log(comparison.winner); // 'claude' | 'codex' | 'tie'
 *
 * // Run all fixtures
 * const allResults = await runner.runAll('mocked');
 * ```
 */

import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { EvalError } from '../errors.js';
import { CommitMessageGenerator } from '../generator.js';
import { hasContent } from '../utils/guards.js';
import { Evaluator } from './evaluator.js';
import type { EvalComparison, EvalFixture } from './schemas.js';

/**
 * EvalRunner class that loads fixtures and runs evaluation pipeline
 *
 * Responsibilities:
 * - Load fixtures from examples/eval-fixtures/
 * - Generate commit messages with both Claude and Codex
 * - Evaluate both messages using ChatGPT
 * - Compare results and determine winner (score difference > 0.5)
 */
export class EvalRunner {
  /** Evaluator instance for ChatGPT evaluation */
  private readonly evaluator: Evaluator;

  /**
   * Create a new EvalRunner instance
   *
   * @example
   * ```typescript
   * const runner = new EvalRunner();
   * ```
   */
  constructor() {
    this.evaluator = new Evaluator();
  }

  /**
   * Load a fixture by name from examples/eval-fixtures/
   *
   * Supports two modes:
   * - 'mocked': Load pre-recorded git output from mock-status.txt and mock-diff.txt (fast)
   * - 'live': Execute real git commands in fixture directory (comprehensive)
   *
   * @param name - Fixture name (e.g., 'simple', 'complex')
   * @param mode - Loading mode ('mocked' or 'live')
   * @returns Loaded EvalFixture with git status, git diff, and metadata
   * @throws {EvalError} If fixture directory or required files are missing
   *
   * @example
   * ```typescript
   * const runner = new EvalRunner();
   *
   * // Load mocked fixture (fast)
   * const mockedFixture = runner.loadFixture('simple', 'mocked');
   * console.log(mockedFixture.gitStatus); // From mock-status.txt
   *
   * // Load live fixture (comprehensive)
   * const liveFixture = runner.loadFixture('simple', 'live');
   * console.log(liveFixture.gitStatus); // From real git status --porcelain
   * ```
   */
  loadFixture(name: string, mode: 'live' | 'mocked' = 'mocked'): EvalFixture {
    // Construct fixture path based on mode
    const fixturePath = join(
      process.cwd(),
      'examples/eval-fixtures',
      mode === 'live' ? `${name}-live` : name
    );

    try {
      // Load metadata.json (required for both modes)
      const metadataPath = join(fixturePath, 'metadata.json');
      const metadata = JSON.parse(readFileSync(metadataPath, 'utf8')) as {
        description: string;
        expectedType: 'chore' | 'docs' | 'feat' | 'fix' | 'perf' | 'refactor' | 'style' | 'test';
        name: string;
      };

      if (mode === 'mocked') {
        // Mocked mode: Read pre-recorded git output from files
        const gitStatus = readFileSync(join(fixturePath, 'mock-status.txt'), 'utf8');
        const gitDiff = readFileSync(join(fixturePath, 'mock-diff.txt'), 'utf8');

        return {
          description: metadata.description,
          expectedType: metadata.expectedType,
          gitDiff,
          gitStatus,
          name: metadata.name,
        };
      }
      // Live mode: Execute real git commands in fixture directory
      const gitStatus = execSync('git status --porcelain', {
        cwd: fixturePath,
        encoding: 'utf8',
      });

      const gitDiff = execSync('git diff --cached', {
        cwd: fixturePath,
        encoding: 'utf8',
      });

      return {
        description: metadata.description,
        expectedType: metadata.expectedType,
        gitDiff,
        gitStatus,
        name: metadata.name,
      };
    } catch {
      // If any file is missing or git command fails, throw EvalError.fixtureNotFound
      throw EvalError.fixtureNotFound(name);
    }
  }

  /**
   * Run evaluation for a single fixture with both agents
   *
   * Pipeline:
   * 1. Generate commit message with Claude
   * 2. Generate commit message with Codex
   * 3. Evaluate Claude's message with ChatGPT
   * 4. Evaluate Codex's message with ChatGPT
   * 5. Compare scores and determine winner (>0.5 threshold)
   *
   * Note: For evaluation purposes, we use a minimal task that just describes the fixture.
   * The actual changeset comes from the fixture's git diff/status.
   *
   * @param fixture - The fixture to evaluate
   * @param workdir - Working directory for generators (defaults to process.cwd())
   * @returns EvalComparison with both results and winner
   * @throws {EvalError} If generation or evaluation fails
   *
   * @example
   * ```typescript
   * const runner = new EvalRunner();
   * const fixture = runner.loadFixture('simple', 'mocked');
   * const comparison = await runner.runFixture(fixture);
   *
   * console.log(comparison.winner); // 'claude' | 'codex' | 'tie'
   * console.log(comparison.scoreDiff); // 1.25 (positive = Claude wins)
   * console.log(comparison.claudeResult.overallScore); // 8.75
   * console.log(comparison.codexResult.overallScore); // 7.50
   * ```
   */
  async runFixture(fixture: EvalFixture, workdir: string = process.cwd()): Promise<EvalComparison> {
    // Create a minimal task from the fixture
    const task = {
      description: fixture.description,
      produces: [], // Files will be detected from git status
      title: `Evaluate ${fixture.name}`,
    };

    // 1. Generate commit message with Claude
    const claudeGenerator = new CommitMessageGenerator({
      agent: 'claude',
      enableAI: true,
    });

    const claudeMessage = await claudeGenerator.generateCommitMessage(task, {
      workdir,
    });

    // Type assertion: At runtime, mocked generators may return null
    if (!hasContent(claudeMessage as string | null)) {
      throw EvalError.generationFailed('claude', 'No message generated');
    }

    // 2. Generate commit message with Codex
    const codexGenerator = new CommitMessageGenerator({
      agent: 'codex',
      enableAI: true,
    });

    const codexMessage = await codexGenerator.generateCommitMessage(task, {
      workdir,
    });

    // Type assertion: At runtime, mocked generators may return null
    if (!hasContent(codexMessage as string | null)) {
      throw EvalError.generationFailed('codex', 'No message generated');
    }

    // 3. Evaluate Claude's message
    const claudeResult = await this.evaluator.evaluate(
      claudeMessage,
      fixture.gitStatus,
      fixture.gitDiff,
      fixture.name,
      'claude'
    );

    // 4. Evaluate Codex's message
    const codexResult = await this.evaluator.evaluate(
      codexMessage,
      fixture.gitStatus,
      fixture.gitDiff,
      fixture.name,
      'codex'
    );

    // 5. Compare results and determine winner
    const scoreDiff = claudeResult.overallScore - codexResult.overallScore;

    // Winner threshold: Must have >0.5 point difference
    const winner = Math.abs(scoreDiff) < 0.5 ? 'tie' : scoreDiff > 0 ? 'claude' : 'codex';

    return {
      claudeResult,
      codexResult,
      fixture: fixture.name,
      scoreDiff,
      winner,
    };
  }

  /**
   * Run all fixtures in examples/eval-fixtures/
   *
   * Discovers fixtures by scanning the directory and runs each one.
   * Results are returned in discovery order.
   *
   * @param mode - Loading mode ('mocked' or 'live')
   * @returns Array of EvalComparison results for all fixtures
   * @throws {EvalError} If any generation or evaluation fails
   *
   * @example
   * ```typescript
   * const runner = new EvalRunner();
   *
   * // Run all mocked fixtures (fast)
   * const mockedResults = await runner.runAll('mocked');
   * console.log(mockedResults.length); // 2 (simple, complex)
   *
   * // Run all live fixtures (comprehensive)
   * const liveResults = await runner.runAll('live');
   * ```
   */
  async runAll(mode: 'live' | 'mocked' = 'mocked'): Promise<EvalComparison[]> {
    const fixturesDir = join(process.cwd(), 'examples/eval-fixtures');

    // Discover fixtures by scanning directory
    const fixtureNames = readdirSync(fixturesDir).filter((name) => {
      if (mode === 'live') {
        // Live mode: Only include directories ending with '-live'
        return name.endsWith('-live');
      }
      // Mocked mode: Exclude directories ending with '-live'
      return !name.endsWith('-live');
    });

    // Load all fixtures
    const fixtures = fixtureNames.map((name) => {
      // For live mode, strip the '-live' suffix when loading
      const fixtureName = mode === 'live' ? name.replace(/-live$/, '') : name;
      return this.loadFixture(fixtureName, mode);
    });

    // Run all fixtures sequentially (to avoid overloading APIs)
    const results: EvalComparison[] = [];
    for (const fixture of fixtures) {
      const result = await this.runFixture(fixture);
      results.push(result);
    }

    return results;
  }
}
