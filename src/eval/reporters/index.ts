/**
 * Reporter exports for evaluation system
 *
 * Provides three reporter types:
 * - CLIReporter: Real-time colored console output
 * - JSONReporter: Structured storage with timestamped files
 * - MarkdownReporter: Human-readable reports
 *
 * @example
 * ```typescript
 * import { CLIReporter, JSONReporter, MarkdownReporter } from './reporters/index.js';
 *
 * const cliReporter = new CLIReporter();
 * const jsonReporter = new JSONReporter();
 * const markdownReporter = new MarkdownReporter();
 * ```
 */

export { CLIReporter } from './cli-reporter.js';
export { JSONReporter } from './json-reporter.js';
export { MarkdownReporter } from './markdown-reporter.js';
