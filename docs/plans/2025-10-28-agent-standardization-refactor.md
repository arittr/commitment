# Agent Standardization & Prompt Extraction Refactor

**Date:** 2025-10-28
**Status:** Design Approved
**Goal:** Standardize agent implementations, extract prompts for testability, improve git hook UX

## Overview

This refactor addresses three core issues:

1. **Agent Inconsistency:** Codex agent has special file I/O logic that other agents don't need
2. **Prompt Coupling:** 52-line prompt hardcoded in generator, impossible to test independently
3. **Hook UX Noise:** Git hooks show status messages during every commit with no way to suppress

## Design Principles

- **Agent Standardization:** All agents should look identical except for `executeCommand()`
- **Modularity:** Prompts should be separate, testable, versionable modules
- **User Control:** Users should control verbosity with explicit flags
- **Backward Compatibility:** Existing hooks and scripts continue working unchanged

## Architecture Changes

### 1. Agent Standardization

**Problem:**
- Codex uses temp files with `_readOutput()` and `_cleanupTempFile()` methods (60+ LOC extra)
- Claude and Gemini override `cleanResponse()` unnecessarily (just call super + trim)
- Violates "all agents should look the same" principle

**Solution:**

#### Update Codex Agent
**File:** `src/agents/codex.ts`

**Changes:**
- Remove temp file logic (`_readOutput`, `_cleanupTempFile`)
- Change `executeCommand()` to use: `codex exec <prompt>` with prompt as CLI argument
- Override `cleanResponse()` to extract final message from verbose Codex output
- Use regex/parsing to isolate actual commit message

**Rationale:** Per OpenAI Codex CLI reference, `codex exec` accepts prompts as arguments and outputs to stdout. No temp files needed.

**Implementation:**
```typescript
protected async executeCommand(prompt: string, workdir: string): Promise<string> {
  const result = await exec('codex', ['exec', prompt], {
    cwd: workdir,
    timeout: 120_000,
  });
  return result.stdout;
}

protected override cleanResponse(output: string): string {
  // First apply base cleaning
  let cleaned = super.cleanResponse(output);

  // Extract actual commit message from Codex verbose output
  // (Implementation will parse Codex-specific format)

  return cleaned;
}
```

#### Enhance BaseAgent
**File:** `src/agents/base-agent.ts`

**Changes:**
- Add automatic `.trim()` to default `cleanResponse()` implementation
- Improve JSDoc about when to override `cleanResponse()`

**Before:**
```typescript
protected cleanResponse(output: string): string {
  return cleanAIResponse(output);
}
```

**After:**
```typescript
protected cleanResponse(output: string): string {
  return cleanAIResponse(output).trim();
}
```

#### Simplify Claude & Gemini
**Files:** `src/agents/claude.ts`, `src/agents/gemini.ts`

**Changes:**
- Remove `cleanResponse()` overrides entirely
- Agents become ~40-45 LOC (just `name` and `executeCommand()`)

**Result:**
- All agents follow identical structure
- Only `executeCommand()` differs per agent
- Override `cleanResponse()` only when agent produces unique artifacts (like Codex)
- Reduces duplication by ~30 LOC per agent

### 2. Prompt Extraction

**Problem:**
- 52-line prompt hardcoded in `src/generator.ts:216-267`
- Impossible to test prompt generation without running AI
- No versioning or tracking of prompt changes
- Cannot customize prompts per agent

**Solution:**

#### Create Prompts Module
**New Directory:** `src/prompts/`

**Structure:**
```
src/prompts/
├── index.ts                    # Public exports
├── commit-prompt.ts            # buildCommitPrompt() function
└── __tests__/
    └── commit-prompt.test.ts   # Isolated prompt tests
```

#### Prompt Builder Function
**File:** `src/prompts/commit-prompt.ts`

```typescript
export type CommitPromptParams = {
  task: CommitTask;
  gitDiffStat: string;
  gitDiffNameStatus: string;
  gitDiffContent: string;
  filesList: string;
  output?: string;
  changeAnalysis: string;
};

export function buildCommitPrompt(params: CommitPromptParams): string {
  const {
    task,
    gitDiffStat,
    gitDiffNameStatus,
    gitDiffContent,
    filesList,
    output,
    changeAnalysis,
  } = params;

  return `Generate a professional commit message based on the actual code changes:

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
${gitDiffContent}
\`\`\`

Task Execution Output:
${output ?? 'No execution output provided'}

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
<<<COMMIT_MESSAGE_END>>>

Change Analysis:
${changeAnalysis}`;
}
```

#### Generator Integration
**File:** `src/generator.ts`

**Changes:**
```typescript
import { buildCommitPrompt } from './prompts/commit-prompt';

private async _generateAICommitMessage(
  task: CommitTask,
  options: CommitMessageOptions
): Promise<string> {
  // ... existing git diff gathering ...

  const changeAnalysis = this._analyzeCodeChanges(truncatedDiff, filesToAnalyze);

  // Use prompt builder instead of inline string
  const prompt = buildCommitPrompt({
    task,
    gitDiffStat,
    gitDiffNameStatus,
    gitDiffContent: truncatedDiff,
    filesList,
    output: options.output,
    changeAnalysis,
  });

  // ... rest of method ...
}
```

#### Testing Benefits
**File:** `src/prompts/__tests__/commit-prompt.test.ts`

```typescript
import { describe, expect, it } from 'bun:test';
import { buildCommitPrompt } from '../commit-prompt';

