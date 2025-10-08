import { execa } from 'execa';

import type { AIProvider, ProviderConfig } from './providers/index.js';

import { ClaudeProvider, createProvider, ProviderChain } from './providers/index.js';
import { hasContent } from './utils/guards.js';

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
  /** @deprecated Use provider config instead. AI client command (default: 'claude') */
  aiCommand?: string;
  /** @deprecated Use provider config instead. Timeout for AI generation in ms (default: 120000) */
  aiTimeout?: number;
  /** Auto-detect first available provider (default: false) */
  autoDetect?: boolean;
  /** Enable/disable AI generation (default: true) */
  enableAI?: boolean;
  /** Custom logger function */
  logger?: {
    warn: (message: string) => void;
  };
  /** AI provider (config or instance) */
  provider?: AIProvider | ProviderConfig;
  /** Provider chain configs for fallback support */
  providerChain?: ProviderConfig[];
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
 *   aiCommand: 'claude',
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
  private readonly config: Required<
    Omit<
      CommitMessageGeneratorConfig,
      'aiCommand' | 'aiTimeout' | 'autoDetect' | 'provider' | 'providerChain'
    >
  >;
  private readonly provider: AIProvider;

  constructor(config: CommitMessageGeneratorConfig = {}) {
    this.config = {
      signature:
        config.signature ??
        '🤖 Generated with Claude via commitment\n\nCo-Authored-By: Claude <noreply@anthropic.com>',
      enableAI: config.enableAI ?? true,
      logger: config.logger ?? { warn: () => {} },
    };

    // Initialize provider with priority: providerChain > provider > legacy config
    if (config.providerChain !== undefined && config.providerChain.length > 0) {
      // Create provider chain from configs
      const providers = config.providerChain.map((providerConfig) =>
        createProvider(providerConfig),
      );
      this.provider = new ProviderChain(providers);
    } else if (config.provider !== undefined) {
      // Single provider (existing behavior)
      this.provider =
        'generateCommitMessage' in config.provider && 'isAvailable' in config.provider
          ? config.provider
          : createProvider(config.provider);
    } else {
      // Default to Claude (backward compatibility)
      this.provider = new ClaudeProvider({
        command: config.aiCommand,
        timeout: config.aiTimeout,
      });
    }

    // Warn if using deprecated fields
    if (
      config.provider === undefined &&
      config.providerChain === undefined &&
      (config.aiCommand !== undefined || config.aiTimeout !== undefined)
    ) {
      this.config.logger.warn(
        '⚠️ aiCommand and aiTimeout are deprecated. Use provider config instead.',
      );
    }

    // Warn if autoDetect is used (should be handled by CLI before construction)
    if (config.autoDetect === true) {
      this.config.logger.warn(
        '⚠️ autoDetect should be handled before creating CommitMessageGenerator. Use detectAvailableProvider() utility.',
      );
    }
  }

  /**
   * Generate intelligent commit message based on task and changes
   */
  async generateCommitMessage(task: CommitTask, options: CommitMessageOptions): Promise<string> {
    // Try AI-powered generation first if enabled
    if (this.config.enableAI) {
      try {
        const aiMessage = await this._generateAICommitMessage(task, options);
        if (this._isValidMessage(aiMessage)) {
          return this._addSignature(aiMessage);
        }
      } catch (error) {
        this.config.logger.warn(
          `⚠️ AI commit message generation failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Fallback to intelligent rule-based generation
    const ruleBasedMessage = this._generateRuleBasedCommitMessage(task, options);
    return this._addSignature(ruleBasedMessage);
  }

  /**
   * Generate commit message using AI provider
   */
  private async _generateAICommitMessage(
    task: CommitTask,
    options: CommitMessageOptions,
  ): Promise<string> {
    // Get comprehensive git diff information
    const gitDiffStat = await this._execGit(['diff', '--cached', '--stat'], options.workdir);
    const gitDiffNameStatus = await this._execGit(
      ['diff', '--cached', '--name-status'],
      options.workdir,
    );

    // Get actual code changes (limited to avoid token limits)
    const gitDiffContent = await this._execGit(
      ['diff', '--cached', '--unified=3', '--ignore-space-change'],
      options.workdir,
    );

    // Truncate diff if too long to avoid token limits
    const maxDiffLength = 8000; // Reserve tokens for prompt and response
    const truncatedDiff =
      gitDiffContent.length > maxDiffLength
        ? `${gitDiffContent.slice(0, maxDiffLength)}\n... (diff truncated)`
        : gitDiffContent;

    const prompt = `Generate a professional commit message based on the actual code changes:

Task Context:
- Title: ${task.title}
- Description: ${task.description}
- Files: ${options.files?.join(', ') ?? 'No files specified'}

File Changes Summary:
${gitDiffNameStatus}

Diff Statistics:
${gitDiffStat}

Actual Code Changes:
\`\`\`diff
${truncatedDiff}
\`\`\`

Task Execution Output:
${options.output ?? 'No execution output provided'}

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

    // Analyze patterns in the actual changes
    const changeAnalysis = this._analyzeCodeChanges(truncatedDiff, options.files ?? []);
    const enhancedPrompt = `${prompt}

Change Analysis:
${changeAnalysis}`;

    try {
      // Use provider to generate commit message
      return await this.provider.generateCommitMessage(enhancedPrompt, {
        workdir: options.workdir,
      });
    } catch (error) {
      throw new Error(
        `${this.provider.getName()} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Generate commit message using rule-based analysis
   */
  private _generateRuleBasedCommitMessage(task: CommitTask, options: CommitMessageOptions): string {
    const files = options.files ?? [];

    // Analyze file patterns for intelligent categorization
    const categories = this._categorizeFiles(files);
    const bulletPoints: string[] = [];

    // Generate detailed bullet points based on file changes
    if (categories.components.length > 0) {
      bulletPoints.push(
        `- Add ${categories.components.length} component${categories.components.length > 1 ? 's' : ''}: ${categories.components.slice(0, 3).join(', ')}${categories.components.length > 3 ? '...' : ''}`,
      );
    }

    if (categories.apis.length > 0) {
      bulletPoints.push(
        `- Implement ${categories.apis.length} API endpoint${categories.apis.length > 1 ? 's' : ''}: ${categories.apis.slice(0, 3).join(', ')}${categories.apis.length > 3 ? '...' : ''}`,
      );
    }

    if (categories.tests.length > 0) {
      bulletPoints.push(
        `- Add ${categories.tests.length} test file${categories.tests.length > 1 ? 's' : ''} for comprehensive coverage`,
      );
    }

    if (categories.configs.length > 0) {
      bulletPoints.push(
        `- Update ${categories.configs.length} configuration file${categories.configs.length > 1 ? 's' : ''}`,
      );
    }

    if (categories.docs.length > 0) {
      bulletPoints.push(`- Update documentation and README files`);
    }

    // Add file count summary if we have uncategorized files
    const categorizedCount =
      categories.components.length +
      categories.apis.length +
      categories.tests.length +
      categories.configs.length +
      categories.docs.length;
    const uncategorizedCount = files.length - categorizedCount;
    if (uncategorizedCount > 0) {
      bulletPoints.push(
        `- Modify ${uncategorizedCount} additional file${uncategorizedCount > 1 ? 's' : ''}`,
      );
    }

    // Generate title based on predominant file type
    let title = '';
    let prefix = '';

    if (categories.tests.length > categories.components.length + categories.apis.length) {
      prefix = 'test';
      title = `add test coverage for ${task.title.toLowerCase()}`;
    } else if (categories.components.length > 0) {
      prefix = 'feat';
      title = `add ${task.title.toLowerCase()}`;
    } else if (categories.apis.length > 0) {
      prefix = 'feat';
      title = `implement ${task.title.toLowerCase()}`;
    } else if (categories.docs.length > 0) {
      prefix = 'docs';
      title = `update ${task.title.toLowerCase()}`;
    } else if (categories.configs.length > 0) {
      prefix = 'chore';
      title = `update ${task.title.toLowerCase()}`;
    } else {
      prefix = task.produces.length > 0 ? 'feat' : 'chore';
      title = task.title.toLowerCase();
    }

    // Create complete commit message
    const commitTitle = `${prefix}: ${title}`;

    if (bulletPoints.length > 0) {
      return `${commitTitle}\n\n${bulletPoints.join('\n')}`;
    }
    return `${commitTitle}\n\n- ${task.description}`;
  }

  private _categorizeFiles(files: string[]): {
    apis: string[];
    components: string[];
    configs: string[];
    docs: string[];
    tests: string[];
  } {
    const categories = {
      components: [] as string[],
      apis: [] as string[],
      tests: [] as string[],
      configs: [] as string[],
      docs: [] as string[],
    };

    for (const file of files) {
      const lower = file.toLowerCase();

      if (lower.includes('component') || lower.endsWith('.tsx') || lower.endsWith('.jsx')) {
        categories.components.push(file);
      } else if (lower.includes('api') || lower.includes('endpoint') || lower.includes('route')) {
        categories.apis.push(file);
      } else if (lower.includes('test') || lower.includes('spec')) {
        categories.tests.push(file);
      } else if (lower.includes('config') || lower.endsWith('.json') || lower.endsWith('.yaml')) {
        categories.configs.push(file);
      } else if (lower.endsWith('.md') || lower.includes('readme') || lower.includes('doc')) {
        categories.docs.push(file);
      }
    }

    return categories;
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
   * Execute git command and return stdout
   */
  private async _execGit(args: string[], cwd: string): Promise<string> {
    try {
      const { stdout } = await execa('git', args, { cwd });
      return stdout;
    } catch (error) {
      throw new Error(
        `Git command failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Analyze code changes to provide more accurate context
   */
  private _analyzeCodeChanges(diffContent: string, files: string[]): string {
    const analysis: string[] = [];

    // Analyze diff patterns
    const addedLines = diffContent
      .split('\n')
      .filter((line) => line.startsWith('+') && !line.startsWith('+++'));
    const removedLines = diffContent
      .split('\n')
      .filter((line) => line.startsWith('-') && !line.startsWith('---'));

    // Detect significant patterns only
    const patterns = {
      newFunctions: addedLines.filter((line) =>
        /\+.*(?:function|const\s+\w+\s*=|class\s+\w+)/.test(line),
      ).length,
      removedFunctions: removedLines.filter((line) =>
        /-.*(?:function|const\s+\w+\s*=|class\s+\w+)/.test(line),
      ).length,
      newTests: addedLines.filter((line) => /\+.*(test|it|describe)\s*\(/.test(line)).length,
      removedTests: removedLines.filter((line) => /-.*(test|it|describe)\s*\(/.test(line)).length,
      mockChanges:
        diffContent.includes('vi.mock') ||
        diffContent.includes('jest.mock') ||
        diffContent.includes('mock'),
      typeChanges:
        diffContent.includes('interface') ||
        diffContent.includes('type ') ||
        diffContent.includes('.d.ts'),
    };

    // Generate concise analysis - only significant changes
    if (patterns.newFunctions > patterns.removedFunctions + 1) {
      analysis.push(`Added ${patterns.newFunctions} new functions/methods`);
    } else if (patterns.removedFunctions > patterns.newFunctions + 1) {
      analysis.push(`Removed ${patterns.removedFunctions} functions/methods`);
    } else if (patterns.newFunctions > 0 || patterns.removedFunctions > 0) {
      analysis.push('Modified function definitions');
    }

    if (patterns.newTests > 0) {
      analysis.push(`Added ${patterns.newTests} test cases`);
    } else if (patterns.removedTests > 0) {
      analysis.push(`Removed ${patterns.removedTests} test cases`);
    }

    if (patterns.mockChanges) {
      analysis.push('Modified mocking/test patterns');
    }

    if (patterns.typeChanges) {
      analysis.push('Updated TypeScript definitions');
    }

    // File scope context
    const fileCount = files.length;
    if (fileCount === 1) {
      analysis.push('Single file modification');
    } else if (fileCount > 5) {
      analysis.push(`Broad changes across ${fileCount} files`);
    }

    // Change magnitude (only for significant changes)
    const totalChanges = addedLines.length + removedLines.length;
    if (totalChanges > 100) {
      analysis.push(`Substantial changes: ${addedLines.length}+ ${removedLines.length}- lines`);
    } else if (totalChanges > 20) {
      analysis.push('Moderate code changes');
    }

    return analysis.length > 0 ? analysis.join('\n- ') : 'Minor code modifications';
  }
}
