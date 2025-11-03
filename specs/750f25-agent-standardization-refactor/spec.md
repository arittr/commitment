---
runId: 750f25
feature: agent-standardization-refactor
created: 2025-11-03
status: draft
---

# Feature: Agent Standardization and Architecture Refactoring

**Status**: Draft
**Created**: 2025-11-03

## Problem Statement

**Current State:**
- Codex agent uses inconsistent temp file I/O pattern while Claude/Gemini use direct CLI execution
- Prompt generation logic embedded in `generator.ts` (~60 LOC) is not modular or testable
- Manual fallback mode (`--no-ai` flag + rule-based generation) adds ~200 LOC of complexity
- "Generating message with..." progress indicator only shows in interactive mode, not git hooks
- Manual file categorization duplicates what LLMs can do better

**Desired State:**
- All agents use identical execution patterns (standardized on direct CLI with stdin/args)
- Prompt logic extracted to dedicated, testable module (`src/prompts/`)
- Single AI-only code path (no manual fallback)
- Progress messages visible in git hooks by default, suppressible with `--quiet` flag
- Simpler, more maintainable codebase (~200 LOC reduction)

**Gap:**
Architectural inconsistencies and unnecessary complexity reduce code quality, testability, and maintainability. The dual-mode (AI + manual) approach violates the "AI-first" philosophy and creates maintenance burden.

## Requirements

> **Note**: All changes must follow @docs/constitutions/current/

### Functional Requirements

