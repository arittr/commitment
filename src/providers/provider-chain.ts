import type { AIProvider, GenerateOptions, ProviderType } from './types';

import { isProviderError } from './errors';

/**
 * Error thrown when all providers in a chain fail
 */
export class ProviderChainError extends Error {
  constructor(
    message: string,
    public readonly attemptedProviders: string[],
    public readonly errors: Error[],
  ) {
    super(message);
    this.name = 'ProviderChainError';
    Object.setPrototypeOf(this, ProviderChainError.prototype);
  }
}

/**
 * Provider implementation that chains multiple providers with fallback logic
 * Tries each provider in sequence until one succeeds
 *
 * @example
 * ```typescript
 * const chain = new ProviderChain([
 *   claudeProvider,
 *   openaiProvider,
 *   geminiProvider
 * ]);
 *
 * // Will try Claude first, fall back to OpenAI, then Gemini
 * const message = await chain.generateCommitMessage(prompt, options);
 * ```
 */
export class ProviderChain implements AIProvider {
  private readonly providers: AIProvider[];

  constructor(providers: AIProvider[]) {
    if (providers.length === 0) {
      throw new Error('ProviderChain requires at least one provider');
    }
    this.providers = providers;
  }

  /**
   * Generate commit message by trying each provider in sequence
   * Falls back to next provider if current one fails
   *
   * @throws ProviderChainError if all providers fail
   */
  async generateCommitMessage(prompt: string, options: GenerateOptions): Promise<string> {
    const errors: Error[] = [];
    const attemptedProviders: string[] = [];

    for (const provider of this.providers) {
      attemptedProviders.push(provider.getName());

      try {
        // Try this provider
        const result = await provider.generateCommitMessage(prompt, options);
        return result;
      } catch (error) {
        // Collect error and continue to next provider
        if (error instanceof Error) {
          errors.push(error);
        } else {
          errors.push(new Error(`Unknown error from provider ${provider.getName()}`));
        }

        // Continue to next provider
        continue;
      }
    }

    // All providers failed
    throw new ProviderChainError(
      `All ${this.providers.length} providers failed to generate commit message`,
      attemptedProviders,
      errors,
    );
  }

  /**
   * Check if any provider in the chain is available
   * Returns true as soon as one provider reports availability
   */
  async isAvailable(): Promise<boolean> {
    // Check providers in parallel for efficiency
    const availabilityPromises = this.providers.map(async (provider) => {
      try {
        const available = await provider.isAvailable();
        return { provider: provider.getName(), available };
      } catch {
        return { provider: provider.getName(), available: false };
      }
    });

    const results = await Promise.all(availabilityPromises);
    return results.some((result) => result.available);
  }

  /**
   * Get composite name listing all providers in the chain
   */
  getName(): string {
    const names = this.providers.map((p) => p.getName()).join(', ');
    return `ProviderChain[${names}]`;
  }

  /**
   * Get provider type of the first available provider
   * Falls back to first provider's type if none are available
   */
  getProviderType(): ProviderType {
    // Safe to access [0] because constructor validates non-empty array
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.providers[0]!.getProviderType();
  }

  /**
   * Get the ordered list of providers in this chain
   */
  getProviders(): readonly AIProvider[] {
    return [...this.providers];
  }

  /**
   * Get the number of providers in this chain
   */
  getProviderCount(): number {
    return this.providers.length;
  }
}

/**
 * Type guard to check if an error is a ProviderChainError
 */
export function isProviderChainError(error: unknown): error is ProviderChainError {
  return error instanceof ProviderChainError;
}

/**
 * Helper to format ProviderChainError for user-friendly display
 */
export function formatProviderChainError(error: ProviderChainError): string {
  const lines = [error.message, ''];

  for (let index = 0; index < error.attemptedProviders.length; index++) {
    const providerName = error.attemptedProviders[index];
    const providerError = error.errors[index];

    lines.push(`${index + 1}. ${providerName}:`);

    if (isProviderError(providerError)) {
      lines.push(`   ${providerError.message}`);
    } else {
      lines.push(`   ${providerError?.message ?? 'Unknown error'}`);
    }
  }

  return lines.join('\n');
}
