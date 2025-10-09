/* eslint-disable no-console, unicorn/no-process-exit */
import chalk from 'chalk';

import type { CLIProviderConfig, ProviderConfig } from '../providers/index';

/**
 * Build a provider chain from primary and fallback provider names
 *
 * Creates an array of provider configurations for fallback support.
 * Validates that all providers are implemented.
 *
 * @param mainProvider - Primary provider configuration (optional)
 * @param fallbackNames - Array of fallback provider names (optional)
 * @returns Array of provider configs, or undefined if no fallbacks specified
 *
 * @throws Exits process if a fallback provider is not yet implemented
 *
 * @example
 * ```typescript
 * const config = { type: 'cli', provider: 'claude' } as CLIProviderConfig;
 * const chain = buildProviderChain(config, ['codex']);
 * // Returns: [{ type: 'cli', provider: 'claude' }, { type: 'cli', provider: 'codex' }]
 * ```
 */
export function buildProviderChain(
  mainProvider: ProviderConfig | undefined,
  fallbackNames: string[] | undefined,
): ProviderConfig[] | undefined {
  if (fallbackNames === undefined || fallbackNames.length === 0) {
    return undefined;
  }

  // Build provider chain from --provider + --fallback flags
  const providers: ProviderConfig[] = [];

  // Add main provider if specified
  if (mainProvider !== undefined) {
    providers.push(mainProvider);
  }

  // Add fallback providers
  for (const fallbackName of fallbackNames) {
    const name = fallbackName.toLowerCase();

    if (name === 'claude') {
      providers.push({
        type: 'cli',
        provider: 'claude',
      } satisfies CLIProviderConfig);
    } else {
      console.error(chalk.red(`❌ Fallback provider '${name}' is not yet implemented`));
      console.log(chalk.gray('   Available providers: claude'));
      process.exit(1);
    }
  }

  if (providers.length > 0) {
    console.log(
      chalk.cyan(
        `📋 Provider fallback chain: ${providers.map((p) => (p as CLIProviderConfig).provider).join(' → ')}`,
      ),
    );
    return providers;
  }

  return undefined;
}
