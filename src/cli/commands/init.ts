/* eslint-disable no-console, unicorn/no-process-exit */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import chalk from 'chalk';

import type { AgentName } from '../../agents/types';
import type { Logger } from '../../utils/logger';
import { exec } from '../../utils/shell';

type HookManager = 'husky' | 'simple-git-hooks' | 'lefthook' | 'plain';

type InitOptions = {
  cwd: string;
  hookManager?: HookManager;
  agent?: AgentName;
};

/**
 * Generate hook content with optional agent parameter
 */
function generateHookContent(
  hookType: 'husky' | 'plain' | 'simpleGitHooks',
  agent?: AgentName
): string {
  const agentFlag = agent ? ` --agent ${agent}` : '';

  const templates = {
    husky: `#!/bin/sh
# Husky prepare-commit-msg hook for commitment
# This hook generates commit messages using AI before you edit them

# Only run for regular commits (not merge, squash, etc.)
if [ -z "$2" ]; then
  echo "🤖 Generating commit message..." > /dev/tty 2>/dev/null || true
  exec < /dev/tty && npx @arittr/commitment${agentFlag} --message-only > "$1" || true
fi
`,
    plain: `#!/bin/sh
# Git prepare-commit-msg hook for commitment
# Only run for regular commits (not merge, squash, etc.)
if [ -z "$2" ]; then
  echo "🤖 Generating commit message..." > /dev/tty 2>/dev/null || true
  npx @arittr/commitment${agentFlag} --message-only > "$1" || true
fi
`,
    simpleGitHooks: `#!/bin/sh
# simple-git-hooks prepare-commit-msg hook for commitment
# Only run for regular commits (not merge, squash, or when message specified)
if [ -z "$2" ]; then
  echo "🤖 Generating commit message..." > /dev/tty 2>/dev/null || true
  npx @arittr/commitment${agentFlag} --message-only > "$1" || true
fi
`,
  };

  return templates[hookType];
}

/**
 * Detect which hook manager is being used in the project
 */