describe('buildCommitPrompt', () => {
  it('should include all task context', () => {
    const prompt = buildCommitPrompt({
      task: { title: 'Add auth', description: 'JWT auth', produces: [] },
      gitDiffStat: 'stats...',
      gitDiffNameStatus: 'A  src/auth.ts',
      gitDiffContent: '+function login() {}',
      filesList: 'src/auth.ts',
      changeAnalysis: 'Added 1 new function',
    });

    expect(prompt).toContain('Title: Add auth');
    expect(prompt).toContain('Description: JWT auth');
    expect(prompt).toContain('Files: src/auth.ts');
  });

  it('should handle missing output gracefully', () => {
    const prompt = buildCommitPrompt({
      task: { title: 'Test', description: 'Desc', produces: [] },
      gitDiffStat: '',
      gitDiffNameStatus: '',
      gitDiffContent: '',
      filesList: '',
      changeAnalysis: '',
    });

    expect(prompt).toContain('No execution output provided');
  });
});
```

**Benefits:**
- Test prompt generation without AI calls
- Verify all placeholders filled correctly
- Easy to add prompt variants (v2, v3) later
- Clear separation of concerns

### 3. Hook UX Improvements

**Problem:**
- Git hooks show `🤖 Generating commit message with claude...` during every commit
- Users see stderr noise even when hooks work perfectly
- No way to suppress status messages

**Solution:**

#### Add --quiet Flag
**File:** `src/cli/schemas.ts`

```typescript
export const cliOptionsSchema = z.object({
  agent: z.enum(['claude', 'codex', 'gemini']).optional(),
  ai: z.boolean().default(true),
  cwd: z.string().default(process.cwd()),
  dryRun: z.boolean().optional(),
  messageOnly: z.boolean().optional(),
  quiet: z.boolean().default(false), // NEW
});
```

#### Update Display Helpers
**File:** `src/cli/helpers.ts`

```typescript
export function displayStagedChanges(
  gitStatus: GitStatus,
  messageOnly: boolean,
  quiet: boolean  // NEW parameter
): void {
  if (quiet) return;  // Skip all output in quiet mode

  // ... existing display logic unchanged ...
}

export function displayGenerationStatus(
  agentName: string,
  useAI: boolean,
  messageOnly: boolean,
  quiet: boolean  // NEW parameter
): void {
  if (quiet) return;  // Skip all output in quiet mode

  // ... existing display logic unchanged ...
}
```

#### Update CLI Command
**File:** `src/cli.ts`

```typescript
async function generateCommitCommand(rawOptions: {
  agent?: string;
  ai: boolean;
  cwd: string;
  dryRun?: boolean;
  messageOnly?: boolean;
  quiet?: boolean;  // NEW
}): Promise<void> {
  const options = validateOptionsOrExit(rawOptions);
  const gitStatus = await checkGitStatusOrExit(options.cwd);

  displayStagedChanges(gitStatus, options.messageOnly === true, options.quiet === true);
  displayGenerationStatus(agentName, options.ai, options.messageOnly === true, options.quiet === true);

  // ... rest unchanged ...
}
```

#### Update Hook Examples
**Files:** `examples/git-hooks/prepare-commit-msg`, `examples/husky/prepare-commit-msg`

**Before:**
```bash
#!/bin/sh
if [ -z "$2" ]; then
  npx commitment --message-only > "$1" || exit 1
fi
```

**After:**
```bash
#!/bin/sh
if [ -z "$2" ]; then
  npx commitment --message-only --quiet > "$1" || exit 1
fi
```

#### Backward Compatibility
- Default is `quiet: false` (current behavior preserved)
- Existing hooks work unchanged (show status messages)
- Users opt-in to quiet mode by adding `--quiet`
- No breaking changes

**Benefits:**
- Clean, silent git hook experience when desired
- Users control verbosity explicitly
- Debugging still possible (omit --quiet flag)

## Implementation Order

1. **Extract Prompts** (lowest risk)
   - Create `src/prompts/commit-prompt.ts`
   - Add tests
   - Update generator to use `buildCommitPrompt()`

2. **Add --quiet Flag** (low risk, high value)
   - Update schemas
   - Update helpers
   - Update CLI command
   - Update hook examples

3. **Standardize Agents** (medium risk)
   - Enhance BaseAgent `cleanResponse()`
   - Simplify Claude & Gemini (remove overrides)
   - Refactor Codex (remove temp files, update executeCommand)
   - Update all agent tests

## Testing Strategy

### Unit Tests
- `src/prompts/__tests__/commit-prompt.test.ts` - Test prompt generation
- `src/agents/__tests__/codex.test.ts` - Test new Codex implementation
- `src/cli/__tests__/schemas.test.ts` - Test --quiet flag validation

### Integration Tests
- `src/__tests__/integration/` - Test full flow with --quiet flag
- Verify all agents produce identical structure

### Manual Testing
- Test each agent generates valid commit messages
- Test git hooks with and without --quiet
- Verify backward compatibility (existing hooks work)

## Success Criteria

- [ ] All agents have identical structure (only `executeCommand()` differs)
- [ ] Codex agent uses `codex exec <prompt>` (no temp files)
- [ ] Prompts extracted to `src/prompts/` with tests
- [ ] `--quiet` flag suppresses all status messages
- [ ] All existing tests pass
- [ ] Hook examples updated with --quiet
- [ ] CLAUDE.md updated with new architecture

## Migration Notes

### For Users
- Add `--quiet` to git hooks for silent operation
- No breaking changes - existing setups work unchanged

### For Contributors
- Prompts now in `src/prompts/` (test separately)
- Agent overrides should be minimal (only when needed)
- Use `--quiet` flag for hook testing

## Future Enhancements

- Agent-specific prompt customization (override `getPrompt()`)
- Prompt versioning (v1, v2, v3)
- Prompt templates for different commit types
- Structured prompt builder pattern (fluent API)
