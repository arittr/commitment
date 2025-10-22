import { describe, expect, it } from 'vitest';

import { AgentError, GeneratorError, isAgentError, isGeneratorError } from '../errors.js';

describe('AgentError', () => {
  describe('constructor', () => {
    it('should create error with message', () => {
      const error = new AgentError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AgentError);
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('AgentError');
    });

    it('should include agentName in error', () => {
      const error = new AgentError('Test error', { agentName: 'Claude CLI' });

      expect(error.agentName).toBe('Claude CLI');
    });

    it('should include cause in error', () => {
      const cause = new Error('Original error');
      const error = new AgentError('Wrapped error', { cause });

      expect(error.cause).toBe(cause);
    });

    it('should include context in error', () => {
      const error = new AgentError('Test error', {
        context: { command: 'claude', workdir: '/tmp' },
      });

      expect(error.context).toEqual({ command: 'claude', workdir: '/tmp' });
    });

    it('should include suggestedAction in error', () => {
      const error = new AgentError('Test error', {
        suggestedAction: 'Try running: npm install -g @anthropic-ai/claude-cli',
      });

      expect(error.suggestedAction).toBe('Try running: npm install -g @anthropic-ai/claude-cli');
    });

    it('should include all options together', () => {
      const cause = new Error('Original');
      const error = new AgentError('Test error', {
        agentName: 'Claude CLI',
        cause,
        context: { command: 'claude' },
        suggestedAction: 'Install Claude CLI',
      });

      expect(error.agentName).toBe('Claude CLI');
      expect(error.cause).toBe(cause);
      expect(error.context).toEqual({ command: 'claude' });
      expect(error.suggestedAction).toBe('Install Claude CLI');
    });
  });

  describe('CLI not found error pattern', () => {
    it('should create actionable error for missing CLI', () => {
      const error = AgentError.cliNotFound('claude', 'Claude CLI');

      expect(error.message).toContain('claude');
      expect(error.message).toContain('not found');
      expect(error.agentName).toBe('Claude CLI');
      expect(error.suggestedAction).toContain('install');
      expect(error.suggestedAction).toContain('npm install');
    });

    it('should include installation instructions for Claude', () => {
      const error = AgentError.cliNotFound('claude', 'Claude CLI');

      expect(error.suggestedAction).toContain('npm install -g @anthropic-ai/claude-cli');
      expect(error.suggestedAction).toContain('brew install claude-cli');
    });

    it('should include installation instructions for Codex', () => {
      const error = AgentError.cliNotFound('codex', 'Codex CLI');

      expect(error.suggestedAction).toContain('npm install -g codex');
    });
  });

  describe('execution failed error pattern', () => {
    it('should create actionable error for execution failure', () => {
      const cause = new Error('Command failed');
      const error = AgentError.executionFailed('Claude CLI', 1, 'API key not configured', cause);

      expect(error.message).toContain('execution failed');
      expect(error.message).toContain('code: 1');
      expect(error.agentName).toBe('Claude CLI');
      expect(error.cause).toBe(cause);
      expect(error.suggestedAction).toContain('API key');
    });
  });

  describe('malformed response error pattern', () => {
    it('should create actionable error for invalid response', () => {
      const error = AgentError.malformedResponse(
        'Claude CLI',
        'Here is your message...',
        'Expected conventional commit format',
      );

      expect(error.message).toContain('malformed response');
      expect(error.message).toContain('Expected conventional commit format');
      expect(error.agentName).toBe('Claude CLI');
      expect(error.context).toHaveProperty('receivedOutput');
      expect(error.suggestedAction).toBeDefined();
      expect(error.suggestedAction?.toLowerCase()).toContain('conventional commit');
    });

    it('should truncate long output in context', () => {
      const longOutput = 'x'.repeat(200);
      const error = AgentError.malformedResponse('Claude CLI', longOutput);

      const receivedOutput = error.context?.receivedOutput as string;
      expect(receivedOutput.length).toBeLessThan(150);
      expect(receivedOutput).toContain('...');
    });
  });
});

