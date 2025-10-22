/**
 * Agent System
 *
 * Simplified abstraction for AI-powered commit message generation.
 * Replaces the complex Provider pattern with a minimal, focused interface.
 *
 * Design Principles:
 * - Single responsibility: generate commit messages
 * - No base classes or factories
 * - Each agent is self-contained
 * - Simple configuration (just an agent name)
 *
 * @module agents
 */

export { ChatGPTAgent } from './chatgpt';
export { ClaudeAgent } from './claude';
export { CodexAgent } from './codex';
export type { Agent, AgentConfig, AgentName } from './types';
export { agentConfigSchema, safeValidateAgentConfig, validateAgentConfig } from './types';
