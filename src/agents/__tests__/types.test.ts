/**
 * Agent Types Tests - Testing Philosophy
 *
 * We DON'T test Zod's validation logic:
 * - ❌ "rejects non-string input"
 * - ❌ "rejects empty string"
 * - ❌ "rejects unknown agent name"
 * - ❌ "applies default values"
 *
 * We DO test our custom logic:
 * - ✅ Agent interface structure and contracts
 * - ✅ Type inference (z.infer<> produces correct types)
 * - ✅ Business logic (agent behavior we own)
 *
 * Rationale: Zod is well-tested. We focus on behavior we own.
 * Agent interface tests ensure the contract is correctly defined.
 *
 * See: @docs/constitutions/current/schema-rules.md
 */

import { describe, expect, it } from 'vitest';

import type { Agent, AgentConfig } from '../types';

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

describe('AgentConfig type', () => {
  it('should be inferred from schema', () => {
    // Type-only test to ensure type inference works
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
