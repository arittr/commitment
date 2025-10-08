import type { AIProvider } from './types';

import { ClaudeProvider } from './claude-provider';

/**
 * Auto-detect the first available AI provider
 * Checks providers in priority order: Claude CLI -> (more to come)
 *
 * @returns The first available provider, or null if none are available
 *
 * @example
 * ```typescript
 * const provider = await detectAvailableProvider();
 * if (provider) {
 *   console.log(`Using ${provider.getName()}`);
 * } else {
 *   console.log('No AI providers available, using rule-based fallback');
 * }
 * ```
 */
export async function detectAvailableProvider(): Promise<AIProvider | null> {
  // Define providers to check in priority order
  const providersToCheck: AIProvider[] = [
    // 1. Claude CLI (currently the only implemented provider)
    new ClaudeProvider(),

    // Future providers will be added here:
    // new CodexProvider(),
    // new OpenAIAPIProvider() if process.env.OPENAI_API_KEY exists
    // new GeminiAPIProvider() if process.env.GEMINI_API_KEY exists
  ];

  // Check each provider in order
  for (const provider of providersToCheck) {
    try {
      const isAvailable = await provider.isAvailable();
      if (isAvailable) {
        return provider;
      }
    } catch {
      // Availability check failed, continue to next provider
      continue;
    }
  }

  // No providers available
  return null;
}

/**
 * Get all available providers (for creating a fallback chain)
 *
 * @returns Array of all available providers, in priority order
 *
 * @example
 * ```typescript
 * const providers = await getAllAvailableProviders();
 * if (providers.length > 0) {
 *   const chain = new ProviderChain(providers);
 * }
 * ```
 */
export async function getAllAvailableProviders(): Promise<AIProvider[]> {
  const providersToCheck: AIProvider[] = [
    new ClaudeProvider(),
    // More providers will be added as they're implemented
  ];

  const availableProviders: AIProvider[] = [];

  // Check all providers in parallel for efficiency
  const results = await Promise.allSettled(
    providersToCheck.map(async (provider) => ({
      provider,
      available: await provider.isAvailable(),
    })),
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.available) {
      availableProviders.push(result.value.provider);
    }
  }

  return availableProviders;
}
