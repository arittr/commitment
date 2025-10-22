import { describe, expect, it } from 'bun:test';
import { exec } from '../shell';

describe('shell execution adapter', () => {
  describe('runtime detection', () => {
    it('should detect Bun runtime when process.versions.bun is defined', async () => {
      // Bun runtime is the default in test environment
      expect(typeof process.versions.bun).toBe('string');
    });
  });

  describe('Bun runtime path (integration tests)', () => {
    it('should execute command successfully and return stdout', async () => {
      const result = await exec('echo', ['hello world'], { cwd: '/tmp' });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('hello world');
      expect(result.stderr).toBe('');
    });

    it('should handle non-zero exit code', async () => {
      await expect(async () => {
        // sh -c 'exit 1' will return exit code 1
        await exec('sh', ['-c', 'exit 1'], { cwd: '/tmp' });
      }).toThrow(/Command failed with exit code 1/);
    });

    it('should handle ENOENT error (command not found)', async () => {
      await expect(async () => {
        await exec('this-command-definitely-does-not-exist-anywhere', [], { cwd: '/tmp' });
      }).toThrow(/not found/);
    });

    it('should pass cwd option correctly', async () => {
      // pwd should return the cwd we provide (or its resolved path on macOS)
      const result = await exec('pwd', [], { cwd: '/tmp' });
      // macOS /tmp is a symlink to /private/tmp
      expect(result.stdout.trim()).toMatch(/^\/(private\/)?tmp$/);
    });

    it('should capture stderr separately', async () => {
      // sh -c 'echo error >&2' outputs to stderr
      const result = await exec('sh', ['-c', 'echo error >&2'], { cwd: '/tmp' });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain('error');
    });

    it('should handle commands with multiple arguments', async () => {
      const result = await exec('echo', ['-n', 'test'], { cwd: '/tmp' });
      expect(result.stdout).toBe('test');
    });

    it('should preserve original error as cause', async () => {
      try {
        await exec('this-command-does-not-exist', [], { cwd: '/tmp' });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).cause).toBeDefined();
      }
    });
  });

  describe('options mapping', () => {
    it('should accept minimal options (cwd only)', async () => {
      const result = await exec('echo', ['test'], { cwd: '/tmp' });
      expect(result.exitCode).toBe(0);
    });

    it('should accept timeout option', async () => {
      // Quick command should complete within timeout
      const result = await exec('echo', ['test'], {
        cwd: '/tmp',
        timeout: 5000,
      });
      expect(result.exitCode).toBe(0);
    });

    it('should accept stdin input option', async () => {
      // cat with no args reads from stdin
      const result = await exec('cat', [], {
        cwd: '/tmp',
        input: 'test input data',
      });
      expect(result.stdout).toBe('test input data');
    });

    it('should accept all options together', async () => {
      const result = await exec('cat', [], {
        cwd: '/tmp',
        input: 'hello',
        timeout: 5000,
      });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('hello');
    });
  });

  describe('error messages', () => {
    it('should provide actionable error message for ENOENT', async () => {
      try {
        await exec('nonexistent-command-xyz', [], { cwd: '/tmp' });
        expect(true).toBe(false);
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('nonexistent-command-xyz');
        expect(message).toContain('not found');
        expect(message).toContain('PATH');
      }
    });

    it('should include command and args in error messages', async () => {
      try {
        await exec('sh', ['-c', 'exit 42'], { cwd: '/tmp' });
        expect(true).toBe(false);
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('exit code 42');
        expect(message).toContain('sh');
      }
    });

    it('should include stderr in non-zero exit code errors', async () => {
      try {
        // Command that writes to stderr and exits with error
        await exec('sh', ['-c', 'echo "error message" >&2; exit 1'], { cwd: '/tmp' });
        expect(true).toBe(false);
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('exit code 1');
        expect(message).toContain('error message');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty stdout', async () => {
      const result = await exec('true', [], { cwd: '/tmp' });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('should handle commands with special characters in arguments', async () => {
      const result = await exec('echo', ['hello$world'], { cwd: '/tmp' });
      expect(result.stdout).toContain('hello$world');
    });

    it('should handle multiline output', async () => {
      const result = await exec('printf', ['line1\\nline2\\nline3'], { cwd: '/tmp' });
      expect(result.stdout).toBe('line1\nline2\nline3');
    });
  });

  describe('Node runtime path', () => {
    // Note: These tests would run in Node runtime
    // Since we're running in Bun, we'll skip these but document expected behavior
    it.skip('should use execa when running in Node runtime', async () => {
      // This would be tested in a Node environment
      // The implementation should detect !process.versions.bun and use execa
    });

    it.skip('should map options correctly to execa', async () => {
      // Verify that cwd, timeout, input are passed through to execa correctly
    });
  });
});
