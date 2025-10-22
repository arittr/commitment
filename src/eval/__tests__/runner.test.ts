import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
/**
 * Unit tests for EvalRunner module
 *
 * Tests fixture loading and evaluation pipeline orchestration.
 */

/* eslint-disable @typescript-eslint/consistent-type-imports */


import { EvaluationError } from '../../errors.js';
import { CommitMessageGenerator } from '../../generator.js';
import type { Evaluator } from '../evaluator.js';
import { EvalRunner } from '../runner.js';
import type { EvalFixture, EvalMetrics, EvalResult } from '../schemas.js';

// Create mock functions
const mockReaddirSync = mock();
const mockReadFileSync = mock();
const mockGenerator = mock();

// Mock dependencies
mock.module('../evaluator.js', () => ({}));
mock.module('../../generator.js', () => ({
  CommitMessageGenerator: mockGenerator,
}));
mock.module('node:fs', async () => {
  const actual = await import('node:fs');
  return {
    ...actual,
    readdirSync: mockReaddirSync,
    readFileSync: mockReadFileSync,
  };
});

describe('EvalRunner', () => {
  let runner: EvalRunner;

  beforeEach(() => {
    mock.restore();
    runner = new EvalRunner();
  });

  describe('loadFixture', () => {
    it('should load mocked fixture with all required fields', async () => {
      // Arrange
      // Mock metadata.json
      mockReadFileSync.mockImplementation((path) => {
        if (path.toString().endsWith('metadata.json')) {
          return JSON.stringify({
            description: 'Single-file bug fix',
            expectedType: 'fix',
            name: 'simple',
          });
        }
        if (path.toString().endsWith('mock-status.txt')) {
          return 'M  src/utils/parser.ts';
        }
        if (path.toString().endsWith('mock-diff.txt')) {
          return 'diff --git a/src/utils/parser.ts...';
        }
        throw new Error('Unexpected file');
      });

      // Act
      const fixture = runner.loadFixture('simple', 'mocked');

      // Assert
      expect(fixture.name).toBe('simple');
      expect(fixture.gitStatus).toBe('M  src/utils/parser.ts');
      expect(fixture.gitDiff).toBe('diff --git a/src/utils/parser.ts...');
      expect(fixture.expectedType).toBe('fix');
      expect(fixture.description).toBe('Single-file bug fix');
    });

    it('should throw EvaluationError.fixtureNotFound for missing fixture', async () => {
      // Arrange
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file');
      });

      // Act & Assert
      expect(() => runner.loadFixture('nonexistent')).toThrow(EvaluationError);
      expect(() => runner.loadFixture('nonexistent')).toThrow('Fixture "nonexistent" not found');
    });

    it('should throw EvaluationError.fixtureNotFound for missing metadata.json', async () => {
      // Arrange
      mockReadFileSync.mockImplementation((path) => {
        if (path.toString().endsWith('metadata.json')) {
          throw new Error('File not found');
        }
        return 'mock data';
      });

      // Act & Assert
      expect(() => runner.loadFixture('broken')).toThrow(EvaluationError);
    });

    it('should throw EvaluationError.fixtureNotFound for missing mock files', async () => {
      // Arrange
      mockReadFileSync.mockImplementation((path) => {
        if (path.toString().endsWith('metadata.json')) {
          return JSON.stringify({ description: 'Test', expectedType: 'fix', name: 'test' });
        }
        // Missing mock-status.txt or mock-diff.txt
        throw new Error('File not found');
      });

      // Act & Assert
      expect(() => runner.loadFixture('incomplete', 'mocked')).toThrow(EvaluationError);
    });

    it('should use correct paths for mocked mode', async () => {
      // Arrange
      const readFileCalls: string[] = [];

      mockReadFileSync.mockImplementation((path) => {
        readFileCalls.push(path.toString());
        if (path.toString().endsWith('metadata.json')) {
          return JSON.stringify({ description: 'Test', expectedType: 'fix', name: 'simple' });
        }
        return 'mock data';
      });

      // Act
      runner.loadFixture('simple', 'mocked');

      // Assert - should NOT include '-live' suffix
      expect(readFileCalls.some((path) => path.includes('simple-live'))).toBe(false);
      expect(readFileCalls.some((path) => path.includes('examples/eval-fixtures/simple'))).toBe(
        true
      );
    });

    it('should support different fixture types', async () => {
      // Arrange

      mockReadFileSync.mockImplementation((path) => {
        if (path.toString().endsWith('metadata.json')) {
          return JSON.stringify({
            description: 'Multi-file feature',
            expectedType: 'feat',
            name: 'complex',
          });
        }
        return 'mock data';
      });

      // Act
      const fixture = runner.loadFixture('complex', 'mocked');

      // Assert
      expect(fixture.expectedType).toBe('feat');
      expect(fixture.description).toBe('Multi-file feature');
    });
  });

  describe('runFixture', () => {
    let mockEvaluator: Evaluator;

    beforeEach(() => {
      // Get mocked instances

      mockEvaluator = (runner as unknown as { evaluator: Evaluator }).evaluator;
    });

    it('should generate with both Claude and Codex agents', async () => {
      // Arrange
      const fixture: EvalFixture = {
        description: 'Test',
        expectedType: 'fix',
        gitDiff: 'diff...',
        gitStatus: 'M  file.ts',
        name: 'test',
      };

      const claudeMessage = 'fix: claude message';
      const codexMessage = 'fix: codex message';

      // Mock generators
      const claudeGenerateSpy = mock().mockResolvedValue(claudeMessage);
      const codexGenerateSpy = mock().mockResolvedValue(codexMessage);

      mockGenerator.mockImplementation((config?: any) => {
        const generator = {
          generateCommitMessage: config?.agent === 'codex' ? codexGenerateSpy : claudeGenerateSpy,
        } as unknown as CommitMessageGenerator;
        return generator;
      });

      // Mock evaluator
      const mockMetrics: EvalMetrics = {
        accuracy: 8,
        clarity: 8,
        conventionalCompliance: 8,
        detailLevel: 8,
      };

      spyOn(mockEvaluator, 'evaluate').mockResolvedValue({
        agent: 'claude',
        commitMessage: claudeMessage,
        feedback: 'Good',
        fixture: 'test',
        metrics: mockMetrics,
        overallScore: 8,
        timestamp: new Date().toISOString(),
      } as EvalResult);

      // Act
      await runner.runFixture(fixture);

      // Assert
      expect(claudeGenerateSpy).toHaveBeenCalled();
      expect(codexGenerateSpy).toHaveBeenCalled();
    });

    it('should evaluate both messages with ChatGPT', async () => {
      // Arrange
      const fixture: EvalFixture = {
        description: 'Test',
        expectedType: 'fix',
        gitDiff: 'diff...',
        gitStatus: 'M  file.ts',
        name: 'test',
      };

      const claudeMessage = 'fix: claude message';
      const codexMessage = 'fix: codex message';

      mockGenerator.mockImplementation((config?: any) => {
        const message = config?.agent === 'codex' ? codexMessage : claudeMessage;
        return {
          generateCommitMessage: mock().mockResolvedValue(message),
        } as unknown as CommitMessageGenerator;
      });

      const mockMetrics: EvalMetrics = {
        accuracy: 8,
        clarity: 8,
        conventionalCompliance: 8,
        detailLevel: 8,
      };

      const evaluateSpy = spyOn(mockEvaluator, 'evaluate');

      evaluateSpy.mockResolvedValueOnce({
        agent: 'claude',
        commitMessage: claudeMessage,
        feedback: 'Good',
        fixture: 'test',
        metrics: mockMetrics,
        overallScore: 8,
        timestamp: new Date().toISOString(),
      } as EvalResult);

      evaluateSpy.mockResolvedValueOnce({
        agent: 'codex',
        commitMessage: codexMessage,
        feedback: 'Good',
        fixture: 'test',
        metrics: mockMetrics,
        overallScore: 7.5,
        timestamp: new Date().toISOString(),
      } as EvalResult);

      // Act
      await runner.runFixture(fixture);

      // Assert - evaluator called twice (once for Claude, once for Codex)
      expect(evaluateSpy).toHaveBeenCalledTimes(2);
      expect(evaluateSpy).toHaveBeenCalledWith(
        claudeMessage,
        fixture.gitStatus,
        fixture.gitDiff,
        fixture.name,
        'claude'
      );
      expect(evaluateSpy).toHaveBeenCalledWith(
        codexMessage,
        fixture.gitStatus,
        fixture.gitDiff,
        fixture.name,
        'codex'
      );
    });

    it('should determine winner correctly when Claude scores higher', async () => {
      // Arrange
      const fixture: EvalFixture = {
        description: 'Test',
        expectedType: 'fix',
        gitDiff: 'diff...',
        gitStatus: 'M  file.ts',
        name: 'test',
      };

      mockGenerator.mockImplementation(() => {
        return {
          generateCommitMessage: mock().mockResolvedValue('fix: message'),
        } as unknown as CommitMessageGenerator;
      });

      const mockMetrics: EvalMetrics = {
        accuracy: 8,
        clarity: 8,
        conventionalCompliance: 8,
        detailLevel: 8,
      };

      const evaluateSpy = spyOn(mockEvaluator, 'evaluate');

      // Claude scores 9.0
      evaluateSpy.mockResolvedValueOnce({
        agent: 'claude',
        commitMessage: 'fix: claude',
        feedback: 'Excellent',
        fixture: 'test',
        metrics: mockMetrics,
        overallScore: 9,
        timestamp: new Date().toISOString(),
      } as EvalResult);

      // Codex scores 7.0
      evaluateSpy.mockResolvedValueOnce({
        agent: 'codex',
        commitMessage: 'fix: codex',
        feedback: 'Good',
        fixture: 'test',
        metrics: mockMetrics,
        overallScore: 7,
        timestamp: new Date().toISOString(),
      } as EvalResult);

      // Act
      const comparison = await runner.runFixture(fixture);

      // Assert
      expect(comparison.winner).toBe('claude');
      expect(comparison.scoreDiff).toBe(2); // 9.0 - 7.0
    });

    it('should determine winner correctly when Codex scores higher', async () => {
      // Arrange
      const fixture: EvalFixture = {
        description: 'Test',
        expectedType: 'fix',
        gitDiff: 'diff...',
        gitStatus: 'M  file.ts',
        name: 'test',
      };

      mockGenerator.mockImplementation(() => {
        return {
          generateCommitMessage: mock().mockResolvedValue('fix: message'),
        } as unknown as CommitMessageGenerator;
      });

      const mockMetrics: EvalMetrics = {
        accuracy: 8,
        clarity: 8,
        conventionalCompliance: 8,
        detailLevel: 8,
      };

      const evaluateSpy = spyOn(mockEvaluator, 'evaluate');

      // Claude scores 6.5
      evaluateSpy.mockResolvedValueOnce({
        agent: 'claude',
        commitMessage: 'fix: claude',
        feedback: 'Okay',
        fixture: 'test',
        metrics: mockMetrics,
        overallScore: 6.5,
        timestamp: new Date().toISOString(),
      } as EvalResult);

      // Codex scores 8.0
      evaluateSpy.mockResolvedValueOnce({
        agent: 'codex',
        commitMessage: 'fix: codex',
        feedback: 'Good',
        fixture: 'test',
        metrics: mockMetrics,
        overallScore: 8,
        timestamp: new Date().toISOString(),
      } as EvalResult);

      // Act
      const comparison = await runner.runFixture(fixture);

      // Assert
      expect(comparison.winner).toBe('codex');
      expect(comparison.scoreDiff).toBe(-1.5); // 6.5 - 8.0 = -1.5
    });

    it('should determine tie when score difference is less than 0.5', async () => {
      // Arrange
      const fixture: EvalFixture = {
        description: 'Test',
        expectedType: 'fix',
        gitDiff: 'diff...',
        gitStatus: 'M  file.ts',
        name: 'test',
      };

      mockGenerator.mockImplementation(() => {
        return {
          generateCommitMessage: mock().mockResolvedValue('fix: message'),
        } as unknown as CommitMessageGenerator;
      });

      const mockMetrics: EvalMetrics = {
        accuracy: 8,
        clarity: 8,
        conventionalCompliance: 8,
        detailLevel: 8,
      };

      const evaluateSpy = spyOn(mockEvaluator, 'evaluate');

      // Claude scores 8.0
      evaluateSpy.mockResolvedValueOnce({
        agent: 'claude',
        commitMessage: 'fix: claude',
        feedback: 'Good',
        fixture: 'test',
        metrics: mockMetrics,
        overallScore: 8,
        timestamp: new Date().toISOString(),
      } as EvalResult);

      // Codex scores 8.3 (difference = 0.3, which is < 0.5)
      evaluateSpy.mockResolvedValueOnce({
        agent: 'codex',
        commitMessage: 'fix: codex',
        feedback: 'Good',
        fixture: 'test',
        metrics: mockMetrics,
        overallScore: 8.3,
        timestamp: new Date().toISOString(),
      } as EvalResult);

      // Act
      const comparison = await runner.runFixture(fixture);

      // Assert
      expect(comparison.winner).toBe('tie');
      expect(comparison.scoreDiff).toBeCloseTo(-0.3, 1);
    });

    it('should throw EvaluationError.generationFailed when Claude generation fails', async () => {
      // Arrange
      const fixture: EvalFixture = {
        description: 'Test',
        expectedType: 'fix',
        gitDiff: 'diff...',
        gitStatus: 'M  file.ts',
        name: 'test',
      };

      mockGenerator.mockImplementation(() => {
        return {
          generateCommitMessage: mock().mockResolvedValue(null), // Null = no message generated
        } as unknown as CommitMessageGenerator;
      });

      // Act & Assert
      await expect(runner.runFixture(fixture)).rejects.toThrow(EvaluationError);
      await expect(runner.runFixture(fixture)).rejects.toThrow(
        'Agent "claude" failed to generate commit message'
      );
    });

    it('should throw EvaluationError.generationFailed when Codex generation fails', async () => {
      // Arrange
      const fixture: EvalFixture = {
        description: 'Test',
        expectedType: 'fix',
        gitDiff: 'diff...',
        gitStatus: 'M  file.ts',
        name: 'test',
      };

      // Claude succeeds, Codex fails

      mockGenerator.mockImplementation((config?: any) => {
        const message = config?.agent === 'codex' ? null : 'fix: claude message';
        return {
          generateCommitMessage: mock().mockResolvedValue(message),
        } as unknown as CommitMessageGenerator;
      });

      // Act & Assert
      await expect(runner.runFixture(fixture)).rejects.toThrow(EvaluationError);
      await expect(runner.runFixture(fixture)).rejects.toThrow(
        'Agent "codex" failed to generate commit message'
      );
    });

    it('should return complete comparison with both results', async () => {
      // Arrange
      const fixture: EvalFixture = {
        description: 'Test',
        expectedType: 'fix',
        gitDiff: 'diff...',
        gitStatus: 'M  file.ts',
        name: 'test-fixture',
      };

      mockGenerator.mockImplementation(() => {
        return {
          generateCommitMessage: mock().mockResolvedValue('fix: message'),
        } as unknown as CommitMessageGenerator;
      });

      const mockMetrics: EvalMetrics = {
        accuracy: 8,
        clarity: 8,
        conventionalCompliance: 8,
        detailLevel: 8,
      };

      const claudeResult: EvalResult = {
        agent: 'claude',
        commitMessage: 'fix: claude',
        feedback: 'Good',
        fixture: 'test-fixture',
        metrics: mockMetrics,
        overallScore: 8.5,
        timestamp: new Date().toISOString(),
      };

      const codexResult: EvalResult = {
        agent: 'codex',
        commitMessage: 'fix: codex',
        feedback: 'Good',
        fixture: 'test-fixture',
        metrics: mockMetrics,
        overallScore: 7.5,
        timestamp: new Date().toISOString(),
      };

      const evaluateSpy = spyOn(mockEvaluator, 'evaluate');
      evaluateSpy.mockResolvedValueOnce(claudeResult);
      evaluateSpy.mockResolvedValueOnce(codexResult);

      // Act
      const comparison = await runner.runFixture(fixture);

      // Assert
      expect(comparison.fixture).toBe('test-fixture');
      expect(comparison.claudeResult).toEqual(claudeResult);
      expect(comparison.codexResult).toEqual(codexResult);
      expect(comparison.winner).toBe('claude');
      expect(comparison.scoreDiff).toBe(1);
    });
  });

  describe('runAll', () => {
    it('should discover and load fixtures in mocked mode', async () => {
      // Arrange

      // Mock directory listing
      mockReaddirSync.mockReturnValue(['simple', 'complex', 'simple-live'] as never[]);

      // Mock file reads
      mockReadFileSync.mockImplementation((path) => {
        if (path.toString().endsWith('metadata.json')) {
          return JSON.stringify({ description: 'Test', expectedType: 'fix', name: 'test' });
        }
        return 'mock data';
      });

      // Mock generator and evaluator
      mockGenerator.mockImplementation(() => {
        return {
          generateCommitMessage: mock().mockResolvedValue('fix: message'),
        } as unknown as CommitMessageGenerator;
      });

      const mockEvaluator = (runner as unknown as { evaluator: Evaluator }).evaluator;
      const mockMetrics: EvalMetrics = {
        accuracy: 8,
        clarity: 8,
        conventionalCompliance: 8,
        detailLevel: 8,
      };

      spyOn(mockEvaluator, 'evaluate').mockResolvedValue({
        agent: 'claude',
        commitMessage: 'fix: test',
        feedback: 'Good',
        fixture: 'test',
        metrics: mockMetrics,
        overallScore: 8,
        timestamp: new Date().toISOString(),
      } as EvalResult);

      // Act
      const results = await runner.runAll('mocked');

      // Assert - should exclude 'simple-live' in mocked mode
      expect(results.length).toBe(2); // simple, complex (not simple-live)
    });

    it('should discover and load fixtures in live mode', async () => {
      // Arrange

      // Mock directory listing
      mockReaddirSync.mockReturnValue(['simple', 'complex', 'simple-live'] as never[]);

      // Mock file reads
      mockReadFileSync.mockImplementation((path) => {
        if (path.toString().endsWith('metadata.json')) {
          return JSON.stringify({ description: 'Test', expectedType: 'fix', name: 'test' });
        }
        return 'mock data';
      });

      // Mock generator and evaluator
      mockGenerator.mockImplementation(() => {
        return {
          generateCommitMessage: mock().mockResolvedValue('fix: message'),
        } as unknown as CommitMessageGenerator;
      });

      const mockEvaluator = (runner as unknown as { evaluator: Evaluator }).evaluator;
      const mockMetrics: EvalMetrics = {
        accuracy: 8,
        clarity: 8,
        conventionalCompliance: 8,
        detailLevel: 8,
      };

      spyOn(mockEvaluator, 'evaluate').mockResolvedValue({
        agent: 'claude',
        commitMessage: 'fix: test',
        feedback: 'Good',
        fixture: 'test',
        metrics: mockMetrics,
        overallScore: 8,
        timestamp: new Date().toISOString(),
      } as EvalResult);

      // Act
      const results = await runner.runAll('live');

      // Assert - should only include 'simple-live' in live mode
      expect(results.length).toBe(1); // only simple-live
    });

    it('should return array of comparisons', async () => {
      // Arrange

      mockReaddirSync.mockReturnValue(['simple', 'complex'] as never[]);

      mockReadFileSync.mockImplementation((path) => {
        if (path.toString().endsWith('metadata.json')) {
          return JSON.stringify({ description: 'Test', expectedType: 'fix', name: 'test' });
        }
        return 'mock data';
      });

      mockGenerator.mockImplementation(() => {
        return {
          generateCommitMessage: mock().mockResolvedValue('fix: message'),
        } as unknown as CommitMessageGenerator;
      });

      const mockEvaluator = (runner as unknown as { evaluator: Evaluator }).evaluator;
      const mockMetrics: EvalMetrics = {
        accuracy: 8,
        clarity: 8,
        conventionalCompliance: 8,
        detailLevel: 8,
      };

      spyOn(mockEvaluator, 'evaluate').mockResolvedValue({
        agent: 'claude',
        commitMessage: 'fix: test',
        feedback: 'Good',
        fixture: 'test',
        metrics: mockMetrics,
        overallScore: 8,
        timestamp: new Date().toISOString(),
      } as EvalResult);

      // Act
      const results = await runner.runAll('mocked');

      // Assert
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);
      expect(results[0]).toHaveProperty('claudeResult');
      expect(results[0]).toHaveProperty('codexResult');
      expect(results[0]).toHaveProperty('winner');
      expect(results[0]).toHaveProperty('scoreDiff');
    });
  });
});