async function detectHookManager(cwd: string): Promise<HookManager | null> {
  try {
    // Check for lefthook
    const lefthookConfigFiles = [
      'lefthook.yml',
      '.lefthook.yml',
      'lefthook.yaml',
      '.lefthook.yaml',
    ];
    for (const configFile of lefthookConfigFiles) {
      try {
        const configPath = path.join(cwd, configFile);
        await fs.access(configPath);
        return 'lefthook';
      } catch {
        // Config file doesn't exist, continue checking
      }
    }

    // Check for husky
    const huskyDir = path.join(cwd, '.husky');
    try {
      const stats = await fs.stat(huskyDir);
      if (stats.isDirectory()) {
        return 'husky';
      }
    } catch {
      // Not husky, continue checking
    }

    // Check for simple-git-hooks in package.json
    const packageJsonPath = path.join(cwd, 'package.json');
    try {
      const packageJsonBuffer = await fs.readFile(packageJsonPath);
      const packageJson = JSON.parse(packageJsonBuffer.toString()) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        simpleGitHooks?: unknown;
      };

      const hasSimpleGitHooksConfig = packageJson.simpleGitHooks !== undefined;
      const hasSimpleGitHooksDevelopmentDependency =
        packageJson.devDependencies?.['simple-git-hooks'] !== undefined;
      const hasSimpleGitHooksDependency =
        packageJson.dependencies?.['simple-git-hooks'] !== undefined;

      if (
        hasSimpleGitHooksConfig ||
        hasSimpleGitHooksDevelopmentDependency ||
        hasSimpleGitHooksDependency
      ) {
        return 'simple-git-hooks';
      }
    } catch {
      // Cannot read package.json, continue
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Install husky hook
 */
async function installHuskyHook(
  cwd: string,
  agent: AgentName | undefined,
  logger: Logger
): Promise<void> {
  const huskyDir = path.join(cwd, '.husky');
  const hookPath = path.join(huskyDir, 'prepare-commit-msg');

  // Ensure .husky directory exists
  try {
    await fs.mkdir(huskyDir, { recursive: true });
  } catch (error) {
    throw new Error(
      `Failed to create .husky directory: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Write hook file
  await fs.writeFile(hookPath, generateHookContent('husky', agent), 'utf8');

  // Make executable (Unix-like systems)
  if (process.platform !== 'win32') {
    await fs.chmod(hookPath, 0o755);
  }

  logger.info(chalk.green('✅ Installed prepare-commit-msg hook with husky'));
  logger.info(chalk.gray(`   Location: ${hookPath}`));
}

/**
 * Install simple-git-hooks configuration
 */
async function installSimpleGitHooks(
  cwd: string,
  agent: AgentName | undefined,
  logger: Logger
): Promise<void> {
  const packageJsonPath = path.join(cwd, 'package.json');

  try {
    const packageJsonBuffer = await fs.readFile(packageJsonPath);
    const packageJson = JSON.parse(packageJsonBuffer.toString()) as {
      scripts?: Record<string, string>;
      simpleGitHooks?: Record<string, string>;
    };

    // Add simple-git-hooks configuration
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    if (packageJson.simpleGitHooks === undefined) {
      packageJson.simpleGitHooks = {};
    }
    const agentFlag = agent ? ` --agent ${agent}` : '';
    packageJson.simpleGitHooks['prepare-commit-msg'] =
      `[ -z "$2" ] && npx @arittr/commitment${agentFlag} --message-only > $1`;

    // Add prepare script if not present
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    if (packageJson.scripts === undefined) {
      packageJson.scripts = {};
    }
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    if (packageJson.scripts.prepare === undefined) {
      packageJson.scripts.prepare = 'simple-git-hooks';
    }

    // Write updated package.json
    await fs.writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');

    logger.info(chalk.green('✅ Configured simple-git-hooks in package.json'));
    logger.warn('\n⚠️  Run the following to activate hooks:');
    logger.info(chalk.cyan('   npm install'));
    logger.info(chalk.cyan('   npm run prepare'));
  } catch (error) {
    throw new Error(
      `Failed to configure simple-git-hooks: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Install plain git hook
 */
async function installPlainGitHook(
  cwd: string,
  agent: AgentName | undefined,
  logger: Logger
): Promise<void> {
  // Find .git directory
  let gitDir = path.join(cwd, '.git');

  // Check if .git is a file (git worktree)
  try {
    const gitStat = await fs.stat(gitDir);
    if (gitStat.isFile()) {
      const gitFileContent = await fs.readFile(gitDir, 'utf8');
      const match = /gitdir:\s*(.+)/i.exec(gitFileContent);
      const gitDirPath = match?.[1];
      if (gitDirPath !== undefined) {
        gitDir = path.resolve(cwd, gitDirPath.trim());
      }
    }
  } catch {
    throw new Error('Not a git repository (or any of the parent directories)');
  }

  const hooksDir = path.join(gitDir, 'hooks');
  const hookPath = path.join(hooksDir, 'prepare-commit-msg');

  // Ensure hooks directory exists
  try {
    await fs.mkdir(hooksDir, { recursive: true });
  } catch (error) {
    throw new Error(
      `Failed to create hooks directory: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Write hook file
  await fs.writeFile(hookPath, generateHookContent('plain', agent), 'utf8');

  // Make executable (Unix-like systems)
  if (process.platform !== 'win32') {
    await fs.chmod(hookPath, 0o755);
  }

  logger.info(chalk.green('✅ Installed prepare-commit-msg hook'));
  logger.info(chalk.gray(`   Location: ${hookPath}`));
}

/**
 * Install lefthook configuration
 */
async function installLefthookConfig(
  cwd: string,
  agent: AgentName | undefined,
  logger: Logger
): Promise<void> {
  const lefthookConfigPath = path.join(cwd, 'lefthook.yml');

  // Check if lefthook.yml already exists
  let existingConfig = '';
  try {
    existingConfig = await fs.readFile(lefthookConfigPath, 'utf8');
  } catch {
    // File doesn't exist, we'll create it
  }

  const agentFlag = agent ? ` --agent ${agent}` : '';
  const prepareCommitMsgConfig = `prepare-commit-msg:
  skip:
    - merge
    - rebase
  commands:
    commitment:
      # Run for regular commits only
      # {1} is the commit message file path
      # {2} is commit source: "message" (from -m), "template", "merge", "squash", or "commit"
      # When no source (regular git commit), lefthook doesn't substitute {2}
      run: |
        # Only run if {2} contains curly braces (unsubstituted = regular commit)
        # Skip if {2} = "message", "template", etc. (user already provided message)
        case "{2}" in
          *"{"*)
            echo "🤖 Generating commit message..." > /dev/tty 2>/dev/null || true
            npx @arittr/commitment${agentFlag} --message-only > "{1}"
            ;;
        esac
      interactive: true
`;

  if (existingConfig !== '') {
    // File exists, check if it has prepare-commit-msg hook
    if (existingConfig.includes('prepare-commit-msg:')) {
      logger.warn('⚠️  lefthook.yml already has prepare-commit-msg hook');
      logger.info(chalk.gray('   Skipping configuration'));
      return;
    }

    // Append to existing config
    const updatedConfig = `${existingConfig.trimEnd()}\n\n${prepareCommitMsgConfig}`;
    await fs.writeFile(lefthookConfigPath, updatedConfig, 'utf8');
    logger.info(chalk.green('✅ Added commitment hook to existing lefthook.yml'));
  } else {
    // Create new file
    const newConfig = `# Lefthook configuration for commitment\n\n${prepareCommitMsgConfig}`;
    await fs.writeFile(lefthookConfigPath, newConfig, 'utf8');
    logger.info(chalk.green('✅ Created lefthook.yml with commitment hook'));
  }

  logger.info(chalk.gray(`   Location: ${lefthookConfigPath}`));
  logger.info('');
  logger.warn('⚠️  Run the following to activate hooks:');
  logger.info(chalk.cyan('   npx lefthook install'));
  logger.info(chalk.gray('   (or add "prepare": "lefthook install" to package.json scripts)'));
}

/**
 * Initialize commitment hooks
 */
export async function initCommand(options: InitOptions, logger: Logger): Promise<void> {
  const { hookManager: specifiedManager, cwd } = options;

  try {
    // Verify we're in a git repository
    try {
      await exec('git', ['rev-parse', '--git-dir'], { cwd });
    } catch {
      logger.error('❌ Not a git repository');
      logger.info(chalk.gray('   Run `git init` first'));
      process.exit(1);
    }

    let hookManager: HookManager;

    if (specifiedManager !== undefined) {
      // User specified a hook manager
      hookManager = specifiedManager;
    } else {
      // Auto-detect hook manager
      const detected = await detectHookManager(cwd);
      if (detected !== null) {
        hookManager = detected;
        logger.info(chalk.cyan(`🔍 Detected ${detected} hook manager`));
      } else {
        // Default to plain git hooks if nothing detected
        hookManager = 'plain';
        logger.info(chalk.cyan('📝 No hook manager detected, using plain git hooks'));
      }
    }

    logger.info('');

    // Install appropriate hook
    switch (hookManager) {
      case 'lefthook': {
        await installLefthookConfig(cwd, options.agent, logger);
        break;
      }
      case 'husky': {
        await installHuskyHook(cwd, options.agent, logger);
        break;
      }
      case 'simple-git-hooks': {
        await installSimpleGitHooks(cwd, options.agent, logger);
        break;
      }
      case 'plain': {
        await installPlainGitHook(cwd, options.agent, logger);
        break;
      }
    }

    // Print next steps
    logger.info('');
    logger.info(chalk.green('🎉 Setup complete!'));
    if (options.agent !== undefined) {
      logger.info(chalk.cyan(`   Default agent: ${options.agent}`));
    }
    logger.info('');
    logger.info(chalk.cyan('Next steps:'));
    logger.info(chalk.white('  1. Stage your changes: ') + chalk.gray('git add .'));
    logger.info(chalk.white('  2. Create a commit:    ') + chalk.gray('git commit'));
    logger.info('');
    logger.info(chalk.gray('The commit message will be generated automatically!'));
  } catch (error) {
    logger.error(
      chalk.red('❌ Failed to initialize hooks:') +
        ' ' +
        (error instanceof Error ? error.message : String(error))
    );
    process.exit(1);
  }
}
