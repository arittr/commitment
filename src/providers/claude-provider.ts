import { execa } from 'execa';

import type { CLIProviderConfig, GenerateOptions } from './types';

import { BaseCLIProvider } from './base-cli-provider';

/**
 * Claude CLI provider implementation
 * Integrates with the Claude CLI tool for AI-powered commit message generation
 */
export class ClaudeProvider extends BaseCLIProvider {
  constructor(config: Omit<CLIProviderConfig, 'type' | 'provider'> = {}) {
    super({
      type: 'cli',
      provider: 'claude',
      ...config,
    });
  }

  /**
   * Get the CLI command name
   */
  protected getCommand(): string {
    return this.config.command ?? 'claude';
  }

  /**
   * Get CLI arguments for Claude
   */
  protected getArgs(): string[] {
    return this.config.args ?? ['--print'];
  }

  getName(): string {
    return 'Claude CLI';
  }

  /**
   * Check if Claude CLI is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const { exitCode } = await execa(this.getCommand(), ['--version'], {
        reject: false,
        timeout: 5000,
      });
      return exitCode === 0;
    } catch {
      return false;
    }
  }

  /**
   * Clean and parse Claude's response to extract commit message
   * Handles sentinel markers and removes common AI artifacts
   */
  protected override prepareInput(prompt: string): string {
    // Pass prompt as-is since Claude expects it via stdin
    return prompt;
  }

  /**
   * Override generateCommitMessage to add response cleaning
   */
  override async generateCommitMessage(prompt: string, options: GenerateOptions): Promise<string> {
    // Call parent implementation to get raw response
    const rawResponse = await super.generateCommitMessage(prompt, options);

    // Clean and parse the response
    return this._parseClaudeResponse(rawResponse);
  }

  /**
   * Parse Claude's response and extract clean commit message
   * Removes AI artifacts, preamble, and ensures conventional commit format
   */
  private _parseClaudeResponse(aiResponse: string): string {
    // Extract content between sentinel markers if present
    const startTag = '<<<COMMIT_MESSAGE_START>>>';
    const endTag = '<<<COMMIT_MESSAGE_END>>>';
    const startIndex = aiResponse.indexOf(startTag);
    const endIndex = aiResponse.indexOf(endTag);

    let message = '';
    message =
      startIndex !== -1 && endIndex !== -1 && endIndex > startIndex
        ? aiResponse.slice(startIndex + startTag.length, endIndex).trim()
        : aiResponse.trim();

    // Clean up common AI artifacts and preamble
    message = message
      .replaceAll('```', '')
      .replace(/^here's? (?:the |a )?commit message:?\s*/i, '')
      .replace(/^based on (?:the )?git diff.*$/im, '')
      .replace(/^looking at (?:the )?changes.*$/im, '')
      .replace(/^analyzing (?:the )?changes.*$/im, '')
      .replace(/^from (?:the )?changes.*$/im, '')
      .replace(/^i can see (?:that )?this.*$/im, '')
      .replace(/^this (?:change|commit|update).*$/im, '')
      .replace(/^the (?:changes|modifications).*$/im, '')
      .trim();

    // Clean up any remaining preamble patterns but preserve bullet points and blank lines
    const lines = message.split('\n');
    const cleanedLines: string[] = [];
    let foundCommitStart = false;

    for (const line of lines) {
      const cleanLine = line.trim();

      // Skip obvious preamble/analysis lines (but only if we haven't found the commit start)
      if (!foundCommitStart && cleanLine !== '') {
        if (
          /^(looking|analyzing|based|from|i can see|this commit|the changes|the modifications)/i.test(
            cleanLine,
          ) ||
          /^(here|now|let me|first|next|then)/i.test(cleanLine) ||
          cleanLine.length < 5
        ) {
          continue;
        }

        // Once we find what looks like a commit message start, keep everything from here
        if (
          /^(feat|fix|docs|style|refactor|perf|test|chore|build|ci):/i.test(cleanLine) ||
          /^(add|update|fix|remove|implement|enhance|improve|create)/i.test(cleanLine)
        ) {
          foundCommitStart = true;
        }
      }

      // Once we've found the commit start, keep all lines (including empty ones for formatting)
      if (foundCommitStart) {
        cleanedLines.push(line);
      }
    }

    // Reconstruct the message preserving structure
    message = cleanedLines.length > 0 ? cleanedLines.join('\n').trim() : message;

    // If we still have no good message, take the first non-empty line
    if (message === '' && lines.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      message = lines[0]!;
    }

    return message;
  }
}
