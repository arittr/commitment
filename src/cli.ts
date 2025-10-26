import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { program } from 'commander';
import { ZodError } from 'zod';

import { initCommand } from './cli/commands/init';
import {
  displayCommitMessage,
  displayGenerationStatus,
  displayStagedChanges,
  executeCommit,
  getGitStatus,
} from './cli/helpers';
import { formatValidationError, validateCliOptions } from './cli/schemas';
import { CommitMessageGenerator } from './generator';
import type { GitStatus } from './utils/git-schemas';

// Read version from package.json
const Filename = fileURLToPath(import.meta.url);
const Dirname = dirname(Filename);
const packageJson = JSON.parse(readFileSync(join(Dirname, '../package.json'), 'utf-8'));
const version = packageJson.version;

/**
 * Generate commit command (default action)
 */
async function generateCommitCommand(rawOptions: {
  agent?: string;
  ai: boolean;
  cwd: string;
  dryRun?: boolean;
  messageOnly?: boolean;
}): Promise<void> {
  const options = validateOptionsOrExit(rawOptions);
  const agentName = options.agent ?? 'claude';

  try {
    const gitStatus = await checkGitStatusOrExit(options.cwd);
    displayStagedChanges(gitStatus, options.messageOnly === true);
    displayGenerationStatus(agentName, options.ai, options.messageOnly === true);

    const task = {
      description: 'Analyze git diff to generate appropriate commit message',
      produces: gitStatus.stagedFiles,
      title: 'Code changes',
    };

    const generator = new CommitMessageGenerator({
      agent: agentName,
      enableAI: options.ai,
      logger: {
        warn: (warningMessage: string) => {
          console.error(chalk.yellow(`⚠️  ${warningMessage}`));
        },
      },
    });

    const message = await generator.generateCommitMessage(task, {
      files: gitStatus.stagedFiles,
      workdir: options.cwd,
    });

    displayCommitMessage(message, options.messageOnly === true);
    await executeCommit(
      message,
      options.cwd,
      options.dryRun === true,
      options.messageOnly === true
    );
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Validate CLI options or exit with error
 */
function validateOptionsOrExit(
  rawOptions: Parameters<typeof validateCliOptions>[0]
): ReturnType<typeof validateCliOptions> {
  try {
    return validateCliOptions(rawOptions);
  } catch (error) {
    if (error instanceof ZodError) {
      console.error(chalk.red('❌ Invalid CLI options:'));
      console.error(chalk.yellow(formatValidationError(error)));
      console.log(chalk.gray('\nPlease check your command-line flags and try again.'));
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Check git status and exit if no changes
 *
 * Returns a simplified GitStatus-like object with just the fields we need
 */
async function checkGitStatusOrExit(cwd: string): Promise<GitStatus> {
  const gitStatus = await getGitStatus(cwd);

  if (!gitStatus.hasChanges) {
    console.log(chalk.yellow('No staged changes to commit'));
    console.log(chalk.gray('Run `git add` to stage changes first'));
    process.exit(1);
  }

  // Return full GitStatus from getGitStatus which already has all required fields
  return gitStatus;
}

/**
 * Main CLI function
 */
async function main(): Promise<void> {
  program
    .name('commitment')
    .description('AI-powered commit message generator using Claude or Codex')
    .version(version);

  // Init command - setup git hooks
  program
    .command('init')
    .description('Initialize commitment hooks in your project')
    .option('--hook-manager <type>', 'Hook manager to use: husky, simple-git-hooks, plain')
    .option('--agent <name>', 'Default AI agent for hooks: claude, codex, gemini')
    .option('--cwd <path>', 'Working directory', process.cwd())
    .action(
      async (options: {
        cwd: string;
        hookManager?: 'husky' | 'simple-git-hooks' | 'plain';
        agent?: 'claude' | 'codex' | 'gemini';
      }) => {
        // Parse --agent manually from process.argv due to Commander.js subcommand option conflict
        const agentFlagIndex = process.argv.indexOf('--agent');
        const agentValue =
          agentFlagIndex >= 0 && agentFlagIndex < process.argv.length - 1
            ? (process.argv[agentFlagIndex + 1] as 'claude' | 'codex' | 'gemini')
            : undefined;

        await initCommand({
          agent: agentValue,
          cwd: options.cwd,
          hookManager: options.hookManager,
        });
      }
    );

  // Default command - generate commit message
  program
    .description(
      'Generate commit message and create commit\n\n' +
        'Available agents:\n' +
        '  claude    - Claude CLI (default)\n' +
        '  codex     - OpenAI Codex CLI\n' +
        '  gemini    - Google Gemini CLI\n\n' +
        'Example: commitment --agent claude --dry-run'
    )
    .option('--agent <name>', 'AI agent to use (claude, codex, gemini)', 'claude')
    .option('--dry-run', 'Generate message without creating commit')
    .option('--message-only', 'Output only the commit message (no commit)')
    .option('--cwd <path>', 'Working directory', process.cwd())
    .action(
      async (options: {
        agent?: string;
        ai: boolean;
        cwd: string;
        dryRun?: boolean;
        messageOnly?: boolean;
      }) => {
        await generateCommitCommand(options);
      }
    );

  await program.parseAsync();
}

// Run CLI
await main();
