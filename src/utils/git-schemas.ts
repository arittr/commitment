import { z } from 'zod';

/**
 * Git status codes as they appear in git status --porcelain output
 *
 * Format: Two character status code followed by space and filename
 * - First character: staged status
 * - Second character: unstaged status
 *
 * Common status codes:
 * - M = Modified
 * - A = Added
 * - D = Deleted
 * - R = Renamed
 * - C = Copied
 * - U = Updated but unmerged
 * - ? = Untracked
 * - ! = Ignored
 * - Space = Unmodified
 */

/**
 * Schema for a single git status line from git status --porcelain
 *
 * Format: "XY filename" where:
 * - X is the staged status
 * - Y is the unstaged status
 * - filename is the file path (starts at position 3)
 *
 * @example
 * ```typescript
 * const line = "M  src/file.ts";
 * const validated = validateGitStatusLine(line);
 * // { statusCode: "M ", filename: "src/file.ts", isStaged: true }
 * ```
 */
export const gitStatusLineSchema = z
  .string()
  .min(4, 'Git status line must have at least 4 characters (status code + space + filename)')
  .refine(
    (line) => {
      // Must have status code (2 chars) + space + filename
      if (line.length < 4) {
        return false;
      }

      // Check if positions 0-1 are valid status codes
      const statusCode = line.slice(0, 2);
      return /^[ !?ACDMRU]{2}$/.test(statusCode);
    },
    {
      message: 'Invalid git status line format. Expected: "XY filename" where XY is status code',
    },
  )
  .transform((line) => {
    const statusCode = line.slice(0, 2);
    const filename = line.slice(3); // Skip status code and space

    // Determine if file is staged
    // Staged if first character is not space or ?
    const isStaged = !statusCode.startsWith('?') && !statusCode.startsWith(' ');

    // Extract individual status codes
    const stagedStatus = statusCode[0] ?? ' ';
    const unstagedStatus = statusCode[1] ?? ' ';

    return {
      statusCode,
      filename,
      isStaged,
      stagedStatus,
      unstagedStatus,
    };
  });

/**
 * Schema for parsed git status output
 *
 * Represents the complete output from git status --porcelain,
 * parsed into structured data.
 *
 * @example
 * ```typescript
 * const status = {
 *   hasChanges: true,
 *   stagedFiles: ['src/file.ts'],
 *   statusLines: ['M  src/file.ts'],
 *   unstagedFiles: [],
 *   untrackedFiles: []
 * };
 *
 * const validated = validateGitStatus(status);
 * ```
 */
export const gitStatusSchema = z.object({
  /**
   * Whether there are any staged changes
   */
  hasChanges: z.boolean(),

  /**
   * List of staged files (filenames only)
   */
  stagedFiles: z.array(z.string()),

  /**
   * Raw status lines for staged files
   */
  statusLines: z.array(z.string()),

  /**
   * List of unstaged files (filenames only)
   */
  unstagedFiles: z.array(z.string()).optional().default([]),

  /**
   * List of untracked files (filenames only)
   */
  untrackedFiles: z.array(z.string()).optional().default([]),
});

/**
 * Schema for file categories based on file patterns
 *
 * Used to categorize files by their type/purpose for intelligent
 * commit message generation.
 *
 * @example
 * ```typescript
 * const categories = {
 *   tests: ['src/__tests__/file.test.ts'],
 *   components: ['src/components/Button.tsx'],
 *   types: ['src/types/index.ts'],
 *   configs: ['package.json'],
 *   docs: ['README.md'],
 *   apis: ['src/api/users.ts']
 * };
 *
 * const validated = validateFileCategories(categories);
 * ```
 */
export const fileCategoriesSchema = z.object({
  /**
   * Test files (includes 'test', 'spec')
   */
  tests: z.array(z.string()).default([]),

  /**
   * Component files (.tsx, .jsx, or 'component')
   */
  components: z.array(z.string()).default([]),

  /**
   * Type definition files ('types', .d.ts)
   */
  types: z.array(z.string()).default([]),

  /**
   * Configuration files ('config', .json, .yaml, .toml)
   */
  configs: z.array(z.string()).default([]),

  /**
   * Documentation files (.md, README)
   */
  docs: z.array(z.string()).default([]),

  /**
   * API/service files ('api', 'service', 'adapter')
   */
  apis: z.array(z.string()).default([]),
});

/**
 * Schema for git change statistics
 *
 * Represents counts of different types of file changes based on
 * git status codes.
 *
 * @example
 * ```typescript
 * const stats = {
 *   added: 2,
 *   modified: 5,
 *   deleted: 1,
 *   renamed: 0
 * };
 *
 * const validated = validateChangeStats(stats);
 * ```
 */
export const changeStatsSchema = z.object({
  /**
   * Number of added files (status code 'A')
   */
  added: z.number().int().nonnegative().default(0),

  /**
   * Number of modified files (status code 'M')
   */
  modified: z.number().int().nonnegative().default(0),

  /**
   * Number of deleted files (status code 'D')
   */
  deleted: z.number().int().nonnegative().default(0),

  /**
   * Number of renamed files (status code 'R')
   */
  renamed: z.number().int().nonnegative().default(0),
});

