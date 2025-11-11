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
import { hasContent, isString } from './utils/guards';
import type { Logger } from './utils/logger';

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
  /** AI agent to use - either a string name or Agent instance for testing */
  agent?: Agent | AgentName;
  /** Custom git provider (default: RealGitProvider) */
  gitProvider?: GitProvider;
  /** Custom logger for debugging and diagnostics */
  logger?: Logger;
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
  private readonly config: Required<
    Omit<CommitMessageGeneratorConfig, 'agent' | 'gitProvider' | 'logger'>
  >;
  private readonly agent: Agent;
  private readonly gitProvider: GitProvider;
  private readonly logger?: Logger;

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
  - agent: 'claude' | 'codex' | 'gemini' (optional, default: 'claude')
  - signature: string (optional)
  - logger: Logger (optional)`,
      });
    }

    // Use validated config (now fully type-safe)
    const validatedConfig = validationResult.data;

    // Store logger for internal use
    this.logger = validatedConfig.logger;

    // Determine if agent is a string (use factory) or object (inject directly)
    const agentConfig = validatedConfig.agent ?? 'claude';
    let agentName: AgentName;

    if (typeof agentConfig === 'string') {
      // String: use factory to create agent
      agentName = agentConfig;
      this.agent = createAgent(agentName, this.logger);
    } else {
      // Object: use injected agent directly (for testing)
      // Type assertion is safe because Zod schema validates the Agent interface
      this.agent = agentConfig as Agent;
      // Try to infer agent name from the agent's name property
      // Default to 'claude' if name doesn't match known agents
      agentName = match(agentConfig.name.toLowerCase())
        .when(
          (name) => name.includes('claude'),
          () => 'claude' as const
        )
        .when(
          (name) => name.includes('codex'),
          () => 'codex' as const
        )
        .when(
          (name) => name.includes('gemini'),
          () => 'gemini' as const
        )
        .otherwise(() => 'claude' as const);
    }

    // Generate default signature based on the agent being used
    const defaultSignature = match<AgentName, string>(agentName)
      .with('claude', () => '🤖 Generated with Claude via commitment')
      .with('codex', () => '🤖 Generated with Codex via commitment')
      .with('gemini', () => '🤖 Generated with Gemini via commitment')
      .exhaustive();

    this.config = {
      signature: validatedConfig.signature ?? defaultSignature,
    };

    // Use provided git provider or default to real git
    this.gitProvider = validatedConfig.gitProvider ?? new RealGitProvider();
  }

  /**
   * Generate intelligent commit message based on task and changes
   *
   * Always uses AI generation. Manual fallback mode has been removed.
   * If AI generation fails, throws an error with installation instructions.
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

    // Always use AI generation (manual mode removed)
    const aiMessage = await this._generateAICommitMessage(validatedTask, validatedOptions);
    if (this._isValidMessage(aiMessage)) {
      return this._addSignature(aiMessage);
    }

    // If AI message is invalid, throw error with helpful instructions
    throw new GeneratorError('AI generation produced invalid commit message', {
      context: { message: aiMessage },
      suggestedAction: `Check AI agent output format and conventional commit compliance.

To install the ${this.agent.name} CLI:
  - Claude: Visit https://claude.ai/download
  - Codex: Visit https://github.com/openai/codex-cli
  - Gemini: Visit https://ai.google.dev/gemini-api/docs/get-started/tutorial`,
    });
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
