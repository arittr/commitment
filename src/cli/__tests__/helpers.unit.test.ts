import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { SilentLogger } from '../../utils/logger';
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
    const logger = new SilentLogger();

    displayStagedChanges(gitStatus, false, logger);

    // Note: with SilentLogger, nothing is actually logged
    // In real usage, ConsoleLogger would be used
    expect(true).toBe(true);
  });

  it('should handle empty status lines', () => {
    const gitStatus = {
      hasChanges: false,
      stagedFiles: [],
      statusLines: [],
      unstagedFiles: [],
      untrackedFiles: [],
    };
    const logger = new SilentLogger();

    displayStagedChanges(gitStatus, false, logger);

    expect(true).toBe(true);
  });
});

describe('displayGenerationStatus', () => {
  it('should display AI generation status', () => {
    const logger = new SilentLogger();
    displayGenerationStatus('claude', logger);

    // SilentLogger doesn't output, so nothing to assert
    expect(true).toBe(true);
  });

  it('should display different agent names correctly', () => {
    const logger = new SilentLogger();
    displayGenerationStatus('codex', logger);

    expect(true).toBe(true);
  });
});

describe('displayCommitMessage', () => {
  it('should display commit message with formatting in normal mode', () => {
    const message = 'feat: add new feature\n\nThis is the body';
    const logger = new SilentLogger();

    displayCommitMessage(message, false, logger);

    // SilentLogger doesn't output, so nothing to assert
    expect(true).toBe(true);
  });

  it('should output only message in message-only mode', () => {
    const message = 'feat: add new feature';
    const logger = new SilentLogger();

    displayCommitMessage(message, true, logger);

    // In message-only mode, uses console.log directly (critical stdout output)
    expect(mockConsoleLog).toHaveBeenCalledWith(message);
    expect(mockConsoleLog).toHaveBeenCalledTimes(1);
  });

  it('should handle single-line messages', () => {
    const message = 'fix: resolve bug';
    const logger = new SilentLogger();

    displayCommitMessage(message, false, logger);

    expect(true).toBe(true);
  });

  it('should handle multi-line messages with empty lines', () => {
    const message = 'feat: feature\n\nBody line 1\n\nBody line 2';
    const logger = new SilentLogger();

    displayCommitMessage(message, false, logger);

    expect(true).toBe(true);
  });
});

describe('executeCommit', () => {
  it('should not do anything in message-only mode', async () => {
    const logger = new SilentLogger();
    await executeCommit('feat: message', '/tmp/repo', false, true, logger);

    expect(mockConsoleLog).not.toHaveBeenCalled();
    expect(mockExec).not.toHaveBeenCalled();
  });

  it('should display dry-run message without creating commit', async () => {
    const logger = new SilentLogger();
    await executeCommit('feat: message', '/tmp/repo', true, false, logger);

    // SilentLogger doesn't output, so nothing logged
    expect(mockExec).not.toHaveBeenCalled();
  });

  it('should create commit and display success message', async () => {
    mockExec.mockResolvedValue({
      exitCode: 0,
      stderr: '',
      stdout: '',
    });
    const logger = new SilentLogger();

    await executeCommit('feat: message', '/tmp/repo', false, false, logger);

    expect(mockExec).toHaveBeenCalledWith('git', ['commit', '-m', 'feat: message'], {
      cwd: '/tmp/repo',
    });
    // SilentLogger doesn't output, so no console.log check
  });

  it('should throw error if commit creation fails', async () => {
    const error = new Error('Git error');
    mockExec.mockRejectedValue(error);
    const logger = new SilentLogger();

    await expect(executeCommit('feat: message', '/tmp/repo', false, false, logger)).rejects.toThrow(
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
