import { ClaudeAgent } from './agents/claude';
import { CodexAgent } from './agents/codex';
import type { Agent } from './agents/types';
import { AgentError, GeneratorError } from './errors';
import {
  safeValidateCommitOptions,
  safeValidateCommitTask,
  safeValidateGeneratorConfig,
} from './types/schemas';
import { categorizeFiles } from './utils/git-schemas';
import { hasContent, isDefined, isString } from './utils/guards';
import { exec } from './utils/shell';

/**
 * Minimal task interface for commit message generation
 * Can be fulfilled by any task object with these properties
 */
export type CommitTask = {
  description: string;
  produces: string[];
  title: string;
};

/**
 * Configuration options for commit message generation
 */
export type CommitMessageGeneratorConfig = {
  /** AI agent to use ('claude' | 'codex', default: 'claude') */
  agent?: 'claude' | 'codex';
  /** Enable/disable AI generation (default: true) */
  enableAI?: boolean;
  /** Custom logger function */
  logger?: {
    warn: (message: string) => void;
  };
  /** Custom signature to append to commits */
  signature?: string;
};

/**
 * Options for generating a commit message
 */
export type CommitMessageOptions = {
  /** Specific files involved in the change */
  files?: string[];
  /** Task execution output or additional context */
  output?: string | undefined;
  /** Working directory for git operations */
  workdir: string;
};

/**
 * Standalone commit message generator that uses AI with intelligent fallback
 *
 * @example
 * ```typescript
 * const generator = new CommitMessageGenerator({
 *   agent: 'claude',
 *   enableAI: true,
 * });
 *
 * const task = {
 *   title: 'Add user authentication',
 *   description: 'Implement JWT-based auth',
 *   produces: ['src/auth.ts'],
 * };
 *
 * const message = await generator.generateCommitMessage(task, {
 *   workdir: process.cwd(),
 *   files: ['src/auth.ts'],
 * });
 * ```
 */
export class CommitMessageGenerator {
  private readonly config: Required<Omit<CommitMessageGeneratorConfig, 'agent'>>;
  private readonly agent: Agent;

  constructor(config: CommitMessageGeneratorConfig = {}) {
    // Validate configuration at construction boundary
    const validationResult = safeValidateGeneratorConfig(config);

    if (!validationResult.success) {
      // Format ZodError for user-friendly output
      const errorMessages = validationResult.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : 'config';
        return `${path}: ${issue.message}`;
      });

