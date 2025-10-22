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

export { ChatGPTAgent } from './chatgpt.js';
export { ClaudeAgent } from './claude.js';
export { CodexAgent } from './codex.js';
export type { Agent, AgentConfig, AgentName } from './types.js';
export { agentConfigSchema, safeValidateAgentConfig, validateAgentConfig } from './types.js';
