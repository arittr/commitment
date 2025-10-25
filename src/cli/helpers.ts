import chalk from 'chalk';

import { type GitStatus, parseGitStatus } from '../utils/git-schemas';
import { exec } from '../utils/shell';

/**
 * Get git status and check for staged changes
 *
 * @param cwd - Working directory
 * @returns Parsed git status with staged files
 * @throws Error if git command fails or output is malformed
 */
export async function getGitStatus(cwd: string): Promise<GitStatus> {
  try {
    const { stdout } = await exec('git', ['status', '--porcelain'], { cwd });

    // Parse and validate git status output
    try {
      return parseGitStatus(stdout);
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
 *
 * @param message - Commit message to use
 * @param cwd - Working directory
 * @throws Error if git commit fails
 */
export async function createCommit(message: string, cwd: string): Promise<void> {
  try {
    await exec('git', ['commit', '-m', message], { cwd });
  } catch (error) {
    throw new Error(
      `Failed to create commit: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Display staged changes to user
 *
 * @param gitStatus - Git status with staged files
 * @param messageOnly - If true, write to stderr instead of stdout (for hooks)
 */
export function displayStagedChanges(gitStatus: GitStatus, messageOnly: boolean): void {
  if (messageOnly) {
    // In message-only mode, write to stderr so it appears in terminal while stdout goes to commit file
    console.error(chalk.cyan('📝 Staged changes:'));
    for (const line of gitStatus.statusLines) {
      const status = line.slice(0, 2);
      const file = line.slice(3);
      console.error(chalk.gray('  ') + chalk.green(status) + chalk.white(` ${file}`));
    }
    console.error('');
    return;
  }

  console.log(chalk.cyan('📝 Staged changes:'));
  for (const line of gitStatus.statusLines) {
    const status = line.slice(0, 2);
    const file = line.slice(3);
    console.log(chalk.gray('  ') + chalk.green(status) + chalk.white(` ${file}`));
  }
  console.log('');
}

/**
 * Display generation status to user
 *
 * @param agentName - Name of the agent being used
 * @param useAI - Whether AI generation is enabled
 * @param messageOnly - If true, write to stderr instead of stdout (for hooks)
 */
export function displayGenerationStatus(
  agentName: string,
  useAI: boolean,
  messageOnly: boolean
): void {
  if (messageOnly) {
    // In message-only mode, write to stderr so it appears in terminal while stdout goes to commit file
    if (useAI) {
      console.error(chalk.cyan(`🤖 Generating commit message with ${agentName}...`));
    } else {
      console.error(chalk.cyan('📝 Generating commit message with rules...'));
    }
    return;
  }

  if (useAI) {
    console.log(chalk.cyan(`🤖 Generating commit message with ${agentName}...`));
  } else {
    console.log(chalk.cyan('📝 Generating commit message with rules...'));
  }
}

/**
 * Display commit message to user
 *
 * @param message - Commit message to display
 * @param messageOnly - If true, output only the message (for hooks)
 */
export function displayCommitMessage(message: string, messageOnly: boolean): void {
  if (messageOnly) {
    // Just output the message for hooks
    console.log(message);
    return;
  }

  console.log(chalk.green('✅ Generated commit message'));
  console.log(chalk.green('\n💬 Commit message:'));
  const lines = message.split('\n');
  for (const line of lines) {
    console.log(chalk.white(`   ${line}`));
  }
  console.log('');
}

/**
 * Execute commit or show dry-run message
 *
 * @param message - Commit message to use
 * @param cwd - Working directory
 * @param dryRun - If true, don't create commit
 * @param messageOnly - If true, skip commit creation
 */
export async function executeCommit(
  message: string,
  cwd: string,
  dryRun: boolean,
  messageOnly: boolean
): Promise<void> {
  if (messageOnly) {
    return;
  }

  if (dryRun) {
    console.log(chalk.blue('🚀 DRY RUN - No commit created'));
    console.log(chalk.gray('   Remove --dry-run to create the commit'));
  } else {
    await createCommit(message, cwd);
    console.log(chalk.green('✅ Commit created successfully'));
  }
}