      throw new GeneratorError('Invalid CommitMessageGenerator configuration', {
        context: { validationErrors: errorMessages },
        suggestedAction: `Please provide valid configuration with:
  - agent: 'claude' | 'codex' (optional, default: 'claude')
  - enableAI: boolean (optional, default: true)
  - signature: string (optional)
  - logger: { warn: (msg: string) => void } (optional)`,
      });
    }

    // Use validated config (now fully type-safe)
    const validatedConfig = validationResult.data;

    // Instantiate agent directly based on config (defaults to Claude)
    const agentName = validatedConfig.agent ?? 'claude';
    this.agent = agentName === 'codex' ? new CodexAgent() : new ClaudeAgent();

    // Generate default signature based on the agent being used
    const defaultSignature =
      agentName === 'codex'
        ? '🤖 Generated with Codex via commitment'
        : '🤖 Generated with Claude via commitment';

    this.config = {
      enableAI: validatedConfig.enableAI ?? true,
      logger: isDefined(validatedConfig.logger)
        ? { warn: validatedConfig.logger.warn as (message: string) => void }
        : { warn: () => {} },
      signature: validatedConfig.signature ?? defaultSignature,
    };
  }

  /**
   * Generate intelligent commit message based on task and changes
   */
  async generateCommitMessage(task: CommitTask, options: CommitMessageOptions): Promise<string> {
    // Validate task parameter
    const taskValidation = safeValidateCommitTask(task);
    if (!taskValidation.success) {
      const errorMessages = taskValidation.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : 'task';
        return `${path}: ${issue.message}`;
      });

      throw GeneratorError.invalidTask(errorMessages);
    }

    // Validate options parameter
    const optionsValidation = safeValidateCommitOptions(options);
    if (!optionsValidation.success) {
      const errorMessages = optionsValidation.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : 'options';
        return `${path}: ${issue.message}`;
      });

      throw GeneratorError.invalidOptions(errorMessages);
    }

    // Use validated parameters (now fully type-safe)
    const validatedTask = taskValidation.data;
    const validatedOptions = optionsValidation.data;

    // Try AI-powered generation first if enabled
    if (this.config.enableAI) {
      try {
        const aiMessage = await this._generateAICommitMessage(validatedTask, validatedOptions);
        if (this._isValidMessage(aiMessage)) {
          return this._addSignature(aiMessage);
        }
      } catch (error) {
        // Log warning but don't throw - will fall back to rule-based
        const errorMessage =
          error instanceof AgentError
            ? `${error.agentName ?? 'Agent'} failed: ${error.message}`
            : error instanceof Error
              ? error.message
              : String(error);

        this.config.logger.warn(`⚠️ AI commit message generation failed: ${errorMessage}`);
      }
    }

    // Fallback to intelligent rule-based generation
    const ruleBasedMessage = this._generateRuleBasedCommitMessage(validatedTask, validatedOptions);
    return this._addSignature(ruleBasedMessage);
  }

  /**
   * Generate commit message using AI provider
   */
  private async _generateAICommitMessage(
    task: CommitTask,
    options: CommitMessageOptions
  ): Promise<string> {
    // Get comprehensive git diff information
    const gitDiffStat = await this._execGit(['diff', '--cached', '--stat'], options.workdir);
    const gitDiffNameStatus = await this._execGit(
      ['diff', '--cached', '--name-status'],
      options.workdir
    );

    // Get actual code changes (limited to avoid token limits)
    const gitDiffContent = await this._execGit(
      ['diff', '--cached', '--unified=3', '--ignore-space-change'],
      options.workdir
    );

    // Validate git outputs are strings
    if (!isString(gitDiffStat) || !isString(gitDiffNameStatus) || !isString(gitDiffContent)) {
      throw new Error('Git diff output validation failed: expected string output');
    }

    // Truncate diff if too long to avoid token limits
    const maxDiffLength = 8000; // Reserve tokens for prompt and response
    const truncatedDiff =
      gitDiffContent.length > maxDiffLength
        ? `${gitDiffContent.slice(0, maxDiffLength)}\n... (diff truncated)`
        : gitDiffContent;

    // Build file list with validation
    const filesList =
      isDefined(options.files) && options.files.length > 0
        ? options.files.join(', ')
        : 'No files specified';

    const prompt = `Generate a professional commit message based on the actual code changes:

Task Context:
- Title: ${task.title}
- Description: ${task.description}
- Files: ${filesList}

File Changes Summary:
${gitDiffNameStatus}

Diff Statistics:
${gitDiffStat}

Actual Code Changes:
\`\`\`diff
${truncatedDiff}
\`\`\`

Task Execution Output:
${hasContent(options.output) ? options.output : 'No execution output provided'}

Requirements:
1. ANALYZE THE ACTUAL CODE CHANGES - don't guess based on file names
2. Clear, descriptive title (50 chars or less) following conventional commits
3. Be CONCISE - match detail level to scope of changes:
   - Single file/method: 2-4 bullet points max
   - Multiple files: 4-6 bullet points max
   - Major refactor: 6+ bullet points as needed
4. Use imperative mood ("Add feature" not "Added feature")
5. Format: Title + blank line + bullet point details
6. Focus on the most important changes from the diff:
   - Key functionality added/modified/removed
   - Significant logic or behavior changes
   - Important architectural changes
7. Avoid over-describing implementation details for small changes
8. DO NOT include preamble like "Looking at the changes"
9. Start directly with the action ("Add", "Fix", "Update", etc.)
10. Quality over quantity - fewer, more meaningful bullet points

Example format:
feat: add user authentication system

- Implement JWT-based authentication flow
- Add login/logout endpoints in auth routes
- Create user session management middleware
- Add password hashing with bcrypt
- Update frontend to handle auth tokens

Return ONLY the commit message content between these markers:
<<<COMMIT_MESSAGE_START>>>
(commit message goes here)
<<<COMMIT_MESSAGE_END>>>`;

    // Analyze patterns in the actual changes with validated files
    const filesToAnalyze = isDefined(options.files) ? options.files : [];
    const changeAnalysis = this._analyzeCodeChanges(truncatedDiff, filesToAnalyze);
    const enhancedPrompt = `${prompt}

Change Analysis:
${changeAnalysis}`;

    try {
      // Use agent to generate commit message
      return await this.agent.generate(enhancedPrompt, options.workdir);
    } catch (error) {
      // Wrap agent errors with generator context
      if (error instanceof AgentError) {
        throw GeneratorError.aiGenerationFailed(this.agent.name, error);
      }

      // Wrap other errors
      const wrappedError = error instanceof Error ? error : new Error(String(error));
      throw GeneratorError.aiGenerationFailed(this.agent.name, wrappedError);
    }
  }

  /**
   * Generate commit message using rule-based analysis
   */
  private _generateRuleBasedCommitMessage(task: CommitTask, options: CommitMessageOptions): string {
    const files = isDefined(options.files) ? options.files : [];
    const categories = this._categorizeFiles(files);
    const bulletPoints = this._createBulletPoints(categories, files);
    const { prefix, title } = this._determineCommitType(categories, task);

    return this._formatCommitMessage(prefix, title, bulletPoints, task.description);
  }

  /**
   * Create bullet points from file categories
   */
  private _createBulletPoints(
    categories: ReturnType<typeof this._categorizeFiles>,
    files: string[]
  ): string[] {
    const bulletPoints: string[] = [];

    if (categories.components.length > 0) {
      bulletPoints.push(
        this._createFileBulletPoint(
          'Add',
          'component',
          categories.components.length,
          categories.components
        )
      );
    }

    if (categories.apis.length > 0) {
      bulletPoints.push(
        this._createFileBulletPoint(
          'Implement',
          'API endpoint',
          categories.apis.length,
          categories.apis
        )
      );
    }

    if (categories.tests.length > 0) {
      bulletPoints.push(
        `- Add ${categories.tests.length} test file${categories.tests.length > 1 ? 's' : ''} for comprehensive coverage`
      );
    }

    if (categories.configs.length > 0) {
      bulletPoints.push(
        `- Update ${categories.configs.length} configuration file${categories.configs.length > 1 ? 's' : ''}`
      );
    }

    if (categories.docs.length > 0) {
      bulletPoints.push(`- Update documentation and README files`);
    }

    // Add uncategorized files summary
    const categorizedCount =
      categories.components.length +
      categories.apis.length +
      categories.tests.length +
      categories.configs.length +
      categories.docs.length;
    const uncategorizedCount = files.length - categorizedCount;

    if (uncategorizedCount > 0) {
      bulletPoints.push(
        `- Modify ${uncategorizedCount} additional file${uncategorizedCount > 1 ? 's' : ''}`
      );
    }

    return bulletPoints;
  }

  /**
   * Create a bullet point for a file category
   */
  private _createFileBulletPoint(
    verb: string,
    type: string,
    count: number,
    fileList: string[]
  ): string {
    const plural = count > 1 ? 's' : '';
    const preview = fileList.slice(0, 3).join(', ');
    const ellipsis = fileList.length > 3 ? '...' : '';
    return `- ${verb} ${count} ${type}${plural}: ${preview}${ellipsis}`;
  }

  /**
   * Determine commit type prefix and title based on file categories
   */
  private _determineCommitType(
    categories: ReturnType<typeof this._categorizeFiles>,
    task: CommitTask
  ): { prefix: string; title: string } {
    const isTestDominant =
      categories.tests.length > categories.components.length + categories.apis.length;

    if (isTestDominant) {
      return { prefix: 'test', title: `add test coverage for ${task.title.toLowerCase()}` };
    }

    if (categories.components.length > 0) {
      return { prefix: 'feat', title: `add ${task.title.toLowerCase()}` };
    }

    if (categories.apis.length > 0) {
      return { prefix: 'feat', title: `implement ${task.title.toLowerCase()}` };
    }

    if (categories.docs.length > 0) {
      return { prefix: 'docs', title: `update ${task.title.toLowerCase()}` };
    }

    if (categories.configs.length > 0) {
      return { prefix: 'chore', title: `update ${task.title.toLowerCase()}` };
    }

    return {
      prefix: task.produces.length > 0 ? 'feat' : 'chore',
      title: task.title.toLowerCase(),
    };
  }

  /**
   * Format the final commit message
   */
  private _formatCommitMessage(
    prefix: string,
    title: string,
    bulletPoints: string[],
    fallbackDescription: string
  ): string {
    const commitTitle = `${prefix}: ${title}`;

    if (bulletPoints.length > 0) {
      return `${commitTitle}\n\n${bulletPoints.join('\n')}`;
    }

    return `${commitTitle}\n\n- ${fallbackDescription}`;
  }

  private _categorizeFiles(files: string[]): {
    apis: string[];
    components: string[];
    configs: string[];
    docs: string[];
    tests: string[];
    types: string[];
  } {
    // Use validated categorizeFiles from git-schemas
    // This provides runtime validation and consistent categorization logic
    return categorizeFiles(files);
  }

  /**
   * Add signature to commit message
   */
  private _addSignature(message: string): string {
    if (!hasContent(this.config.signature)) {
      return message;
    }
    return `${message}\n\n${this.config.signature}`;
  }

  /**
   * Check if message is valid (non-empty and has minimum length)
   */
  private _isValidMessage(message: string): boolean {
    return typeof message === 'string' && message.trim().length >= 5;
  }

  /**
   * Execute git command and return stdout with validation
   */
  private async _execGit(args: string[], cwd: string): Promise<string> {
    // Validate cwd is a non-empty string
    if (!isString(cwd) || !hasContent(cwd)) {
      throw new Error('Working directory must be a non-empty string');
    }

    try {
      const result = await exec('git', args, { cwd });

      // Validate output is a string
      if (!isString(result.stdout)) {
        throw new Error('Git command returned non-string output');
      }

      return result.stdout;
    } catch (error) {
      throw new Error(
        `Git command failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Analyze code changes to provide more accurate context
   */
  private _analyzeCodeChanges(diffContent: string, files: string[]): string {
    if (!isString(diffContent)) {
      throw new Error('Diff content must be a string');
    }

    const { addedLines, removedLines } = this._parseDiffLines(diffContent);
    const patterns = this._detectPatterns(diffContent, addedLines, removedLines);

    const analysis = [
      ...this._analyzePatterns(patterns),
      ...this._analyzeFileScope(files.length),
      ...this._analyzeChangeMagnitude(addedLines.length, removedLines.length),
    ];

    return analysis.length > 0 ? analysis.join('\n- ') : 'Minor code modifications';
  }

  /**
   * Parse diff content into added and removed lines
   */
  private _parseDiffLines(diffContent: string): { addedLines: string[]; removedLines: string[] } {
    const lines = diffContent.split('\n');
    return {
      addedLines: lines.filter((line) => line.startsWith('+') && !line.startsWith('++')),
      removedLines: lines.filter((line) => line.startsWith('-') && !line.startsWith('---')),
    };
  }

  /**
   * Detect code patterns in diff
   */
  private _detectPatterns(diffContent: string, addedLines: string[], removedLines: string[]) {
    return {
      mockChanges:
        diffContent.includes('vi.mock') ||
        diffContent.includes('jest.mock') ||
        diffContent.includes('mock'),
      newFunctions: addedLines.filter((line) =>
        /\+.*(?:function|const\s+\w+\s*=|class\s+\w+)/.test(line)
      ).length,
      newTests: addedLines.filter((line) => /\+.*(test|it|describe)\s*\(/.test(line)).length,
      removedFunctions: removedLines.filter((line) =>
        /-.*(?:function|const\s+\w+\s*=|class\s+\w+)/.test(line)
      ).length,
      removedTests: removedLines.filter((line) => /-.*(test|it|describe)\s*\(/.test(line)).length,
      typeChanges:
        diffContent.includes('interface') ||
        diffContent.includes('type ') ||
        diffContent.includes('.d.ts'),
    };
  }

  /**
   * Analyze patterns and generate insights
   */
  private _analyzePatterns(patterns: ReturnType<typeof this._detectPatterns>): string[] {
    const analysis: string[] = [];

    // Function changes
    if (patterns.newFunctions > patterns.removedFunctions + 1) {
      analysis.push(`Added ${patterns.newFunctions} new functions/methods`);
    } else if (patterns.removedFunctions > patterns.newFunctions + 1) {
      analysis.push(`Removed ${patterns.removedFunctions} functions/methods`);
    } else if (patterns.newFunctions > 0 || patterns.removedFunctions > 0) {
      analysis.push('Modified function definitions');
    }

    // Test changes
    if (patterns.newTests > 0) {
      analysis.push(`Added ${patterns.newTests} test cases`);
    } else if (patterns.removedTests > 0) {
      analysis.push(`Removed ${patterns.removedTests} test cases`);
    }

    // Other changes
    if (patterns.mockChanges) {
      analysis.push('Modified mocking/test patterns');
    }

    if (patterns.typeChanges) {
      analysis.push('Updated TypeScript definitions');
    }

    return analysis;
  }

  /**
   * Analyze file scope
   */
  private _analyzeFileScope(fileCount: number): string[] {
    if (fileCount === 1) {
      return ['Single file modification'];
    }
    if (fileCount > 5) {
      return [`Broad changes across ${fileCount} files`];
    }
    return [];
  }

  /**
   * Analyze change magnitude
   */
  private _analyzeChangeMagnitude(addedCount: number, removedCount: number): string[] {
    const totalChanges = addedCount + removedCount;

    if (totalChanges > 100) {
      return [`Substantial changes: ${addedCount}+ ${removedCount}- lines`];
    }
    if (totalChanges > 20) {
      return ['Moderate code changes'];
    }
    return [];
  }
}
