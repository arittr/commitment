import { describe, expect, it, mock } from 'bun:test';
import { execa } from 'execa';

import { BaseAgent } from '../base-agent.js';
import type { Agent } from '../types.js';

// Create mock for execa
const mockExeca = mock(() => Promise.resolve({ exitCode: 0, stderr: '', stdout: '' }));

// Mock execa module
mock.module('execa', () => ({
  execa: mockExeca,
}));

/**
 * Concrete test agent for validating BaseAgent template method pattern
 *
 * This mock agent implements the minimal required extension point (executeCommand)
 * and allows testing of the standard flow and default implementations.
 */
class TestAgent extends BaseAgent {
  readonly name = 'TestAgent';

  // Track calls to verify execution order
  public callOrder: string[] = [];

  // Make executeCommand public for testing (override access modifier)
  public async executeCommand(_prompt: string, _workdir: string): Promise<string> {
    this.callOrder.push('executeCommand');
    return 'feat: test commit message\n\nTest description';
  }

  // Override to track calls
  protected override cleanResponse(output: string): string {
    this.callOrder.push('cleanResponse');
    return super.cleanResponse(output);
  }

  // Override to track calls
  protected override validateResponse(message: string): void {
    this.callOrder.push('validateResponse');
    super.validateResponse(message);
  }

  // Expose checkAvailability for testing
  public async testCheckAvailability(cliCommand: string): Promise<void> {
    return this.checkAvailability(cliCommand);
  }
}

/**
 * Test agent that overrides cleanResponse for custom cleaning
 */
class CustomCleanAgent extends BaseAgent {
  readonly name = 'CustomCleanAgent';

  // Make executeCommand public for testing
  public async executeCommand(_prompt: string, _workdir: string): Promise<string> {
    return '[CUSTOM]feat: test\n\nDescription';
  }

  protected override cleanResponse(output: string): string {
    // Custom cleaning: remove [CUSTOM] prefix
    let cleaned = super.cleanResponse(output);
    cleaned = cleaned.replace(/\[CUSTOM\]/g, '');
    return cleaned;
  }
}

/**
 * Test agent that overrides validateResponse with custom validation
 */
class CustomValidateAgent extends BaseAgent {
  readonly name = 'CustomValidateAgent';

  // Make executeCommand public for testing
  public async executeCommand(_prompt: string, _workdir: string): Promise<string> {
    return 'feat: test';
  }

  protected override validateResponse(message: string): void {
    // Custom validation: require "test" in message
    if (!message.includes('test')) {
      throw new Error('Message must include "test"');
    }
  }
}

