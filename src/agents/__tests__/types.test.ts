import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  type Agent,
  type AgentConfig,
  agentConfigSchema,
  safeValidateAgentConfig,
  validateAgentConfig,
} from '../types';

describe('Agent interface', () => {
  it('should define Agent interface with name property', () => {
    // Type-only test to ensure Agent interface has required shape
    const mockAgent: Agent = {
      generate: async (_prompt: string, _workdir: string): Promise<string> => {
        return 'test message';
      },
      name: 'test-agent',
    };

    expect(mockAgent.name).toBe('test-agent');
    expect(typeof mockAgent.generate).toBe('function');
  });

  it('should have generate method that returns Promise<string>', async () => {
    const mockAgent: Agent = {
      generate: async (prompt: string, workdir: string): Promise<string> => {
        return `Generated from ${prompt} in ${workdir}`;
      },
      name: 'test-agent',
    };

    const result = await mockAgent.generate('test prompt', '/tmp');
    expect(typeof result).toBe('string');
    expect(result).toContain('test prompt');
    expect(result).toContain('/tmp');
  });
});

describe('agentConfigSchema', () => {
  describe('valid inputs', () => {
    it('accepts valid claude agent config', () => {
      const config = { agent: 'claude' };
      const result = agentConfigSchema.parse(config);
      expect(result).toEqual({ agent: 'claude' });
    });

    it('accepts valid codex agent config', () => {
      const config = { agent: 'codex' };
      const result = agentConfigSchema.parse(config);
      expect(result).toEqual({ agent: 'codex' });
    });
  });

  describe('invalid inputs', () => {
    it('rejects empty agent string', () => {
      const config = { agent: '' };
      expect(() => agentConfigSchema.parse(config)).toThrow(z.ZodError);
    });

    it('rejects unknown agent name', () => {
      const config = { agent: 'unknown-agent' };
      expect(() => agentConfigSchema.parse(config)).toThrow(z.ZodError);
    });

    it('rejects non-string agent', () => {
      const config = { agent: 123 };
      expect(() => agentConfigSchema.parse(config)).toThrow(z.ZodError);
    });

    it('rejects null agent', () => {
      const config = { agent: null };
      expect(() => agentConfigSchema.parse(config)).toThrow(z.ZodError);
    });

    it('rejects undefined agent', () => {
      const config = { agent: undefined };
      expect(() => agentConfigSchema.parse(config)).toThrow(z.ZodError);
    });

    it('rejects missing agent field', () => {
      const config = {};
      expect(() => agentConfigSchema.parse(config)).toThrow(z.ZodError);
    });

    it('provides helpful error message for invalid agent', () => {
      const config = { agent: 'invalid' };
      try {
        agentConfigSchema.parse(config);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error instanceof z.ZodError).toBe(true);
        if (error instanceof z.ZodError) {
          const message = error.issues[0]?.message ?? '';
          expect(message.toLowerCase()).toContain('invalid');
        }
      }
    });
  });

  describe('edge cases', () => {
    it('rejects agent with whitespace only', () => {
      const config = { agent: '   ' };
      expect(() => agentConfigSchema.parse(config)).toThrow(z.ZodError);
    });

    it('accepts valid agent with surrounding whitespace (trimmed)', () => {
      const config = { agent: '  claude  ' };
      const result = agentConfigSchema.parse(config);
      // Schema should trim whitespace
      expect(result.agent).toBe('claude');
    });

    it('rejects object instead of string', () => {
      const config = { agent: { name: 'claude' } };
      expect(() => agentConfigSchema.parse(config)).toThrow(z.ZodError);
    });

    it('rejects array instead of string', () => {
      const config = { agent: ['claude'] };
      expect(() => agentConfigSchema.parse(config)).toThrow(z.ZodError);
    });
  });
});

describe('validateAgentConfig', () => {
  it('validates and returns typed config for valid input', () => {
    const input = { agent: 'claude' };
    const result = validateAgentConfig(input);
    expect(result).toEqual({ agent: 'claude' });
    // TypeScript should know result is AgentConfig
    const typed: AgentConfig = result;
    expect(typed.agent).toBe('claude');
  });

  it('throws ZodError for invalid input', () => {
    const input = { agent: 'invalid' };
    expect(() => validateAgentConfig(input)).toThrow(z.ZodError);
  });

  it('throws ZodError for missing agent field', () => {
    const input = {};
    expect(() => validateAgentConfig(input)).toThrow(z.ZodError);
  });

  it('validates unknown input type', () => {
    const input: unknown = { agent: 'codex' };
    const result = validateAgentConfig(input);
    expect(result.agent).toBe('codex');
  });
});

describe('safeValidateAgentConfig', () => {
  it('returns success for valid config', () => {
    const input = { agent: 'claude' };
    const result = safeValidateAgentConfig(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ agent: 'claude' });
      // TypeScript should know result.data is AgentConfig
      const typed: AgentConfig = result.data;
      expect(typed.agent).toBe('claude');
    }
  });

  it('returns failure for invalid config', () => {
    const input = { agent: 'invalid' };
    const result = safeValidateAgentConfig(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(z.ZodError);
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it('returns failure for missing agent field', () => {
    const input = {};
    const result = safeValidateAgentConfig(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(z.ZodError);
    }
  });

  it('handles unknown input type safely', () => {
    const input: unknown = { agent: 'codex' };
    const result = safeValidateAgentConfig(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.agent).toBe('codex');
    }
  });

  it('provides detailed error information on failure', () => {
    const input = { agent: '' };
    const result = safeValidateAgentConfig(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]).toBeDefined();
      expect(result.error.issues[0]?.path).toContain('agent');
    }
  });
});

describe('AgentConfig type', () => {
  it('should be inferred from schema', () => {
    // Type-only test
    const config: AgentConfig = { agent: 'claude' };
    expect(config.agent).toBe('claude');
  });

  it('should only allow valid agent names', () => {
    // Type-only test - TypeScript should enforce this
    const config1: AgentConfig = { agent: 'claude' };
    const config2: AgentConfig = { agent: 'codex' };

    expect(config1.agent).toBe('claude');
    expect(config2.agent).toBe('codex');

    // This should cause a TypeScript error (but won't fail at runtime in tests):
    // const invalid: AgentConfig = { agent: 'invalid' };
  });
});

describe('schema coverage', () => {
  it('covers all supported agents', () => {
    const supportedAgents = ['claude', 'codex'];

    for (const agent of supportedAgents) {
      const config = { agent };
      expect(() => agentConfigSchema.parse(config)).not.toThrow();
    }
  });

  it('has comprehensive validation for agent field', () => {
    // Test that schema validates agent field thoroughly
    const testCases = [
      { input: { agent: 'claude' }, shouldPass: true },
      { input: { agent: 'codex' }, shouldPass: true },
      { input: { agent: '' }, shouldPass: false },
      { input: { agent: 'invalid' }, shouldPass: false },
      { input: { agent: 123 }, shouldPass: false },
      { input: { agent: null }, shouldPass: false },
      { input: {}, shouldPass: false },
    ];

    for (const testCase of testCases) {
      const result = agentConfigSchema.safeParse(testCase.input);
      expect(result.success).toBe(testCase.shouldPass);
    }
  });
});
