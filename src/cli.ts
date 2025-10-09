import chalk from 'chalk';
import { program } from 'commander';
import { execa } from 'execa';
import ora from 'ora';
import { ZodError } from 'zod';

import type { CommitTask } from './generator';
import type { CLIProviderConfig, ProviderConfig } from './providers/index';

import {
  autoDetectCommand,
  checkProviderCommand,
  listProvidersCommand,
} from './cli/commands/index';
import { buildProviderChain } from './cli/provider-config-builder';
import { formatValidationError, parseProviderConfigJson, validateCliOptions } from './cli/schemas';
import { CommitMessageGenerator } from './generator';
import { analyzeChanges, categorizeFiles, parseGitStatus } from './utils/git-schemas';

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
          `Invalid git status output: ${error.message}\n${chalk.gray('This may indicate a git version incompatibility or corrupted output.')}`,
        );
      }
      throw error;
    }
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
  // Analyze file patterns and changes using validated utilities
  const changes = analyzeChanges(statusLines);
  const categories = categorizeFiles(files);

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
    .option('--provider <name>', 'AI provider to use (claude, codex, openai, cursor, gemini)')
    .option('--provider-config <json>', 'Provider configuration as JSON string')
    .option('--claude-command <cmd>', 'Claude CLI command path')
    .option('--claude-timeout <ms>', 'Claude CLI timeout in milliseconds')
    .option(
      '--ai-command <cmd>',
      '[DEPRECATED] AI command to use (use --provider instead)',
      'claude',
    )
    .option(
      '--timeout <ms>',
      '[DEPRECATED] AI timeout in milliseconds (use --provider instead)',
      '120000',
    )
    .option('--list-providers', 'List all available AI providers')
    .option('--check-provider', 'Check if selected provider is available')
    .option('--auto-detect', 'Auto-detect first available AI provider')
    .option('--fallback <provider...>', 'Fallback providers (can specify multiple)')
    .parse();

  const rawOptions = program.opts<{
    ai: boolean;
    aiCommand: string;
    autoDetect?: boolean;
    checkProvider?: boolean;
    claudeCommand?: string;
    claudeTimeout?: string;
    cwd: string;
    dryRun?: boolean;
    fallback?: string[];
    listProviders?: boolean;
    messageOnly?: boolean;
    provider?: string;
    providerConfig?: string;
    signature?: string;
    timeout: string;
  }>();

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

  // Handle --list-providers
  if (options.listProviders === true) {
    listProvidersCommand();
  }

  // Parse provider configuration from CLI flags
  let providerConfig: ProviderConfig | undefined;

  if (options.providerConfig !== undefined) {
    // Parse and validate JSON config
    try {
      providerConfig = parseProviderConfigJson(options.providerConfig);
    } catch (error) {
      if (error instanceof Error) {
        console.error(chalk.red('❌ Invalid provider config:'));
        console.error(chalk.yellow(`   ${error.message}`));
        console.log(chalk.gray('\nProvider config must be valid JSON matching the schema.'));
        console.log(
          chalk.gray('Example: --provider-config \'{"type":"cli","provider":"claude"}\''),
        );
        process.exit(1);
      }
      throw error;
    }
  } else if (options.provider !== undefined) {
    // Build config from provider name and provider-specific flags
    const providerName = options.provider.toLowerCase();

    if (providerName === 'claude') {
      providerConfig = {
        type: 'cli',
        provider: 'claude',
        command: options.claudeCommand,
        timeout:
          options.claudeTimeout !== undefined
            ? Number.parseInt(options.claudeTimeout, 10)
            : undefined,
      } satisfies CLIProviderConfig;
    } else {
      console.error(chalk.red(`❌ Provider '${providerName}' is not yet implemented`));
      console.log(chalk.gray('   Available providers: claude'));
      console.log(chalk.gray('   Run `commitment --list-providers` for more info'));
      process.exit(1);
    }
  }

  // Handle --check-provider
  if (options.checkProvider === true) {
    await checkProviderCommand(providerConfig);
  }

  // Handle --auto-detect
  if (options.autoDetect === true) {
    const detectedProvider = await autoDetectCommand();

    if (detectedProvider !== null) {
      // Override providerConfig with detected provider instance
      providerConfig = detectedProvider as unknown as ProviderConfig;
    }
  }

  // Handle provider fallback chain
  const providerChain = buildProviderChain(providerConfig, options.fallback);

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
    const task = createTaskFromGitStatus(gitStatus.statusLines, gitStatus.stagedFiles);

    // Generate commit message
    const spinner =
      options.messageOnly === true ? null : ora('Generating commit message with AI...').start();

    const generator = new CommitMessageGenerator({
      enableAI: options.ai,
      provider: providerChain === undefined ? providerConfig : undefined,
      providerChain,
      // Backward compatibility with deprecated flags
      aiCommand:
        providerConfig === undefined && providerChain === undefined ? options.aiCommand : undefined,
      aiTimeout:
        providerConfig === undefined && providerChain === undefined
          ? Number.parseInt(options.timeout, 10)
          : undefined,
      signature: options.signature,
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
      workdir: options.cwd,
      files: gitStatus.stagedFiles,
    });

    if (spinner !== null) {
      spinner.succeed('Generated commit message');
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

// Run CLI
await main();
