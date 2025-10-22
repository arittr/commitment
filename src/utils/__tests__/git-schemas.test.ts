/**
 * Git Schemas Tests - Testing Philosophy
 *
 * We DON'T test Zod's validation logic:
 * - ❌ "rejects non-string input"
 * - ❌ "rejects empty string"
 * - ❌ "applies default values"
 * - ❌ "validates status code format"
 *
 * We DO test our custom logic built on schemas:
 * - ✅ parseGitStatus() - Parses git status output into structured data
 * - ✅ categorizeFiles() - Categorizes files by type (tests, components, configs, etc.)
 * - ✅ analyzeChanges() - Extracts change statistics from git output
 * - ✅ Type inference - Ensures z.infer<> produces correct types
 *
 * Rationale: Zod is well-tested. We focus on behavior we own.
 *
 * See: @docs/constitutions/current/schema-rules.md
 */

import type { ChangeStats, FileCategories, GitStatus, GitStatusLine } from '../git-schemas';
import { analyzeChanges, categorizeFiles, parseGitStatus } from '../git-schemas';

describe('parseGitStatus', () => {
  it('should parse empty git output', () => {
    const output = '';

    const result = parseGitStatus(output);

    expect(result.hasChanges).toBe(false);
    expect(result.stagedFiles).toEqual([]);
    expect(result.statusLines).toEqual([]);
    expect(result.unstagedFiles).toEqual([]);
    expect(result.untrackedFiles).toEqual([]);
  });

  it('should parse single modified file', () => {
    const output = 'M  src/file.ts';

    const result = parseGitStatus(output);

    expect(result.hasChanges).toBe(true);
    expect(result.stagedFiles).toEqual(['src/file.ts']);
    expect(result.statusLines).toEqual(['M  src/file.ts']);
    expect(result.unstagedFiles).toEqual([]);
    expect(result.untrackedFiles).toEqual([]);
  });

  it('should parse multiple staged files', () => {
    const output = 'M  src/file1.ts\nA  src/file2.ts\nD  src/file3.ts';

    const result = parseGitStatus(output);

    expect(result.hasChanges).toBe(true);
    expect(result.stagedFiles).toEqual(['src/file1.ts', 'src/file2.ts', 'src/file3.ts']);
    expect(result.statusLines).toHaveLength(3);
  });

  it('should parse untracked files', () => {
    const output = '?? untracked.ts\n?? another.ts';

    const result = parseGitStatus(output);

    expect(result.hasChanges).toBe(false);
    expect(result.stagedFiles).toEqual([]);
    expect(result.untrackedFiles).toEqual(['untracked.ts', 'another.ts']);
  });

  it('should parse unstaged files', () => {
    const output = ' M src/unstaged.ts\n D src/deleted.ts';

    const result = parseGitStatus(output);

    expect(result.hasChanges).toBe(false);
    expect(result.stagedFiles).toEqual([]);
    expect(result.unstagedFiles).toEqual(['src/unstaged.ts', 'src/deleted.ts']);
  });

  it('should parse mixed status output', () => {
    const output = 'M  src/staged.ts\n M src/unstaged.ts\n?? untracked.ts';

    const result = parseGitStatus(output);

    expect(result.hasChanges).toBe(true);
    expect(result.stagedFiles).toEqual(['src/staged.ts']);
    expect(result.unstagedFiles).toEqual(['src/unstaged.ts']);
    expect(result.untrackedFiles).toEqual(['untracked.ts']);
  });

  it('should ignore empty lines', () => {
    const output = 'M  src/file.ts\n\n\nA  src/new.ts\n';

    const result = parseGitStatus(output);

    expect(result.stagedFiles).toHaveLength(2);
  });

  it('should handle trailing newlines', () => {
    const output = 'M  src/file.ts\n';

    const result = parseGitStatus(output);

    expect(result.stagedFiles).toEqual(['src/file.ts']);
  });

  it('should throw error for malformed line', () => {
    const output = 'M  src/valid.ts\nINVALID LINE\nA  src/another.ts';

    expect(() => parseGitStatus(output)).toThrow('Malformed git status line');
  });

  it('should provide context in error message', () => {
    const output = 'XX invalid.ts';

    try {
      parseGitStatus(output);
      expect.fail('Should have thrown error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      const errorMessage = (error as Error).message;
      expect(errorMessage).toContain('Malformed git status line');
      expect(errorMessage).toContain('XX invalid.ts');
    }
  });

  it('should parse real-world git output', () => {
    const output = `M  src/cli.ts
A  src/new-feature.ts
D  src/old-file.ts
 M src/unstaged.ts
?? temp.log
?? .env.local`;

    const result = parseGitStatus(output);

    expect(result.hasChanges).toBe(true);
    expect(result.stagedFiles).toEqual(['src/cli.ts', 'src/new-feature.ts', 'src/old-file.ts']);
    expect(result.unstagedFiles).toEqual(['src/unstaged.ts']);
    expect(result.untrackedFiles).toEqual(['temp.log', '.env.local']);
  });
});

describe('categorizeFiles', () => {
  it('should categorize empty array', () => {
    const files: string[] = [];

    const result = categorizeFiles(files);

    expect(result.tests).toEqual([]);
    expect(result.components).toEqual([]);
    expect(result.types).toEqual([]);
    expect(result.configs).toEqual([]);
    expect(result.docs).toEqual([]);
    expect(result.apis).toEqual([]);
  });

  it('should categorize test files', () => {
    const files = ['src/__tests__/file.test.ts', 'src/component.spec.tsx'];

    const result = categorizeFiles(files);

    // component.spec.tsx is categorized as component due to .tsx extension (component priority)
    expect(result.tests).toEqual(['src/__tests__/file.test.ts']);
    expect(result.components).toEqual(['src/component.spec.tsx']);
  });

  it('should categorize component files', () => {
    const files = ['src/components/Button.tsx', 'src/Widget.jsx', 'src/component.helper.ts'];

    const result = categorizeFiles(files);

    expect(result.components).toEqual([
      'src/components/Button.tsx',
      'src/Widget.jsx',
      'src/component.helper.ts',
    ]);
  });

  it('should categorize type files', () => {
    const files = ['src/types/index.ts', 'src/declarations.d.ts'];

    const result = categorizeFiles(files);

    expect(result.types).toEqual(['src/types/index.ts', 'src/declarations.d.ts']);
  });

  it('should categorize config files', () => {
    const files = ['package.json', 'tsconfig.json', 'eslint.config.js'];

    const result = categorizeFiles(files);

    expect(result.configs).toEqual(['package.json', 'tsconfig.json', 'eslint.config.js']);
  });

  it('should categorize documentation files', () => {
    const files = ['README.md', 'docs/guide.md', 'CHANGELOG.md'];

    const result = categorizeFiles(files);

    expect(result.docs).toEqual(['README.md', 'docs/guide.md', 'CHANGELOG.md']);
  });

  it('should categorize API files', () => {
    const files = ['src/api/users.ts', 'src/routes/auth.ts', 'src/endpoints/posts.ts'];

    const result = categorizeFiles(files);

    expect(result.apis).toEqual([
      'src/api/users.ts',
      'src/routes/auth.ts',
      'src/endpoints/posts.ts',
    ]);
  });

  it('should categorize mixed files correctly', () => {
    const files = [
      'src/__tests__/auth.test.ts',
      'src/components/Button.tsx',
      'src/types/user.ts',
      'package.json',
      'README.md',
      'src/api/users.ts',
      'src/utils.ts', // uncategorized
    ];

    const result = categorizeFiles(files);

    expect(result.tests).toEqual(['src/__tests__/auth.test.ts']);
    expect(result.components).toEqual(['src/components/Button.tsx']);
    expect(result.types).toEqual(['src/types/user.ts']);
    expect(result.configs).toEqual(['package.json']);
    expect(result.docs).toEqual(['README.md']);
    expect(result.apis).toEqual(['src/api/users.ts']);
  });

  it('should handle files matching multiple categories (components priority)', () => {
    const files = ['src/component.test.tsx'];

    const result = categorizeFiles(files);

    // Should be categorized as component first (due to .tsx extension)
    expect(result.components).toEqual(['src/component.test.tsx']);
    expect(result.tests).toEqual([]);
  });

  it('should be case-insensitive', () => {
    const files = ['SRC/API/USERS.TS', 'README.MD', 'PACKAGE.JSON'];

    const result = categorizeFiles(files);

    expect(result.apis).toEqual(['SRC/API/USERS.TS']);
    expect(result.docs).toEqual(['README.MD']);
    expect(result.configs).toEqual(['PACKAGE.JSON']);
  });

  it('should handle YAML config files', () => {
    const files = ['.github/workflows/ci.yaml', 'docker-compose.yml'];

    const result = categorizeFiles(files);

    expect(result.configs).toEqual(['.github/workflows/ci.yaml']);
  });

  it('should validate returned categories', () => {
    const files = ['test.ts', 'component.tsx'];

    const result = categorizeFiles(files);

    // Should be valid FileCategories type
    expect(result).toHaveProperty('tests');
    expect(result).toHaveProperty('components');
    expect(result).toHaveProperty('types');
    expect(result).toHaveProperty('configs');
    expect(result).toHaveProperty('docs');
    expect(result).toHaveProperty('apis');
  });

  it('should handle files with no category', () => {
    const files = ['src/utils.ts', 'src/helpers.ts', 'index.ts'];

    const result = categorizeFiles(files);

    expect(result.tests).toEqual([]);
    expect(result.components).toEqual([]);
    expect(result.types).toEqual([]);
    expect(result.configs).toEqual([]);
    expect(result.docs).toEqual([]);
    expect(result.apis).toEqual([]);
  });
});

describe('analyzeChanges', () => {
  it('should analyze empty status lines', () => {
    const statusLines: string[] = [];

    const result = analyzeChanges(statusLines);

    expect(result.added).toBe(0);
    expect(result.modified).toBe(0);
    expect(result.deleted).toBe(0);
    expect(result.renamed).toBe(0);
  });

  it('should count added files', () => {
    const statusLines = ['A  src/file1.ts', 'A  src/file2.ts', 'A  src/file3.ts'];

    const result = analyzeChanges(statusLines);

    expect(result.added).toBe(3);
    expect(result.modified).toBe(0);
    expect(result.deleted).toBe(0);
    expect(result.renamed).toBe(0);
  });

  it('should count modified files', () => {
    const statusLines = ['M  src/file1.ts', 'M  src/file2.ts'];

    const result = analyzeChanges(statusLines);

    expect(result.added).toBe(0);
    expect(result.modified).toBe(2);
    expect(result.deleted).toBe(0);
    expect(result.renamed).toBe(0);
  });

  it('should count deleted files', () => {
    const statusLines = ['D  src/file1.ts'];

    const result = analyzeChanges(statusLines);

    expect(result.added).toBe(0);
    expect(result.modified).toBe(0);
    expect(result.deleted).toBe(1);
    expect(result.renamed).toBe(0);
  });

  it('should count renamed files', () => {
    const statusLines = ['R  src/old.ts', 'R  src/another.ts'];

    const result = analyzeChanges(statusLines);

    expect(result.added).toBe(0);
    expect(result.modified).toBe(0);
    expect(result.deleted).toBe(0);
    expect(result.renamed).toBe(2);
  });

  it('should count mixed changes', () => {
    const statusLines = [
      'M  src/file1.ts',
      'A  src/file2.ts',
      'D  src/file3.ts',
      'M  src/file4.ts',
      'R  src/file5.ts',
    ];

    const result = analyzeChanges(statusLines);

    expect(result.added).toBe(1);
    expect(result.modified).toBe(2);
    expect(result.deleted).toBe(1);
    expect(result.renamed).toBe(1);
  });

  it('should ignore untracked files', () => {
    const statusLines = ['M  src/staged.ts', '?? untracked.ts', 'A  src/added.ts'];

    const result = analyzeChanges(statusLines);

    expect(result.added).toBe(1);
    expect(result.modified).toBe(1);
    expect(result.deleted).toBe(0);
    expect(result.renamed).toBe(0);
  });

  it('should ignore unstaged changes', () => {
    const statusLines = ['M  src/staged.ts', ' M src/unstaged.ts'];

    const result = analyzeChanges(statusLines);

    expect(result.added).toBe(0);
    expect(result.modified).toBe(1); // Only staged modification
    expect(result.deleted).toBe(0);
    expect(result.renamed).toBe(0);
  });

  it('should handle real-world git output', () => {
    const statusLines = [
      'M  src/cli.ts',
      'A  src/new-feature.ts',
      'A  src/another-feature.ts',
      'D  src/deprecated.ts',
      'M  src/generator.ts',
      'M  src/types.ts',
    ];

    const result = analyzeChanges(statusLines);

    expect(result.added).toBe(2);
    expect(result.modified).toBe(3);
    expect(result.deleted).toBe(1);
    expect(result.renamed).toBe(0);
  });

  it('should validate the result', () => {
    const statusLines = ['M  src/file.ts'];

    const result = analyzeChanges(statusLines);

    // Result should be a valid ChangeStats object
    expect(result).toHaveProperty('added');
    expect(result).toHaveProperty('modified');
    expect(result).toHaveProperty('deleted');
    expect(result).toHaveProperty('renamed');
    expect(typeof result.added).toBe('number');
    expect(typeof result.modified).toBe('number');
    expect(typeof result.deleted).toBe('number');
    expect(typeof result.renamed).toBe('number');
  });
});

describe('Type Inference', () => {
  it('should infer correct ChangeStats type', () => {
    const stats: ChangeStats = {
      added: 1,
      deleted: 0,
      modified: 2,
      renamed: 0,
    };

    expect(stats.added).toBe(1);
    expect(stats.modified).toBe(2);
    expect(stats.deleted).toBe(0);
    expect(stats.renamed).toBe(0);
  });

  it('should infer correct GitStatusLine type', () => {
    const line: GitStatusLine = {
      filename: 'src/file.ts',
      isStaged: true,
      stagedStatus: 'M',
      statusCode: 'M ',
      unstagedStatus: ' ',
    };

    expect(line.statusCode).toBe('M ');
    expect(line.filename).toBe('src/file.ts');
    expect(line.isStaged).toBe(true);
    expect(line.stagedStatus).toBe('M');
    expect(line.unstagedStatus).toBe(' ');
  });

  it('should infer correct GitStatus type', () => {
    const status: GitStatus = {
      hasChanges: true,
      stagedFiles: ['file.ts'],
      statusLines: ['M  file.ts'],
      unstagedFiles: [],
      untrackedFiles: [],
    };

    expect(status.hasChanges).toBe(true);
    expect(status.stagedFiles).toEqual(['file.ts']);
    expect(status.statusLines).toEqual(['M  file.ts']);
    expect(status.unstagedFiles).toEqual([]);
    expect(status.untrackedFiles).toEqual([]);
  });

  it('should infer correct FileCategories type', () => {
    const categories: FileCategories = {
      apis: [],
      components: ['Button.tsx'],
      configs: [],
      docs: [],
      tests: ['test.ts'],
      types: [],
    };

    expect(categories.tests).toEqual(['test.ts']);
    expect(categories.components).toEqual(['Button.tsx']);
    expect(categories.types).toEqual([]);
    expect(categories.configs).toEqual([]);
    expect(categories.docs).toEqual([]);
    expect(categories.apis).toEqual([]);
  });
});
