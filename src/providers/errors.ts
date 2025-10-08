/**
 * Base error class for all provider-related errors
 */
export class ProviderError extends Error {
  public override readonly cause?: Error;

  constructor(
    message: string,
    public readonly providerName: string,
    cause?: Error,
  ) {
    super(message);
    this.name = 'ProviderError';
    this.cause = cause;
    Object.setPrototypeOf(this, ProviderError.prototype);
  }
}

/**
 * Error thrown when a provider is not available or cannot be initialized
 */
export class ProviderNotAvailableError extends ProviderError {
  constructor(providerName: string, reason: string, cause?: Error) {
    super(`Provider '${providerName}' is not available: ${reason}`, providerName, cause);
    this.name = 'ProviderNotAvailableError';
    Object.setPrototypeOf(this, ProviderNotAvailableError.prototype);
  }
}

/**
 * Error thrown when a provider operation times out
 */
export class ProviderTimeoutError extends ProviderError {
  constructor(
    providerName: string,
    public readonly timeoutMs: number,
    operation: string,
    cause?: Error,
  ) {
    super(
      `Provider '${providerName}' operation '${operation}' timed out after ${timeoutMs}ms`,
      providerName,
      cause,
    );
    this.name = 'ProviderTimeoutError';
    Object.setPrototypeOf(this, ProviderTimeoutError.prototype);
  }
}

/**
 * Error thrown when an API provider encounters an API-specific error
 */
export class ProviderAPIError extends ProviderError {
  constructor(
    providerName: string,
    public readonly statusCode?: number,
    public readonly apiMessage?: string,
    cause?: Error,
  ) {
    const details = [statusCode !== undefined ? `status ${statusCode}` : null, apiMessage].filter(
      Boolean,
    );

    const detailsMessage = details.length > 0 ? `: ${details.join(' - ')}` : '';

    super(`Provider '${providerName}' API error${detailsMessage}`, providerName, cause);
    this.name = 'ProviderAPIError';
    Object.setPrototypeOf(this, ProviderAPIError.prototype);
  }
}

/**
 * Type guard to check if an error is a ProviderError
 */
export function isProviderError(error: unknown): error is ProviderError {
  return error instanceof ProviderError;
}

/**
 * Type guard to check if an error is a ProviderNotAvailableError
 */
export function isProviderNotAvailableError(error: unknown): error is ProviderNotAvailableError {
  return error instanceof ProviderNotAvailableError;
}

/**
 * Type guard to check if an error is a ProviderTimeoutError
 */
export function isProviderTimeoutError(error: unknown): error is ProviderTimeoutError {
  return error instanceof ProviderTimeoutError;
}

/**
 * Type guard to check if an error is a ProviderAPIError
 */
export function isProviderAPIError(error: unknown): error is ProviderAPIError {
  return error instanceof ProviderAPIError;
}