/**
 * TypeScript types inferred from Zod schemas
 */
export type GitStatusLine = z.infer<typeof gitStatusLineSchema>;
export type GitStatus = z.infer<typeof gitStatusSchema>;
export type FileCategories = z.infer<typeof fileCategoriesSchema>;
export type ChangeStats = z.infer<typeof changeStatsSchema>;

/**
 * Type alias for file categorization (commonly used name)
 */
export type FileCategorization = FileCategories;

/**
 * Validates a git status line string
 *
 * @param line - Git status line from git status --porcelain
 * @returns Parsed and validated git status line with metadata
 * @throws ZodError if validation fails
 *
 * @example
 * ```typescript
 * const line = "M  src/file.ts";
 * const parsed = validateGitStatusLine(line);
 * // { statusCode: "M ", filename: "src/file.ts", isStaged: true }
 * ```
 */
export function validateGitStatusLine(line: unknown): GitStatusLine {
  return gitStatusLineSchema.parse(line);
}

/**
 * Validates a git status object
 *
 * @param status - Git status object to validate
 * @returns Validated and typed git status
 * @throws ZodError if validation fails
 *
 * @example
 * ```typescript
 * const status = {
 *   hasChanges: true,
 *   stagedFiles: ['src/file.ts'],
 *   statusLines: ['M  src/file.ts']
 * };
 *
 * const validated = validateGitStatus(status);
 * ```
 */
export function validateGitStatus(status: unknown): GitStatus {
  return gitStatusSchema.parse(status);
}

/**
 * Validates file categories object
 *
 * @param categories - File categories object to validate
 * @returns Validated and typed file categories
 * @throws ZodError if validation fails
 *
 * @example
 * ```typescript
 * const categories = {
 *   tests: ['file.test.ts'],
 *   components: ['Button.tsx']
 * };
 *
 * const validated = validateFileCategories(categories);
 * ```
 */
export function validateFileCategories(categories: unknown): FileCategories {
  return fileCategoriesSchema.parse(categories);
}

/**
 * Safely validates a git status line with error handling
 *
 * @param line - Git status line to validate
 * @returns Success result with parsed line or failure result with error
 *
 * @example
 * ```typescript
 * const result = safeValidateGitStatusLine("M  src/file.ts");
 *
 * if (result.success) {
 *   console.log('Parsed:', result.data);
 * } else {
 *   console.error('Error:', result.error);
 * }
 * ```
 */
export function safeValidateGitStatusLine(
  line: unknown,
): { data: GitStatusLine; success: true } | { error: z.ZodError; success: false } {
  return gitStatusLineSchema.safeParse(line);
}

/**
 * Safely validates a git status object with error handling
 *
 * @param status - Git status object to validate
 * @returns Success result with validated status or failure result with error
 *
 * @example
 * ```typescript
 * const result = safeValidateGitStatus(unknownStatus);
 *
 * if (result.success) {
 *   console.log('Valid status:', result.data);
 * } else {
 *   console.error('Validation failed:', result.error);
 * }
 * ```
 */
export function safeValidateGitStatus(
  status: unknown,
): { data: GitStatus; success: true } | { error: z.ZodError; success: false } {
  return gitStatusSchema.safeParse(status);
}

/**
 * Safely validates file categories with error handling
 *
 * @param categories - File categories to validate
 * @returns Success result with validated categories or failure result with error
 *
 * @example
 * ```typescript
 * const result = safeValidateFileCategories(unknownCategories);
 *
 * if (result.success) {
 *   console.log('Valid categories:', result.data);
 * } else {
 *   console.error('Validation failed:', result.error);
 * }
 * ```
 */
export function safeValidateFileCategories(
  categories: unknown,
): { data: FileCategories; success: true } | { error: z.ZodError; success: false } {
  return fileCategoriesSchema.safeParse(categories);
}

/**
 * Parse raw git status output into structured format
 *
 * Takes the raw output from `git status --porcelain` and parses it
 * into a structured GitStatus object with categorized files.
 *
 * @param rawOutput - Raw output from git status --porcelain command
 * @returns Parsed and validated git status object
 * @throws ZodError if git output is malformed
 *
 * @example
 * ```typescript
 * const gitOutput = "M  src/file.ts\nA  src/new.ts\n?? untracked.ts";
 * const status = parseGitStatus(gitOutput);
 * // {
 * //   hasChanges: true,
 * //   stagedFiles: ['src/file.ts', 'src/new.ts'],
 * //   statusLines: ['M  src/file.ts', 'A  src/new.ts'],
 * //   untrackedFiles: ['untracked.ts']
 * // }
 * ```
 */
