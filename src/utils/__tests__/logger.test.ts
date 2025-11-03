import { beforeEach, describe, expect, it, mock } from 'bun:test';
import chalk from 'chalk';

import { ConsoleLogger, type Logger, SilentLogger } from '../logger';

describe('Logger', () => {
  describe('ConsoleLogger', () => {
    let consoleLogSpy: ReturnType<typeof mock>;
    let consoleWarnSpy: ReturnType<typeof mock>;
    let consoleErrorSpy: ReturnType<typeof mock>;

    beforeEach(() => {
      consoleLogSpy = mock(() => {});
      consoleWarnSpy = mock(() => {});
      consoleErrorSpy = mock(() => {});

      console.log = consoleLogSpy;
      console.warn = consoleWarnSpy;
      console.error = consoleErrorSpy;
    });

    it('should implement Logger interface', () => {
      const logger = new ConsoleLogger();
      expect(logger).toBeDefined();
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('should log debug messages with gray color', () => {
      const logger = new ConsoleLogger();
      const message = 'Debug message';

      logger.debug(message);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.gray(message));
    });

    it('should log info messages without color', () => {
      const logger = new ConsoleLogger();
      const message = 'Info message';

      logger.info(message);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(message);
    });

    it('should log warn messages with yellow color', () => {
      const logger = new ConsoleLogger();
      const message = 'Warning message';

      logger.warn(message);

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(chalk.yellow(message));
    });

    it('should log error messages with red color', () => {
      const logger = new ConsoleLogger();
      const message = 'Error message';

      logger.error(message);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.red(message));
    });
  });

  describe('SilentLogger', () => {
    let consoleLogSpy: ReturnType<typeof mock>;
    let consoleWarnSpy: ReturnType<typeof mock>;
    let consoleErrorSpy: ReturnType<typeof mock>;

    beforeEach(() => {
      consoleLogSpy = mock(() => {});
      consoleWarnSpy = mock(() => {});
      consoleErrorSpy = mock(() => {});

      console.log = consoleLogSpy;
      console.warn = consoleWarnSpy;
      console.error = consoleErrorSpy;
    });

    it('should implement Logger interface', () => {
      const logger = new SilentLogger();
      expect(logger).toBeDefined();
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('should not log debug messages', () => {
      const logger = new SilentLogger();
      logger.debug('Debug message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should not log info messages', () => {
      const logger = new SilentLogger();
      logger.info('Info message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should not log warn messages', () => {
      const logger = new SilentLogger();
      logger.warn('Warning message');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should not log error messages', () => {
      const logger = new SilentLogger();
      logger.error('Error message');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('Type compatibility', () => {
    it('should allow ConsoleLogger to be assigned to Logger type', () => {
      const logger: Logger = new ConsoleLogger();
      expect(logger).toBeInstanceOf(ConsoleLogger);
    });

    it('should allow SilentLogger to be assigned to Logger type', () => {
      const logger: Logger = new SilentLogger();
      expect(logger).toBeInstanceOf(SilentLogger);
    });
  });
});
