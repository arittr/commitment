import { beforeEach, describe, expect, it, mock } from 'bun:test';
import chalk from 'chalk';

import { ConsoleLogger } from '../logger';

/**
 * Test that logger writes to correct output streams
 *
 * Critical for --message-only mode where stdout is captured for commit message
 * and logger output must go to stderr to avoid polluting the message.
 *
 * Previously, logger debug/info output was appearing in commit messages when using --message-only.
 */
describe('Logger output streams', () => {
  let consoleLogSpy: ReturnType<typeof mock>;
  let consoleErrorSpy: ReturnType<typeof mock>;
  let consoleWarnSpy: ReturnType<typeof mock>;

  beforeEach(() => {
    consoleLogSpy = mock(() => {});
    consoleErrorSpy = mock(() => {});
    consoleWarnSpy = mock(() => {});

    console.log = consoleLogSpy;
    console.error = consoleErrorSpy;
    console.warn = consoleWarnSpy;
  });

  describe('ConsoleLogger', () => {
    it('should write debug() to stderr, not stdout (when verbose)', () => {
      const logger = new ConsoleLogger({ verbose: true });
      const message = 'Debug message';

      logger.debug(message);

      // CRITICAL: debug must go to stderr to avoid polluting stdout in --message-only mode
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.gray(message));
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should write info() to stderr, not stdout', () => {
      const logger = new ConsoleLogger();
      const message = 'Info message';

      logger.info(message);

      // CRITICAL: info must go to stderr to avoid polluting stdout in --message-only mode
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(message);
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should write warn() to stderr', () => {
      const logger = new ConsoleLogger();
      const message = 'Warning message';

      logger.warn(message);

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(chalk.yellow(message));
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should write error() to stderr', () => {
      const logger = new ConsoleLogger();
      const message = 'Error message';

      logger.error(message);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.red(message));
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('Real-world scenario: --message-only mode', () => {
    it('should not pollute stdout when logger is used during message generation (verbose mode)', () => {
      const logger = new ConsoleLogger({ verbose: true });

      // Simulate BaseAgent.generate() calling logger during generation
      logger.debug('[claude] Starting commit message generation');
      logger.debug('[claude] Checking CLI availability');
      logger.debug('[claude] CLI is available');
      logger.debug('[claude] Executing command');
      logger.debug('[claude] Command executed, output length: 497');
      logger.debug('[claude] Cleaning response');
      logger.debug('[claude] Response cleaned, length: 445');
      logger.debug('[claude] Validating response format');
      logger.debug('[claude] Response validated successfully');

      // All debug output should go to stderr (when verbose)
      expect(consoleErrorSpy).toHaveBeenCalledTimes(9);

      // Stdout should be clean for commit message
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });
});
