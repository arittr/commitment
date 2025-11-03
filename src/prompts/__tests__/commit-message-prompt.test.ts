import { describe, expect, it } from 'bun:test';

import {
  analyzeCodeChanges,
  buildCommitMessagePrompt,
  type CommitTask,
  type PromptContext,
} from '../commit-message-prompt';

describe('buildCommitMessagePrompt', () => {
  const baseTask: CommitTask = {
    description: 'Implement new feature',
    produces: ['src/feature.ts'],
    title: 'Add feature',
  };

  const baseContext: PromptContext = {
    files: ['src/feature.ts'],
    gitDiffContent: '+function newFeature() { return true; }',
    gitDiffNameStatus: 'M\tsrc/feature.ts',
    gitDiffStat: '1 file changed, 10 insertions(+)',
    task: baseTask,
  };

  describe('prompt structure', () => {
    it('should include task context in prompt', () => {
      const prompt = buildCommitMessagePrompt(baseContext);

      expect(prompt).toContain('Task Context:');
      expect(prompt).toContain('- Title: Add feature');
      expect(prompt).toContain('- Description: Implement new feature');
      expect(prompt).toContain('- Files: src/feature.ts');
    });

    it('should include git diff sections', () => {
      const prompt = buildCommitMessagePrompt(baseContext);

      expect(prompt).toContain('File Changes Summary:');
      expect(prompt).toContain('M\tsrc/feature.ts');
      expect(prompt).toContain('Diff Statistics:');
      expect(prompt).toContain('1 file changed, 10 insertions(+)');
      expect(prompt).toContain('Actual Code Changes:');
      expect(prompt).toContain('+function newFeature() { return true; }');
    });

    it('should include requirements section', () => {
      const prompt = buildCommitMessagePrompt(baseContext);

      expect(prompt).toContain('Requirements:');
      expect(prompt).toContain('ANALYZE THE ACTUAL CODE CHANGES');
      expect(prompt).toContain('conventional commits');
      expect(prompt).toContain('imperative mood');
    });

    it('should include example format', () => {
      const prompt = buildCommitMessagePrompt(baseContext);

      expect(prompt).toContain('Example format:');
      expect(prompt).toContain('feat: add user authentication system');
    });

    it('should include response markers', () => {
      const prompt = buildCommitMessagePrompt(baseContext);

      expect(prompt).toContain('<<<COMMIT_MESSAGE_START>>>');
      expect(prompt).toContain('<<<COMMIT_MESSAGE_END>>>');
    });

    it('should include change analysis', () => {
      const prompt = buildCommitMessagePrompt(baseContext);

      expect(prompt).toContain('Change Analysis:');
      expect(prompt).toContain('Single file modification');
    });
  });

  describe('diff truncation', () => {
    it('should truncate long diffs to avoid token limits', () => {
      const longDiff = 'a'.repeat(9000); // Exceeds 8000 char limit
      const context: PromptContext = {
        ...baseContext,
        gitDiffContent: longDiff,
      };

      const prompt = buildCommitMessagePrompt(context);

      expect(prompt).toContain('(diff truncated)');
      expect(prompt.length).toBeLessThan(longDiff.length + 2000); // Reasonable overhead
    });

    it('should not truncate short diffs', () => {
      const shortDiff = '+function test() {}';
      const context: PromptContext = {
        ...baseContext,
        gitDiffContent: shortDiff,
      };

      const prompt = buildCommitMessagePrompt(context);

      expect(prompt).not.toContain('(diff truncated)');
      expect(prompt).toContain(shortDiff);
    });

    it('should truncate at exactly 8000 characters', () => {
      const exactDiff = 'x'.repeat(8000);
      const context: PromptContext = {
        ...baseContext,
        gitDiffContent: exactDiff,
      };

      const prompt = buildCommitMessagePrompt(context);

      // Should not truncate at exactly the limit
      expect(prompt).not.toContain('(diff truncated)');

      // But one char over should truncate
      const overDiff = 'x'.repeat(8001);
      const overContext: PromptContext = {
        ...baseContext,
        gitDiffContent: overDiff,
      };

      const overPrompt = buildCommitMessagePrompt(overContext);
      expect(overPrompt).toContain('(diff truncated)');
    });
  });

  describe('file list handling', () => {
    it('should show "No files specified" when files array is empty', () => {
      const context: PromptContext = {
        ...baseContext,
        files: [],
      };

      const prompt = buildCommitMessagePrompt(context);

      expect(prompt).toContain('- Files: No files specified');
    });

    it('should show "No files specified" when files is undefined', () => {
      const context: PromptContext = {
        ...baseContext,
        files: undefined,
      };

      const prompt = buildCommitMessagePrompt(context);

      expect(prompt).toContain('- Files: No files specified');
    });

    it('should join multiple files with commas', () => {
      const context: PromptContext = {
        ...baseContext,
        files: ['src/file1.ts', 'src/file2.ts', 'src/file3.ts'],
      };

      const prompt = buildCommitMessagePrompt(context);

      expect(prompt).toContain('- Files: src/file1.ts, src/file2.ts, src/file3.ts');
    });

    it('should handle single file', () => {
      const prompt = buildCommitMessagePrompt(baseContext);

      expect(prompt).toContain('- Files: src/feature.ts');
    });
  });

  describe('output handling', () => {
    it('should include output when provided', () => {
      const context: PromptContext = {
        ...baseContext,
        output: 'All tests passed successfully',
      };

      const prompt = buildCommitMessagePrompt(context);

      expect(prompt).toContain('Task Execution Output:');
      expect(prompt).toContain('All tests passed successfully');
    });

    it('should show "No execution output provided" when output is undefined', () => {
      const context: PromptContext = {
        ...baseContext,
        output: undefined,
      };

      const prompt = buildCommitMessagePrompt(context);

      expect(prompt).toContain('Task Execution Output:');
      expect(prompt).toContain('No execution output provided');
    });

    it('should show "No execution output provided" when output is empty string', () => {
      const context: PromptContext = {
        ...baseContext,
        output: '',
      };

      const prompt = buildCommitMessagePrompt(context);

      expect(prompt).toContain('No execution output provided');
    });

    it('should show "No execution output provided" when output is whitespace', () => {
      const context: PromptContext = {
        ...baseContext,
        output: '   ',
      };

      const prompt = buildCommitMessagePrompt(context);

      expect(prompt).toContain('No execution output provided');
    });
  });

  describe('error handling', () => {
    it('should throw error when gitDiffContent is not a string', () => {
      const context = {
        ...baseContext,
        gitDiffContent: null as unknown as string,
      };

      expect(() => buildCommitMessagePrompt(context)).toThrow('Git diff output validation failed');
    });

    it('should throw error when gitDiffContent is undefined', () => {
      const context = {
        ...baseContext,
        gitDiffContent: undefined as unknown as string,
      };

      expect(() => buildCommitMessagePrompt(context)).toThrow('Git diff output validation failed');
    });

    it('should throw error when gitDiffContent is a number', () => {
      const context = {
        ...baseContext,
        gitDiffContent: 123 as unknown as string,
      };

      expect(() => buildCommitMessagePrompt(context)).toThrow('Git diff output validation failed');
    });
  });
});

