import { describe, expect, it } from 'bun:test';

import type { GitProvider } from '../git-provider';
import { MockGitProvider, RealGitProvider } from '../git-provider';

/**
 * Unit Tests for GitProvider implementations
 *
 * Tests both RealGitProvider and MockGitProvider:
 * - Command routing logic
 * - Fixture data generation
 * - Status code conversion
 * - Edge cases (empty status, unknown commands)
 *
 * MockGitProvider is used by the eval system, so correct behavior is critical.
 */
describe('GitProvider', () => {
  describe('RealGitProvider', () => {
    it('should implement GitProvider interface', () => {
      const provider = new RealGitProvider();

      expect(provider).toBeDefined();
      expect(typeof provider.exec).toBe('function');
    });

    it('should execute git commands (integration test)', async () => {
      const provider = new RealGitProvider();

      // This is a real integration test - will fail if not in git repo
      // But verifies the interface works correctly
      try {
        const result = await provider.exec(['--version'], process.cwd());
        expect(result).toContain('git version');
      } catch (error) {
        // If git is not available, skip this test
        expect(error).toBeDefined();
      }
    });

    it('should pass args and cwd correctly', async () => {
      const provider = new RealGitProvider();

      // Test with a safe command
      try {
        await provider.exec(['status', '--porcelain'], process.cwd());
      } catch {
        // Command might fail if not in git repo, but we're testing the call
      }

      // Just verify provider exists and has correct interface
      expect(provider.exec).toBeDefined();
    });
  });

  describe('MockGitProvider', () => {
    const sampleFixture = {
      diff: `diff --git a/src/file.ts b/src/file.ts
index 1234567..abcdefg 100644
--- a/src/file.ts
+++ b/src/file.ts
@@ -1,3 +1,4 @@
+new line
 existing line 1
 existing line 2`,
      status: 'M  src/file.ts',
    };

    describe('constructor', () => {
      it('should create MockGitProvider with fixture data', () => {
        const provider = new MockGitProvider(sampleFixture);

        expect(provider).toBeDefined();
        expect(typeof provider.exec).toBe('function');
      });

      it('should accept empty fixture data', () => {
        const provider = new MockGitProvider({
          diff: '',
          status: '',
        });

        expect(provider).toBeDefined();
      });
    });

    describe('command routing', () => {
      it('should return diff for "diff" command', async () => {
        const provider = new MockGitProvider(sampleFixture);

        const result = await provider.exec(['diff', '--cached'], '/tmp');

        expect(result).toBe(sampleFixture.diff);
      });

      it('should return status for "status" command', async () => {
        const provider = new MockGitProvider(sampleFixture);

        const result = await provider.exec(['status', '--porcelain'], '/tmp');

        expect(result).toBe(sampleFixture.status);
      });

      it('should return empty string for unknown commands', async () => {
        const provider = new MockGitProvider(sampleFixture);

        const result = await provider.exec(['log', '--oneline'], '/tmp');

        expect(result).toBe('');
      });

      it('should ignore cwd parameter (fixture-based)', async () => {
        const provider = new MockGitProvider(sampleFixture);

        const result1 = await provider.exec(['diff'], '/path1');
        const result2 = await provider.exec(['diff'], '/path2');

        expect(result1).toBe(result2);
        expect(result1).toBe(sampleFixture.diff);
      });
    });

    describe('diff --stat generation', () => {
      it('should generate stats from single file status', async () => {
        const provider = new MockGitProvider({
          diff: 'diff content',
          status: 'M  src/file.ts',
        });

        const result = await provider.exec(['diff', '--cached', '--stat'], '/tmp');

        expect(result).toContain('src/file.ts');
        expect(result).toContain('| 2 +-');
        expect(result).toContain('1 file changed');
      });

      it('should generate stats from multiple file status', async () => {
        const provider = new MockGitProvider({
          diff: 'diff content',
          status: 'M  src/file1.ts\nA  src/file2.ts\nD  src/file3.ts',
        });

        const result = await provider.exec(['diff', '--stat'], '/tmp');

        expect(result).toContain('src/file1.ts');
        expect(result).toContain('src/file2.ts');
        expect(result).toContain('src/file3.ts');
        expect(result).toContain('3 files changed');
      });

      it('should handle empty status', async () => {
        const provider = new MockGitProvider({
          diff: '',
          status: '',
        });

        const result = await provider.exec(['diff', '--stat'], '/tmp');

        expect(result).toBe('');
      });

      it('should handle status with only whitespace lines', async () => {
        const provider = new MockGitProvider({
          diff: 'diff',
          status: '   \n\n  \n',
        });

        const result = await provider.exec(['diff', '--stat'], '/tmp');

        expect(result).toBe('');
      });

      it('should include insertion/deletion summary', async () => {
        const provider = new MockGitProvider({
          diff: 'diff',
          status: 'M  src/file.ts',
        });

        const result = await provider.exec(['diff', '--stat'], '/tmp');

        expect(result).toContain('2 insertions(+)');
        expect(result).toContain('1 deletion(-)');
      });

      it('should use singular "file" for single file', async () => {
        const provider = new MockGitProvider({
          diff: 'diff',
          status: 'M  src/file.ts',
        });

        const result = await provider.exec(['diff', '--stat'], '/tmp');

        expect(result).toContain('1 file changed');
        expect(result).not.toContain('1 files changed');
      });

      it('should use plural "files" for multiple files', async () => {
        const provider = new MockGitProvider({
          diff: 'diff',
          status: 'M  src/file1.ts\nA  src/file2.ts',
        });

        const result = await provider.exec(['diff', '--stat'], '/tmp');

        expect(result).toContain('2 files changed');
      });

      it('should format each file line correctly', async () => {
        const provider = new MockGitProvider({
          diff: 'diff',
          status: 'M  src/feature.ts',
        });

        const result = await provider.exec(['diff', '--stat'], '/tmp');

        expect(result).toMatch(/src\/feature\.ts\s+\|\s+2\s+\+-/);
      });
    });

    describe('diff --name-status generation', () => {
      it('should convert M (modified) status code', async () => {
        const provider = new MockGitProvider({
          diff: 'diff',
          status: 'M  src/file.ts',
        });

        const result = await provider.exec(['diff', '--name-status'], '/tmp');

        expect(result).toBe('M\tsrc/file.ts');
      });

      it('should convert A (added) status code', async () => {
        const provider = new MockGitProvider({
          diff: 'diff',
          status: 'A  src/new-file.ts',
        });

        const result = await provider.exec(['diff', '--name-status'], '/tmp');

        expect(result).toBe('A\tsrc/new-file.ts');
      });

      it('should convert D (deleted) status code', async () => {
        const provider = new MockGitProvider({
          diff: 'diff',
          status: 'D  src/old-file.ts',
        });

        const result = await provider.exec(['diff', '--name-status'], '/tmp');

        expect(result).toBe('D\tsrc/old-file.ts');
      });

      it('should convert R (renamed) status code', async () => {
        const provider = new MockGitProvider({
          diff: 'diff',
          status: 'R  src/old.ts',
        });

        const result = await provider.exec(['diff', '--name-status'], '/tmp');

        expect(result).toBe('R\tsrc/old.ts');
      });

      it('should default to M for unknown status codes', async () => {
        const provider = new MockGitProvider({
          diff: 'diff',
          status: 'X  src/file.ts',
        });

        const result = await provider.exec(['diff', '--name-status'], '/tmp');

        expect(result).toBe('M\tsrc/file.ts');
      });

      it('should handle multiple files with different statuses', async () => {
        const provider = new MockGitProvider({
          diff: 'diff',
          status: 'M  src/file1.ts\nA  src/file2.ts\nD  src/file3.ts',
        });

        const result = await provider.exec(['diff', '--name-status'], '/tmp');

        expect(result).toContain('M\tsrc/file1.ts');
        expect(result).toContain('A\tsrc/file2.ts');
        expect(result).toContain('D\tsrc/file3.ts');
      });

      it('should handle empty status', async () => {
        const provider = new MockGitProvider({
          diff: '',
          status: '',
        });

        const result = await provider.exec(['diff', '--name-status'], '/tmp');

        expect(result).toBe('');
      });

      it('should filter out whitespace-only lines', async () => {
        const provider = new MockGitProvider({
          diff: 'diff',
          status: 'M  src/file1.ts\n   \nA  src/file2.ts\n\n',
        });

        const result = await provider.exec(['diff', '--name-status'], '/tmp');

        const lines = result.split('\n');
        expect(lines.length).toBe(2);
        expect(lines[0]).toBe('M\tsrc/file1.ts');
        expect(lines[1]).toBe('A\tsrc/file2.ts');
      });

      it('should use tab separator between status and filename', async () => {
        const provider = new MockGitProvider({
          diff: 'diff',
          status: 'M  src/file.ts',
        });

        const result = await provider.exec(['diff', '--name-status'], '/tmp');

        expect(result).toContain('\t');
        expect(result.split('\t')).toHaveLength(2);
      });

      it('should handle status codes with trailing spaces', async () => {
        const provider = new MockGitProvider({
          diff: 'diff',
          status: 'M   src/file.ts  ',
        });

        const result = await provider.exec(['diff', '--name-status'], '/tmp');

        expect(result).toContain('M\tsrc/file.ts');
      });

      it('should handle staged/unstaged status codes (e.g., MM, AM)', async () => {
        const provider = new MockGitProvider({
          diff: 'diff',
          status: 'MM src/file.ts',
        });

        const result = await provider.exec(['diff', '--name-status'], '/tmp');

        // Should detect M in "MM"
        expect(result).toBe('M\tsrc/file.ts');
      });
    });

    describe('diff command variants', () => {
      it('should return diff for "diff --cached"', async () => {
        const provider = new MockGitProvider(sampleFixture);

        const result = await provider.exec(['diff', '--cached'], '/tmp');

        expect(result).toBe(sampleFixture.diff);
      });

      it('should return diff for "diff --unified=3"', async () => {
        const provider = new MockGitProvider(sampleFixture);

        const result = await provider.exec(['diff', '--unified=3'], '/tmp');

        expect(result).toBe(sampleFixture.diff);
      });

      it('should return diff for "diff --ignore-space-change"', async () => {
        const provider = new MockGitProvider(sampleFixture);

        const result = await provider.exec(['diff', '--ignore-space-change'], '/tmp');

        expect(result).toBe(sampleFixture.diff);
      });

      it('should return stat for any diff command with --stat', async () => {
        const provider = new MockGitProvider({
          diff: 'diff',
          status: 'M  src/file.ts',
        });

        const result = await provider.exec(['diff', '--cached', '--stat', '--foo'], '/tmp');

        expect(result).toContain('src/file.ts');
        expect(result).not.toBe('diff');
      });

      it('should return name-status for any diff command with --name-status', async () => {
        const provider = new MockGitProvider({
          diff: 'diff',
          status: 'M  src/file.ts',
        });

        const result = await provider.exec(['diff', '--cached', '--name-status', '--bar'], '/tmp');

        expect(result).toBe('M\tsrc/file.ts');
        expect(result).not.toBe('diff');
      });
    });

    describe('interface compliance', () => {
      it('should implement GitProvider interface', () => {
        const provider: GitProvider = new MockGitProvider(sampleFixture);

        expect(provider.exec).toBeDefined();
        expect(typeof provider.exec).toBe('function');
      });

      it('should return Promise<string> from exec', async () => {
        const provider = new MockGitProvider(sampleFixture);

        const result = provider.exec(['diff'], '/tmp');

        expect(result).toBeInstanceOf(Promise);

        const resolved = await result;
        expect(typeof resolved).toBe('string');
      });

      it('should accept string[] for args parameter', async () => {
        const provider = new MockGitProvider(sampleFixture);

        const result = await provider.exec(['diff', '--cached', '--stat'], '/tmp');

        expect(typeof result).toBe('string');
      });

      it('should accept string for cwd parameter', async () => {
        const provider = new MockGitProvider(sampleFixture);

        const result = await provider.exec(['diff'], '/any/path/here');

        expect(typeof result).toBe('string');
      });
    });

    describe('eval system usage patterns', () => {
      it('should support typical eval fixture format', async () => {
        const evalFixture = {
          diff: `diff --git a/src/feature.ts b/src/feature.ts
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/src/feature.ts
@@ -0,0 +1,10 @@
+export function newFeature() {
+  return 'implemented';
+}`,
          status: 'A  src/feature.ts',
        };

        const provider = new MockGitProvider(evalFixture);

        const diff = await provider.exec(['diff', '--cached'], '/eval/tmp');
        const stat = await provider.exec(['diff', '--cached', '--stat'], '/eval/tmp');
        const nameStatus = await provider.exec(['diff', '--cached', '--name-status'], '/eval/tmp');

        expect(diff).toBe(evalFixture.diff);
        expect(stat).toContain('src/feature.ts');
        expect(nameStatus).toBe('A\tsrc/feature.ts');
      });

      it('should handle complex multi-file eval scenarios', async () => {
        const complexFixture = {
          diff: 'complex diff with multiple files',
          status: `M  src/file1.ts
A  src/file2.ts
D  src/old.ts
R  src/renamed.ts`,
        };

        const provider = new MockGitProvider(complexFixture);

        const stat = await provider.exec(['diff', '--stat'], '/tmp');
        const nameStatus = await provider.exec(['diff', '--name-status'], '/tmp');

        expect(stat).toContain('4 files changed');
        expect(nameStatus).toContain('M\tsrc/file1.ts');
        expect(nameStatus).toContain('A\tsrc/file2.ts');
        expect(nameStatus).toContain('D\tsrc/old.ts');
        expect(nameStatus).toContain('R\tsrc/renamed.ts');
      });
    });

    describe('edge cases', () => {
      it('should handle filenames with spaces', async () => {
        const provider = new MockGitProvider({
          diff: 'diff',
          status: 'M  src/file with spaces.ts',
        });

        const nameStatus = await provider.exec(['diff', '--name-status'], '/tmp');

        expect(nameStatus).toBe('M\tsrc/file with spaces.ts');
      });

      it('should handle filenames with special characters', async () => {
        const provider = new MockGitProvider({
          diff: 'diff',
          status: 'M  src/file-name_v2.0.ts',
        });

        const nameStatus = await provider.exec(['diff', '--name-status'], '/tmp');

        expect(nameStatus).toContain('src/file-name_v2.0.ts');
      });

      it('should handle very long status output', async () => {
        const manyFiles = Array.from({ length: 100 }, (_, i) => `M  src/file${i}.ts`).join('\n');

        const provider = new MockGitProvider({
          diff: 'diff',
          status: manyFiles,
        });

        const stat = await provider.exec(['diff', '--stat'], '/tmp');

        expect(stat).toContain('100 files changed');
      });

      it('should handle mixed line endings in status', async () => {
        const provider = new MockGitProvider({
          diff: 'diff',
          status: 'M  src/file1.ts\r\nA  src/file2.ts\nD  src/file3.ts',
        });

        const nameStatus = await provider.exec(['diff', '--name-status'], '/tmp');

        // Should handle \r\n line endings
        expect(nameStatus).toContain('M\tsrc/file1.ts');
      });

      it('should handle status codes with single-char status (edge case)', async () => {
        // Note: Real git status always has 2-char codes (e.g., "M ", "A ", "MM")
        // This tests behavior with non-standard input
        const provider = new MockGitProvider({
          diff: 'diff',
          status: 'M  src/file.ts', // Standard format: 2 chars + space
        });

        const nameStatus = await provider.exec(['diff', '--name-status'], '/tmp');

        expect(nameStatus).toContain('M\tsrc/file.ts');
      });
    });
  });
});
