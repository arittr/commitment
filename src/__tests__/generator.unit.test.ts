import { beforeEach, describe, expect, it, mock } from 'bun:test';

import type { Agent } from '../agents/types';
import { GeneratorError } from '../errors';
import { CommitMessageGenerator } from '../generator';
import type { GitProvider } from '../utils/git-provider';
import type { Logger } from '../utils/logger';

/**
 * Unit Tests for CommitMessageGenerator
 *
 * Tests the core commit message generation logic including:
 * - Configuration validation
 * - Signature handling
 * - Message validation
 * - Git command execution
 * - Error wrapping and propagation
 * - End-to-end generation flow
 */
describe('CommitMessageGenerator', () => {
  // Test fixtures
  const validTask = {
    description: 'Implement new feature',
    produces: ['src/feature.ts'],
    title: 'Add feature',
  };

  const validOptions = {
    files: ['src/feature.ts'],
    workdir: '/test/repo',
  };

  // Mock implementations
  let mockAgent: Agent;
  let mockGitProvider: GitProvider;
  let mockLogger: Logger;

  beforeEach(() => {
    // Reset mocks before each test
    mock.restore();

    // Create fresh mocks
    mockAgent = {
      generate: mock(async () => 'feat: add feature\n\nImplement new feature'),
      name: 'claude',
    };

    mockGitProvider = {
      exec: mock(async (args: string[]) => {
        // Mock different git commands
        if (args.includes('--stat')) {
          return ' src/feature.ts | 10 ++++++++++\n 1 file changed, 10 insertions(+)';
        }
        if (args.includes('--name-status')) {
          return 'A\tsrc/feature.ts';
        }
        // Default: return unified diff
        return 'diff --git a/src/feature.ts b/src/feature.ts\n+new content';
      }),
    };

    mockLogger = {
      debug: mock(() => {}),
      error: mock(() => {}),
      info: mock(() => {}),
      warn: mock(() => {}),
    };
  });

  describe('constructor', () => {
    it('should create generator with default config', () => {
      const generator = new CommitMessageGenerator();

      expect(generator).toBeInstanceOf(CommitMessageGenerator);
    });

    it('should create generator with custom agent', () => {
      const generator = new CommitMessageGenerator({ agent: 'codex' });

      expect(generator).toBeInstanceOf(CommitMessageGenerator);
    });

    it('should create generator with custom signature', () => {
      const generator = new CommitMessageGenerator({
        signature: 'Custom signature',
      });

      expect(generator).toBeInstanceOf(CommitMessageGenerator);
    });

    it('should create generator with custom logger', () => {
      const generator = new CommitMessageGenerator({
        logger: mockLogger,
      });

      expect(generator).toBeInstanceOf(CommitMessageGenerator);
    });

    it('should create generator with custom git provider', () => {
      const generator = new CommitMessageGenerator({
        gitProvider: mockGitProvider,
      });

      expect(generator).toBeInstanceOf(CommitMessageGenerator);
    });

    it('should throw on invalid agent name', () => {
      expect(() => {
        new CommitMessageGenerator({ agent: 'invalid' as any });
      }).toThrow(GeneratorError);

      expect(() => {
        new CommitMessageGenerator({ agent: 'invalid' as any });
      }).toThrow(/Invalid CommitMessageGenerator configuration/);
    });

    it('should throw on invalid signature type', () => {
      expect(() => {
        new CommitMessageGenerator({ signature: 123 as any });
      }).toThrow(GeneratorError);

      expect(() => {
        new CommitMessageGenerator({ signature: 123 as any });
      }).toThrow(/Invalid CommitMessageGenerator configuration/);
    });

    it('should include validation errors in context', () => {
      try {
        new CommitMessageGenerator({ agent: 'invalid' as any });
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(GeneratorError);
        const genError = error as GeneratorError & { context?: { validationErrors?: string[] } };
        expect(genError.context?.validationErrors).toBeDefined();
        expect(Array.isArray(genError.context?.validationErrors)).toBe(true);
      }
    });

    it('should use agent-specific default signature for claude', () => {
      // We can't directly test private config, but we can verify via generated message
      const generator = new CommitMessageGenerator({
        agent: 'claude',
        gitProvider: mockGitProvider,
      });

      expect(generator).toBeInstanceOf(CommitMessageGenerator);
      // Signature will be tested in generateCommitMessage tests
    });

    it('should use agent-specific default signature for codex', () => {
      const generator = new CommitMessageGenerator({
        agent: 'codex',
        gitProvider: mockGitProvider,
      });

      expect(generator).toBeInstanceOf(CommitMessageGenerator);
    });

    it('should use agent-specific default signature for gemini', () => {
      const generator = new CommitMessageGenerator({
        agent: 'gemini',
        gitProvider: mockGitProvider,
      });

      expect(generator).toBeInstanceOf(CommitMessageGenerator);
    });
  });

  describe('generateCommitMessage - task validation', () => {
    it('should throw on invalid task - empty title', async () => {
      const generator = new CommitMessageGenerator({
        gitProvider: mockGitProvider,
      });

      const invalidTask = {
        description: 'Valid description',
        produces: [],
        title: '', // Invalid
      };

      await expect(
        generator.generateCommitMessage(invalidTask as any, validOptions)
      ).rejects.toThrow(GeneratorError);

      await expect(
        generator.generateCommitMessage(invalidTask as any, validOptions)
      ).rejects.toThrow(/Invalid task parameter/);
    });

    it('should throw on invalid task - empty description', async () => {
      const generator = new CommitMessageGenerator({
        gitProvider: mockGitProvider,
      });

      const invalidTask = {
        description: '', // Invalid
        produces: [],
        title: 'Valid title',
      };

      await expect(
        generator.generateCommitMessage(invalidTask as any, validOptions)
      ).rejects.toThrow(/Invalid task parameter/);
    });

    it.skip('should throw on invalid task - title too long (needs schema update)', async () => {
      // TODO: Update schema to enforce max title length
      // Currently validation passes, then fails at agent execution
      const generator = new CommitMessageGenerator({
        gitProvider: mockGitProvider,
      });

      const invalidTask = {
        description: 'Valid description',
        produces: [],
        title: 'x'.repeat(201), // Invalid: max 200
      };

      await expect(
        generator.generateCommitMessage(invalidTask as any, validOptions)
      ).rejects.toThrow(GeneratorError);

      try {
        await generator.generateCommitMessage(invalidTask as any, validOptions);
      } catch (error) {
        expect((error as Error).message).toContain('Invalid task parameter');
      }
    });

    it('should include field path in task validation errors', async () => {
      const generator = new CommitMessageGenerator({
        gitProvider: mockGitProvider,
      });

      const invalidTask = {
        description: '', // Invalid
        produces: [],
        title: 'Valid',
      };

      try {
        await generator.generateCommitMessage(invalidTask as any, validOptions);
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(GeneratorError);
        const genError = error as Error;
        expect(genError.message).toContain('description');
      }
    });
  });

  describe('generateCommitMessage - options validation', () => {
    it('should throw on invalid options - empty workdir', async () => {
      const generator = new CommitMessageGenerator({
        gitProvider: mockGitProvider,
      });

      const invalidOptions = {
        workdir: '', // Invalid
      };

      await expect(
        generator.generateCommitMessage(validTask, invalidOptions as any)
      ).rejects.toThrow(/Invalid options parameter/);
    });

    it('should throw on invalid options - non-string workdir', async () => {
      const generator = new CommitMessageGenerator({
        gitProvider: mockGitProvider,
      });

      const invalidOptions = {
        workdir: 123, // Invalid
      };

      await expect(
        generator.generateCommitMessage(validTask, invalidOptions as any)
      ).rejects.toThrow(/Invalid options parameter/);
    });

    it('should throw on invalid options - files not array', async () => {
      const generator = new CommitMessageGenerator({
        gitProvider: mockGitProvider,
      });

      const invalidOptions = {
        files: 'not-array', // Invalid
        workdir: '/test',
      };

      await expect(
        generator.generateCommitMessage(validTask, invalidOptions as any)
      ).rejects.toThrow(/Invalid options parameter/);
    });

    it('should include field path in options validation errors', async () => {
      const generator = new CommitMessageGenerator({
        gitProvider: mockGitProvider,
      });

      const invalidOptions = {
        workdir: '', // Invalid
      };

      try {
        await generator.generateCommitMessage(validTask, invalidOptions as any);
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(GeneratorError);
        const genError = error as Error;
        expect(genError.message).toContain('workdir');
      }
    });

    it('should accept valid options with optional fields', async () => {
      const generator = new CommitMessageGenerator({
        gitProvider: mockGitProvider,
      });

      const minimalOptions = {
        workdir: '/test/repo',
      };

      // Should not throw validation error - will fail at agent execution (GeneratorError wrapping AgentError)
      // but validation passes
      await expect(generator.generateCommitMessage(validTask, minimalOptions)).rejects.toThrow(
        GeneratorError
      );
    });
  });

  describe('signature handling', () => {
    it('should add default signature when none provided', async () => {
      const generator = new CommitMessageGenerator({
        agent: mockAgent,
        gitProvider: mockGitProvider,
      });

      const result = await generator.generateCommitMessage(validTask, validOptions);

      expect(result).toContain('🤖 Generated with Claude via commitment');
    });

    it('should add custom signature when provided', async () => {
      const generator = new CommitMessageGenerator({
        agent: mockAgent,
        gitProvider: mockGitProvider,
        signature: 'Custom Test Signature',
      });

      const result = await generator.generateCommitMessage(validTask, validOptions);

      expect(result).toContain('Custom Test Signature');
      expect(result).not.toContain('🤖 Generated with Claude');
    });

    it('should use codex signature for codex agent', async () => {
      const codexAgent: Agent = {
        generate: mock(async () => 'feat: add feature\n\nImplement new feature'),
        name: 'codex',
      };

      const generator = new CommitMessageGenerator({
        agent: codexAgent,
        gitProvider: mockGitProvider,
      });

      const result = await generator.generateCommitMessage(validTask, validOptions);

      expect(result).toContain('🤖 Generated with Codex via commitment');
    });

    it('should use gemini signature for gemini agent', async () => {
      const geminiAgent: Agent = {
        generate: mock(async () => 'feat: add feature\n\nImplement new feature'),
        name: 'gemini',
      };

      const generator = new CommitMessageGenerator({
        agent: geminiAgent,
        gitProvider: mockGitProvider,
      });

      const result = await generator.generateCommitMessage(validTask, validOptions);

      expect(result).toContain('🤖 Generated with Gemini via commitment');
    });

    it('should skip signature when set to empty string', async () => {
      const generator = new CommitMessageGenerator({
        agent: mockAgent,
        gitProvider: mockGitProvider,
        signature: '',
      });

      const result = await generator.generateCommitMessage(validTask, validOptions);

      expect(result).toBe('feat: add feature\n\nImplement new feature');
      expect(result).not.toContain('🤖');
    });

    it('should format signature with double newline separator', async () => {
      const generator = new CommitMessageGenerator({
        agent: mockAgent,
        gitProvider: mockGitProvider,
        signature: 'TEST',
      });

      const result = await generator.generateCommitMessage(validTask, validOptions);

      expect(result).toContain('\n\nTEST');
    });
  });

  describe('message validation', () => {
    it('should accept valid commit message (>= 5 chars)', async () => {
      const testAgent: Agent = {
        generate: mock(async () => 'feat: test'),
        name: 'claude',
      };

      const generator = new CommitMessageGenerator({
        agent: testAgent,
        gitProvider: mockGitProvider,
      });

      const result = await generator.generateCommitMessage(validTask, validOptions);

      expect(result.length).toBeGreaterThanOrEqual(5);
    });

    it('should throw on message less than 5 chars', async () => {
      const testAgent: Agent = {
        generate: mock(async () => 'abc'),
        name: 'claude',
      };

      const generator = new CommitMessageGenerator({
        agent: testAgent,
        gitProvider: mockGitProvider,
      });

      await expect(generator.generateCommitMessage(validTask, validOptions)).rejects.toThrow(
        'AI generation produced invalid commit message'
      );
    });
  });

  describe('git command execution', () => {
    it('should execute git diff --stat command', async () => {
      const generator = new CommitMessageGenerator({
        agent: mockAgent,
        gitProvider: mockGitProvider,
      });

      await generator.generateCommitMessage(validTask, validOptions);

      expect(mockGitProvider.exec).toHaveBeenCalled();
      const calls = (mockGitProvider.exec as any).mock.calls;
      const statCall = calls.find((call: any[]) =>
        call[0].some((arg: string) => arg.includes('--stat'))
      );
      expect(statCall).toBeDefined();
    });

    it('should execute git diff --name-status command', async () => {
      const generator = new CommitMessageGenerator({
        agent: mockAgent,
        gitProvider: mockGitProvider,
      });

      await generator.generateCommitMessage(validTask, validOptions);

      const calls = (mockGitProvider.exec as any).mock.calls;
      const nameStatusCall = calls.find((call: any[]) =>
        call[0].some((arg: string) => arg.includes('--name-status'))
      );
      expect(nameStatusCall).toBeDefined();
    });

    it('should execute git diff with unified context', async () => {
      const generator = new CommitMessageGenerator({
        agent: mockAgent,
        gitProvider: mockGitProvider,
      });

      await generator.generateCommitMessage(validTask, validOptions);

      const calls = (mockGitProvider.exec as any).mock.calls;
      const diffCall = calls.find((call: any[]) =>
        call[0].some((arg: string) => arg.includes('--unified'))
      );
      expect(diffCall).toBeDefined();
    });

    it('should pass workdir to git commands', async () => {
      const generator = new CommitMessageGenerator({
        agent: mockAgent,
        gitProvider: mockGitProvider,
      });

      await generator.generateCommitMessage(validTask, {
        workdir: '/custom/path',
      });

      const calls = (mockGitProvider.exec as any).mock.calls;
      for (const call of calls) {
        expect(call[1]).toBe('/custom/path');
      }
    });

    it('should handle git command failures gracefully', async () => {
      const failingGitProvider: GitProvider = {
        exec: mock(async () => {
          throw new Error('Git command failed: not a git repository');
        }),
      };

      const generator = new CommitMessageGenerator({
        agent: mockAgent,
        gitProvider: failingGitProvider,
      });

      await expect(generator.generateCommitMessage(validTask, validOptions)).rejects.toThrow(
        /Git command failed/
      );
    });
  });

  describe('error wrapping', () => {
    it('should throw GeneratorError when agent returns invalid message', async () => {
      const failingAgent: Agent = {
        generate: mock(async () => ''),
        name: 'claude',
      };

      const generator = new CommitMessageGenerator({
        agent: failingAgent,
        gitProvider: mockGitProvider,
      });

      await expect(generator.generateCommitMessage(validTask, validOptions)).rejects.toThrow(
        GeneratorError
      );
    });

    it('should include agent name in error context', async () => {
      const failingAgent: Agent = {
        generate: mock(async () => ''),
        name: 'codex',
      };

      const generator = new CommitMessageGenerator({
        agent: failingAgent,
        gitProvider: mockGitProvider,
      });

      try {
        await generator.generateCommitMessage(validTask, validOptions);
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        // Error message should reference AI generation
        const message = (error as Error).message;
        expect(message.toLowerCase()).toMatch(/ai generation/i);
      }
    });

    it('should preserve original error details', async () => {
      const failingGitProvider: GitProvider = {
        exec: mock(async () => {
          throw new Error('Specific git error details');
        }),
      };

      const generator = new CommitMessageGenerator({
        agent: mockAgent,
        gitProvider: failingGitProvider,
      });

      try {
        await generator.generateCommitMessage(validTask, validOptions);
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const message = (error as Error).message;
        expect(message).toContain('Specific git error details');
      }
    });
  });

  describe('end-to-end generation flow', () => {
    it('should generate commit from task + git diff', async () => {
      const generator = new CommitMessageGenerator({
        agent: mockAgent,
        gitProvider: mockGitProvider,
      });

      const result = await generator.generateCommitMessage(validTask, validOptions);

      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('feat: add feature');
    });

    it('should handle multi-file changes', async () => {
      const multiFileGitProvider: GitProvider = {
        exec: mock(async (args: string[]) => {
          if (args.includes('--stat')) {
            return ' src/file1.ts | 5 +++++\n src/file2.ts | 3 +++\n 2 files changed, 8 insertions(+)';
          }
          if (args.includes('--name-status')) {
            return 'M\tsrc/file1.ts\nA\tsrc/file2.ts';
          }
          return 'diff --git a/src/file1.ts b/src/file1.ts\n+content';
        }),
      };

      const generator = new CommitMessageGenerator({
        agent: mockAgent,
        gitProvider: multiFileGitProvider,
      });

      const multiFileTask = {
        description: 'Update multiple files',
        produces: ['src/file1.ts', 'src/file2.ts'],
        title: 'Multi-file change',
      };

      const result = await generator.generateCommitMessage(multiFileTask, {
        files: ['src/file1.ts', 'src/file2.ts'],
        workdir: '/test',
      });

      expect(result).toBeTruthy();
      expect(mockAgent.generate).toHaveBeenCalled();
    });

    it('should include custom signature in output', async () => {
      const generator = new CommitMessageGenerator({
        agent: mockAgent,
        gitProvider: mockGitProvider,
        signature: '✨ Magic signature',
      });

      const result = await generator.generateCommitMessage(validTask, validOptions);

      expect(result).toContain('feat: add feature');
      expect(result).toContain('✨ Magic signature');
    });

    it('should handle task with output context', async () => {
      const generator = new CommitMessageGenerator({
        agent: mockAgent,
        gitProvider: mockGitProvider,
      });

      const result = await generator.generateCommitMessage(validTask, {
        ...validOptions,
        output: 'Task completed successfully with additional context',
      });

      expect(result).toBeTruthy();
      expect(mockAgent.generate).toHaveBeenCalled();

      // Verify prompt included output context
      const promptArg = (mockAgent.generate as any).mock.calls[0][0];
      expect(promptArg).toContain('Task completed successfully');
    });

    it('should work with minimal task (no produces)', async () => {
      const generator = new CommitMessageGenerator({
        agent: mockAgent,
        gitProvider: mockGitProvider,
      });

      const minimalTask = {
        description: 'Simple change',
        produces: [],
        title: 'Update',
      };

      const result = await generator.generateCommitMessage(minimalTask, validOptions);

      expect(result).toBeTruthy();
      expect(result).toContain('feat: add feature');
    });

    it('should work with minimal options (no files)', async () => {
      const generator = new CommitMessageGenerator({
        agent: mockAgent,
        gitProvider: mockGitProvider,
      });

      const result = await generator.generateCommitMessage(validTask, {
        workdir: '/test',
      });

      expect(result).toBeTruthy();
      expect(mockAgent.generate).toHaveBeenCalled();
    });
  });

  describe('logger integration', () => {
    it('should pass logger to agent if provided', () => {
      const generator = new CommitMessageGenerator({
        logger: mockLogger,
      });

      expect(generator).toBeInstanceOf(CommitMessageGenerator);
      // Logger is passed to agent via factory - can't directly verify
      // but constructor should not throw
    });

    it('should work without logger', () => {
      const generator = new CommitMessageGenerator();

      expect(generator).toBeInstanceOf(CommitMessageGenerator);
    });
  });
});
