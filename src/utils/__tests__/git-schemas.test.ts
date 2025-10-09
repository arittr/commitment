import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import type { FileCategories, GitStatus, GitStatusLine } from '../git-schemas';

import {
  categorizeFiles,
  fileCategoriesSchema,
  gitStatusLineSchema,
  gitStatusSchema,
  parseGitStatus,
  safeValidateFileCategories,
  safeValidateGitStatus,
  safeValidateGitStatusLine,
  validateFileCategories,
  validateGitStatus,
  validateGitStatusLine,
} from '../git-schemas';

describe('Git Schemas', () => {
  describe('gitStatusLineSchema', () => {
    describe('valid status lines', () => {
      it('should parse modified file (M )', () => {
        const line = 'M  src/file.ts';

        const result = gitStatusLineSchema.parse(line);

        expect(result.statusCode).toBe('M ');
        expect(result.filename).toBe('src/file.ts');
        expect(result.isStaged).toBe(true);
        expect(result.stagedStatus).toBe('M');
        expect(result.unstagedStatus).toBe(' ');
      });

      it('should parse added file (A )', () => {
        const line = 'A  src/new.ts';

        const result = gitStatusLineSchema.parse(line);

        expect(result.statusCode).toBe('A ');
        expect(result.filename).toBe('src/new.ts');
        expect(result.isStaged).toBe(true);
        expect(result.stagedStatus).toBe('A');
        expect(result.unstagedStatus).toBe(' ');
      });

      it('should parse deleted file (D )', () => {
        const line = 'D  src/old.ts';

        const result = gitStatusLineSchema.parse(line);

        expect(result.statusCode).toBe('D ');
        expect(result.filename).toBe('src/old.ts');
        expect(result.isStaged).toBe(true);
        expect(result.stagedStatus).toBe('D');
        expect(result.unstagedStatus).toBe(' ');
      });

      it('should parse renamed file (R )', () => {
        const line = 'R  src/renamed.ts';

        const result = gitStatusLineSchema.parse(line);

        expect(result.statusCode).toBe('R ');
        expect(result.filename).toBe('src/renamed.ts');
        expect(result.isStaged).toBe(true);
        expect(result.stagedStatus).toBe('R');
        expect(result.unstagedStatus).toBe(' ');
      });

      it('should parse untracked file (??)', () => {
        const line = '?? untracked.ts';

        const result = gitStatusLineSchema.parse(line);

        expect(result.statusCode).toBe('??');
        expect(result.filename).toBe('untracked.ts');
        expect(result.isStaged).toBe(false);
        expect(result.stagedStatus).toBe('?');
        expect(result.unstagedStatus).toBe('?');
      });

      it('should parse unstaged modification ( M)', () => {
        const line = ' M src/unstaged.ts';

        const result = gitStatusLineSchema.parse(line);

        expect(result.statusCode).toBe(' M');
        expect(result.filename).toBe('src/unstaged.ts');
        expect(result.isStaged).toBe(false);
        expect(result.stagedStatus).toBe(' ');
        expect(result.unstagedStatus).toBe('M');
      });

      it('should parse modified and unstaged (MM)', () => {
        const line = 'MM src/both.ts';

        const result = gitStatusLineSchema.parse(line);

        expect(result.statusCode).toBe('MM');
        expect(result.filename).toBe('src/both.ts');
        expect(result.isStaged).toBe(true);
        expect(result.stagedStatus).toBe('M');
        expect(result.unstagedStatus).toBe('M');
      });

      it('should parse file with path containing spaces', () => {
        const line = 'M  src/file with spaces.ts';

        const result = gitStatusLineSchema.parse(line);

        expect(result.statusCode).toBe('M ');
        expect(result.filename).toBe('src/file with spaces.ts');
        expect(result.isStaged).toBe(true);
      });

      it('should parse file with deep path', () => {
        const line = 'A  src/very/deep/nested/path/file.ts';

        const result = gitStatusLineSchema.parse(line);

        expect(result.statusCode).toBe('A ');
        expect(result.filename).toBe('src/very/deep/nested/path/file.ts');
        expect(result.isStaged).toBe(true);
      });

      it('should parse copied file (C )', () => {
        const line = 'C  src/copied.ts';

        const result = gitStatusLineSchema.parse(line);

        expect(result.statusCode).toBe('C ');
        expect(result.filename).toBe('src/copied.ts');
        expect(result.isStaged).toBe(true);
        expect(result.stagedStatus).toBe('C');
        expect(result.unstagedStatus).toBe(' ');
      });

      it('should parse updated but unmerged (U )', () => {
        const line = 'U  src/unmerged.ts';

        const result = gitStatusLineSchema.parse(line);

        expect(result.statusCode).toBe('U ');
        expect(result.filename).toBe('src/unmerged.ts');
        expect(result.isStaged).toBe(true);
        expect(result.stagedStatus).toBe('U');
        expect(result.unstagedStatus).toBe(' ');
      });

      it('should parse ignored file (!!)', () => {
        const line = '!! .env';

        const result = gitStatusLineSchema.parse(line);

        expect(result.statusCode).toBe('!!');
        expect(result.filename).toBe('.env');
        // Ignored files are treated as staged since they don't start with '?' or ' '
        expect(result.isStaged).toBe(true);
      });
    });

    describe('invalid status lines', () => {
      it('should reject empty string', () => {
        expect(() => gitStatusLineSchema.parse('')).toThrow(ZodError);
      });

      it('should reject line with only status code', () => {
        expect(() => gitStatusLineSchema.parse('M ')).toThrow(ZodError);
      });

      it('should reject line with only 3 characters', () => {
        expect(() => gitStatusLineSchema.parse('M a')).toThrow(ZodError);
      });

      it('should reject line with invalid status code', () => {
        expect(() => gitStatusLineSchema.parse('XX file.ts')).toThrow(ZodError);
      });

      it('should reject line with non-string input', () => {
        expect(() => gitStatusLineSchema.parse(123)).toThrow(ZodError);
      });

      it('should reject null input', () => {
        expect(() => gitStatusLineSchema.parse(null)).toThrow(ZodError);
      });

      it('should reject undefined input', () => {
        expect(() => gitStatusLineSchema.parse(undefined)).toThrow(ZodError);
      });

      it('should reject line with invalid characters in status code', () => {
        expect(() => gitStatusLineSchema.parse('Z@ file.ts')).toThrow(ZodError);
      });

      it('should reject line with only status code and space', () => {
        expect(() => gitStatusLineSchema.parse('M  ')).toThrow(ZodError);
      });
    });
  });

  describe('gitStatusSchema', () => {
    describe('valid git status objects', () => {
      it('should validate minimal git status', () => {
        const status = {
          hasChanges: false,
          stagedFiles: [],
          statusLines: [],
        };

        const result = gitStatusSchema.parse(status);

        expect(result.hasChanges).toBe(false);
        expect(result.stagedFiles).toEqual([]);
        expect(result.statusLines).toEqual([]);
        expect(result.unstagedFiles).toEqual([]);
        expect(result.untrackedFiles).toEqual([]);
      });

      it('should validate git status with staged files', () => {
        const status = {
          hasChanges: true,
          stagedFiles: ['src/file.ts', 'src/other.ts'],
          statusLines: ['M  src/file.ts', 'A  src/other.ts'],
        };

        const result = gitStatusSchema.parse(status);

        expect(result.hasChanges).toBe(true);
        expect(result.stagedFiles).toHaveLength(2);
        expect(result.statusLines).toHaveLength(2);
      });

      it('should validate git status with all fields', () => {
        const status = {
          hasChanges: true,
          stagedFiles: ['src/staged.ts'],
          statusLines: ['M  src/staged.ts'],
          unstagedFiles: ['src/unstaged.ts'],
          untrackedFiles: ['untracked.ts'],
        };

        const result = gitStatusSchema.parse(status);

        expect(result).toEqual(status);
      });

      it('should apply default empty arrays for optional fields', () => {
        const status = {
          hasChanges: true,
          stagedFiles: ['src/file.ts'],
          statusLines: ['M  src/file.ts'],
        };

        const result = gitStatusSchema.parse(status);

        expect(result.unstagedFiles).toEqual([]);
        expect(result.untrackedFiles).toEqual([]);
      });

      it('should validate status with many files', () => {
        const status = {
          hasChanges: true,
          stagedFiles: Array.from({ length: 100 }, (_, index) => `src/file-${index}.ts`),
          statusLines: Array.from({ length: 100 }, (_, index) => `M  src/file-${index}.ts`),
        };

        const result = gitStatusSchema.parse(status);

        expect(result.stagedFiles).toHaveLength(100);
        expect(result.statusLines).toHaveLength(100);
      });

      it('should validate status with empty arrays explicitly set', () => {
        const status = {
          hasChanges: false,
          stagedFiles: [],
          statusLines: [],
          unstagedFiles: [],
          untrackedFiles: [],
        };

        const result = gitStatusSchema.parse(status);

        expect(result.unstagedFiles).toEqual([]);
        expect(result.untrackedFiles).toEqual([]);
      });
    });

    describe('invalid git status objects', () => {
      it('should reject missing hasChanges', () => {
        const status = {
          stagedFiles: [],
          statusLines: [],
        };

        expect(() => gitStatusSchema.parse(status)).toThrow(ZodError);
      });

      it('should reject missing stagedFiles', () => {
        const status = {
          hasChanges: false,
          statusLines: [],
        };

        expect(() => gitStatusSchema.parse(status)).toThrow(ZodError);
      });

      it('should reject missing statusLines', () => {
        const status = {
          hasChanges: false,
          stagedFiles: [],
        };

        expect(() => gitStatusSchema.parse(status)).toThrow(ZodError);
      });

      it('should reject non-boolean hasChanges', () => {
        const status = {
          hasChanges: 'true',
          stagedFiles: [],
          statusLines: [],
        };

        expect(() => gitStatusSchema.parse(status)).toThrow(ZodError);
      });

      it('should reject non-array stagedFiles', () => {
        const status = {
          hasChanges: false,
          stagedFiles: 'not-an-array',
          statusLines: [],
        };

        expect(() => gitStatusSchema.parse(status)).toThrow(ZodError);
      });

      it('should reject non-array statusLines', () => {
        const status = {
          hasChanges: false,
          stagedFiles: [],
          statusLines: 'not-an-array',
        };

        expect(() => gitStatusSchema.parse(status)).toThrow(ZodError);
      });

      it('should reject stagedFiles with non-string elements', () => {
        const status = {
          hasChanges: true,
          stagedFiles: ['file.ts', 123, null],
          statusLines: [],
        };

        expect(() => gitStatusSchema.parse(status)).toThrow(ZodError);
      });

      it('should reject null input', () => {
        expect(() => gitStatusSchema.parse(null)).toThrow(ZodError);
      });

      it('should reject undefined input', () => {
        expect(() => gitStatusSchema.parse(undefined)).toThrow(ZodError);
      });
    });
  });

  describe('fileCategoriesSchema', () => {
    describe('valid file categories', () => {
      it('should validate empty categories', () => {
        const categories = {};

        const result = fileCategoriesSchema.parse(categories);

        expect(result.tests).toEqual([]);
        expect(result.components).toEqual([]);
        expect(result.types).toEqual([]);
        expect(result.configs).toEqual([]);
        expect(result.docs).toEqual([]);
        expect(result.apis).toEqual([]);
      });

      it('should validate categories with all fields', () => {
        const categories = {
          tests: ['file.test.ts'],
          components: ['Button.tsx'],
          types: ['types.ts'],
          configs: ['package.json'],
          docs: ['README.md'],
          apis: ['api.ts'],
        };

        const result = fileCategoriesSchema.parse(categories);

        expect(result).toEqual(categories);
      });

      it('should validate categories with some fields', () => {
        const categories = {
          tests: ['file.test.ts'],
          components: ['Button.tsx'],
        };

        const result = fileCategoriesSchema.parse(categories);

        expect(result.tests).toEqual(['file.test.ts']);
        expect(result.components).toEqual(['Button.tsx']);
        expect(result.types).toEqual([]);
        expect(result.configs).toEqual([]);
        expect(result.docs).toEqual([]);
        expect(result.apis).toEqual([]);
      });

      it('should validate categories with many files', () => {
        const categories = {
          tests: Array.from({ length: 50 }, (_, index) => `test-${index}.test.ts`),
        };

        const result = fileCategoriesSchema.parse(categories);

        expect(result.tests).toHaveLength(50);
      });

      it('should apply default empty arrays for missing fields', () => {
        const categories = {
          tests: ['test.ts'],
        };

        const result = fileCategoriesSchema.parse(categories);

        expect(result.components).toEqual([]);
        expect(result.types).toEqual([]);
        expect(result.configs).toEqual([]);
        expect(result.docs).toEqual([]);
        expect(result.apis).toEqual([]);
      });
    });

    describe('invalid file categories', () => {
      it('should reject non-array tests', () => {
        const categories = {
          tests: 'not-an-array',
        };

        expect(() => fileCategoriesSchema.parse(categories)).toThrow(ZodError);
      });

      it('should reject non-array components', () => {
        const categories = {
          components: { file: 'Button.tsx' },
        };

        expect(() => fileCategoriesSchema.parse(categories)).toThrow(ZodError);
      });

      it('should reject arrays with non-string elements', () => {
        const categories = {
          tests: ['valid.test.ts', 123, null],
        };

        expect(() => fileCategoriesSchema.parse(categories)).toThrow(ZodError);
      });

      it('should reject null input', () => {
        expect(() => fileCategoriesSchema.parse(null)).toThrow(ZodError);
      });

      it('should reject string input', () => {
        expect(() => fileCategoriesSchema.parse('invalid')).toThrow(ZodError);
      });
    });
  });

  describe('Validation Helper Functions', () => {
    describe('validateGitStatusLine', () => {
      it('should validate valid status line', () => {
        const line = 'M  src/file.ts';

        const result = validateGitStatusLine(line);

        expect(result.filename).toBe('src/file.ts');
        expect(result.isStaged).toBe(true);
      });

      it('should throw ZodError for invalid line', () => {
        expect(() => validateGitStatusLine('invalid')).toThrow(ZodError);
      });

      it('should throw ZodError for non-string input', () => {
        expect(() => validateGitStatusLine(123)).toThrow(ZodError);
      });
    });

    describe('validateGitStatus', () => {
      it('should validate valid status object', () => {
        const status = {
          hasChanges: true,
          stagedFiles: ['file.ts'],
          statusLines: ['M  file.ts'],
        };

        const result = validateGitStatus(status);

        expect(result.hasChanges).toBe(true);
      });

      it('should throw ZodError for invalid status', () => {
        const status = {
          hasChanges: 'invalid',
          stagedFiles: [],
          statusLines: [],
        };

        expect(() => validateGitStatus(status)).toThrow(ZodError);
      });
    });

    describe('validateFileCategories', () => {
      it('should validate valid categories', () => {
        const categories = {
          tests: ['test.ts'],
          components: [],
        };

        const result = validateFileCategories(categories);

        expect(result.tests).toEqual(['test.ts']);
      });

      it('should throw ZodError for invalid categories', () => {
        const categories = {
          tests: 'not-an-array',
        };

        expect(() => validateFileCategories(categories)).toThrow(ZodError);
      });
    });
  });

  describe('Safe Validation Helper Functions', () => {
    describe('safeValidateGitStatusLine', () => {
      it('should return success for valid line', () => {
        const line = 'M  src/file.ts';

        const result = safeValidateGitStatusLine(line);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.filename).toBe('src/file.ts');
        }
      });

      it('should return error for invalid line', () => {
        const line = 'invalid';

        const result = safeValidateGitStatusLine(line);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(ZodError);
        }
      });

      it('should not throw for invalid input', () => {
        expect(() => safeValidateGitStatusLine(null)).not.toThrow();
        expect(() => safeValidateGitStatusLine(undefined)).not.toThrow();
        expect(() => safeValidateGitStatusLine(123)).not.toThrow();
      });
    });

    describe('safeValidateGitStatus', () => {
      it('should return success for valid status', () => {
        const status = {
          hasChanges: false,
          stagedFiles: [],
          statusLines: [],
        };

        const result = safeValidateGitStatus(status);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.hasChanges).toBe(false);
        }
      });

      it('should return error for invalid status', () => {
        const status = {
          hasChanges: 'invalid',
        };

        const result = safeValidateGitStatus(status);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(ZodError);
        }
      });

      it('should not throw for invalid input', () => {
        expect(() => safeValidateGitStatus(null)).not.toThrow();
        expect(() => safeValidateGitStatus('string')).not.toThrow();
        expect(() => safeValidateGitStatus([])).not.toThrow();
      });
    });

    describe('safeValidateFileCategories', () => {
      it('should return success for valid categories', () => {
        const categories = {
          tests: ['test.ts'],
        };

        const result = safeValidateFileCategories(categories);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.tests).toEqual(['test.ts']);
        }
      });

      it('should return error for invalid categories', () => {
        const categories = {
          tests: 'not-an-array',
        };

        const result = safeValidateFileCategories(categories);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(ZodError);
        }
      });

      it('should not throw for invalid input', () => {
        expect(() => safeValidateFileCategories(null)).not.toThrow();
        expect(() => safeValidateFileCategories([])).not.toThrow();
        expect(() => safeValidateFileCategories('string')).not.toThrow();
      });
    });
  });

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

  describe('Type Inference', () => {
    it('should infer correct GitStatusLine type', () => {
      const line: GitStatusLine = {
        statusCode: 'M ',
        filename: 'src/file.ts',
        isStaged: true,
        stagedStatus: 'M',
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
        tests: ['test.ts'],
        components: ['Button.tsx'],
        types: [],
        configs: [],
        docs: [],
        apis: [],
      };

      expect(categories.tests).toEqual(['test.ts']);
      expect(categories.components).toEqual(['Button.tsx']);
      expect(categories.types).toEqual([]);
      expect(categories.configs).toEqual([]);
      expect(categories.docs).toEqual([]);
      expect(categories.apis).toEqual([]);
    });
  });
});
