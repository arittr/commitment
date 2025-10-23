/**
 * Git provider interface for dependency injection
 *
 * Allows the generator to work with real git commands or mocked data.
 * This enables the eval system to provide fixture data without file system side effects.
 *
 * @example
 * ```typescript
 * // Real git provider (default)
 * const realGit = new RealGitProvider();
 * const output = await realGit.exec(['diff', '--cached'], '/path/to/repo');
 *
 * // Mock git provider (for testing/eval)
 * const mockGit = new MockGitProvider({
 *   diff: 'diff --git a/file.ts...',
 *   status: 'M  file.ts'
 * });
 * const output = await mockGit.exec(['diff', '--cached'], '/tmp/fake');
 * ```
 */

import { exec as execCommand } from './shell';

/**
 * Git provider interface
 *
 * Abstracts git command execution to allow mocking for eval/test scenarios.
 */
export interface GitProvider {
  /**
   * Execute a git command
   *
   * @param args - Git command arguments (e.g., ['diff', '--cached'])
   * @param cwd - Working directory
   * @returns Command stdout
   * @throws {Error} If command fails
   */
  exec(args: string[], cwd: string): Promise<string>;
}

/**
 * Real git provider that executes actual git commands
 *
 * Default implementation used by the CLI.
 */
export class RealGitProvider implements GitProvider {
  async exec(args: string[], cwd: string): Promise<string> {
    const result = await execCommand('git', args, { cwd });
    return result.stdout;
  }
}

/**
 * Mock git provider for eval/test scenarios
 *
 * Returns pre-defined fixture data instead of executing real git commands.
 *
 * @example
 * ```typescript
 * const mockGit = new MockGitProvider({
 *   diff: 'diff --git a/src/file.ts...',
 *   status: 'M  src/file.ts'
 * });
 *
 * // Returns mocked diff
 * const diff = await mockGit.exec(['diff', '--cached'], '/tmp/fake');
 * ```
 */
export class MockGitProvider implements GitProvider {
  /**
   * Create a mock git provider with fixture data
   *
   * @param fixtureData - Mocked git output data
   */
  constructor(
    private readonly fixtureData: {
      /** Git diff content */
      diff: string;
      /** Git status output */
      status: string;
    }
  ) {}

  async exec(args: string[], _cwd: string): Promise<string> {
    // Match common git commands and return appropriate fixture data
    const command = args.join(' ');

    // All diff variants return the same diff content
    if (command.includes('diff')) {
      // For --stat, generate stats from diff
      if (command.includes('--stat')) {
        return this._generateDiffStat();
      }

      // For --name-status, extract files from status
      if (command.includes('--name-status')) {
        return this._generateNameStatus();
      }

      // For regular diff (with or without --unified, --ignore-space-change, etc.)
      return this.fixtureData.diff;
    }

    // Status command
    if (command.includes('status')) {
      return this.fixtureData.status;
    }

    // Unknown command - return empty string (safe fallback)
    return '';
  }

  /**
   * Generate git diff --stat output from fixture status
   *
   * Simple implementation that creates basic stats.
   */
  private _generateDiffStat(): string {
    const lines = this.fixtureData.status.split('\n').filter((line) => line.trim().length > 0);
    const fileCount = lines.length;

    if (fileCount === 0) {
      return '';
    }

    // Simple stats: just list files with placeholder change counts
    const stats = lines
      .map((line) => {
        const filename = line.slice(3).trim();
        return ` ${filename} | 2 +-`;
      })
      .join('\n');

    return `${stats}\n ${fileCount} file${fileCount > 1 ? 's' : ''} changed, 2 insertions(+), 1 deletion(-)`;
  }

  /**
   * Generate git diff --name-status output from fixture status
   *
   * Converts git status format to name-status format.
   */
  private _generateNameStatus(): string {
    const lines = this.fixtureData.status.split('\n').filter((line) => line.trim().length > 0);

    return lines
      .map((line) => {
        const statusCode = line.slice(0, 2).trim();
        const filename = line.slice(3).trim();

        // Convert status code to name-status format
        // M = Modified, A = Added, D = Deleted, R = Renamed
        const status = statusCode.includes('M')
          ? 'M'
          : statusCode.includes('A')
            ? 'A'
            : statusCode.includes('D')
              ? 'D'
              : statusCode.includes('R')
                ? 'R'
                : 'M';

        return `${status}\t${filename}`;
      })
      .join('\n');
  }
}
