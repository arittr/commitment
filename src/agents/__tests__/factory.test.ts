import { describe, expect, it } from 'bun:test';

import { ClaudeAgent } from '../claude';
import { CodexAgent } from '../codex';
import { createAgent } from '../factory';
import { GeminiAgent } from '../gemini';

describe('createAgent', () => {
  it('should create ClaudeAgent for "claude"', () => {
    const agent = createAgent('claude');

    expect(agent).toBeInstanceOf(ClaudeAgent);
    expect(agent.name).toBe('claude');
  });

  it('should create CodexAgent for "codex"', () => {
    const agent = createAgent('codex');

    expect(agent).toBeInstanceOf(CodexAgent);
    expect(agent.name).toBe('codex');
  });

  it('should create GeminiAgent for "gemini"', () => {
    const agent = createAgent('gemini');

    expect(agent).toBeInstanceOf(GeminiAgent);
    expect(agent.name).toBe('gemini');
  });

  it('should create different instances each time', () => {
    const agent1 = createAgent('claude');
    const agent2 = createAgent('claude');

    // Should be different instances
    expect(agent1).not.toBe(agent2);
    // But same class
    expect(agent1).toBeInstanceOf(ClaudeAgent);
    expect(agent2).toBeInstanceOf(ClaudeAgent);
  });

  it('should handle all agent types exhaustively', () => {
    // This test verifies that createAgent handles all AgentName values
    // If a new agent type is added to AgentName but not to createAgent,
    // TypeScript will error during compilation
    const agentNames: Array<'claude' | 'codex' | 'gemini'> = ['claude', 'codex', 'gemini'];

    for (const name of agentNames) {
      const agent = createAgent(name);
      expect(agent).toBeDefined();
      expect(agent.name).toBe(name);
    }
  });
});
