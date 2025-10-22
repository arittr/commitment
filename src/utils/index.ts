/**
 * Utilities module
 *
 * Exports shared utility functions and types used across layers.
 */

// Git schemas and utilities
export * from './git-schemas';

// Type guards
export * from './guards';
// Shell execution adapter
export { exec, type ShellExecOptions, type ShellExecResult } from './shell';
