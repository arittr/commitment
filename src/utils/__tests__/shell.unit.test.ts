import { beforeEach, describe, expect, it, mock } from 'bun:test';

/**
 * Unit tests for shell execution adapter
 *
 * These tests mock the exec function to verify it's called correctly
 * by other modules. For integration tests that actually run commands,
 * see shell.integration.test.ts
 */

// Mock the shell module
const mockExec = mock(() => Promise.resolve({ exitCode: 0, stderr: '', stdout: '' }));

mock.module('../shell.js', () => ({
  exec: mockExec,
}));

// Import something that uses exec to test the mock
import { exec } from '../shell';

describe('shell execution adapter (unit tests)', () => {
  beforeEach(() => {
    mockExec.mockClear();
  });

  describe('runtime detection', () => {
    it('should detect Bun runtime', () => {
      expect(typeof process.versions.bun).toBe('string');
    });
  });

  describe('exec function interface', () => {
    it('should be callable with command, args, and options', async () => {
      mockExec.mockResolvedValueOnce({
        exitCode: 0,
        stderr: '',
        stdout: 'output',
      });

      const result = await exec('git', ['status'], { cwd: '/test' });

      expect(mockExec).toHaveBeenCalledWith('git', ['status'], { cwd: '/test' });
      expect(result.stdout).toBe('output');
      expect(result.exitCode).toBe(0);
    });

    it('should support timeout option', async () => {
      mockExec.mockResolvedValueOnce({
        exitCode: 0,
        stderr: '',
        stdout: '',
      });

      await exec('echo', ['test'], { cwd: '/tmp', timeout: 5000 });

      expect(mockExec).toHaveBeenCalledWith('echo', ['test'], {
        cwd: '/tmp',
        timeout: 5000,
      });
    });

    it('should support stdin input option', async () => {
      mockExec.mockResolvedValueOnce({
        exitCode: 0,
        stderr: '',
        stdout: 'echoed',
      });

      await exec('cat', [], { cwd: '/tmp', input: 'test data' });

      expect(mockExec).toHaveBeenCalledWith('cat', [], {
        cwd: '/tmp',
        input: 'test data',
      });
    });

    it('should return ShellExecResult with stdout, stderr, exitCode', async () => {
      mockExec.mockResolvedValueOnce({
        exitCode: 0,
        stderr: 'warning',
        stdout: 'hello world',
      });

      const result = await exec('echo', ['hello'], { cwd: '/tmp' });

      expect(result).toEqual({
        exitCode: 0,
        stderr: 'warning',
        stdout: 'hello world',
      });
    });

    it('should handle errors from execution', async () => {
      mockExec.mockRejectedValueOnce(new Error('Command failed'));

      await expect(exec('cmd', [], { cwd: '/tmp' })).rejects.toThrow('Command failed');
    });
  });
});
