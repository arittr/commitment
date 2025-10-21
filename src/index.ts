/**
 * commitment - AI-powered commit message generator with intelligent fallback
 *
 * Simplified, focused API for generating conventional commit messages.
 *
 * @packageDocumentation
 */

// Agent system
export type { Agent, AgentName } from './agents/types.js';
// Error types
export { AgentError, GeneratorError, isAgentError, isGeneratorError } from './errors.js';

// Core generator
export { CommitMessageGenerator } from './generator.js';

export type {
  CommitMessageGeneratorConfig,
  CommitMessageOptions,
  CommitTask,
} from './generator.js';
