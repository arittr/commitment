/**
 * Provider abstraction layer for AI-powered commit message generation
 * Supports multiple AI providers (CLI and API-based) with automatic fallback
 */

// Auto-detection utilities
export { detectAvailableProvider, getAllAvailableProviders } from './auto-detect';
// Base classes for provider implementations
export { BaseAPIProvider } from './base/base-api-provider';

export { BaseCLIProvider } from './base/base-cli-provider';

// Error types and utilities
export {
  ProviderAPIError,
  ProviderError,
  ProviderNotAvailableError,
  ProviderTimeoutError,
  isProviderAPIError,
  isProviderError,
  isProviderNotAvailableError,
  isProviderTimeoutError,
} from './errors';

// Concrete provider implementations
export { ClaudeProvider } from './implementations/claude-provider';

// Provider chain for fallback support
export {
  ProviderChain,
  ProviderChainError,
  formatProviderChainError,
  isProviderChainError,
} from './provider-chain';

// Factory for creating provider instances
export { ProviderNotImplementedError, createProvider, createProviders } from './provider-factory';

// Core types and interfaces
export type {
  AIProvider,
  APIProviderConfig,
  CLIProviderConfig,
  GenerateOptions,
  ProviderConfig,
} from './types';

export {
  ProviderType,
  apiProviderSchema,
  cliProviderSchema,
  isAPIProviderConfig,
  isCLIProviderConfig,
  providerConfigSchema,
  validateProviderConfig,
} from './types';
