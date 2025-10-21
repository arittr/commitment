/**
 * Legacy error exports for backward compatibility
 *
 * This module re-exports the consolidated error system for legacy provider code.
 * These exports will be removed in Task 7 when legacy provider files are deleted.
 *
 * @deprecated Use AgentError and GeneratorError from '../errors.js' instead
 */

import { AgentError } from '../errors.js';

/**
 * @deprecated Use AgentError instead
 */
export class ProviderError extends Error {
  public override readonly name: string = 'ProviderError';
  public readonly providerName: string;
  public override readonly cause?: Error;

  constructor(message: string, providerName: string, cause?: Error) {
    super(message);
    this.providerName = providerName;
    this.cause = cause;
    Object.setPrototypeOf(this, ProviderError.prototype);
  }
}

/**
 * @deprecated Use AgentError.cliNotFound() instead
 */
export class ProviderNotAvailableError extends ProviderError {
  public override readonly name = 'ProviderNotAvailableError';

  constructor(providerName: string, reason: string, cause?: Error) {
    super(`Provider '${providerName}' is not available: ${reason}`, providerName, cause);
    Object.setPrototypeOf(this, ProviderNotAvailableError.prototype);
  }
}

/**
 * @deprecated Use AgentError.executionFailed() instead
 */
export class ProviderTimeoutError extends ProviderError {
  public override readonly name = 'ProviderTimeoutError';
  public readonly timeoutMs: number;

  constructor(providerName: string, timeoutMs: number, operation: string, cause?: Error) {
    super(
      `Provider '${providerName}' operation '${operation}' timed out after ${timeoutMs}ms`,
      providerName,
      cause,
    );
    this.timeoutMs = timeoutMs;
    Object.setPrototypeOf(this, ProviderTimeoutError.prototype);
  }
}

/**
 * @deprecated Use AgentError.executionFailed() instead
 */
export class ProviderAPIError extends ProviderError {
  public override readonly name = 'ProviderAPIError';
  public readonly statusCode?: number;
  public readonly apiMessage?: string;

  constructor(providerName: string, statusCode?: number, apiMessage?: string, cause?: Error) {
    const details = [statusCode !== undefined ? `status ${statusCode}` : null, apiMessage].filter(
      Boolean,
    );

    const detailsMessage = details.length > 0 ? `: ${details.join(' - ')}` : '';

    super(`Provider '${providerName}' API error${detailsMessage}`, providerName, cause);
    this.statusCode = statusCode;
    this.apiMessage = apiMessage;
    Object.setPrototypeOf(this, ProviderAPIError.prototype);
  }
}

/**
 * @deprecated Use isAgentError() instead
 */
export function isProviderError(error: unknown): error is ProviderError {
  return error instanceof ProviderError || error instanceof AgentError;
}

/**
 * @deprecated Use isAgentError() instead
 */
export function isProviderNotAvailableError(error: unknown): error is ProviderNotAvailableError {
  return error instanceof ProviderNotAvailableError;
}

/**
 * @deprecated Use isAgentError() instead
 */
export function isProviderTimeoutError(error: unknown): error is ProviderTimeoutError {
  return error instanceof ProviderTimeoutError;
}

/**
 * @deprecated Use isAgentError() instead
 */
export function isProviderAPIError(error: unknown): error is ProviderAPIError {
  return error instanceof ProviderAPIError;
}