export function parseGitStatus(rawOutput: string): GitStatus {
  const lines = rawOutput.split('\n').filter((line) => line.trim() !== '');

  const stagedLines: string[] = [];
  const stagedFiles: string[] = [];
  const unstagedFiles: string[] = [];
  const untrackedFiles: string[] = [];

  for (const line of lines) {
    try {
      const parsed = validateGitStatusLine(line);

      if (parsed.statusCode.startsWith('?')) {
        // Untracked file
        untrackedFiles.push(parsed.filename);
      } else if (parsed.isStaged) {
        // Staged file
        stagedLines.push(line);
        stagedFiles.push(parsed.filename);
      } else {
        // Unstaged file
        unstagedFiles.push(parsed.filename);
      }
    } catch (error) {
      // Provide better error context for malformed lines
      throw new Error(
        `Malformed git status line: "${line}". ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return {
    hasChanges: stagedLines.length > 0,
    stagedFiles,
    statusLines: stagedLines,
    unstagedFiles,
    untrackedFiles,
  };
}

/**
 * Validates change statistics object
 *
 * @param stats - Change statistics object to validate
 * @returns Validated and typed change statistics
 * @throws ZodError if validation fails
 *
 * @example
 * ```typescript
 * const stats = {
 *   added: 2,
 *   modified: 5,
 *   deleted: 1,
 *   renamed: 0
 * };
 *
 * const validated = validateChangeStats(stats);
 * ```
 */
export function validateChangeStats(stats: unknown): ChangeStats {
  return changeStatsSchema.parse(stats);
}

/**
 * Safely validates change statistics with error handling
 *
 * @param stats - Change statistics to validate
 * @returns Success result with validated stats or failure result with error
 *
 * @example
 * ```typescript
 * const result = safeValidateChangeStats(unknownStats);
 *
 * if (result.success) {
 *   console.log('Valid stats:', result.data);
 * } else {
 *   console.error('Validation failed:', result.error);
 * }
 * ```
 */
export function safeValidateChangeStats(
  stats: unknown,
): { data: ChangeStats; success: true } | { error: z.ZodError; success: false } {
  return changeStatsSchema.safeParse(stats);
}

/**
 * Categorize files by their type/purpose
 *
 * Analyzes file paths to categorize them into common types
 * (tests, components, types, configs, docs, apis) for intelligent
 * commit message generation.
 *
 * @param files - Array of file paths to categorize
 * @returns Categorized files object
 * @throws ZodError if categorization result is invalid
 *
 * @example
 * ```typescript
 * const files = [
 *   'src/__tests__/file.test.ts',
 *   'src/components/Button.tsx',
 *   'README.md'
 * ];
 *
 * const categories = categorizeFiles(files);
 * // {
 * //   tests: ['src/__tests__/file.test.ts'],
 * //   components: ['src/components/Button.tsx'],
 * //   docs: ['README.md'],
 * //   types: [],
 * //   configs: [],
 * //   apis: []
 * // }
 * ```
 */
export function categorizeFiles(files: string[]): FileCategories {
  const categories: FileCategories = {
    components: [],
    apis: [],
    tests: [],
    configs: [],
    docs: [],
    types: [],
  };

  for (const file of files) {
    const lower = file.toLowerCase();

    if (lower.includes('component') || lower.endsWith('.tsx') || lower.endsWith('.jsx')) {
      categories.components.push(file);
    } else if (lower.includes('api') || lower.includes('endpoint') || lower.includes('route')) {
      categories.apis.push(file);
    } else if (lower.includes('test') || lower.includes('spec')) {
      categories.tests.push(file);
    } else if (lower.includes('config') || lower.endsWith('.json') || lower.endsWith('.yaml')) {
      categories.configs.push(file);
    } else if (lower.endsWith('.md') || lower.includes('readme') || lower.includes('doc')) {
      categories.docs.push(file);
    } else if (lower.includes('type') || lower.endsWith('.d.ts')) {
      categories.types.push(file);
    }
  }

  return validateFileCategories(categories);
}

/**
 * Analyze git status lines to extract change statistics
 *
 * Counts the number of files that were added, modified, deleted, or renamed
 * based on git status codes.
 *
 * @param statusLines - Array of git status lines (from git status --porcelain)
 * @returns Change statistics with counts for each change type
 * @throws ZodError if result validation fails
 *
 * @example
 * ```typescript
 * const statusLines = [
 *   'M  src/file1.ts',
 *   'A  src/file2.ts',
 *   'D  src/file3.ts',
 *   'M  src/file4.ts'
 * ];
 *
 * const stats = analyzeChanges(statusLines);
 * // { added: 1, modified: 2, deleted: 1, renamed: 0 }
 * ```
 */
export function analyzeChanges(statusLines: string[]): ChangeStats {
  const stats: ChangeStats = {
    added: statusLines.filter((line) => line.startsWith('A ')).length,
    modified: statusLines.filter((line) => line.startsWith('M ')).length,
    deleted: statusLines.filter((line) => line.startsWith('D ')).length,
    renamed: statusLines.filter((line) => line.startsWith('R ')).length,
  };

  return validateChangeStats(stats);
}
