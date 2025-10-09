/* eslint-disable no-console, unicorn/no-process-exit */
import chalk from 'chalk';

import type { ProviderConfig } from '../../providers/index';

import { createProvider } from '../../providers/index';

/**
 * Check if a provider is available and properly configured
 *
 * Tests whether the specified provider can be instantiated and is available
 * for use. Exits with status 0 if available, 1 if not.
 *
 * @param providerConfig - Provider configuration to check (optional, defaults to Claude)
 *
 * @example
 * ```typescript
 * // Check default Claude provider
 * await checkProviderCommand();
 *
 * // Check specific provider
 * await checkProviderCommand({
 *   type: 'cli',
 *   provider: 'codex'
 * });
 * ```
 */
export async function checkProviderCommand(providerConfig?: ProviderConfig): Promise<void> {
  try {
    const provider =
      providerConfig !== undefined
        ? createProvider(providerConfig)
        : createProvider({ type: 'cli', provider: 'claude' });

    const isAvailable = await provider.isAvailable();

    if (isAvailable) {
      console.log(chalk.green(`✅ Provider '${provider.getName()}' is available`));
      process.exit(0);
    } else {
      console.log(chalk.red(`❌ Provider '${provider.getName()}' is not available`));
      console.log(chalk.gray('   Make sure the CLI tool is installed and in your PATH'));
      process.exit(1);
    }
  } catch (error) {
    console.error(
      chalk.red('❌ Error checking provider:'),
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}
