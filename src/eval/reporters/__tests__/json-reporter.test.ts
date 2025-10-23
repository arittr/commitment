import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { readlink } from 'node:fs/promises';
import { join } from 'node:path';

import type { EvalResult } from '../../core/types.js';
import { JSONReporter } from '../json-reporter.js';

describe('JSONReporter', () => {
  const testResultsDir = join(process.cwd(), '.eval-results');
  let createdFiles: string[] = [];

  beforeEach(() => {
    createdFiles = [];
  });

  afterEach(() => {
    // Clean up created files
    for (const file of createdFiles) {
      try {
        if (existsSync(file)) {
          unlinkSync(file);
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  function createTestResult(): EvalResult {
    return {
      attempts: [
        {
          attemptNumber: 1,
          commitMessage: 'feat: add new feature',
          metrics: {
            clarity: 9,
            conventionalFormat: 10,
            scope: 7,
            specificity: 8,
          },
          overallScore: 8.5,
          responseTimeMs: 1000,
          status: 'success',
        },
        {
          attemptNumber: 2,
          failureReason: 'Invalid conventional commit format',
          failureType: 'validation',
          responseTimeMs: 100,
          status: 'failure',
        },
        {
          attemptNumber: 3,
          commitMessage: 'feat: improve feature',
          metrics: {
            clarity: 8,
            conventionalFormat: 9,
            scope: 8,
            specificity: 9,
          },
          overallScore: 8.5,
          responseTimeMs: 1100,
          status: 'success',
        },
      ],
      bestAttempt: 1,
      consistencyScore: 8.0,
      errorRateImpact: -1.0,
      finalScore: 7.5,
      reasoning:
        'Two successful attempts with good consistency, but one failure impacts overall score.',
      successRate: '2/3',
    };
  }

  describe('saveResults', () => {
    it('should create timestamped JSON file', async () => {
      const reporter = new JSONReporter(testResultsDir);
      const result = createTestResult();

      const filename = await reporter.saveResults(result, 'test-fixture');
      createdFiles.push(join(testResultsDir, filename));

      // Check file exists
      expect(existsSync(join(testResultsDir, filename))).toBe(true);

      // Check filename format: YYYY-MM-DDTHH-mm-ss.sssZ/test-fixture.json
      expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z\/test-fixture\.json$/);
    });

    it('should save valid JSON content', async () => {
      const reporter = new JSONReporter(testResultsDir);
      const result = createTestResult();

      const filename = await reporter.saveResults(result, 'test-fixture');
      createdFiles.push(join(testResultsDir, filename));

      // Read and parse JSON
      const content = readFileSync(join(testResultsDir, filename), 'utf-8');
      const parsed = JSON.parse(content);

      // Verify structure
      expect(parsed).toHaveProperty('attempts');
      expect(parsed).toHaveProperty('finalScore');
      expect(parsed).toHaveProperty('consistencyScore');
      expect(parsed).toHaveProperty('successRate');
      expect(parsed.attempts).toHaveLength(3);
    });

    it('should preserve all result data', async () => {
      const reporter = new JSONReporter(testResultsDir);
      const result = createTestResult();

      const filename = await reporter.saveResults(result, 'test-fixture');
      createdFiles.push(join(testResultsDir, filename));

      const content = readFileSync(join(testResultsDir, filename), 'utf-8');
      const parsed = JSON.parse(content) as EvalResult;

      expect(parsed.finalScore).toBe(7.5);
      expect(parsed.consistencyScore).toBe(8.0);
      expect(parsed.errorRateImpact).toBe(-1.0);
      expect(parsed.successRate).toBe('2/3');
      expect(parsed.bestAttempt).toBe(1);
      expect(parsed.reasoning).toContain('Two successful attempts');
    });

    it('should create symlink to latest file', async () => {
      const reporter = new JSONReporter(testResultsDir);
      const result = createTestResult();

      const filename = await reporter.saveResults(result, 'test-fixture');
      createdFiles.push(join(testResultsDir, filename));

      const symlinkPath = join(testResultsDir, 'latest-test-fixture.json');
      createdFiles.push(symlinkPath);

      // Check symlink exists
      expect(existsSync(symlinkPath)).toBe(true);

      // Check symlink points to the correct file
      const target = await readlink(symlinkPath);
      expect(target).toBe(filename);
    });

    it('should update symlink when saving multiple times', async () => {
      const reporter = new JSONReporter(testResultsDir);
      const result = createTestResult();

      // Save first time
      const filename1 = await reporter.saveResults(result, 'test-fixture');
      createdFiles.push(join(testResultsDir, filename1));

      // Wait a tiny bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Save second time (same runDir, so filename will be identical)
      const filename2 = await reporter.saveResults(result, 'test-fixture');
      createdFiles.push(join(testResultsDir, filename2));

      const symlinkPath = join(testResultsDir, 'latest-test-fixture.json');
      createdFiles.push(symlinkPath);

      // Within the same reporter instance, runDir is shared, so filenames are identical
      expect(filename2).toBe(filename1);

      // Symlink should still point to the file
      const target = await readlink(symlinkPath);
      expect(target).toBe(filename1);
    });

    it('should handle all-failure scenario', async () => {
      const reporter = new JSONReporter(testResultsDir);
      const result: EvalResult = {
        attempts: [
          {
            attemptNumber: 1,
            failureReason: 'Failed to clean artifacts',
            failureType: 'cleaning',
            responseTimeMs: 100,
            status: 'failure',
          },
          {
            attemptNumber: 2,
            failureReason: 'Invalid format',
            failureType: 'validation',
            responseTimeMs: 100,
            status: 'failure',
          },
          {
            attemptNumber: 3,
            failureReason: 'Agent timeout',
            failureType: 'generation',
            responseTimeMs: 100,
            status: 'failure',
          },
        ],
        bestAttempt: undefined,
        consistencyScore: 0.0,
        errorRateImpact: -3.0,
        finalScore: 0.0,
        reasoning: 'All attempts failed, unable to generate valid commit message.',
        successRate: '0/3',
      };

      const filename = await reporter.saveResults(result, 'all-failures');
      createdFiles.push(join(testResultsDir, filename));

      const content = readFileSync(join(testResultsDir, filename), 'utf-8');
      const parsed = JSON.parse(content) as EvalResult;

      expect(parsed.successRate).toBe('0/3');
      expect(parsed.finalScore).toBe(0.0);
      expect(parsed.bestAttempt).toBeUndefined();
    });

    it('should handle different fixture names', async () => {
      const reporter = new JSONReporter(testResultsDir);
      const result = createTestResult();

      const fixtures = ['simple', 'complex', 'edge-case'];
      for (const fixture of fixtures) {
        const filename = await reporter.saveResults(result, fixture);
        createdFiles.push(join(testResultsDir, filename));
        createdFiles.push(join(testResultsDir, `latest-${fixture}.json`));

        expect(filename).toContain(fixture);
      }

      // Check all symlinks exist
      for (const fixture of fixtures) {
        expect(existsSync(join(testResultsDir, `latest-${fixture}.json`))).toBe(true);
      }
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid results directory', async () => {
      const reporter = new JSONReporter('/nonexistent/invalid/path');
      const result = createTestResult();

      await expect(reporter.saveResults(result, 'test')).rejects.toThrow();
    });

    it('should handle empty fixture name', async () => {
      const reporter = new JSONReporter(testResultsDir);
      const result = createTestResult();

      // Empty fixture name should still work, just creates odd filename
      const filename = await reporter.saveResults(result, '');
      createdFiles.push(join(testResultsDir, filename));

      expect(existsSync(join(testResultsDir, filename))).toBe(true);
    });
  });
});
