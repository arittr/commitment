/* eslint-disable no-console */
import chalk from 'chalk';

import type { AIProvider } from '../../providers/index';

import { detectAvailableProvider } from '../../providers/index';

/**
 * Auto-detect the first available AI provider
 *
 * Attempts to detect and return the first available AI provider
 * from the list of supported providers.
 *
 * @returns Detected provider instance, or null if none available
 *
 * @example
 * ```typescript
 * const provider = await autoDetectCommand();
 *
 * if (provider !== null) {
 *   console.log('Using provider:', provider.getName());
 * } else {
 *   console.log('No providers available');
 * }
 * ```
 */
export async function autoDetectCommand(): Promise<AIProvider | null> {
  const detectedProvider = await detectAvailableProvider();

  if (detectedProvider !== null) {
    console.log(chalk.green(`✅ Auto-detected provider: ${detectedProvider.getName()}`));
    return detectedProvider;
  }
  console.log(chalk.yellow('⚠️ No AI providers detected, will use rule-based generation'));
  return null;
}
