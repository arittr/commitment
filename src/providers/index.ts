/**
 * Provider abstraction layer for AI-powered commit message generation
 * Supports multiple AI providers (CLI and API-based) with automatic fallback
 */

// Base classes for provider implementations
export { BaseAPIProvider } from './base-api-provider';
export { BaseCLIProvider } from './base-cli-provider';

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
