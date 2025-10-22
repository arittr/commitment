import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
/**
 * Unit tests for EvalReporter module
 *
 * Tests result storage, symlink management, and markdown report generation.
 */

/* eslint-disable @typescript-eslint/consistent-type-imports */

import { EvalReporter } from '../reporter.js';
import type { EvalComparison, EvalMetrics } from '../schemas.js';

// Create mock functions
const mockExistsSync = mock();
const mockMkdirSync = mock();
const mockReadFileSync = mock();
const mockSymlinkSync = mock();
const mockUnlinkSync = mock();
const mockWriteFileSync = mock();

// Mock node:fs
mock.module('node:fs', async () => {
  const actual = await import('node:fs');
  return {
    ...actual,
    existsSync: mockExistsSync,
    mkdirSync: mockMkdirSync,
    readFileSync: mockReadFileSync,
    symlinkSync: mockSymlinkSync,
    unlinkSync: mockUnlinkSync,
    writeFileSync: mockWriteFileSync,
  };
});

describe('EvalReporter', () => {
  let reporter: EvalReporter;

  beforeEach(() => {
    mock.restore();
    reporter = new EvalReporter('.eval-results-test');
  });

  afterEach(() => {
    mock.restore();
  });

  describe('constructor', () => {
    it('should create results directory if it does not exist', async () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);

      // Act
      new EvalReporter('.test-results');

      // Assert
      expect(mockMkdirSync).toHaveBeenCalledWith('.test-results', { recursive: true });
    });

    it('should not create directory if it already exists', async () => {
      // Arrange
      mockExistsSync.mockReturnValue(true);
      mock.restore(); // Clear mock calls from beforeEach

      // Act
      new EvalReporter('.existing-results');

      // Assert
      expect(mockMkdirSync).not.toHaveBeenCalled();
    });

    it('should use default directory when not specified', async () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);

      // Act
      new EvalReporter();

      // Assert
      expect(mockMkdirSync).toHaveBeenCalledWith('.eval-results', { recursive: true });
    });
  });

  describe('storeResults', () => {
    it('should write timestamped JSON file', async () => {
      // Arrange

      const mockMetrics: EvalMetrics = {
        accuracy: 9,
        clarity: 8,
        conventionalCompliance: 9,
        detailLevel: 7,
      };

      const comparison: EvalComparison = {
        claudeResult: {
          agent: 'claude',
          commitMessage: 'fix: claude message',
          feedback: 'Good',
          fixture: 'simple',
          metrics: mockMetrics,
          overallScore: 8.25,
          timestamp: '2025-01-22T10:30:00.000Z',
        },
        codexResult: {
          agent: 'codex',
          commitMessage: 'fix: codex message',
          feedback: 'Good',
          fixture: 'simple',
          metrics: mockMetrics,
          overallScore: 7.5,
          timestamp: '2025-01-22T10:30:00.000Z',
        },
        fixture: 'simple',
        scoreDiff: 0.75,
        winner: 'claude',
      };

      // Act
      reporter.storeResults(comparison);

      // Assert
      expect(mockWriteFileSync).toHaveBeenCalled();
      const writeCall = mockWriteFileSync.mock.calls[0];
      expect(writeCall?.[0]).toMatch(/simple-.*\.json$/); // Timestamped filename
      expect(writeCall?.[1]).toBe(JSON.stringify(comparison, null, 2));
    });

    it('should create symlink to latest result', async () => {
      // Arrange
      mockExistsSync.mockReturnValue(false); // No existing symlink

      const mockMetrics: EvalMetrics = {
        accuracy: 8,
        clarity: 8,
        conventionalCompliance: 8,
        detailLevel: 8,
      };

      const comparison: EvalComparison = {
        claudeResult: {
          agent: 'claude',
          commitMessage: 'fix: test',
          feedback: 'Good',
          fixture: 'test-fixture',
          metrics: mockMetrics,
          overallScore: 8,
          timestamp: '2025-01-22T10:30:00.000Z',
        },
        codexResult: {
          agent: 'codex',
          commitMessage: 'fix: test',
          feedback: 'Good',
          fixture: 'test-fixture',
          metrics: mockMetrics,
          overallScore: 7.5,
          timestamp: '2025-01-22T10:30:00.000Z',
        },
        fixture: 'test-fixture',
        scoreDiff: 0.5,
        winner: 'tie',
      };

      // Act
      reporter.storeResults(comparison);

      // Assert
      expect(mockSymlinkSync).toHaveBeenCalled();
      const symlinkCall = mockSymlinkSync.mock.calls[0];
      expect(symlinkCall?.[0]).toMatch(/test-fixture-.*\.json$/); // Source (timestamped file)
      expect(symlinkCall?.[1]).toMatch(/latest-test-fixture\.json$/); // Target (latest symlink)
    });

    it('should remove existing symlink before creating new one', async () => {
      // Arrange
      mockExistsSync.mockReturnValue(true); // Existing symlink

      const mockMetrics: EvalMetrics = {
        accuracy: 8,
        clarity: 8,
        conventionalCompliance: 8,
        detailLevel: 8,
      };

      const comparison: EvalComparison = {
        claudeResult: {
          agent: 'claude',
          commitMessage: 'fix: test',
          feedback: 'Good',
          fixture: 'simple',
          metrics: mockMetrics,
          overallScore: 8,
          timestamp: '2025-01-22T10:30:00.000Z',
        },
        codexResult: {
          agent: 'codex',
          commitMessage: 'fix: test',
          feedback: 'Good',
          fixture: 'simple',
          metrics: mockMetrics,
          overallScore: 7.5,
          timestamp: '2025-01-22T10:30:00.000Z',
        },
        fixture: 'simple',
        scoreDiff: 0.5,
        winner: 'tie',
      };

      // Act
      reporter.storeResults(comparison);

      // Assert
      expect(mockUnlinkSync).toHaveBeenCalled();
      expect(mockSymlinkSync).toHaveBeenCalled();

      // Verify unlink called before symlink
      const unlinkCall = mockUnlinkSync.mock.invocationCallOrder[0];
      const symlinkCall = mockSymlinkSync.mock.invocationCallOrder[0];

      // Type assertion after checking they're defined
      expect(unlinkCall).toBeDefined();
      expect(symlinkCall).toBeDefined();
      if (unlinkCall !== undefined && symlinkCall !== undefined) {
        expect(unlinkCall).toBeLessThan(symlinkCall);
      }
    });

    it('should use timestamp without colons for Windows compatibility', async () => {
      // Arrange

      const mockMetrics: EvalMetrics = {
        accuracy: 8,
        clarity: 8,
        conventionalCompliance: 8,
        detailLevel: 8,
      };

      const comparison: EvalComparison = {
        claudeResult: {
          agent: 'claude',
          commitMessage: 'fix: test',
          feedback: 'Good',
          fixture: 'simple',
          metrics: mockMetrics,
          overallScore: 8,
          timestamp: '2025-01-22T10:30:00.000Z',
        },
        codexResult: {
          agent: 'codex',
          commitMessage: 'fix: test',
          feedback: 'Good',
          fixture: 'simple',
          metrics: mockMetrics,
          overallScore: 7.5,
          timestamp: '2025-01-22T10:30:00.000Z',
        },
        fixture: 'simple',
        scoreDiff: 0.5,
        winner: 'tie',
      };

      // Act
      reporter.storeResults(comparison);

      // Assert
      const writeCall = mockWriteFileSync.mock.calls[0];
      const filename = writeCall?.[0]?.toString() ?? '';

      // Filename should not contain colons (Windows-incompatible)
      expect(filename).not.toMatch(/:\d/); // No time colons like :30:
    });
  });

  describe('generateMarkdownReport', () => {
    it('should generate report with header', async () => {
      // Arrange
      const mockMetrics: EvalMetrics = {
        accuracy: 8,
        clarity: 8,
        conventionalCompliance: 8,
        detailLevel: 8,
      };

      const comparisons: EvalComparison[] = [
        {
          claudeResult: {
            agent: 'claude',
            commitMessage: 'fix: test',
            feedback: 'Good',
            fixture: 'simple',
            metrics: mockMetrics,
            overallScore: 8,
            timestamp: '2025-01-22T10:30:00.000Z',
          },
          codexResult: {
            agent: 'codex',
            commitMessage: 'fix: test',
            feedback: 'Good',
            fixture: 'simple',
            metrics: mockMetrics,
            overallScore: 7.5,
            timestamp: '2025-01-22T10:30:00.000Z',
          },
          fixture: 'simple',
          scoreDiff: 0.5,
          winner: 'tie',
        },
      ];

      // Act
      const markdown = reporter.generateMarkdownReport(comparisons);

      // Assert
      expect(markdown).toContain('# Commit Message Quality Evaluation Report');
      expect(markdown).toContain('**Fixtures**: 1');
      expect(markdown).toContain('**Generated**:');
    });

    it('should include both agent results', async () => {
      // Arrange
      const mockMetrics: EvalMetrics = {
        accuracy: 9,
        clarity: 8,
        conventionalCompliance: 9,
        detailLevel: 7,
      };

      const comparisons: EvalComparison[] = [
        {
          claudeResult: {
            agent: 'claude',
            commitMessage: 'fix: claude message',
            feedback: 'Claude feedback',
            fixture: 'test',
            metrics: mockMetrics,
            overallScore: 8.25,
            timestamp: '2025-01-22T10:30:00.000Z',
          },
          codexResult: {
            agent: 'codex',
            commitMessage: 'fix: codex message',
            feedback: 'Codex feedback',
            fixture: 'test',
            metrics: mockMetrics,
            overallScore: 8,
            timestamp: '2025-01-22T10:30:00.000Z',
          },
          fixture: 'test',
          scoreDiff: 0.25,
          winner: 'tie',
        },
      ];

      // Act
      const markdown = reporter.generateMarkdownReport(comparisons);

      // Assert
      expect(markdown).toContain('### Claude');
      expect(markdown).toContain('fix: claude message');
      expect(markdown).toContain('Claude feedback');

      expect(markdown).toContain('### Codex');
      expect(markdown).toContain('fix: codex message');
      expect(markdown).toContain('Codex feedback');
    });

    it('should include metrics breakdown for both agents', async () => {
      // Arrange
      const mockMetrics: EvalMetrics = {
        accuracy: 9,
        clarity: 8,
        conventionalCompliance: 10,
        detailLevel: 7,
      };

      const comparisons: EvalComparison[] = [
        {
          claudeResult: {
            agent: 'claude',
            commitMessage: 'fix: test',
            feedback: 'Good',
            fixture: 'test',
            metrics: mockMetrics,
            overallScore: 8.5,
            timestamp: '2025-01-22T10:30:00.000Z',
          },
          codexResult: {
            agent: 'codex',
            commitMessage: 'fix: test',
            feedback: 'Good',
            fixture: 'test',
            metrics: mockMetrics,
            overallScore: 8.5,
            timestamp: '2025-01-22T10:30:00.000Z',
          },
          fixture: 'test',
          scoreDiff: 0,
          winner: 'tie',
        },
      ];

      // Act
      const markdown = reporter.generateMarkdownReport(comparisons);

      // Assert
      expect(markdown).toContain('Conventional Compliance: 10/10');
      expect(markdown).toContain('Clarity: 8/10');
      expect(markdown).toContain('Accuracy: 9/10');
      expect(markdown).toContain('Detail Level: 7/10');
    });

    it('should include comparison section with winner', async () => {
      // Arrange
      const mockMetrics: EvalMetrics = {
        accuracy: 8,
        clarity: 8,
        conventionalCompliance: 8,
        detailLevel: 8,
      };

      const comparisons: EvalComparison[] = [
        {
          claudeResult: {
            agent: 'claude',
            commitMessage: 'fix: test',
            feedback: 'Good',
            fixture: 'test',
            metrics: mockMetrics,
            overallScore: 9,
            timestamp: '2025-01-22T10:30:00.000Z',
          },
          codexResult: {
            agent: 'codex',
            commitMessage: 'fix: test',
            feedback: 'Good',
            fixture: 'test',
            metrics: mockMetrics,
            overallScore: 7.5,
            timestamp: '2025-01-22T10:30:00.000Z',
          },
          fixture: 'test',
          scoreDiff: 1.5,
          winner: 'claude',
        },
      ];

      // Act
      const markdown = reporter.generateMarkdownReport(comparisons);

      // Assert
      expect(markdown).toContain('### Comparison');
      expect(markdown).toContain('**Winner**: claude');
      expect(markdown).toContain('**Score Difference**: +1.50');
    });

    it('should handle negative score difference correctly', async () => {
      // Arrange
      const mockMetrics: EvalMetrics = {
        accuracy: 8,
        clarity: 8,
        conventionalCompliance: 8,
        detailLevel: 8,
      };

      const comparisons: EvalComparison[] = [
        {
          claudeResult: {
            agent: 'claude',
            commitMessage: 'fix: test',
            feedback: 'Good',
            fixture: 'test',
            metrics: mockMetrics,
            overallScore: 7,
            timestamp: '2025-01-22T10:30:00.000Z',
          },
          codexResult: {
            agent: 'codex',
            commitMessage: 'fix: test',
            feedback: 'Good',
            fixture: 'test',
            metrics: mockMetrics,
            overallScore: 8.5,
            timestamp: '2025-01-22T10:30:00.000Z',
          },
          fixture: 'test',
          scoreDiff: -1.5,
          winner: 'codex',
        },
      ];

      // Act
      const markdown = reporter.generateMarkdownReport(comparisons);

      // Assert
      expect(markdown).toContain('**Score Difference**: -1.50');
    });

    it('should handle multiple fixtures', async () => {
      // Arrange
      const mockMetrics: EvalMetrics = {
        accuracy: 8,
        clarity: 8,
        conventionalCompliance: 8,
        detailLevel: 8,
      };

      const comparisons: EvalComparison[] = [
        {
          claudeResult: {
            agent: 'claude',
            commitMessage: 'fix: test1',
            feedback: 'Good',
            fixture: 'fixture1',
            metrics: mockMetrics,
            overallScore: 8,
            timestamp: '2025-01-22T10:30:00.000Z',
          },
          codexResult: {
            agent: 'codex',
            commitMessage: 'fix: test1',
            feedback: 'Good',
            fixture: 'fixture1',
            metrics: mockMetrics,
            overallScore: 7.5,
            timestamp: '2025-01-22T10:30:00.000Z',
          },
          fixture: 'fixture1',
          scoreDiff: 0.5,
          winner: 'tie',
        },
        {
          claudeResult: {
            agent: 'claude',
            commitMessage: 'feat: test2',
            feedback: 'Great',
            fixture: 'fixture2',
            metrics: mockMetrics,
            overallScore: 9,
            timestamp: '2025-01-22T10:30:00.000Z',
          },
          codexResult: {
            agent: 'codex',
            commitMessage: 'feat: test2',
            feedback: 'Great',
            fixture: 'fixture2',
            metrics: mockMetrics,
            overallScore: 8,
            timestamp: '2025-01-22T10:30:00.000Z',
          },
          fixture: 'fixture2',
          scoreDiff: 1,
          winner: 'claude',
        },
      ];

      // Act
      const markdown = reporter.generateMarkdownReport(comparisons);

      // Assert
      expect(markdown).toContain('## Fixture: fixture1');
      expect(markdown).toContain('## Fixture: fixture2');
      expect(markdown).toContain('**Fixtures**: 2');
    });
  });

  describe('storeMarkdownReport', () => {
    it('should write markdown report to file', async () => {
      // Arrange

      const mockMetrics: EvalMetrics = {
        accuracy: 8,
        clarity: 8,
        conventionalCompliance: 8,
        detailLevel: 8,
      };

      const comparisons: EvalComparison[] = [
        {
          claudeResult: {
            agent: 'claude',
            commitMessage: 'fix: test',
            feedback: 'Good',
            fixture: 'simple',
            metrics: mockMetrics,
            overallScore: 8,
            timestamp: '2025-01-22T10:30:00.000Z',
          },
          codexResult: {
            agent: 'codex',
            commitMessage: 'fix: test',
            feedback: 'Good',
            fixture: 'simple',
            metrics: mockMetrics,
            overallScore: 7.5,
            timestamp: '2025-01-22T10:30:00.000Z',
          },
          fixture: 'simple',
          scoreDiff: 0.5,
          winner: 'tie',
        },
      ];

      // Act
      reporter.storeMarkdownReport(comparisons);

      // Assert
      expect(mockWriteFileSync).toHaveBeenCalled();
      const writeCall = mockWriteFileSync.mock.calls[0];
      expect(writeCall?.[0]).toMatch(/report-.*\.md$/); // Timestamped filename
      expect(writeCall?.[1]).toContain('# Commit Message Quality Evaluation Report');
    });

    it('should create symlink to latest report', async () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);

      const mockMetrics: EvalMetrics = {
        accuracy: 8,
        clarity: 8,
        conventionalCompliance: 8,
        detailLevel: 8,
      };

      const comparisons: EvalComparison[] = [
        {
          claudeResult: {
            agent: 'claude',
            commitMessage: 'fix: test',
            feedback: 'Good',
            fixture: 'simple',
            metrics: mockMetrics,
            overallScore: 8,
            timestamp: '2025-01-22T10:30:00.000Z',
          },
          codexResult: {
            agent: 'codex',
            commitMessage: 'fix: test',
            feedback: 'Good',
            fixture: 'simple',
            metrics: mockMetrics,
            overallScore: 7.5,
            timestamp: '2025-01-22T10:30:00.000Z',
          },
          fixture: 'simple',
          scoreDiff: 0.5,
          winner: 'tie',
        },
      ];

      // Act
      reporter.storeMarkdownReport(comparisons);

      // Assert
      expect(mockSymlinkSync).toHaveBeenCalled();
      const symlinkCall = mockSymlinkSync.mock.calls[0];
      expect(symlinkCall?.[0]).toMatch(/report-.*\.md$/);
      expect(symlinkCall?.[1]).toMatch(/latest-report\.md$/);
    });
  });

  describe('compareWithBaseline', () => {
    it('should return null when no baseline exists', async () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);

      const mockMetrics: EvalMetrics = {
        accuracy: 8,
        clarity: 8,
        conventionalCompliance: 8,
        detailLevel: 8,
      };

      const comparison: EvalComparison = {
        claudeResult: {
          agent: 'claude',
          commitMessage: 'fix: test',
          feedback: 'Good',
          fixture: 'test',
          metrics: mockMetrics,
          overallScore: 8,
          timestamp: '2025-01-22T10:30:00.000Z',
        },
        codexResult: {
          agent: 'codex',
          commitMessage: 'fix: test',
          feedback: 'Good',
          fixture: 'test',
          metrics: mockMetrics,
          overallScore: 7.5,
          timestamp: '2025-01-22T10:30:00.000Z',
        },
        fixture: 'test',
        scoreDiff: 0.5,
        winner: 'tie',
      };

      // Act
      const result = reporter.compareWithBaseline(comparison);

      // Assert
      expect(result).toBeNull();
    });

    it('should calculate differences when baseline exists', async () => {
      // Arrange
      mockExistsSync.mockReturnValue(true);

      const mockMetrics: EvalMetrics = {
        accuracy: 8,
        clarity: 8,
        conventionalCompliance: 8,
        detailLevel: 8,
      };

      const baseline: EvalComparison = {
        claudeResult: {
          agent: 'claude',
          commitMessage: 'fix: old',
          feedback: 'Good',
          fixture: 'test',
          metrics: mockMetrics,
          overallScore: 7.5,
          timestamp: '2025-01-20T10:30:00.000Z',
        },
        codexResult: {
          agent: 'codex',
          commitMessage: 'fix: old',
          feedback: 'Good',
          fixture: 'test',
          metrics: mockMetrics,
          overallScore: 7,
          timestamp: '2025-01-20T10:30:00.000Z',
        },
        fixture: 'test',
        scoreDiff: 0.5,
        winner: 'tie',
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(baseline));

      const current: EvalComparison = {
        claudeResult: {
          agent: 'claude',
          commitMessage: 'fix: new',
          feedback: 'Great',
          fixture: 'test',
          metrics: mockMetrics,
          overallScore: 8.5,
          timestamp: '2025-01-22T10:30:00.000Z',
        },
        codexResult: {
          agent: 'codex',
          commitMessage: 'fix: new',
          feedback: 'Good',
          fixture: 'test',
          metrics: mockMetrics,
          overallScore: 7.5,
          timestamp: '2025-01-22T10:30:00.000Z',
        },
        fixture: 'test',
        scoreDiff: 1,
        winner: 'claude',
      };

      // Act
      const result = reporter.compareWithBaseline(current);

      // Assert
      expect(result).toBeTruthy();
      expect(result).toContain('Baseline Comparison (test)');
      expect(result).toContain('Claude: +1.00'); // 8.5 - 7.5 = +1.0
      expect(result).toContain('Codex: +0.50'); // 7.5 - 7.0 = +0.5
      expect(result).toContain('7.50 → 8.50'); // Claude progression
      expect(result).toContain('7.00 → 7.50'); // Codex progression
    });

    it('should handle negative differences correctly', async () => {
      // Arrange
      mockExistsSync.mockReturnValue(true);

      const mockMetrics: EvalMetrics = {
        accuracy: 8,
        clarity: 8,
        conventionalCompliance: 8,
        detailLevel: 8,
      };

      const baseline: EvalComparison = {
        claudeResult: {
          agent: 'claude',
          commitMessage: 'fix: old',
          feedback: 'Good',
          fixture: 'test',
          metrics: mockMetrics,
          overallScore: 8.5,
          timestamp: '2025-01-20T10:30:00.000Z',
        },
        codexResult: {
          agent: 'codex',
          commitMessage: 'fix: old',
          feedback: 'Good',
          fixture: 'test',
          metrics: mockMetrics,
          overallScore: 8,
          timestamp: '2025-01-20T10:30:00.000Z',
        },
        fixture: 'test',
        scoreDiff: 0.5,
        winner: 'tie',
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(baseline));

      const current: EvalComparison = {
        claudeResult: {
          agent: 'claude',
          commitMessage: 'fix: new',
          feedback: 'Okay',
          fixture: 'test',
          metrics: mockMetrics,
          overallScore: 7.5,
          timestamp: '2025-01-22T10:30:00.000Z',
        },
        codexResult: {
          agent: 'codex',
          commitMessage: 'fix: new',
          feedback: 'Okay',
          fixture: 'test',
          metrics: mockMetrics,
          overallScore: 7,
          timestamp: '2025-01-22T10:30:00.000Z',
        },
        fixture: 'test',
        scoreDiff: 0.5,
        winner: 'tie',
      };

      // Act
      const result = reporter.compareWithBaseline(current);

      // Assert
      expect(result).toContain('Claude: -1.00'); // 7.5 - 8.5 = -1.0
      expect(result).toContain('Codex: -1.00'); // 7.0 - 8.0 = -1.0
    });
  });
});
