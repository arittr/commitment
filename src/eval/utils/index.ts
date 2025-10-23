/**
 * Utility functions for multi-attempt evaluation
 *
 * This module exports pure utility functions that support the evaluation pipeline:
 * - Error categorization for failure analysis
 * - Best attempt selection for identifying highest-quality outputs
 *
 * All functions are pure (no side effects, deterministic).
 */

export { getBestAttempt } from './best-attempt.js';
export { categorizeError } from './error-categorization.js';
