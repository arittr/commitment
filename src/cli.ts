import chalk from 'chalk';
import { program } from 'commander';
import { execa } from 'execa';
import ora from 'ora';

import type { CommitTask } from './generator.js';

import { CommitMessageGenerator } from './generator.js';

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
    const lines = stdout.split('\n').filter((line) => line.trim() !== '');

    // Get staged changes (lines starting with M, A, D, R in first column)
    const stagedLines = lines.filter((line) => {
      const status = line.slice(0, 2);
      return !status.startsWith('?') && !status.startsWith(' ');
    });

    const stagedFiles = stagedLines.map((line) => line.slice(3));

    return {
      hasChanges: stagedLines.length > 0,
      stagedFiles,
      statusLines: stagedLines,
    };
  } catch (error) {
    throw new Error(
      `Failed to get git status: ${error instanceof Error ? error.message : String(error)}`,
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
      `Failed to create commit: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Create a task object from git status for commit message generation
 */
function createTaskFromGitStatus(statusLines: string[], files: string[]): CommitTask {
  // Analyze file patterns and changes
  const changes = {
    added: statusLines.filter((line) => line.startsWith('A ')).length,
    modified: statusLines.filter((line) => line.startsWith('M ')).length,
    deleted: statusLines.filter((line) => line.startsWith('D ')).length,
    renamed: statusLines.filter((line) => line.startsWith('R ')).length,
  };

  // Categorize files by type
  const categories = {
    tests: files.filter((f) => f.includes('test') || f.includes('spec')),
    components: files.filter(
      (f) => f.endsWith('.tsx') || f.endsWith('.jsx') || f.includes('component'),
    ),
    types: files.filter((f) => f.includes('types') || f.endsWith('.d.ts')),
    configs: files.filter(
      (f) =>
        f.includes('config') || f.endsWith('.json') || f.endsWith('.yaml') || f.endsWith('.toml'),
    ),
    docs: files.filter((f) => f.endsWith('.md') || f.includes('README')),
    apis: files.filter((f) => f.includes('api') || f.includes('service') || f.includes('adapter')),
  };

  // Generate intelligent title based on changes
  let title = 'Update codebase';
  if (categories.tests.length > 0 && categories.tests.length >= files.length / 2) {
    title = 'Add comprehensive test coverage';
  } else if (categories.components.length > 0) {
    title = 'Enhance UI components and functionality';
  } else if (categories.apis.length > 0) {
    title = 'Enhance API and service integration';
  } else if (categories.types.length > 0) {
    title = 'Update type definitions and interfaces';
  } else if (categories.configs.length > 0) {
    title = 'Update project configuration';
  } else if (categories.docs.length > 0) {
    title = 'Update documentation';
  }

  // Generate detailed description
  const descriptions: string[] = [];

  if (changes.added > 0) {
    descriptions.push(`${changes.added} new file${changes.added > 1 ? 's' : ''} added`);
  }
  if (changes.modified > 0) {
    descriptions.push(`${changes.modified} file${changes.modified > 1 ? 's' : ''} modified`);
  }
  if (changes.deleted > 0) {
    descriptions.push(`${changes.deleted} file${changes.deleted > 1 ? 's' : ''} deleted`);
  }
  if (changes.renamed > 0) {
    descriptions.push(`${changes.renamed} file${changes.renamed > 1 ? 's' : ''} renamed`);
  }

  const description =
    descriptions.length > 0
      ? descriptions.join(', ')
      : `${files.length} files changed across the codebase`;

  return {
    title,
    description,
    produces: files,
  };
}

/**
 * Main CLI function
 */
async function main(): Promise<void> {
  program
    .name('commitment')
    .description('AI-powered commit message generator with intelligent fallback')
    .version('0.1.0')
    .option('--dry-run', 'Generate message without creating commit')
    .option('--message-only', 'Output only the commit message (no commit)')
    .option('--no-ai', 'Disable AI generation, use rule-based only')
    .option('--cwd <path>', 'Working directory', process.cwd())
    .option('--signature <text>', 'Custom signature to append')
    .option('--ai-command <cmd>', 'AI command to use', 'claude')
    .option('--timeout <ms>', 'AI timeout in milliseconds', '120000')
    .parse();

  const options = program.opts<{
    ai: boolean;
    aiCommand: string;
    cwd: string;
    dryRun?: boolean;
    messageOnly?: boolean;
    signature?: string;
    timeout: string;
  }>();

  const { ai, aiCommand, cwd, dryRun, messageOnly, signature, timeout } = options;

  try {
    // Check for staged changes
    const gitStatus = await getGitStatus(cwd);

    if (!gitStatus.hasChanges) {
      console.log(chalk.yellow('No staged changes to commit'));
      console.log(chalk.gray('Run `git add` to stage changes first'));
      process.exit(1);
    }

    // Show what will be committed
    if (messageOnly !== true) {
      console.log(chalk.cyan('📝 Staged changes:'));
      for (const line of gitStatus.statusLines) {
        const status = line.slice(0, 2);
        const file = line.slice(3);
        console.log(chalk.gray('  ') + chalk.green(status) + chalk.white(` ${file}`));
      }
      console.log('');
    }

    // Create task from git status
    const task = createTaskFromGitStatus(gitStatus.statusLines, gitStatus.stagedFiles);

    // Generate commit message
    const spinner =
      messageOnly === true ? null : ora('Generating commit message with AI...').start();

    const generator = new CommitMessageGenerator({
      enableAI: ai,
      aiCommand,
      aiTimeout: Number.parseInt(timeout, 10),
      signature,
      logger: {
        warn: (warningMessage: string) => {
          if (spinner !== null) {
            spinner.warn(warningMessage);
          } else {
            console.error(chalk.yellow(warningMessage));
          }
        },
      },
    });

    const message = await generator.generateCommitMessage(task, {
      workdir: cwd,
      files: gitStatus.stagedFiles,
    });

    if (spinner !== null) {
      spinner.succeed('Generated commit message');
    }

    // Output the message
    if (messageOnly === true) {
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
    if (dryRun === true) {
      console.log(chalk.blue('🚀 DRY RUN - No commit created'));
      console.log(chalk.gray('   Remove --dry-run to create the commit'));
    } else {
      await createCommit(message, cwd);
      console.log(chalk.green('✅ Commit created successfully'));
    }
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run CLI
await main();
