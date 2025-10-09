/* eslint-disable no-console, unicorn/no-process-exit */
import chalk from 'chalk';

/**
 * Display all available AI providers with their implementation status
 *
 * Provides a user-friendly list of supported providers, indicating which
 * are currently implemented and which are planned.
 *
 * @example
 * ```typescript
 * listProvidersCommand();
 * // Outputs:
 * // 📋 Available AI Providers:
 * //
 * //   claude    - Claude CLI (default)
 * //   codex     - OpenAI Codex CLI
 * //   ...
 * ```
 */
export function listProvidersCommand(): void {
  console.log(chalk.cyan('📋 Available AI Providers:\n'));
  console.log(chalk.white('  claude    ') + chalk.gray('- Claude CLI (default)'));
  console.log(chalk.white('  codex     ') + chalk.gray('- OpenAI Codex CLI (not yet implemented)'));
  console.log(chalk.white('  openai    ') + chalk.gray('- OpenAI API (not yet implemented)'));
  console.log(chalk.white('  cursor    ') + chalk.gray('- Cursor (not yet implemented)'));
  console.log(
    chalk.white('  gemini    ') + chalk.gray('- Google Gemini API (not yet implemented)'),
  );
  console.log(chalk.gray('\nExample usage: commitment --provider claude'));
  process.exit(0);
}