**FR1: Agent Execution Standardization**
- All agents (Claude, Codex, Gemini) must use consistent CLI execution patterns
- Codex agent must use direct `exec()` with stdin/args (no temp files)
- Each agent remains ~40-70 LOC (matching BaseAgent template pattern)
- See: [Codex CLI Reference](https://developers.openai.com/codex/cli/reference)

**FR2: Prompt Extraction**
- Prompt generation logic extracted to `src/prompts/commit-message-prompt.ts`
- Prompt builder must be pure function (input → output, testable)
- Generator calls prompt builder, does not construct prompts inline
- Code analysis logic (`_analyzeCodeChanges`) moved to prompts module

**FR3: Remove Manual Mode**
- Remove `--no-ai` CLI flag and `enableAI` config option
- Remove all rule-based fallback methods from generator:
  - `_generateRuleBasedCommitMessage()`
  - `_categorizeFiles()`
  - `_createBulletPoints()`
  - `_determineCommitType()`
  - `_formatCommitMessage()`
- Generator always uses AI; agent failures throw errors to user

**FR4: Add Quiet Flag**
- Add `--quiet` CLI flag to suppress progress messages
- Default behavior: show "🤖 Generating commit message with [agent]..." in all modes
- Git hooks show progress by default (visible to user during commit)
- `--quiet` suppresses stderr output (useful for scripting)

### Non-Functional Requirements

**NFR1: Backward Compatibility**
- Breaking change: `--no-ai` flag removed (requires migration guide)
- All other CLI flags remain unchanged
- Generator public API unchanged (only internal refactoring)

**NFR2: Code Quality**
- Net reduction of ~200 LOC from codebase
- All agents maintain ≤3 extension points (BaseAgent pattern)
- Prompt module follows pure function pattern
- Test coverage maintained at 80%+ after changes

**NFR3: Documentation**
- CHANGELOG documents breaking change with migration instructions
- README updated to remove `--no-ai` references
- Error messages provide clear installation instructions when agent fails

## Architecture

> **Layer boundaries**: @docs/constitutions/current/architecture.md
> **Required patterns**: @docs/constitutions/current/patterns.md

### Components

**Modified Files:**

**Agents:**
- `src/agents/codex.ts` - Standardize to use `exec('codex', ['exec'], { input: prompt })` pattern; remove temp file methods `_readOutput()` and `_cleanupTempFile()`; reduce from ~160 LOC to ~70 LOC matching claude/gemini
- `src/agents/claude.ts` - No changes (already standardized)
- `src/agents/gemini.ts` - No changes (already standardized)
- `src/agents/__tests__/codex.test.ts` - Update to reflect new execution pattern, remove temp file mocking

**Prompts (New Module):**
- `src/prompts/commit-message-prompt.ts` - Extract prompt building logic from generator; export `buildCommitMessagePrompt(context)` and `analyzeCodeChanges(diff, files)` as pure functions
- `src/prompts/__tests__/commit-message-prompt.test.ts` - Test prompt structure, diff truncation, context inclusion
- `src/prompts/index.ts` - Barrel exports

**Generator:**
- `src/generator.ts` - Import and use `buildCommitMessagePrompt()`; remove `enableAI` config field; remove all manual generation methods (~150 LOC deletion); simplify to single AI-only code path; remove `_analyzeCodeChanges()` (moved to prompts)

**CLI:**
- `src/cli/schemas.ts` - Remove `ai: z.boolean().default(true)` field; add `quiet: z.boolean().default(false)` field
- `src/cli/helpers.ts` - Update `displayGeneratingMessage()` to accept `quiet` parameter; show messages unless `--quiet` passed
- `src/cli.ts` - Remove `--no-ai` flag; add `--quiet` flag; pass `quiet` to display helper

**Tests:**
- `src/generator.test.ts` - Remove manual mode tests; remove tests for deleted methods
- `src/cli/__tests__/schemas.test.ts` - Remove `--no-ai` tests; add `--quiet` tests
- `src/cli/__tests__/helpers.test.ts` - Update `displayGeneratingMessage()` tests with quiet parameter

### Dependencies

**No new packages required.**

All changes use existing dependencies:
- `execa` - For CLI execution (already in use)
- `zod` - For schema validation (already in use)
- `chalk` - For terminal colors (already in use)

### Integration Points

**Agent Layer:**
- Codex agent integrates with Codex CLI per [official docs](https://developers.openai.com/codex/cli/reference)
- All agents continue to extend `BaseAgent` abstract class
- Agent factory unchanged (already uses ts-pattern for exhaustiveness)

**Generator Layer:**
- Generator imports prompt builder from new `src/prompts/` module
- Error handling: Agent failures propagate directly to CLI (no fallback)
- Git provider integration unchanged

**CLI Layer:**
- New `--quiet` flag passed to display helpers
- Removed `--no-ai` flag (breaking change)
- Error messages updated to guide users to install agent CLIs

## Acceptance Criteria

**Constitution compliance:**
- [ ] All patterns followed (@docs/constitutions/current/patterns.md)
  - BaseAgent template pattern maintained (≤3 extension points)
  - Pure functions for prompts (stateless, testable)
  - Exhaustiveness checking in factory unchanged
- [ ] Architecture boundaries respected (@docs/constitutions/current/architecture.md)
  - Prompts module in Utils layer
  - No upward dependencies
  - Clean module separation
- [ ] Testing requirements met (@docs/constitutions/current/testing.md)
  - All new code has tests
  - Coverage maintained at 80%+
  - Co-located tests in `__tests__/` directories

**Feature-specific:**
- [ ] All three agents use identical test structure
- [ ] Codex agent no longer uses temp files
- [ ] Prompts testable in isolation (can mock git output)
- [ ] `--quiet` flag suppresses progress messages
- [ ] Default behavior shows progress in git hooks
- [ ] `--no-ai` flag removed from CLI and schemas
- [ ] Manual fallback methods removed from generator
- [ ] Generator ~200 LOC smaller
- [ ] Error messages guide users to install agent CLIs

**Verification:**
- [ ] All tests pass (`bun test`)
- [ ] Linting passes (`bun run lint`)
- [ ] Type checking passes (`bun run check-types`)
- [ ] Manual test: `git commit` shows "🤖 Generating..." message
- [ ] Manual test: `commitment --quiet` suppresses progress
- [ ] Manual test: `commitment` without agent installed shows clear error

## Migration Guide

### For Users

**Breaking Change: `--no-ai` flag removed**

If you currently use `--no-ai`:
1. Install one of the supported AI CLIs:
   - [Claude CLI](https://claude.ai/download)
   - [Codex CLI](https://developers.openai.com/codex/cli)
   - [Gemini CLI](https://ai.google.dev/gemini-api/docs/cli)
2. Remove `--no-ai` from scripts and configurations
3. If AI generation fails, error message will provide installation instructions

**New Feature: `--quiet` flag**

Suppress progress messages (useful for scripting):
```bash
commitment --quiet --message-only > commit-msg.txt
```

### For Git Hooks

No changes required. Git hooks will now show progress by default:
```bash
$ git commit
🤖 Generating commit message with claude...
# Opens editor with generated message
```

To suppress (if desired):
```bash
npx commitment --quiet --message-only > "$1"
```

## Open Questions

None. Design validated in Phase 3 of brainstorming.

## References

- Architecture: @docs/constitutions/current/architecture.md
- Patterns: @docs/constitutions/current/patterns.md
- Tech Stack: @docs/constitutions/current/tech-stack.md
- Testing: @docs/constitutions/current/testing.md
- Codex CLI: https://developers.openai.com/codex/cli/reference
