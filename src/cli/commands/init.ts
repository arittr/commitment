/* eslint-disable no-console, unicorn/no-process-exit */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import chalk from 'chalk';
import { execa } from 'execa';

import type { AgentName } from '../../agents/types';

type HookManager = 'husky' | 'simple-git-hooks' | 'plain';

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
  exec < /dev/tty && npx commitment${agentFlag} --message-only > "$1"
fi
`,
    plain: `#!/bin/sh
# Git prepare-commit-msg hook for commitment
# Only run for regular commits (not merge, squash, etc.)
if [ -z "$2" ]; then
  npx commitment${agentFlag} --message-only > "$1"
fi
`,
    simpleGitHooks: `#!/bin/sh
# simple-git-hooks prepare-commit-msg hook for commitment
# Only run for regular commits (not merge, squash, or when message specified)
if [ -z "$2" ]; then
  npx commitment${agentFlag} --message-only > "$1"
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
async function installHuskyHook(cwd: string, agent?: AgentName): Promise<void> {
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

  console.log(chalk.green('✅ Installed prepare-commit-msg hook with husky'));
  console.log(chalk.gray(`   Location: ${hookPath}`));
}

/**
 * Install simple-git-hooks configuration
 */
async function installSimpleGitHooks(cwd: string, agent?: AgentName): Promise<void> {
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
      `[ -z "$2" ] && npx commitment${agentFlag} --message-only > $1 || exit 0`;

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

    console.log(chalk.green('✅ Configured simple-git-hooks in package.json'));
    console.log(chalk.yellow('\n⚠️  Run the following to activate hooks:'));
    console.log(chalk.cyan('   npm install'));
    console.log(chalk.cyan('   npm run prepare'));
  } catch (error) {
    throw new Error(
      `Failed to configure simple-git-hooks: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Install plain git hook
 */
async function installPlainGitHook(cwd: string, agent?: AgentName): Promise<void> {
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

  console.log(chalk.green('✅ Installed prepare-commit-msg hook'));
  console.log(chalk.gray(`   Location: ${hookPath}`));
}

/**
 * Initialize commitment hooks
 */
export async function initCommand(options: InitOptions): Promise<void> {
  const { hookManager: specifiedManager, cwd } = options;

  try {
    // Verify we're in a git repository
    try {
      await execa('git', ['rev-parse', '--git-dir'], { cwd });
    } catch {
      console.error(chalk.red('❌ Not a git repository'));
      console.log(chalk.gray('   Run `git init` first'));
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
        console.log(chalk.cyan(`🔍 Detected ${detected} hook manager`));
      } else {
        // Default to plain git hooks if nothing detected
        hookManager = 'plain';
        console.log(chalk.cyan('📝 No hook manager detected, using plain git hooks'));
      }
    }

    console.log('');

    // Install appropriate hook
    switch (hookManager) {
      case 'husky': {
        await installHuskyHook(cwd, options.agent);
        break;
      }
      case 'simple-git-hooks': {
        await installSimpleGitHooks(cwd, options.agent);
        break;
      }
      case 'plain': {
        await installPlainGitHook(cwd, options.agent);
        break;
      }
    }

    // Print next steps
    console.log('');
    console.log(chalk.green('🎉 Setup complete!'));
    console.log('');
    console.log(chalk.cyan('Next steps:'));
    console.log(chalk.white('  1. Stage your changes: ') + chalk.gray('git add .'));
    console.log(chalk.white('  2. Create a commit:    ') + chalk.gray('git commit'));
    console.log('');
    console.log(chalk.gray('The commit message will be generated automatically!'));
  } catch (error) {
    console.error(
      chalk.red('❌ Failed to initialize hooks:'),
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}
