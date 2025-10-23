/**
 * Tests for error categorization utility
 *
 * Tests pattern-based error detection for all 4 failure types.
 */

import { describe, expect, it } from 'bun:test';

import { categorizeError } from '../error-categorization.js';

describe('categorizeError', () => {
  describe('api_error detection', () => {
    it('should detect ENOENT errors', () => {
      const error = new Error('Command failed');
      // @ts-expect-error - Adding code property for test
      error.code = 'ENOENT';

      expect(categorizeError(error)).toBe('api_error');
    });

    it('should detect "command not found" errors', () => {
      const error = new Error('command not found: claude');

      expect(categorizeError(error)).toBe('api_error');
    });

    it('should detect "not found" errors', () => {
      const error = new Error('claude: not found');

      expect(categorizeError(error)).toBe('api_error');
    });

    it('should detect network errors', () => {
      const error = new Error('Network error: ECONNREFUSED');

      expect(categorizeError(error)).toBe('api_error');
    });

    it('should handle non-Error objects with code property', () => {
      const error = { code: 'ENOENT', message: 'File not found' };

      expect(categorizeError(error)).toBe('api_error');
    });
  });

  describe('validation detection', () => {
    it('should detect "Invalid conventional commit" errors', () => {
      const error = new Error('Invalid conventional commit format');

      expect(categorizeError(error)).toBe('validation');
    });

    it('should detect "does not follow conventional" errors', () => {
      const error = new Error('Commit message does not follow conventional commits');

      expect(categorizeError(error)).toBe('validation');
    });

    it('should detect "missing type" errors', () => {
      const error = new Error('Commit message missing type prefix');

      expect(categorizeError(error)).toBe('validation');
    });

    it('should detect "invalid format" errors', () => {
      const error = new Error('Invalid format: expected type: description');

      expect(categorizeError(error)).toBe('validation');
    });
  });

  describe('cleaning detection', () => {
    it('should detect thinking artifacts', () => {
      const error = new Error('Failed to clean: Found thinking artifacts');

      expect(categorizeError(error)).toBe('cleaning');
    });

    it('should detect COT (Chain of Thought) artifacts', () => {
      const error = new Error('Response contains COT artifacts that could not be removed');

      expect(categorizeError(error)).toBe('cleaning');
    });

    it('should detect markdown code blocks', () => {
      const error = new Error('Could not remove markdown code blocks from output');

      expect(categorizeError(error)).toBe('cleaning');
    });

    it('should detect "failed to clean" patterns', () => {
      const error = new Error('Failed to clean response');

      expect(categorizeError(error)).toBe('cleaning');
    });
  });

  describe('generation detection', () => {
    it('should detect timeout errors', () => {
      const error = new Error('Agent execution timed out after 120000ms');

      expect(categorizeError(error)).toBe('generation');
    });

    it('should detect agent failure errors', () => {
      const error = new Error('Agent failed to generate commit message');

      expect(categorizeError(error)).toBe('generation');
    });

    it('should detect execution errors', () => {
      const error = new Error('Execution failed: exit code 1');

      expect(categorizeError(error)).toBe('generation');
    });

    it('should detect malformed response errors', () => {
      const error = new Error('Malformed response from agent');

      expect(categorizeError(error)).toBe('generation');
    });
  });

  describe('edge cases', () => {
    it('should default to generation for unknown error types', () => {
      const error = new Error('Unknown error occurred');

      expect(categorizeError(error)).toBe('generation');
    });

    it('should handle string errors', () => {
      const error = 'Simple string error';

      expect(categorizeError(error)).toBe('generation');
    });

    it('should handle null', () => {
      expect(categorizeError(null)).toBe('generation');
    });

    it('should handle undefined', () => {
      expect(categorizeError(undefined)).toBe('generation');
    });

    it('should handle objects without message', () => {
      const error = { foo: 'bar' };

      expect(categorizeError(error)).toBe('generation');
    });

    it('should handle empty error message', () => {
      const error = new Error('');

      expect(categorizeError(error)).toBe('generation');
    });

    it('should be case-insensitive for patterns', () => {
      const error1 = new Error('INVALID CONVENTIONAL COMMIT');
      const error2 = new Error('invalid conventional commit');
      const error3 = new Error('Invalid Conventional Commit');

      expect(categorizeError(error1)).toBe('validation');
      expect(categorizeError(error2)).toBe('validation');
      expect(categorizeError(error3)).toBe('validation');
    });
  });

  describe('priority and specificity', () => {
    it('should prioritize api_error over validation if both patterns match', () => {
      const error = new Error('ENOENT: Invalid conventional commit');
      // @ts-expect-error - Adding code property for test
      error.code = 'ENOENT';

      expect(categorizeError(error)).toBe('api_error');
    });

    it('should prioritize cleaning over validation', () => {
      const error = new Error('Failed to clean: Invalid conventional commit');

      expect(categorizeError(error)).toBe('cleaning');
    });

    it('should prioritize api_error over cleaning', () => {
      const error = new Error('Command not found: Failed to clean');

      expect(categorizeError(error)).toBe('api_error');
    });
  });
});
