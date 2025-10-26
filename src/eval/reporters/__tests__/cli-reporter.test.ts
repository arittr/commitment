import { beforeEach, describe, expect, it, mock } from 'bun:test';

import { CLIReporter } from '../cli-reporter.js';

describe('CLIReporter', () => {
  let consoleLogSpy: ReturnType<typeof mock>;
  let reporter: CLIReporter;

  beforeEach(() => {
    // Mock console.log to capture output
    consoleLogSpy = mock(() => {});
    console.log = consoleLogSpy;
    reporter = new CLIReporter();
  });

  describe('reportAttemptStart', () => {
    it('should report attempt start with attempt number', () => {
      reporter.reportAttemptStart(1);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const call = consoleLogSpy.mock.calls[0]?.[0] as string;
      expect(call).toContain('Attempt 1');
    });

    it('should report all three attempts', () => {
      reporter.reportAttemptStart(1);
      reporter.reportAttemptStart(2);
      reporter.reportAttemptStart(3);

      expect(consoleLogSpy).toHaveBeenCalledTimes(3);
      expect(consoleLogSpy.mock.calls[0]?.[0]).toContain('Attempt 1');
      expect(consoleLogSpy.mock.calls[1]?.[0]).toContain('Attempt 2');
      expect(consoleLogSpy.mock.calls[2]?.[0]).toContain('Attempt 3');
    });
  });

  describe('reportAttemptSuccess', () => {
    it('should report success with green color and score', () => {
      reporter.reportAttemptSuccess(1, 8.5, 1000);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const call = consoleLogSpy.mock.calls[0]?.[0] as string;
      expect(call).toContain('Attempt 1');
      expect(call).toContain('8.5');
    });

    it('should handle perfect score', () => {
      reporter.reportAttemptSuccess(1, 10.0, 1200);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const call = consoleLogSpy.mock.calls[0]?.[0] as string;
      expect(call).toContain('10');
    });

    it('should handle low score', () => {
      reporter.reportAttemptSuccess(1, 2.3, 900);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const call = consoleLogSpy.mock.calls[0]?.[0] as string;
      expect(call).toContain('2.3');
    });
  });

  describe('reportAttemptFailure', () => {
    it('should report cleaning failure with red color', () => {
      reporter.reportAttemptFailure(1, 'cleaning', 100);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const call = consoleLogSpy.mock.calls[0]?.[0] as string;
      expect(call).toContain('Attempt 1');
      expect(call).toContain('cleaning');
    });

    it('should report validation failure', () => {
      reporter.reportAttemptFailure(2, 'validation', 150);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const call = consoleLogSpy.mock.calls[0]?.[0] as string;
      expect(call).toContain('Attempt 2');
      expect(call).toContain('validation');
    });

    it('should report generation failure', () => {
      reporter.reportAttemptFailure(3, 'generation', 200);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const call = consoleLogSpy.mock.calls[0]?.[0] as string;
      expect(call).toContain('Attempt 3');
      expect(call).toContain('generation');
    });

    it('should report api_error failure', () => {
      reporter.reportAttemptFailure(1, 'api_error', 50);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const call = consoleLogSpy.mock.calls[0]?.[0] as string;
      expect(call).toContain('Attempt 1');
      expect(call).toContain('api_error');
    });

    it('should report failure with error message', () => {
      reporter.reportAttemptFailure(1, 'generation', 100, 'Command not found: gemini');

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      const call1 = consoleLogSpy.mock.calls[0]?.[0] as string;
      const call2 = consoleLogSpy.mock.calls[1]?.[0] as string;
      expect(call1).toContain('Attempt 1');
      expect(call1).toContain('generation');
      expect(call2).toContain('Command not found: gemini');
    });

    it('should truncate long error messages', () => {
      const longError = 'x'.repeat(150);
      reporter.reportAttemptFailure(1, 'generation', 100, longError);

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      const call2 = consoleLogSpy.mock.calls[1]?.[0] as string;
      expect(call2).toContain('...');
      expect(call2.length).toBeLessThan(150);
    });
  });

  describe('reportSummary', () => {
    it('should report summary with all successes', () => {
      reporter.reportSummary('3/3', 8.5);

      expect(consoleLogSpy).toHaveBeenCalled();
      const calls = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
      expect(calls).toContain('3/3');
      expect(calls).toContain('8.5');
    });

    it('should report summary with partial success', () => {
      reporter.reportSummary('2/3', 7.0);

      expect(consoleLogSpy).toHaveBeenCalled();
      const calls = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
      expect(calls).toContain('2/3');
      expect(calls).toContain('7.0');
    });

    it('should report summary with no successes', () => {
      reporter.reportSummary('0/3', 0.0);

      expect(consoleLogSpy).toHaveBeenCalled();
      const calls = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
      expect(calls).toContain('0/3');
      expect(calls).toContain('0');
    });

    it('should use yellow color for warnings (partial success)', () => {
      reporter.reportSummary('1/3', 5.0);

      expect(consoleLogSpy).toHaveBeenCalled();
      const calls = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
      expect(calls).toContain('1/3');
    });
  });

  describe('full workflow', () => {
    it('should report complete attempt sequence with mixed results', () => {
      // Attempt 1: success
      reporter.reportAttemptStart(1);
      reporter.reportAttemptSuccess(1, 8.5, 1000);

      // Attempt 2: failure
      reporter.reportAttemptStart(2);
      reporter.reportAttemptFailure(2, 'validation', 100);

      // Attempt 3: success
      reporter.reportAttemptStart(3);
      reporter.reportAttemptSuccess(3, 7.8, 1100);

      // Summary
      reporter.reportSummary('2/3', 7.2);

      expect(consoleLogSpy).toHaveBeenCalled();
      // Should have start + result for each attempt + summary
      expect(consoleLogSpy.mock.calls.length).toBeGreaterThan(6);
    });

    it('should report all failures scenario', () => {
      reporter.reportAttemptStart(1);
      reporter.reportAttemptFailure(1, 'cleaning', 100);

      reporter.reportAttemptStart(2);
      reporter.reportAttemptFailure(2, 'generation', 150);

      reporter.reportAttemptStart(3);
      reporter.reportAttemptFailure(3, 'api_error', 50);

      reporter.reportSummary('0/3', 0.0);

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });
});