describe('GeneratorError', () => {
  describe('constructor', () => {
    it('should create error with message', () => {
      const error = new GeneratorError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(GeneratorError);
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('GeneratorError');
    });

    it('should include cause in error', () => {
      const cause = new Error('Original error');
      const error = new GeneratorError('Wrapped error', { cause });

      expect(error.cause).toBe(cause);
    });

    it('should include context in error', () => {
      const error = new GeneratorError('Test error', {
        context: { workdir: '/tmp', files: ['src/file.ts'] },
      });

      expect(error.context).toEqual({ workdir: '/tmp', files: ['src/file.ts'] });
    });

    it('should include suggestedAction in error', () => {
      const error = new GeneratorError('Test error', {
        suggestedAction: 'Run: git add <files>',
      });

      expect(error.suggestedAction).toBe('Run: git add <files>');
    });
  });

  describe('no staged changes error pattern', () => {
    it('should create actionable error for no changes', () => {
      const error = GeneratorError.noStagedChanges('/home/user/project');

      expect(error.message.toLowerCase()).toContain('no staged changes');
      expect(error.context).toEqual({ workdir: '/home/user/project' });
      expect(error.suggestedAction).toContain('git add');
      expect(error.suggestedAction).toContain('<files>');
    });
  });

  describe('invalid task error pattern', () => {
    it('should create actionable error for invalid task', () => {
      const validationErrors = ['title: Required', 'description: Too long'];
      const error = GeneratorError.invalidTask(validationErrors);

      expect(error.message.toLowerCase()).toContain('invalid task');
      expect(error.message).toContain('title: Required');
      expect(error.message).toContain('description: Too long');
      expect(error.suggestedAction).toContain('CommitTask');
    });
  });

  describe('invalid options error pattern', () => {
    it('should create actionable error for invalid options', () => {
      const validationErrors = ['workdir: Required'];
      const error = GeneratorError.invalidOptions(validationErrors);

      expect(error.message.toLowerCase()).toContain('invalid options');
      expect(error.message).toContain('workdir: Required');
      expect(error.suggestedAction).toContain('CommitMessageOptions');
    });
  });

  describe('AI generation failed error pattern', () => {
    it('should create actionable error for AI failure', () => {
      const cause = new AgentError('CLI not found');
      const error = GeneratorError.aiGenerationFailed('Claude CLI', cause);

      expect(error.message).toContain('AI generation failed');
      expect(error.message).toContain('Claude CLI');
      expect(error.cause).toBe(cause);
      expect(error.suggestedAction).toContain('--no-ai');
    });
  });
});

describe('type guards', () => {
  describe('isAgentError', () => {
    it('should return true for AgentError instances', () => {
      const error = new AgentError('Test');
      expect(isAgentError(error)).toBe(true);
    });

    it('should return false for other Error types', () => {
      const error = new Error('Test');
      expect(isAgentError(error)).toBe(false);
    });

    it('should return false for GeneratorError', () => {
      const error = new GeneratorError('Test');
      expect(isAgentError(error)).toBe(false);
    });

    it('should return false for non-errors', () => {
      expect(isAgentError(null)).toBe(false);
      expect(isAgentError(undefined)).toBe(false);
      expect(isAgentError('error')).toBe(false);
      expect(isAgentError(123)).toBe(false);
    });
  });

  describe('isGeneratorError', () => {
    it('should return true for GeneratorError instances', () => {
      const error = new GeneratorError('Test');
      expect(isGeneratorError(error)).toBe(true);
    });

    it('should return false for other Error types', () => {
      const error = new Error('Test');
      expect(isGeneratorError(error)).toBe(false);
    });

    it('should return false for AgentError', () => {
      const error = new AgentError('Test');
      expect(isGeneratorError(error)).toBe(false);
    });

    it('should return false for non-errors', () => {
      expect(isGeneratorError(null)).toBe(false);
      expect(isGeneratorError(undefined)).toBe(false);
      expect(isGeneratorError('error')).toBe(false);
      expect(isGeneratorError(123)).toBe(false);
    });
  });
});
