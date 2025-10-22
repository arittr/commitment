import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import chalk from 'chalk';

import {
  createCommit,
  displayCommitMessage,
  displayGenerationStatus,
  displayStagedChanges,
  executeCommit,
  getGitStatus,
} from '../helpers';

// Mock console.log
const mockConsoleLog = mock();
const mockConsoleError = mock();

// Mock exec function
const mockExec = mock();

beforeEach(() => {
  spyOn(console, 'log').mockImplementation(mockConsoleLog);
  spyOn(console, 'error').mockImplementation(mockConsoleError);
});

afterEach(() => {
  mock.restore();
  mockConsoleLog.mockClear();
  mockConsoleError.mockClear();
  mockExec.mockClear();
});

// Mock shell module
mock.module('../../utils/shell', () => ({
  exec: mockExec,
}));

describe('displayStagedChanges', () => {
  it('should display staged changes with formatting', () => {
    const gitStatus = {
      hasChanges: true,
      stagedFiles: ['src/file1.ts', 'src/file2.ts'],
      statusLines: ['M  src/file1.ts', 'A  src/file2.ts'],
      unstagedFiles: [],
      untrackedFiles: [],
    };

    displayStagedChanges(gitStatus, false);

    expect(mockConsoleLog).toHaveBeenCalledWith(chalk.cyan('📝 Staged changes:'));
    expect(mockConsoleLog).toHaveBeenCalledWith(
      chalk.gray('  ') + chalk.green('M ') + chalk.white(' src/file1.ts')
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      chalk.gray('  ') + chalk.green('A ') + chalk.white(' src/file2.ts')
    );
    expect(mockConsoleLog).toHaveBeenCalledWith('');
  });

  it('should not display anything when silent is true', () => {
    const gitStatus = {
      hasChanges: true,
      stagedFiles: ['src/file1.ts'],
      statusLines: ['M  src/file1.ts'],
      unstagedFiles: [],
      untrackedFiles: [],
    };

    displayStagedChanges(gitStatus, true);

    expect(mockConsoleLog).not.toHaveBeenCalled();
  });

  it('should handle empty status lines', () => {
    const gitStatus = {
      hasChanges: false,
      stagedFiles: [],
      statusLines: [],
      unstagedFiles: [],
      untrackedFiles: [],
    };

    displayStagedChanges(gitStatus, false);

    expect(mockConsoleLog).toHaveBeenCalledWith(chalk.cyan('📝 Staged changes:'));
    expect(mockConsoleLog).toHaveBeenCalledWith('');
    expect(mockConsoleLog).toHaveBeenCalledTimes(2);
  });
});

describe('displayGenerationStatus', () => {
  it('should display AI generation status', () => {
    displayGenerationStatus('claude', true, false);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      chalk.cyan('🤖 Generating commit message with claude...')
    );
  });

  it('should display rule-based generation status', () => {
    displayGenerationStatus('claude', false, false);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      chalk.cyan('📝 Generating commit message with rules...')
    );
  });

  it('should not display anything when silent is true', () => {
    displayGenerationStatus('claude', true, true);

    expect(mockConsoleLog).not.toHaveBeenCalled();
  });

  it('should display different agent names correctly', () => {
    displayGenerationStatus('codex', true, false);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      chalk.cyan('🤖 Generating commit message with codex...')
    );
  });
});

describe('displayCommitMessage', () => {
  it('should display commit message with formatting in normal mode', () => {
    const message = 'feat: add new feature\n\nThis is the body';

    displayCommitMessage(message, false);

    expect(mockConsoleLog).toHaveBeenCalledWith(chalk.green('✅ Generated commit message'));
    expect(mockConsoleLog).toHaveBeenCalledWith(chalk.green('\n💬 Commit message:'));
    expect(mockConsoleLog).toHaveBeenCalledWith(chalk.white('   feat: add new feature'));
    expect(mockConsoleLog).toHaveBeenCalledWith(chalk.white('   '));
    expect(mockConsoleLog).toHaveBeenCalledWith(chalk.white('   This is the body'));
    expect(mockConsoleLog).toHaveBeenCalledWith('');
  });

  it('should output only message in message-only mode', () => {
    const message = 'feat: add new feature';

    displayCommitMessage(message, true);

    expect(mockConsoleLog).toHaveBeenCalledWith(message);
    expect(mockConsoleLog).toHaveBeenCalledTimes(1);
  });

  it('should handle single-line messages', () => {
    const message = 'fix: resolve bug';

    displayCommitMessage(message, false);

    expect(mockConsoleLog).toHaveBeenCalledWith(chalk.green('✅ Generated commit message'));
    expect(mockConsoleLog).toHaveBeenCalledWith(chalk.green('\n💬 Commit message:'));
    expect(mockConsoleLog).toHaveBeenCalledWith(chalk.white('   fix: resolve bug'));
    expect(mockConsoleLog).toHaveBeenCalledWith('');
  });

  it('should handle multi-line messages with empty lines', () => {
    const message = 'feat: feature\n\nBody line 1\n\nBody line 2';

    displayCommitMessage(message, false);

    // Should have called with each line indented
    const calls = mockConsoleLog.mock.calls;
    expect(calls.some((call) => call[0] === chalk.white('   feat: feature'))).toBe(true);
    expect(calls.some((call) => call[0] === chalk.white('   '))).toBe(true);
    expect(calls.some((call) => call[0] === chalk.white('   Body line 1'))).toBe(true);
  });
});

