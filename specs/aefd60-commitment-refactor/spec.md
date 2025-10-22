---
runId: aefd60
feature: commitment-refactor
created: 2025-10-21
status: draft
---

# Feature: Commitment Simplification & Quality Refactor

**Status**: Draft
**Created**: 2025-10-21

## Problem Statement

**Current State:**
- commitment is a working CLI tool for AI-powered commit message generation
- ~12,400 LOC with extensive abstractions (provider chains, auto-detection, base classes, factory patterns)
- References to chopstack (original parent project) in documentation
- Multiple configuration paths create confusion
- Heavy dependency on ora spinner library
- Complex error hierarchy with many custom error types

**Desired State:**
- Lean, focused tool (~2,000 LOC) that does one thing excellently
- Zero-config except `--agent <name>` flag
- No chopstack coupling or references
- Simple, actionable error messages
- Minimal dependencies and API surface

**Gap:**
Over-engineering from monorepo extraction. The tool works but carries complexity debt from being part of a larger system. Users want: "run commitment, get good commit message" not "configure provider chains with JSON".

## Requirements

> **Note**: All features must follow @docs/constitutions/current/

### Functional Requirements

**Core Functionality:**
- FR1: Generate conventional commit messages from git diff using AI agent
- FR2: Support `--agent claude` and `--agent codex` flags
- FR3: Fall back to rule-based generation when `--no-ai` specified
- FR4: Support `--dry-run` (show message without committing)
- FR5: Support `--message-only` (output message without git interaction)

**Removed Functionality:**
- FR6: Remove auto-detection system (defer to future spec)
- FR7: Remove provider chain/fallback system (defer to future spec)
- FR8: Remove `--provider-config` JSON configuration
- FR9: Remove `--check-provider` and `--list-providers` commands (merge into main CLI help)

**Error Handling:**
- FR10: All errors must be actionable (what failed, why, how to fix)
- FR11: CLI not found errors show installation instructions
- FR12: No staged changes error shows `git add` example
- FR13: Malformed git output includes diagnostic context

### Non-Functional Requirements

**Code Quality:**
- NFR1: Reduce total LOC by 80%+ (from ~12,400 to ~2,000)
- NFR2: Maintain 80%+ test coverage per @docs/constitutions/current/testing.md
- NFR3: All public APIs have TSDoc with examples per @docs/constitutions/current/patterns.md
- NFR4: Zero `any` types in production code per @docs/constitutions/current/patterns.md

**Simplicity:**
- NFR5: Public API exports ≤10 items (currently ~30)
- NFR6: Configuration options ≤5 (currently ~15)
- NFR7: No base classes or factory patterns
- NFR8: Each agent implementation <100 LOC

**Documentation:**
- NFR9: Remove all chopstack references from README, docs, comments
- NFR10: README includes quick start (3 commands or less)
- NFR11: Contributing guide explains how to add new agents

**Dependencies:**
- NFR12: Remove ora dependency (use chalk for status)
- NFR13: All dependencies approved per @docs/constitutions/current/tech-stack.md

## Architecture

> **Layer boundaries**: @docs/constitutions/current/architecture.md
> **Required patterns**: @docs/constitutions/current/patterns.md
> **Validation rules**: @docs/constitutions/current/schema-rules.md

### Architectural Changes

**Keep 3-layer architecture:**
- CLI Layer → Generator Layer → Agent Layer (renamed from "Provider")
- Dependency flow remains downward only
- Validation at boundaries using Zod schemas

**Terminology change:**
- "Provider" → "Agent" (simpler, clearer term for CLI tools like claude/codex)
- Files: `src/providers/` → `src/agents/`

### Components

**Files to Delete (9 files + tests):**
- `src/providers/auto-detect.ts` - Auto-detection system (deferred)
- `src/providers/provider-chain.ts` - Fallback chain system (deferred)
- `src/providers/provider-factory.ts` - Factory pattern (unnecessary)
- `src/providers/base/base-cli-provider.ts` - Base class abstraction
- `src/providers/base/base-api-provider.ts` - Base class abstraction
- `src/providers/utils/cli-executor.ts` - Inline into agents
- `src/providers/utils/cli-response-parser.ts` - Inline into agents
- `src/cli/commands/list-providers.ts` - Merge into main CLI
- `src/cli/commands/check-provider.ts` - Merge into main CLI

