import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { APIProviderConfig, GenerateOptions } from '../types';

import { BaseAPIProvider } from '../base/base-api-provider';
import { ProviderAPIError, ProviderTimeoutError } from '../errors';
import { ProviderType } from '../types';

// Concrete test implementation
class TestAPIProvider extends BaseAPIProvider {
  constructor(config: APIProviderConfig) {
    super(config);
  }

  getName(): string {
    return 'TestAPIProvider';
  }

  async generateCommitMessage(prompt: string, options: GenerateOptions): Promise<string> {
    const response = await this.makeRequest<{ message: string }>(
      this.getEndpoint(),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ prompt }),
      },
      options.timeout ?? this.defaultTimeout,
    );
    return response.message;
  }

  // Expose for testing
  getEndpointPublic(): string {
    return this.getEndpoint();
  }

  async makeRequestPublic<T>(url: string, options: RequestInit, timeout: number): Promise<T> {
    return this.makeRequest<T>(url, options, timeout);
  }
}

describe('BaseAPIProvider', () => {
  const mockConfig: APIProviderConfig = {
    type: 'api',
    provider: 'openai',
    apiKey: 'test-api-key',
    endpoint: 'https://api.test.com/v1',
    timeout: 5000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with config', () => {
      const provider = new TestAPIProvider(mockConfig);
      expect(provider.getName()).toBe('TestAPIProvider');
    });

    it('should use default timeout (30s) if not configured', () => {
      const configWithoutTimeout: APIProviderConfig = {
        type: 'api',
        provider: 'openai',
        apiKey: 'test-key',
        endpoint: 'https://api.test.com',
      };
      const provider = new TestAPIProvider(configWithoutTimeout);

      // Access protected field via any cast for testing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access -- Need to access protected property defaultTimeout to verify constructor behavior
      expect((provider as any).defaultTimeout).toBe(30_000);
    });
  });

  describe('getEndpoint', () => {
    it('should return configured endpoint', () => {
      const provider = new TestAPIProvider(mockConfig);
      expect(provider.getEndpointPublic()).toBe('https://api.test.com/v1');
    });

    it('should throw error if endpoint is not configured', () => {
      const configWithoutEndpoint: APIProviderConfig = {
        type: 'api',
        provider: 'openai',
        apiKey: 'test-key',
      };
      const provider = new TestAPIProvider(configWithoutEndpoint);

      expect(() => provider.getEndpointPublic()).toThrow(
        /API endpoint not configured for provider 'TestAPIProvider'/,
      );
    });
  });

  describe('makeRequest', () => {
    it('should successfully make HTTP request', async () => {
      const provider = new TestAPIProvider(mockConfig);
      const mockResponse = { data: 'test data' };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await provider.makeRequestPublic<{ data: string }>(
        'https://api.test.com/endpoint',
        { method: 'POST' },
        5000,
      );

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/endpoint',
        expect.objectContaining({
          method: 'POST',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Vitest expect.any() returns 'any' type, but this is the correct way to assert signal type
          signal: expect.any(AbortSignal),
        }),
      );
    });

    it('should throw ProviderTimeoutError on timeout', async () => {
      const provider = new TestAPIProvider(mockConfig);

      global.fetch = vi.fn().mockImplementation(async () => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            const error = new Error('Timeout');
            error.name = 'AbortError';
            reject(error);
          }, 100);
        });
      });

      await expect(provider.makeRequestPublic('https://api.test.com', {}, 50)).rejects.toThrow(
        ProviderTimeoutError,
      );

      try {
        await provider.makeRequestPublic('https://api.test.com', {}, 50);
      } catch (error) {
        if (error instanceof ProviderTimeoutError) {
          expect(error.timeoutMs).toBe(50);
          expect(error.providerName).toBe('TestAPIProvider');
        }
      }
    });

    it('should throw ProviderAPIError on HTTP error response', async () => {
      const provider = new TestAPIProvider(mockConfig);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid API key',
      });

      await expect(provider.makeRequestPublic('https://api.test.com', {}, 5000)).rejects.toThrow(
        ProviderAPIError,
      );

      try {
        await provider.makeRequestPublic('https://api.test.com', {}, 5000);
      } catch (error) {
        if (error instanceof ProviderAPIError) {
          expect(error.statusCode).toBe(401);
          expect(error.apiMessage).toBe('Invalid API key');
          expect(error.providerName).toBe('TestAPIProvider');
        }
      }
    });

    it('should handle error response body read failure', async () => {
      const provider = new TestAPIProvider(mockConfig);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => {
          throw new Error('Cannot read response');
        },
      });

      await expect(provider.makeRequestPublic('https://api.test.com', {}, 5000)).rejects.toThrow(
        ProviderAPIError,
      );

      try {
        await provider.makeRequestPublic('https://api.test.com', {}, 5000);
      } catch (error) {
        if (error instanceof ProviderAPIError) {
          expect(error.apiMessage).toBe('Unable to read error response');
        }
      }
    });

    it('should wrap generic errors in ProviderAPIError', async () => {
      const provider = new TestAPIProvider(mockConfig);

      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(provider.makeRequestPublic('https://api.test.com', {}, 5000)).rejects.toThrow(
        ProviderAPIError,
      );
    });
  });

  describe('isAvailable', () => {
    it('should return true if API key is present', async () => {
      const provider = new TestAPIProvider(mockConfig);
      const result = await provider.isAvailable();
      expect(result).toBe(true);
    });

    it('should return false if API key is empty', async () => {
      const configWithEmptyKey: APIProviderConfig = {
        type: 'api',
        provider: 'openai',
        apiKey: '',
        endpoint: 'https://api.test.com',
      };
      const provider = new TestAPIProvider(configWithEmptyKey);
      const result = await provider.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('getProviderType', () => {
    it('should return API provider type', () => {
      const provider = new TestAPIProvider(mockConfig);
      expect(provider.getProviderType()).toBe(ProviderType.API);
    });
  });

  describe('generateCommitMessage integration', () => {
    it('should successfully generate message via API', async () => {
      const provider = new TestAPIProvider(mockConfig);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'feat: add new feature' }),
      });

      const result = await provider.generateCommitMessage('test prompt', {});

      expect(result).toBe('feat: add new feature');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/v1',
        expect.objectContaining({
          method: 'POST',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Vitest expect.objectContaining() returns 'any' type for headers, but this is the correct assertion pattern
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-api-key',
          }),
          body: JSON.stringify({ prompt: 'test prompt' }),
        }),
      );
    });

    it('should use custom timeout from options', async () => {
      const provider = new TestAPIProvider(mockConfig);

      // Mock a slow response that takes 200ms
      global.fetch = vi.fn().mockImplementation(async () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({ message: 'success' }),
            });
          }, 200);
        });
      });

      // Should succeed with 1000ms timeout
      const result = await provider.generateCommitMessage('prompt', { timeout: 1000 });
      expect(result).toBe('success');
    });
  });
});
