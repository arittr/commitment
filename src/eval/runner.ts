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
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { EvaluationError } from '../errors';
import { CommitMessageGenerator } from '../generator';
import { hasContent } from '../utils/guards';
import { Evaluator } from './evaluator';
import type { EvalComparison, EvalFixture, EvalResult } from './schemas';

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
   * Load a fixture by name from src/eval/fixtures/
   *
   * Supports two modes:
   * - 'mocked': Load pre-recorded git output from mock-status.txt and mock-diff.txt (fast)
   * - 'live': Execute real git commands in fixture directory (comprehensive)
   *
   * @param name - Fixture name (e.g., 'simple', 'complex')
   * @param mode - Loading mode ('mocked' or 'live')
   * @returns Loaded EvalFixture with git status, git diff, and metadata
   * @throws {EvaluationError} If fixture directory or required files are missing
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
      'src/eval/fixtures',
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
      // If any file is missing or git command fails, throw EvaluationError.fixtureNotFound
      throw EvaluationError.fixtureNotFound(name);
    }
  }

  /**
   * Run evaluation for a single fixture with one or both agents
   *
   * Pipeline:
   * 1. Generate commit message with specified agent(s)
   * 2. Evaluate message(s) with ChatGPT
   * 3. Compare scores and determine winner (if both agents)
   *
   * Note: For evaluation purposes, we use a minimal task that just describes the fixture.
   * The actual changeset comes from the fixture's git diff/status.
   *
   * @param fixture - The fixture to evaluate
   * @param agent - Optional agent filter ('claude' or 'codex'). If undefined, runs both.
   * @param workdir - Working directory for generators (defaults to process.cwd())
   * @returns EvalComparison with result(s) and winner (if both agents)
   * @throws {EvaluationError} If generation or evaluation fails
   *
   * @example
   * ```typescript
   * const runner = new EvalRunner();
   * const fixture = runner.loadFixture('simple', 'mocked');
   *
   * // Compare both agents
   * const comparison = await runner.runFixture(fixture);
   * console.log(comparison.winner); // 'claude' | 'codex' | 'tie'
   *
   * // Single agent
   * const claudeOnly = await runner.runFixture(fixture, 'claude');
   * console.log(claudeOnly.claudeResult.overallScore); // 8.75
   * ```
   */
  async runFixture(
    fixture: EvalFixture,
    agent?: 'claude' | 'codex',
    workdir: string = process.cwd()
  ): Promise<EvalComparison> {
    console.log(`[Runner] Starting evaluation for fixture: ${fixture.name}`);

    // Create a minimal task from the fixture
    const task = {
      description: fixture.description,
      produces: [], // Files will be detected from git status
      title: `Evaluate ${fixture.name}`,
    };

    const runClaude = !agent || agent === 'claude';
    const runCodex = !agent || agent === 'codex';

    let claudeResult: EvalResult | undefined;
    let codexResult: EvalResult | undefined;

    // 1. Generate and evaluate Claude (if needed)
    if (runClaude) {
      console.log('[Runner] Creating Claude generator...');
      const claudeGenerator = new CommitMessageGenerator({
        agent: 'claude',
        enableAI: true,
      });

      console.log('[Runner] Generating Claude message...');
      const claudeMessage = await claudeGenerator.generateCommitMessage(task, {
        workdir,
      });
      console.log('[Runner] Claude message generated');

      // Type assertion: At runtime, mocked generators may return null
      if (!hasContent(claudeMessage as string | null)) {
        throw EvaluationError.generationFailed('claude', 'No message generated');
      }

      console.log('[Runner] Evaluating Claude message with ChatGPT...');
      claudeResult = await this.evaluator.evaluate(
        claudeMessage,
        fixture.gitStatus,
        fixture.gitDiff,
        fixture.name,
        'claude'
      );
      console.log('[Runner] Claude evaluation complete');
    }

    // 2. Generate and evaluate Codex (if needed)
    if (runCodex) {
      console.log('[Runner] Creating Codex generator...');
      const codexGenerator = new CommitMessageGenerator({
        agent: 'codex',
        enableAI: true,
      });

      console.log('[Runner] Generating Codex message...');
      const codexMessage = await codexGenerator.generateCommitMessage(task, {
        workdir,
      });
      console.log('[Runner] Codex message generated');

      // Type assertion: At runtime, mocked generators may return null
      if (!hasContent(codexMessage as string | null)) {
        throw EvaluationError.generationFailed('codex', 'No message generated');
      }

      console.log('[Runner] Evaluating Codex message with ChatGPT...');
      codexResult = await this.evaluator.evaluate(
        codexMessage,
        fixture.gitStatus,
        fixture.gitDiff,
        fixture.name,
        'codex'
      );
      console.log('[Runner] Codex evaluation complete');
    }

    // 3. Compare results and determine winner (if both agents ran)
    let scoreDiff: number;
    let winner: 'claude' | 'codex' | 'tie' | undefined;

    if (claudeResult && codexResult) {
      scoreDiff = claudeResult.overallScore - codexResult.overallScore;
      // Winner threshold: Must have >0.5 point difference
      winner = Math.abs(scoreDiff) < 0.5 ? 'tie' : scoreDiff > 0 ? 'claude' : 'codex';
    } else {
      scoreDiff = 0;
      winner = undefined;
    }

    return {
      claudeResult,
      codexResult,
      fixture: fixture.name,
      scoreDiff,
      winner,
    };
  }

  /**
   * Run all fixtures in src/eval/fixtures/
   *
   * Discovers fixtures by scanning the directory and runs each one.
   * Results are returned in discovery order.
   *
   * @param mode - Loading mode ('mocked' or 'live')
   * @param agent - Optional agent filter ('claude' or 'codex'). If undefined, runs both.
   * @returns Array of EvalComparison results for all fixtures
   * @throws {EvaluationError} If any generation or evaluation fails
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
   *
   * // Run only Claude on all fixtures
   * const claudeResults = await runner.runAll('mocked', 'claude');
   * ```
   */
  async runAll(
    mode: 'live' | 'mocked' = 'mocked',
    agent?: 'claude' | 'codex'
  ): Promise<EvalComparison[]> {
    const fixturesDir = join(process.cwd(), 'src/eval/fixtures');

    // Discover fixtures by scanning directory
    const fixtureNames = readdirSync(fixturesDir).filter((name) => {
      const fullPath = join(fixturesDir, name);

      // Only include directories
      if (!statSync(fullPath).isDirectory()) {
        return false;
      }

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
      const result = await this.runFixture(fixture, agent);
      results.push(result);
    }

    return results;
  }
}