describe('executeCommit', () => {
  it('should not do anything in message-only mode', async () => {
    await executeCommit('feat: message', '/tmp/repo', false, true);

    expect(mockConsoleLog).not.toHaveBeenCalled();
    expect(mockExec).not.toHaveBeenCalled();
  });

  it('should display dry-run message without creating commit', async () => {
    await executeCommit('feat: message', '/tmp/repo', true, false);

    expect(mockConsoleLog).toHaveBeenCalledWith(chalk.blue('🚀 DRY RUN - No commit created'));
    expect(mockConsoleLog).toHaveBeenCalledWith(
      chalk.gray('   Remove --dry-run to create the commit')
    );
    expect(mockExec).not.toHaveBeenCalled();
  });

  it('should create commit and display success message', async () => {
    mockExec.mockResolvedValue({
      exitCode: 0,
      stderr: '',
      stdout: '',
    });

    await executeCommit('feat: message', '/tmp/repo', false, false);

    expect(mockExec).toHaveBeenCalledWith('git', ['commit', '-m', 'feat: message'], {
      cwd: '/tmp/repo',
    });
    expect(mockConsoleLog).toHaveBeenCalledWith(chalk.green('✅ Commit created successfully'));
  });

  it('should throw error if commit creation fails', async () => {
    const error = new Error('Git error');
    mockExec.mockRejectedValue(error);

    await expect(executeCommit('feat: message', '/tmp/repo', false, false)).rejects.toThrow(
      'Failed to create commit: Git error'
    );
  });
});

describe('createCommit', () => {
  it('should execute git commit with message', async () => {
    mockExec.mockResolvedValue({
      exitCode: 0,
      stderr: '',
      stdout: '',
    });

    await createCommit('feat: add feature', '/tmp/repo');

    expect(mockExec).toHaveBeenCalledWith('git', ['commit', '-m', 'feat: add feature'], {
      cwd: '/tmp/repo',
    });
  });

  it('should throw error on git failure', async () => {
    const error = new Error('Commit failed');
    mockExec.mockRejectedValue(error);

    await expect(createCommit('feat: message', '/tmp/repo')).rejects.toThrow(
      'Failed to create commit: Commit failed'
    );
  });

  it('should handle non-Error exceptions', async () => {
    mockExec.mockRejectedValue('string error');

    await expect(createCommit('feat: message', '/tmp/repo')).rejects.toThrow(
      'Failed to create commit: string error'
    );
  });
});

describe('getGitStatus', () => {
  it('should parse git status output successfully', async () => {
    const gitOutput = 'M  src/file1.ts\nA  src/file2.ts';
    mockExec.mockResolvedValue({
      exitCode: 0,
      stderr: '',
      stdout: gitOutput,
    });

    const result = await getGitStatus('/tmp/repo');

    expect(mockExec).toHaveBeenCalledWith('git', ['status', '--porcelain'], { cwd: '/tmp/repo' });
    expect(result.hasChanges).toBe(true);
    expect(result.stagedFiles).toEqual(['src/file1.ts', 'src/file2.ts']);
  });

  it('should handle empty git status', async () => {
    mockExec.mockResolvedValue({
      exitCode: 0,
      stderr: '',
      stdout: '',
    });

    const result = await getGitStatus('/tmp/repo');

    expect(result.hasChanges).toBe(false);
    expect(result.stagedFiles).toEqual([]);
  });

  it('should throw error on git command failure', async () => {
    const error = new Error('Git command failed');
    mockExec.mockRejectedValue(error);

    await expect(getGitStatus('/tmp/repo')).rejects.toThrow(
      'Failed to get git status: Git command failed'
    );
  });

  it('should provide helpful error for malformed git status', async () => {
    const gitOutput = 'INVALID LINE FORMAT';
    mockExec.mockResolvedValue({
      exitCode: 0,
      stderr: '',
      stdout: gitOutput,
    });

    await expect(getGitStatus('/tmp/repo')).rejects.toThrow(/Invalid git status output/);
    await expect(getGitStatus('/tmp/repo')).rejects.toThrow(/git version incompatibility/);
  });

  it('should handle non-Error exceptions from git', async () => {
    mockExec.mockRejectedValue('string error');

    await expect(getGitStatus('/tmp/repo')).rejects.toThrow(
      'Failed to get git status: string error'
    );
  });
});
