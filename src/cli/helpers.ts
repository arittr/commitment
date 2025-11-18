import chalk from 'chalk';
import { type GitStatus, parseGitStatus } from '../utils/git-schemas';
import type { Logger } from '../utils/logger';
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
 * @param logger - Logger instance for output (respects quiet mode)
 */
export function displayStagedChanges(gitStatus: GitStatus, logger: Logger): void {
  // Logger handles quiet mode automatically (--message-only implies --quiet)
  logger.info(chalk.cyan('📝 Staged changes:'));
  for (const line of gitStatus.statusLines) {
    const status = line.slice(0, 2);
    const file = line.slice(3);
    logger.info(chalk.gray('  ') + chalk.green(status) + chalk.white(` ${file}`));
  }
  logger.info('');
}

/**
 * Display generation status to user
 *
 * @param agentName - Name of the agent being used
 * @param logger - Logger instance for output
 */
export function displayGenerationStatus(agentName: string, logger: Logger): void {
  // Logger respects quiet mode internally
  // Always show AI generation message (manual mode removed)
  logger.info(chalk.cyan(`🤖 Generating commit message with ${agentName}...`));
}

/**
 * Display commit message to user
 *
 * @param message - Commit message to display
 * @param messageOnly - If true, output only the message (for hooks)
 * @param logger - Logger instance for output
 */
export function displayCommitMessage(message: string, messageOnly: boolean, logger: Logger): void {
  if (messageOnly) {
    // Just output the message for hooks - use console.log directly (critical stdout output)
    console.log(message);
    return;
  }

  logger.info(chalk.green('✅ Generated commit message'));
  logger.info(chalk.green('\n💬 Commit message:'));
  const lines = message.split('\n');
  for (const line of lines) {
    logger.info(chalk.white(`   ${line}`));
  }
  logger.info('');
}

/**
 * Execute commit or show dry-run message
 *
 * @param message - Commit message to use
 * @param cwd - Working directory
 * @param dryRun - If true, don't create commit
 * @param messageOnly - If true, skip commit creation
 * @param logger - Logger instance for output
 */
export async function executeCommit(
  message: string,
  cwd: string,
  dryRun: boolean,
  messageOnly: boolean,
  logger: Logger
): Promise<void> {
  if (messageOnly) {
    return;
  }

  if (dryRun) {
    logger.info(chalk.blue('🚀 DRY RUN - No commit created'));
    logger.info(chalk.gray('   Remove --dry-run to create the commit'));
  } else {
    await createCommit(message, cwd);
    logger.info(chalk.green('✅ Commit created successfully'));
  }
}