describe('analyzeCodeChanges', () => {
  describe('basic functionality', () => {
    it('should return "Minor code modifications" for empty diff', () => {
      const result = analyzeCodeChanges('', []);
      expect(result).toBe('Minor code modifications');
    });

    it('should analyze single file modification', () => {
      const diff = '+function test() {}';
      const result = analyzeCodeChanges(diff, ['test.ts']);

      expect(result).toContain('Single file modification');
    });

    it('should detect added functions', () => {
      const diff = '+function newFeature() { return true; }\n+const helper = () => {};';
      const result = analyzeCodeChanges(diff, ['feature.ts']);

      expect(result).toContain('Added 2 new functions/methods');
    });

    it('should detect removed functions', () => {
      const diff = '-function oldFeature() { return false; }\n-const unused = () => {};';
      const result = analyzeCodeChanges(diff, ['feature.ts']);

      expect(result).toContain('Removed 2 functions/methods');
    });

    it('should detect modified functions', () => {
      const diff = '+function updated() {}\n-function original() {}';
      const result = analyzeCodeChanges(diff, ['feature.ts']);

      expect(result).toContain('Modified function definitions');
    });
  });

  describe('test detection', () => {
    it('should detect added test cases', () => {
      const diff = `
+describe('Feature', () => {
+  it('should work', () => {});
+  test('should pass', () => {});
+});
`;
      const result = analyzeCodeChanges(diff, ['feature.test.ts']);

      expect(result).toContain('Added 3 test cases');
    });

    it('should detect removed test cases', () => {
      const diff = `
-describe('Old', () => {
-  it('should fail', () => {});
-});
`;
      const result = analyzeCodeChanges(diff, ['feature.test.ts']);

      expect(result).toContain('Removed 2 test cases');
    });
  });

  describe('pattern detection', () => {
    it('should detect mock changes with vi.mock', () => {
      const diff = '+vi.mock("./module")';
      const result = analyzeCodeChanges(diff, ['test.ts']);

      expect(result).toContain('Modified mocking/test patterns');
    });

    it('should detect mock changes with jest.mock', () => {
      const diff = '+jest.mock("./module")';
      const result = analyzeCodeChanges(diff, ['test.ts']);

      expect(result).toContain('Modified mocking/test patterns');
    });

    it('should detect mock changes with generic mock', () => {
      const diff = '+const mockFn = mock();';
      const result = analyzeCodeChanges(diff, ['test.ts']);

      expect(result).toContain('Modified mocking/test patterns');
    });

    it('should detect TypeScript interface changes', () => {
      const diff = '+interface User { name: string; }';
      const result = analyzeCodeChanges(diff, ['types.ts']);

      expect(result).toContain('Updated TypeScript definitions');
    });

    it('should detect TypeScript type changes', () => {
      const diff = '+type Config = { enabled: boolean; };';
      const result = analyzeCodeChanges(diff, ['types.ts']);

      expect(result).toContain('Updated TypeScript definitions');
    });

    it('should detect .d.ts file changes', () => {
      const diff = 'diff --git a/types.d.ts b/types.d.ts';
      const result = analyzeCodeChanges(diff, ['types.d.ts']);

      expect(result).toContain('Updated TypeScript definitions');
    });
  });

  describe('file scope analysis', () => {
    it('should detect single file modification', () => {
      const diff = '+line';
      const result = analyzeCodeChanges(diff, ['file.ts']);

      expect(result).toContain('Single file modification');
    });

    it('should detect broad changes across many files', () => {
      const diff = '+line';
      const files = ['1.ts', '2.ts', '3.ts', '4.ts', '5.ts', '6.ts'];
      const result = analyzeCodeChanges(diff, files);

      expect(result).toContain('Broad changes across 6 files');
    });

    it('should not mention file scope for 2-5 files', () => {
      const diff = '+line';
      const result = analyzeCodeChanges(diff, ['1.ts', '2.ts', '3.ts']);

      expect(result).not.toContain('file');
    });
  });

  describe('change magnitude analysis', () => {
    it('should detect substantial changes (>100 lines)', () => {
      const addedLines = Array.from({ length: 60 }, () => '+line').join('\n');
      const removedLines = Array.from({ length: 50 }, () => '-line').join('\n');
      const diff = `${addedLines}\n${removedLines}`;

      const result = analyzeCodeChanges(diff, ['file.ts']);

      expect(result).toContain('Substantial changes: 60+ 50- lines');
    });

    it('should detect moderate changes (21-100 lines)', () => {
      const addedLines = Array.from({ length: 15 }, () => '+line').join('\n');
      const removedLines = Array.from({ length: 10 }, () => '-line').join('\n');
      const diff = `${addedLines}\n${removedLines}`;

      const result = analyzeCodeChanges(diff, ['file.ts']);

      expect(result).toContain('Moderate code changes');
    });

    it('should not mention magnitude for small changes (<20 lines)', () => {
      const diff = '+line1\n+line2\n-line3';
      const result = analyzeCodeChanges(diff, ['file.ts']);

      // Should only mention file scope, not magnitude
      expect(result).not.toContain('changes:');
      expect(result).not.toContain('Moderate');
      expect(result).not.toContain('Substantial');
    });
  });

  describe('complex scenarios', () => {
    it('should combine multiple analysis types', () => {
      const diff = `
+function newFeature() { return true; }
+function helper() {}
+describe('Test', () => {
+  it('should work', () => {});
+});
-function oldFeature() {}
`;
      const files = ['feature.ts', 'feature.test.ts'];

      const result = analyzeCodeChanges(diff, files);

      // Should detect modified functions (2 added, 1 removed) and tests
      expect(result).toContain('Modified function definitions');
      expect(result).toContain('Added 2 test cases');
    });

    it('should handle real-world git diff format', () => {
      const diff = `diff --git a/src/feature.ts b/src/feature.ts
index 123..456 100644
--- a/src/feature.ts
+++ b/src/feature.ts
@@ -1,3 +1,5 @@
+export function newFeature(): boolean {
+  return true;
+}

-const old = 'removed';`;

      const result = analyzeCodeChanges(diff, ['src/feature.ts']);

      expect(result).toContain('Single file modification');
      expect(result).toContain('Modified function definitions');
    });
  });

  describe('error handling', () => {
    it('should throw error when diffContent is not a string', () => {
      expect(() => analyzeCodeChanges(null as unknown as string, [])).toThrow(
        'Diff content must be a string'
      );
    });

    it('should throw error when diffContent is undefined', () => {
      expect(() => analyzeCodeChanges(undefined as unknown as string, [])).toThrow(
        'Diff content must be a string'
      );
    });

    it('should throw error when diffContent is a number', () => {
      expect(() => analyzeCodeChanges(123 as unknown as string, [])).toThrow(
        'Diff content must be a string'
      );
    });

    it('should handle empty files array', () => {
      const diff = '+function test() {}';
      const result = analyzeCodeChanges(diff, []);

      // Should still analyze, just without file scope info
      expect(result).toBeTruthy();
    });
  });

  describe('edge cases', () => {
    it('should handle diff with only header lines', () => {
      const diff = '--- a/file.ts\n+++ b/file.ts';
      const result = analyzeCodeChanges(diff, ['file.ts']);

      // Should mention single file but return minor since no actual changes
      expect(result).toContain('Single file modification');
    });

    it('should filter out git diff header lines', () => {
      const diff = '--- a/file.ts\n+++ b/file.ts\n+actual code';
      const result = analyzeCodeChanges(diff, ['file.ts']);

      // Should not count header lines
      expect(result).toContain('Single file modification');
    });

    it('should handle mixed whitespace in diff', () => {
      const diff = '+   function test() {}\n\n\n+   const x = 1;';
      const result = analyzeCodeChanges(diff, ['file.ts']);

      expect(result).toContain('Added 2 new functions/methods');
    });
  });
});
