import chalk from 'chalk';
import { program } from 'commander';
import { execa } from 'execa';
import ora from 'ora';
import { ZodError } from 'zod';

import type { CLIProviderConfig, ProviderConfig } from './providers/index';

import {
  autoDetectCommand,
  checkProviderCommand,
  listProvidersCommand,
} from './cli/commands/index';
import { formatValidationError, parseProviderConfigJson, validateCliOptions } from './cli/schemas';
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
    .option('--list-providers', 'List all available AI providers')
    .option('--check-provider', 'Check if selected provider is available')
    .option('--auto-detect', 'Auto-detect first available AI provider')
    .option('--fallback <provider...>', 'Fallback providers (can specify multiple)')
    .parse();

  const rawOptions = program.opts<{
    ai: boolean;
    autoDetect?: boolean;
    checkProvider?: boolean;
    cwd: string;
    dryRun?: boolean;
    fallback?: string[];
    listProviders?: boolean;
    messageOnly?: boolean;
    provider?: string;
    providerConfig?: string;
    signature?: string;
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
    // Build config from provider name
    const providerName = options.provider.toLowerCase();

    if (providerName === 'claude') {
      providerConfig = {
        type: 'cli',
        provider: 'claude',
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
      title: 'Code changes',
      description: 'Analyze git diff to generate appropriate commit message',
      produces: gitStatus.stagedFiles,
    };

    // Generate commit message
    const spinner =
      options.messageOnly === true ? null : ora('Generating commit message with AI...').start();

    // Map provider config to agent name (simplified)
    let agentName: 'claude' | 'codex' = 'claude';
    if (providerConfig !== undefined && 'provider' in providerConfig) {
      agentName = providerConfig.provider === 'codex' ? 'codex' : 'claude';
    }

    const generator = new CommitMessageGenerator({
      enableAI: options.ai,
      agent: agentName,
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
