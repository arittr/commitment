import chalk from 'chalk';
import { program } from 'commander';
import { execa } from 'execa';
import { ZodError } from 'zod';

import { initCommand } from './cli/commands/init';
import { formatValidationError, validateCliOptions } from './cli/schemas';
import { CommitMessageGenerator } from './generator';
import { parseGitStatus } from './utils/git-schemas';

/**
 * Get git status and check for staged changes
 */
async function getGitStatus(cwd: string): Promise<{
  hasChanges: boolean;
  stagedFiles: string[];
  statusLines: string[];
}> {
  try {
    const { stdout } = await execa('git', ['status', '--porcelain'], { cwd });

    // Parse and validate git status output
    try {
      const parsedStatus = parseGitStatus(stdout);

      return {
        hasChanges: parsedStatus.hasChanges,
        stagedFiles: parsedStatus.stagedFiles,
        statusLines: parsedStatus.statusLines,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('Malformed git status line')) {
        throw new Error(
          `Invalid git status output: ${error.message}\n${chalk.gray('This may indicate a git version incompatibility or corrupted output.')}`
        );
      }
      throw error;
    }
  } catch (error) {
    throw new Error(
      `Failed to get git status: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Create a commit with the given message
 */
async function createCommit(message: string, cwd: string): Promise<void> {
  try {
    await execa('git', ['commit', '-m', message], { cwd });
  } catch (error) {
    throw new Error(
      `Failed to create commit: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

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
  // Validate CLI options
  let options;
  try {
    options = validateCliOptions(rawOptions);
  } catch (error) {
    if (error instanceof ZodError) {
      console.error(chalk.red('❌ Invalid CLI options:'));
      console.error(chalk.yellow(formatValidationError(error)));
      console.log(chalk.gray('\nPlease check your command-line flags and try again.'));
      process.exit(1);
    }
    throw error;
  }

  // Use default agent if not specified
  const agentName = options.agent ?? 'claude';

  try {
    // Check for staged changes
    const gitStatus = await getGitStatus(options.cwd);

    if (!gitStatus.hasChanges) {
      console.log(chalk.yellow('No staged changes to commit'));
      console.log(chalk.gray('Run `git add` to stage changes first'));
      process.exit(1);
    }

    // Show what will be committed
    if (options.messageOnly !== true) {
      console.log(chalk.cyan('📝 Staged changes:'));
      for (const line of gitStatus.statusLines) {
        const status = line.slice(0, 2);
        const file = line.slice(3);
        console.log(chalk.gray('  ') + chalk.green(status) + chalk.white(` ${file}`));
      }
      console.log('');
    }

    // Create task from git status
    const task = {
      description: 'Analyze git diff to generate appropriate commit message',
      produces: gitStatus.stagedFiles,
      title: 'Code changes',
    };

    // Show generation status
    if (options.messageOnly !== true) {
      if (options.ai) {
        console.log(chalk.cyan(`🤖 Generating commit message with ${agentName}...`));
      } else {
        console.log(chalk.cyan('📝 Generating commit message with rules...'));
      }
    }

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

    if (options.messageOnly !== true) {
      console.log(chalk.green('✅ Generated commit message'));
    }

    // Output the message
    if (options.messageOnly === true) {
      // Just output the message for hooks
      console.log(message);
      return;
    }

    console.log(chalk.green('\n💬 Commit message:'));
    const lines = message.split('\n');
    for (const line of lines) {
      console.log(chalk.white(`   ${line}`));
    }
    console.log('');

    // Create commit if not dry run
    if (options.dryRun === true) {
      console.log(chalk.blue('🚀 DRY RUN - No commit created'));
      console.log(chalk.gray('   Remove --dry-run to create the commit'));
    } else {
      await createCommit(message, options.cwd);
      console.log(chalk.green('✅ Commit created successfully'));
    }
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Main CLI function
 */
async function main(): Promise<void> {
  program
    .name('commitment')
    .description('AI-powered commit message generator with intelligent fallback')
    .version('0.1.0');

  // Init command - setup git hooks
  program
    .command('init')
    .description('Initialize commitment hooks in your project')
    .option('--hook-manager <type>', 'Hook manager to use: husky, simple-git-hooks, plain')
    .option('--cwd <path>', 'Working directory', process.cwd())
    .action(
      async (options: { cwd: string; hookManager?: 'husky' | 'simple-git-hooks' | 'plain' }) => {
        await initCommand({
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
        '  codex     - OpenAI Codex CLI\n\n' +
        'Example: commitment --agent claude --dry-run'
    )
    .option('--agent <name>', 'AI agent to use (claude, codex)', 'claude')
    .option('--no-ai', 'Disable AI generation, use rule-based only')
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
