import type { AIProvider, APIProviderConfig, GenerateOptions } from './types';

import { ProviderAPIError, ProviderTimeoutError } from './errors';
import { ProviderType } from './types';

/**
 * Abstract base class for API-based AI providers (OpenAI, Gemini)
 * Provides common utilities for HTTP requests, timeout handling, and error management
 */
export abstract class BaseAPIProvider implements AIProvider {
  protected readonly config: APIProviderConfig;
  protected readonly defaultTimeout: number;
  protected readonly apiKey: string;

  constructor(config: APIProviderConfig) {
    this.config = config;
    this.apiKey = config.apiKey;
    this.defaultTimeout = config.timeout ?? 30_000; // 30 seconds default
  }

  /**
   * Get the API endpoint URL
   * Default implementation returns config.endpoint if provided
   * Override this to provide provider-specific default endpoints
   */
  protected getEndpoint(): string {
    if (this.config.endpoint === undefined) {
      throw new Error(
        `API endpoint not configured for provider '${this.getName()}'. Either provide endpoint in config or override getEndpoint()`,
      );
    }
    return this.config.endpoint;
  }

  /**
   * Make an HTTP request with timeout and error handling
   * Helper utility for subclasses to use in their API implementations
   */
  protected async makeRequest<T>(url: string, options: RequestInit, timeout: number): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unable to read error response');
        throw new ProviderAPIError(
          this.getName(),
          response.status,
          errorBody,
          new Error(`HTTP ${response.status}: ${response.statusText}`),
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle abort (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ProviderTimeoutError(this.getName(), timeout, 'API request', error);
      }

      // Re-throw provider errors as-is
      if (error instanceof ProviderAPIError || error instanceof ProviderTimeoutError) {
        throw error;
      }

      // Wrap other errors
      throw new ProviderAPIError(
        this.getName(),
        undefined,
        error instanceof Error ? error.message : 'Unknown API error',
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Get the human-readable name of this provider
   */
  abstract getName(): string;

  /**
   * Generate a commit message using the API provider
   * Must be implemented by each provider with their specific API format
   */
  abstract generateCommitMessage(prompt: string, options: GenerateOptions): Promise<string>;

  /**
   * Check if this provider is available and configured correctly
   * Default implementation checks if API key is present
   * Override this to add provider-specific health checks
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async isAvailable(): Promise<boolean> {
    return this.apiKey.length > 0;
  }

  /**
   * Get the provider type (always API for this base class)
   */
  getProviderType(): ProviderType {
    return ProviderType.API;
  }
}
