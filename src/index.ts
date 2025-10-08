/**
 * commitment - AI-powered commit message generator with intelligent fallback
 *
 * @packageDocumentation
 */

export { CommitMessageGenerator } from './generator.js';
export type {
  CommitTask,
  CommitMessageGeneratorConfig,
  CommitMessageOptions,
} from './generator.js';
export { hasContent } from './utils/guards.js';