**Files to Rename/Restructure:**
- `src/providers/` → `src/agents/`
- `src/providers/implementations/claude-provider.ts` → `src/agents/claude.ts`
- `src/providers/implementations/codex-provider.ts` → `src/agents/codex.ts`
- `src/providers/types.ts` → `src/agents/types.ts` (simplified to just Agent interface)
- `src/providers/errors.ts` → `src/errors.ts` (consolidate error types)

**Files to Simplify:**
- `src/generator.ts` - Remove chain/auto-detect logic, simplify config validation
- `src/cli.ts` - Remove auto-detect/fallback flags, merge command modules
- `src/types/schemas.ts` - Simplify GeneratorConfig schema
- `src/index.ts` - Reduce exports from ~30 to ~10

**New Agent Interface:**
```typescript
// src/agents/types.ts (simplified)
interface Agent {
  name: string;
  generate(prompt: string, workdir: string): Promise<string>;
}
```

### Dependencies

**Remove:**
- `ora` - Spinner library (use chalk for simple status messages)

**Keep (all approved per tech-stack.md):**
- `chalk` - Terminal formatting
- `commander` - CLI parsing
- `execa` - Command execution
- `ts-pattern` - Pattern matching
- `zod` - Runtime validation

**External tools:**
- Claude CLI (`claude`) - Primary agent
- Codex CLI (`codex`) - Secondary agent

See: https://github.com/anthropics/anthropic-sdk-typescript (Claude)
See: https://cursor.sh (Codex via Cursor)

### Integration Points

**Git operations:**
- Uses `execa` to call `git status`, `git diff`, `git commit`
- Validates git output with Zod schemas per @docs/constitutions/current/schema-rules.md

**Agent execution:**
- Each agent checks CLI availability using `which <command>`
- Executes CLI with prompt, parses conventional commit format
- No shared base classes (each agent ~50-100 LOC)

**Configuration:**
- Single path: `--agent <name>` flag or programmatic `{ agent: 'name' }`
- No JSON config, no auto-detect, no fallback chains

### Error Consolidation

**Before (5+ error types):**
- ProviderError, ProviderNotAvailableError, ProviderTimeoutError, etc.

**After (2 error types):**
- `AgentError` - Agent execution failed (CLI not found, bad response, timeout)
- `GeneratorError` - Generation failed (no git changes, validation failed)

## Acceptance Criteria

**Constitution compliance:**
- [ ] All patterns followed (@docs/constitutions/current/patterns.md)
  - kebab-case files, camelCase functions, PascalCase types
  - Zod schema-first validation at boundaries
  - Explicit return types, no `any` types
  - TSDoc on all exports
- [ ] Architecture boundaries respected (@docs/constitutions/current/architecture.md)
  - CLI → Generator → Agent (downward dependencies only)
  - No circular dependencies
- [ ] Testing requirements met (@docs/constitutions/current/testing.md)
  - 80%+ coverage maintained
  - Co-located tests in `__tests__/` directories
  - Don't test library code (Zod, execa, commander)
  - Test business logic and integration

**Simplification metrics:**
- [ ] Total LOC reduced by 80%+ (target: ~2,000 from ~12,400)
- [ ] Public API exports ≤10 (from ~30)
- [ ] CLI flags ≤5 (from ~15)
- [ ] Dependencies reduced (ora removed)
- [ ] Zero base classes or factories

**Quality improvements:**
- [ ] All chopstack references removed (README, docs, comments)
- [ ] All error messages are actionable (what, why, how-to-fix)
- [ ] README has quick start (install, run, done)
- [ ] Contributing guide explains adding agents
- [ ] All tests pass (no regressions)

**Feature verification:**
- [ ] `commitment --agent claude` generates and commits message
- [ ] `commitment --agent codex` generates and commits message
- [ ] `commitment --no-ai` falls back to rule-based generation
- [ ] `commitment --dry-run` shows message without committing
- [ ] `commitment --message-only` outputs message only
- [ ] Error when CLI not found shows installation instructions
- [ ] Error when no staged changes shows `git add` example

## Open Questions

None - design validated through brainstorming phases.

## References

- Architecture: @docs/constitutions/current/architecture.md
- Patterns: @docs/constitutions/current/patterns.md
- Schema Rules: @docs/constitutions/current/schema-rules.md
- Tech Stack: @docs/constitutions/current/tech-stack.md
- Testing: @docs/constitutions/current/testing.md
- Claude CLI: https://github.com/anthropics/anthropic-sdk-typescript
- Cursor/Codex: https://cursor.sh
- Conventional Commits: https://www.conventionalcommits.org/
