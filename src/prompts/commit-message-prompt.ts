import { hasContent, isDefined, isString } from '../utils/guards';

/**
 * Minimal task interface for commit message generation
 */
export type CommitTask = {
  description: string;
  produces: string[];
  title: string;
};

/**
 * Context for building commit message prompts
 */
export type PromptContext = {
  /** Files involved in the change */
  files?: string[];
  /** Git diff content */
  gitDiffContent: string;
  /** Git diff name-status output */
  gitDiffNameStatus: string;
  /** Git diff stat output */
  gitDiffStat: string;
  /** Task execution output or additional context */
  output?: string;
  /** Task information */
  task: CommitTask;
};

/**
 * Build a structured prompt for AI commit message generation
 *
 * @param context - Context containing task, git diffs, files, and output
 * @returns Formatted prompt string ready for AI agent
 *
 * @example
 * ```typescript
 * const prompt = buildCommitMessagePrompt({
 *   task: { title: 'Add feature', description: 'Implement new feature', produces: [] },
 *   gitDiffStat: '1 file changed, 10 insertions(+)',
 *   gitDiffNameStatus: 'M\tsrc/feature.ts',
 *   gitDiffContent: '+function newFeature() {...}',
 *   files: ['src/feature.ts'],
 *   output: 'Tests passed'
 * });
 * ```
 */
export function buildCommitMessagePrompt(context: PromptContext): string {
  const { task, gitDiffStat, gitDiffNameStatus, gitDiffContent, files, output } = context;

  // Validate git diff content
  if (!isString(gitDiffContent)) {
    throw new Error('Git diff output validation failed: expected string output');
  }

  // Truncate diff if too long to avoid token limits
  const maxDiffLength = 8000; // Reserve tokens for prompt and response
  const truncatedDiff =
    gitDiffContent.length > maxDiffLength
      ? `${gitDiffContent.slice(0, maxDiffLength)}\n... (diff truncated)`
      : gitDiffContent;

  // Build file list with validation
  const filesList = isDefined(files) && files.length > 0 ? files.join(', ') : 'No files specified';

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
${hasContent(output) ? output : 'No execution output provided'}

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
  const filesToAnalyze = isDefined(files) ? files : [];
  const changeAnalysis = analyzeCodeChanges(truncatedDiff, filesToAnalyze);
  const enhancedPrompt = `${prompt}

Change Analysis:
${changeAnalysis}`;

  return enhancedPrompt;
}

/**
 * Analyze code changes from git diff to extract patterns and insights
 *
 * @param diffContent - Raw git diff output
 * @param files - List of files being analyzed
 * @returns Human-readable analysis string describing the changes
 *
 * @example
 * ```typescript
 * const analysis = analyzeCodeChanges(
 *   '+function newFeature() {...}',
 *   ['src/feature.ts']
 * );
 * // Returns: "Single file modification\n- Added 1 new functions/methods"
 * ```
 */
export function analyzeCodeChanges(diffContent: string, files: string[]): string {
  if (!isString(diffContent)) {
    throw new Error('Diff content must be a string');
  }

  const { addedLines, removedLines } = parseDiffLines(diffContent);
  const patterns = detectPatterns(diffContent, addedLines, removedLines);

  const analysis = [
    ...analyzePatterns(patterns),
    ...analyzeFileScope(files.length),
    ...analyzeChangeMagnitude(addedLines.length, removedLines.length),
  ];

  return analysis.length > 0 ? analysis.join('\n- ') : 'Minor code modifications';
}

/**
 * Parse diff content into added and removed lines
 *
 * @internal
 */
function parseDiffLines(diffContent: string): { addedLines: string[]; removedLines: string[] } {
  const lines = diffContent.split('\n');
  return {
    addedLines: lines.filter((line) => line.startsWith('+') && !line.startsWith('++')),
    removedLines: lines.filter((line) => line.startsWith('-') && !line.startsWith('---')),
  };
}

/**
 * Detect code patterns in diff
 *
 * @internal
 */
function detectPatterns(diffContent: string, addedLines: string[], removedLines: string[]) {
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
 *
 * @internal
 */
function analyzePatterns(patterns: ReturnType<typeof detectPatterns>): string[] {
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
 *
 * @internal
 */
function analyzeFileScope(fileCount: number): string[] {
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
 *
 * @internal
 */
function analyzeChangeMagnitude(addedCount: number, removedCount: number): string[] {
  const totalChanges = addedCount + removedCount;

  if (totalChanges > 100) {
    return [`Substantial changes: ${addedCount}+ ${removedCount}- lines`];
  }
  if (totalChanges > 20) {
    return ['Moderate code changes'];
  }
  return [];
}
