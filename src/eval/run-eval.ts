#!/usr/bin/env bun
/* eslint-disable no-console, unicorn/no-process-exit */
/**
 * Standalone evaluation script for comparing Claude vs Codex commit message quality
 *
 * Usage:
 *   bun run eval                  # Run all mocked fixtures (both agents)
 *   bun run eval:fixture simple   # Run single fixture (both agents)
 *   bun run eval:live             # Run with live git (both agents)
 *   bun run eval:claude           # Run all fixtures with Claude only
 *   bun run eval:codex            # Run all fixtures with Codex only
 */

import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';

import chalk from 'chalk';

import { MetaEvaluator } from './evaluators/meta-evaluator.js';
import { SingleAttemptEvaluator } from './evaluators/single-attempt.js';
import { CLIReporter } from './reporters/cli-reporter.js';
import { JSONReporter } from './reporters/json-reporter.js';
import { MarkdownReporter } from './reporters/markdown-reporter.js';
import { AttemptRunner } from './runners/attempt-runner.js';
import { EvalRunner } from './runners/eval-runner.js';

const RESULTS_DIR = './.eval-results';

// Parse CLI arguments
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    agent: { default: undefined, short: 'a', type: 'string' },
    fixture: { default: undefined, short: 'f', type: 'string' },
    mode: { default: 'mocked', short: 'm', type: 'string' },
  },
});

const mode = (values.mode === 'live' ? 'live' : 'mocked') as 'live' | 'mocked';
const fixtureName = values.fixture as string | undefined;
const agent = (values.agent === 'claude' || values.agent === 'codex' ? values.agent : undefined) as
  | 'claude'
  | 'codex'
  | undefined;

// Check API key
if (!process.env.OPENAI_API_KEY?.trim()) {
  console.error(chalk.red('❌ OPENAI_API_KEY not set'));
  console.error(chalk.gray('\n  export OPENAI_API_KEY="your-key-here"\n'));
  process.exit(1);
}

// Display header
console.log(chalk.bold('\n🧪 Commitment Evaluation System (Multi-Attempt)\n'));
console.log(chalk.gray('Mode:'), mode);
if (agent) console.log(chalk.gray('Agent:'), agent);
else console.log(chalk.gray('Agents:'), 'claude vs codex');
if (fixtureName) console.log(chalk.gray('Fixture:'), fixtureName);
console.log(chalk.gray('Results:'), RESULTS_DIR);
console.log(chalk.gray('Attempts:'), '3 per agent per fixture');
console.log('');

// Instantiate dependencies
const singleAttemptEvaluator = new SingleAttemptEvaluator();
const metaEvaluator = new MetaEvaluator();
const cliReporter = new CLIReporter();
const jsonReporter = new JSONReporter(RESULTS_DIR);
const markdownReporter = new MarkdownReporter(RESULTS_DIR);

// Create attempt runner (creates its own generator with mock git provider)
const attemptRunner = new AttemptRunner(singleAttemptEvaluator, cliReporter);

// Create eval runner with all dependencies
const runner = new EvalRunner(attemptRunner, metaEvaluator, jsonReporter, markdownReporter);

try {
  if (fixtureName) {
    // Single fixture
    console.log(chalk.blue(`Running fixture: ${fixtureName}\n`));
    const fixture = runner.loadFixture(fixtureName, mode);
    const comparison = await runner.runFixture(fixture, agent);

    // Results
    console.log(chalk.green('\n✅ Complete'));
    if (comparison.winner) {
      console.log(chalk.gray('Winner:'), comparison.winner);
      const claudeScore = comparison.claudeResult?.finalScore ?? 0;
      const codexScore = comparison.codexResult?.finalScore ?? 0;
      const scoreDiff = Math.abs(claudeScore - codexScore);
      const sign = claudeScore > codexScore ? '+' : '-';
      console.log(chalk.gray('Score diff:'), `${sign}${scoreDiff.toFixed(2)}`);
    } else if (comparison.claudeResult) {
      console.log(chalk.gray('Claude Score:'), comparison.claudeResult.finalScore.toFixed(2));
      console.log(chalk.gray('Success Rate:'), comparison.claudeResult.successRate);
    } else if (comparison.codexResult) {
      console.log(chalk.gray('Codex Score:'), comparison.codexResult.finalScore.toFixed(2));
      console.log(chalk.gray('Success Rate:'), comparison.codexResult.successRate);
    }
    console.log(chalk.gray('Results:'), `${RESULTS_DIR}/latest-${fixtureName}.json\n`);
  } else {
    // All fixtures
    console.log(chalk.blue(`Running all ${mode} fixtures...\n`));
    const comparisons = await runner.runAll(mode, agent);

    console.log(chalk.green(`\n✅ Complete: ${comparisons.length} fixtures`));

    // Summary
    if (agent) {
      // Single-agent mode: show average score and success rates
      const avgScore =
        comparisons.reduce((sum, c) => {
          const result = c.claudeResult || c.codexResult;
          return sum + (result?.finalScore || 0);
        }, 0) / comparisons.length;

      const successRates = comparisons.map((c) => {
        const result = c.claudeResult || c.codexResult;
        return result?.successRate || '0/3';
      });

      console.log(chalk.gray('\nAverage Score:'), avgScore.toFixed(2));
      console.log(chalk.gray('Success Rates:'), successRates.join(', '));
    } else {
      // Comparison mode: show wins/losses
      const wins = comparisons.reduce(
        (acc, c) => {
          if (c.winner === 'claude') acc.claude++;
          else if (c.winner === 'codex') acc.codex++;
          else acc.ties++;
          return acc;
        },
        { claude: 0, codex: 0, ties: 0 }
      );

      console.log(chalk.gray('\nSummary:'));
      console.log(chalk.gray('  Claude:'), wins.claude);
      console.log(chalk.gray('  Codex:'), wins.codex);
      console.log(chalk.gray('  Ties:'), wins.ties);
    }

    const reportPath = `${RESULTS_DIR}/latest-report.md`;
    if (existsSync(reportPath)) {
      console.log(chalk.gray('\nReport:'), reportPath);
    }
    console.log('');
  }
} catch (error) {
  console.error(chalk.red('\n❌ Failed:'), error instanceof Error ? error.message : String(error));
  if (error instanceof Error && error.stack) {
    console.error(chalk.gray('\nStack trace:'));
    console.error(error.stack);
  }
  process.exit(1);
}
