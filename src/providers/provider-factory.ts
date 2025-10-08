import { match } from 'ts-pattern';

import type { AIProvider, ProviderConfig } from './types';

import { ClaudeProvider } from './claude-provider';

/**
 * Error thrown when trying to create a provider that is not yet implemented
 */
export class ProviderNotImplementedError extends Error {
  constructor(
    public readonly providerName: string,
    public readonly providerType: string,
  ) {
    super(
      `Provider '${providerName}' (${providerType}) is not yet implemented. ` +
        `Please use a different provider or contribute an implementation.`,
    );
    this.name = 'ProviderNotImplementedError';
    Object.setPrototypeOf(this, ProviderNotImplementedError.prototype);
  }
}

/**
 * Factory function to create an AI provider instance from configuration
 * Uses ts-pattern for exhaustive type-safe matching on discriminated union
 *
 * @param config - Provider configuration (discriminated by 'type' field)
 * @returns AIProvider instance
 * @throws ProviderNotImplementedError if provider is not yet implemented
 *
 * @example
 * ```typescript
 * const provider = createProvider({
 *   type: 'cli',
 *   provider: 'claude',
 *   timeout: 30000
 * });
 * ```
 */
export function createProvider(config: ProviderConfig): AIProvider {
  return (
    match(config)
      // CLI Providers
      .with({ type: 'cli', provider: 'claude' }, (cfg) => {
        return new ClaudeProvider({
          command: cfg.command,
          args: cfg.args,
          timeout: cfg.timeout,
        });
      })
      .with({ type: 'cli', provider: 'codex' }, (cfg) => {
        // TODO: Import and instantiate CodexProvider once implemented
        throw new ProviderNotImplementedError(cfg.provider, cfg.type);
      })
      .with({ type: 'cli', provider: 'cursor' }, (cfg) => {
        // TODO: Import and instantiate CursorProvider once implemented
        throw new ProviderNotImplementedError(cfg.provider, cfg.type);
      })
      // API Providers
      .with({ type: 'api', provider: 'openai' }, (cfg) => {
        // TODO: Import and instantiate OpenAIProvider once implemented
        throw new ProviderNotImplementedError(cfg.provider, cfg.type);
      })
      .with({ type: 'api', provider: 'gemini' }, (cfg) => {
        // TODO: Import and instantiate GeminiProvider once implemented
        throw new ProviderNotImplementedError(cfg.provider, cfg.type);
      })
      .exhaustive()
  );
}

/**
 * Create multiple providers from an array of configurations
 * Useful for setting up fallback chains
 */
export function createProviders(configs: ProviderConfig[]): AIProvider[] {
  return configs.map((config) => createProvider(config));
}