describe('BaseAgent', () => {
  describe('Template Method Pattern', () => {
    it('should call extension points in correct order', async () => {
      const agent = new TestAgent();

      // Mock execa for availability check
      mockExeca.mockResolvedValue({
        exitCode: 0,
        stderr: '',
        stdout: '',
      } as any);

      const result = await agent.generate('test prompt', '/test/workdir');

      // Verify execution order
      expect(agent.callOrder).toEqual(['executeCommand', 'cleanResponse', 'validateResponse']);

      // Verify result
      expect(result).toBe('feat: test commit message\n\nTest description');
    });

    it('should implement Agent interface', () => {
      const agent: Agent = new TestAgent();
      expect(agent.name).toBe('TestAgent');
      expect(typeof agent.generate).toBe('function');
    });
  });

  describe('checkAvailability', () => {
    it('should check CLI availability with which command', async () => {
      const agent = new TestAgent();

      mockExeca.mockResolvedValue({
        exitCode: 0,
        stderr: '',
        stdout: '/usr/bin/claude',
      } as any);

      await expect(agent.testCheckAvailability('claude')).resolves.toBeUndefined();

      expect(execa).toHaveBeenCalledWith('which', ['claude']);
    });

    it('should throw AgentError when CLI not found', async () => {
      const agent = new TestAgent();

      // Mock ENOENT error
      const error = new Error('Command failed') as any;
      error.code = 'ENOENT';
      mockExeca.mockRejectedValue(error);

      await expect(agent.testCheckAvailability('nonexistent')).rejects.toThrow(
        'CLI command "nonexistent" not found'
      );
    });

    it('should throw generic error for non-ENOENT failures', async () => {
      const agent = new TestAgent();

      const error = new Error('Permission denied');
      mockExeca.mockRejectedValue(error);

      await expect(agent.testCheckAvailability('claude')).rejects.toThrow('Permission denied');
    });
  });

  describe('cleanResponse (default implementation)', () => {
    it('should use cleanAIResponse from agent-utils', async () => {
      const agent = new TestAgent();

      // Mock executeCommand to return response with markdown
      agent.executeCommand = mock().mockResolvedValue('```\nfeat: test\n\nDescription\n```');

      mockExeca.mockResolvedValue({ exitCode: 0, stderr: '', stdout: '' } as any);

      const result = await agent.generate('prompt', '/test');

      // Markdown should be removed by cleanAIResponse
      expect(result).toBe('feat: test\n\nDescription');
    });

    it('should remove thinking tags', async () => {
      const agent = new TestAgent();

      agent.executeCommand = mock(
        async () => '<thinking>analyzing</thinking>\nfeat: test\n\nDescription'
      );

      mockExeca.mockResolvedValue({ exitCode: 0, stderr: '', stdout: '' } as any);

      const result = await agent.generate('prompt', '/test');

      expect(result).toBe('feat: test\n\nDescription');
    });

    it('should normalize excessive newlines', async () => {
      const agent = new TestAgent();

      agent.executeCommand = mock().mockResolvedValue('feat: test\n\n\n\nDescription');

      mockExeca.mockResolvedValue({ exitCode: 0, stderr: '', stdout: '' } as any);

      const result = await agent.generate('prompt', '/test');

      expect(result).toBe('feat: test\n\nDescription');
    });
  });

  describe('validateResponse (default implementation)', () => {
    it('should use validateConventionalCommit from agent-utils', async () => {
      const agent = new TestAgent();

      agent.executeCommand = mock().mockResolvedValue('feat: valid message');

      mockExeca.mockResolvedValue({ exitCode: 0, stderr: '', stdout: '' } as any);

      const result = await agent.generate('prompt', '/test');

      expect(result).toBe('feat: valid message');
    });

    it('should throw error for invalid conventional commit format', async () => {
      const agent = new TestAgent();

      agent.executeCommand = mock().mockResolvedValue('invalid message format');

      mockExeca.mockResolvedValue({ exitCode: 0, stderr: '', stdout: '' } as any);

      await expect(agent.generate('prompt', '/test')).rejects.toThrow(
        'Invalid conventional commit format'
      );
    });

    it('should accept all valid conventional commit types', async () => {
      const agent = new TestAgent();
      const validTypes = ['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore', 'perf'];

      mockExeca.mockResolvedValue({ exitCode: 0, stderr: '', stdout: '' } as any);

      for (const type of validTypes) {
        agent.executeCommand = mock().mockResolvedValue(`${type}: test message`);
        const result = await agent.generate('prompt', '/test');
        expect(result).toBe(`${type}: test message`);
      }
    });

    it('should accept messages with scope', async () => {
      const agent = new TestAgent();

      agent.executeCommand = mock().mockResolvedValue('feat(core): add feature');

      mockExeca.mockResolvedValue({ exitCode: 0, stderr: '', stdout: '' } as any);

      const result = await agent.generate('prompt', '/test');

      expect(result).toBe('feat(core): add feature');
    });
  });

  describe('Extension Points - Custom Implementations', () => {
    it('should allow subclasses to override cleanResponse', async () => {
      const agent = new CustomCleanAgent();

      mockExeca.mockResolvedValue({ exitCode: 0, stderr: '', stdout: '' } as any);

      const result = await agent.generate('prompt', '/test');

      // [CUSTOM] prefix should be removed by custom cleanResponse
      expect(result).toBe('feat: test\n\nDescription');
    });

    it('should allow subclasses to override validateResponse', async () => {
      const agent = new CustomValidateAgent();

      mockExeca.mockResolvedValue({ exitCode: 0, stderr: '', stdout: '' } as any);

      // Should succeed with "test" in message
      const result = await agent.generate('prompt', '/test');
      expect(result).toBe('feat: test');
    });

    it('should throw error when custom validation fails', async () => {
      const agent = new CustomValidateAgent();

      // Override to return message without "test"
      agent.executeCommand = mock().mockResolvedValue('feat: no keyword');

      mockExeca.mockResolvedValue({ exitCode: 0, stderr: '', stdout: '' } as any);

      await expect(agent.generate('prompt', '/test')).rejects.toThrow(
        'Message must include "test"'
      );
    });
  });

  describe('Error Handling', () => {
    it('should propagate executeCommand errors', async () => {
      const agent = new TestAgent();

      agent.executeCommand = mock().mockRejectedValue(new Error('Execution failed'));

      mockExeca.mockResolvedValue({ exitCode: 0, stderr: '', stdout: '' } as any);

      await expect(agent.generate('prompt', '/test')).rejects.toThrow('Execution failed');
    });

    it('should handle empty response from executeCommand', async () => {
      const agent = new TestAgent();

      agent.executeCommand = mock().mockResolvedValue('');

      mockExeca.mockResolvedValue({ exitCode: 0, stderr: '', stdout: '' } as any);

      await expect(agent.generate('prompt', '/test')).rejects.toThrow(
        'Invalid conventional commit format'
      );
    });

    it('should handle response with only whitespace', async () => {
      const agent = new TestAgent();

      agent.executeCommand = mock().mockResolvedValue('   \n\n   ');

      mockExeca.mockResolvedValue({ exitCode: 0, stderr: '', stdout: '' } as any);

      await expect(agent.generate('prompt', '/test')).rejects.toThrow(
        'Invalid conventional commit format'
      );
    });
  });

  describe('Integration', () => {
    it('should work end-to-end with typical flow', async () => {
      const agent = new TestAgent();

      // Mock successful CLI check
      mockExeca.mockResolvedValue({
        exitCode: 0,
        stderr: '',
        stdout: '/usr/bin/test',
      } as any);

      // Mock executeCommand to return realistic output (no leading whitespace on lines)
      agent.executeCommand = mock(
        async () =>
          '```\nfeat(core): add new feature\n\nImplemented feature X with support for Y.\nBreaking change: API signature changed.\n```'
      );

      const result = await agent.generate('test prompt', '/test/workdir');

      expect(result).toBe(
        'feat(core): add new feature\n\nImplemented feature X with support for Y.\nBreaking change: API signature changed.'
      );
    });
  });
});
