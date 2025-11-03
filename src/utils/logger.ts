/**
 * Logger utilities for commitment
 *
 * Provides simple logging interface with console and silent implementations.
 */

import chalk from 'chalk';

/**
 * Logger interface for logging messages at different levels
 *
 * @example
 * ```typescript
 * const logger: Logger = new ConsoleLogger();
 * logger.debug('Debug message');
 * logger.info('Info message');
 * logger.warn('Warning message');
 * logger.error('Error message');
 * ```
 */
export interface Logger {
  /**
   * Log debug-level message (typically for development)
   */
  debug(message: string): void;

  /**
   * Log informational message
   */
  info(message: string): void;

  /**
   * Log warning message
   */
  warn(message: string): void;

  /**
   * Log error message
   */
  error(message: string): void;
}

/**
 * Console-based logger implementation with chalk formatting
 *
 * @example
 * ```typescript
 * const logger = new ConsoleLogger();
 * logger.warn('This will be yellow');
 * ```
 */
export class ConsoleLogger implements Logger {
  debug(message: string): void {
    console.log(chalk.gray(message));
  }

  info(message: string): void {
    console.log(message);
  }

  warn(message: string): void {
    console.warn(chalk.yellow(message));
  }

  error(message: string): void {
    console.error(chalk.red(message));
  }
}

/**
 * Silent logger implementation (all methods are no-ops)
 *
 * Useful for testing or when logging should be suppressed.
 *
 * @example
 * ```typescript
 * const logger = new SilentLogger();
 * logger.error('This will not be logged');
 * ```
 */
export class SilentLogger implements Logger {
  debug(_message: string): void {
    // No-op
  }

  info(_message: string): void {
    // No-op
  }

  warn(_message: string): void {
    // No-op
  }

  error(_message: string): void {
    // No-op
  }
}
