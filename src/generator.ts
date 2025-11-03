import { match } from 'ts-pattern';

import { createAgent } from './agents/factory';
import type { Agent, AgentName } from './agents/types';
import { AgentError, GeneratorError } from './errors';
import { buildCommitMessagePrompt } from './prompts';
import {
  safeValidateCommitOptions,
  safeValidateCommitTask,
  safeValidateGeneratorConfig,
} from './types/schemas';
import type { GitProvider } from './utils/git-provider';
import { RealGitProvider } from './utils/git-provider';
import { categorizeFiles } from './utils/git-schemas';
import { hasContent, isDefined, isString } from './utils/guards';

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
  /** AI agent to use ('claude' | 'codex' | 'gemini', default: 'claude') */
  agent?: AgentName;
  /** Enable/disable AI generation (default: true) */
  enableAI?: boolean;
  /** Custom git provider (default: RealGitProvider) */
  gitProvider?: GitProvider;
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
  private readonly config: Required<Omit<CommitMessageGeneratorConfig, 'agent' | 'gitProvider'>>;
  private readonly agent: Agent;
  private readonly gitProvider: GitProvider;

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

    // Instantiate agent using factory (defaults to Claude)
    const agentName = validatedConfig.agent ?? 'claude';
    this.agent = createAgent(agentName);

    // Generate default signature based on the agent being used
    const defaultSignature = match<AgentName, string>(agentName)
      .with('claude', () => '🤖 Generated with Claude via commitment')
      .with('codex', () => '🤖 Generated with Codex via commitment')
      .with('gemini', () => '🤖 Generated with Gemini via commitment')
      .exhaustive();

    this.config = {
      enableAI: validatedConfig.enableAI ?? true,
      logger: isDefined(validatedConfig.logger)
        ? { warn: validatedConfig.logger.warn as (message: string) => void }
        : { warn: () => {} },
      signature: validatedConfig.signature ?? defaultSignature,
    };

    // Use provided git provider or default to real git
    this.gitProvider = validatedConfig.gitProvider ?? new RealGitProvider();
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
      const aiMessage = await this._generateAICommitMessage(validatedTask, validatedOptions);
      if (this._isValidMessage(aiMessage)) {
        return this._addSignature(aiMessage);
      }
      // If AI message is invalid, throw error instead of falling back
      throw new GeneratorError('AI generation produced invalid commit message', {
        context: { message: aiMessage },
        suggestedAction: 'Check AI agent output format and conventional commit compliance',
      });
    }

    // Fallback to intelligent rule-based generation (only when AI is disabled)
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

    // Build prompt using extracted prompt builder
    const enhancedPrompt = buildCommitMessagePrompt({
      files: options.files,
      gitDiffContent,
      gitDiffNameStatus,
      gitDiffStat,
      output: options.output,
      task,
    });

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
      const result = await this.gitProvider.exec(args, cwd);

      // Validate output is a string
      if (!isString(result)) {
        throw new Error('Git command returned non-string output');
      }

      return result;
    } catch (error) {
      throw new Error(
        `Git command failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
