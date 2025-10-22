import { execa } from 'execa';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClaudeAgent } from '../claude';

// Mock execa before importing ClaudeAgent
vi.mock('execa', () => ({
  execa: vi.fn(),
}));

describe('ClaudeAgent', () => {
  let agent: ClaudeAgent;
  let mockExeca: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    agent = new ClaudeAgent();
    mockExeca = vi.mocked(execa);
    mockExeca.mockReset();
  });

  /**
   * Helper to mock successful which + claude command
   */
  const mockSuccessfulGeneration = (output: string): void => {
    mockExeca.mockImplementation(async (cmd: string) => {
      if (cmd === 'which') {
        return { stdout: '/usr/local/bin/claude' } as never;
      }
      if (cmd === 'claude') {
        return { stdout: output } as never;
      }
      throw new Error('Unexpected command');
    });
  };

  describe('name', () => {
    it('should return correct agent name', () => {
      expect(agent.name).toBe('Claude CLI');
    });
  });

  describe('generate', () => {
    it('should generate commit message from prompt', async () => {
      // Mock successful which + claude command
      mockSuccessfulGeneration(
        'feat: add dark mode toggle\n\nImplement theme switching functionality'
      );

      const prompt = 'Generate commit message for adding dark mode';
      const workdir = '/tmp/test-repo';

      const message = await agent.generate(prompt, workdir);

      expect(message).toBe('feat: add dark mode toggle\n\nImplement theme switching functionality');
      expect(mockExeca).toHaveBeenCalledWith('which', ['Claude CLI']);
      expect(mockExeca).toHaveBeenCalledWith(
        'claude',
        ['--print'],
        expect.objectContaining({
          cwd: workdir,
          input: prompt,
        })
      );
    });

    it('should clean AI artifacts from response', async () => {
      // Mock successful which + claude command with markdown artifacts
      mockSuccessfulGeneration('```\nfeat: add feature\n\nDetails here\n```');

      const message = await agent.generate('prompt', '/tmp');

      // Should clean markdown code blocks (via BaseAgent.cleanResponse)
      expect(message).toBe('feat: add feature\n\nDetails here');
    });

    it('should throw error when CLI is not found', async () => {
      // Mock which command to fail (CLI not found)
      mockExeca.mockImplementation(async (cmd: string) => {
        if (cmd === 'which') {
          throw { code: 'ENOENT', message: 'spawn which ENOENT' };
        }
        throw new Error('Unexpected command');
      });

      await expect(agent.generate('prompt', '/tmp')).rejects.toThrow(
        /CLI command "Claude CLI" not found/
      );
    });

    it('should throw error when response is empty', async () => {
      mockSuccessfulGeneration('');

      await expect(agent.generate('prompt', '/tmp')).rejects.toThrow(
        /Invalid conventional commit format/
      );
    });

    it('should throw error when response is whitespace only', async () => {
      mockSuccessfulGeneration('   \n\n  ');

      await expect(agent.generate('prompt', '/tmp')).rejects.toThrow(
        /Invalid conventional commit format/
      );
    });

    it('should throw error when response is malformed', async () => {
      mockSuccessfulGeneration('Not a valid commit message format');

      await expect(agent.generate('prompt', '/tmp')).rejects.toThrow(
        /Invalid conventional commit format/
      );
    });

    it('should accept valid conventional commit types', async () => {
      const validTypes = [
        'feat: add feature',
        'fix: fix bug',
        'docs: update docs',
        'style: format code',
        'refactor: refactor code',
        'perf: improve performance',
        'test: add tests',
        'chore: update tooling',
        'build: update build',
        'ci: update ci',
      ];

      for (const message of validTypes) {
        mockSuccessfulGeneration(message);

        const result = await agent.generate('prompt', '/tmp');
        expect(result).toBe(message);
      }
    });

    it('should clean multiple types of AI artifacts', async () => {
      mockSuccessfulGeneration('```typescript\nfeat: add feature\n```');

      const message = await agent.generate('prompt', '/tmp');
      expect(message).toBe('feat: add feature');
    });

    it('should handle timeout parameter', async () => {
      mockSuccessfulGeneration('feat: test');

      await agent.generate('prompt', '/tmp');

      expect(mockExeca).toHaveBeenCalledWith(
        'claude',
        ['--print'],
        expect.objectContaining({
          timeout: 120_000,
        })
      );
    });

    it('should clean COMMIT_MESSAGE markers from response', async () => {
      // Mock successful generation with commit message markers
      mockSuccessfulGeneration(`<<<COMMIT_MESSAGE_START>>>
feat: add constitution v2 and improve documentation

- Add comprehensive v2 constitution
- Update CLAUDE.md with v2 references
<<<COMMIT_MESSAGE_END>>>`);

      const message = await agent.generate('prompt', '/tmp');

      // Should clean markers via ClaudeAgent.cleanResponse override
      expect(message).toBe(
        `feat: add constitution v2 and improve documentation

- Add comprehensive v2 constitution
- Update CLAUDE.md with v2 references`
      );
    });

    it('should clean COMMIT_MESSAGE markers with extra whitespace', async () => {
      // Mock successful generation with markers and extra whitespace
      mockSuccessfulGeneration(`
<<<COMMIT_MESSAGE_START>>>

feat: add feature

- Implement new functionality
<<<COMMIT_MESSAGE_END>>>
`);

      const message = await agent.generate('prompt', '/tmp');

      // Should clean markers and trim whitespace
      expect(message).toBe(`feat: add feature

- Implement new functionality`);
    });
  });
});
