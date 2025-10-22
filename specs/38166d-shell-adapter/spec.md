---
runId: 38166d
feature: shell-adapter
created: 2025-10-22
status: draft
---

# Feature: Shell Execution Adapter

**Status**: Draft
**Created**: 2025-10-22

## Problem Statement

**Current State:**
- All tests mock `execa` using Bun's `mock.module()` API
- Test setup is verbose and brittle (see `src/agents/__tests__/claude.test.ts:7-35`)
- Tests require complex mock setup with globalThis reassignment
- Cannot easily test Bun-specific execution paths
- Mocking execa obscures actual test intent

**Desired State:**
- Tests can mock native Bun APIs directly (`Bun.spawn`)
- Simpler, more maintainable test setup
- Runtime-appropriate execution (Bun.spawn in Bun, execa in Node)
- Type-safe shell execution abstraction

**Gap:**
Direct coupling to execa throughout the codebase forces awkward test patterns. Need a thin adapter that uses Bun.spawn when available, eliminating execa mocking pain in Bun tests.

## Requirements

> **Note**: All features must follow @docs/constitutions/current/

### Functional Requirements

**FR1**: Provide `exec()` function that executes shell commands with consistent interface
- Accepts command, args array, and options (cwd, timeout, input)
- Returns Promise<{stdout, stderr, exitCode}>
- Works identically in Bun and Node runtimes

**FR2**: Runtime detection using `process.versions.bun`
- If Bun runtime detected → use Bun.spawn()
- If Node runtime detected → use execa
- Detection happens at runtime (no build-time branching)

**FR3**: Support required execution options
- `cwd`: Working directory (required)
- `timeout`: Command timeout in milliseconds (optional)
- `input`: Stdin data for command (optional)

**FR4**: Preserve existing error behavior
- Timeout errors throw with clear message
- Exit code != 0 throws with stderr content
- CLI not found (ENOENT) throws with helpful message
- All errors preserve original error as cause

**FR5**: Drop-in replacement for execa calls
- Replace `execa(cmd, args, opts)` with `exec(cmd, args, opts)`
- No changes to call sites beyond import path
- Same promise-based async API

### Non-Functional Requirements

**NFR1**: Zero performance overhead
- Runtime check happens once per call (negligible)
- Bun.spawn is faster than execa (performance improvement)
- No unnecessary abstraction layers

**NFR2**: Type safety
- Full TypeScript types for options and result
- Infer types from Zod schemas per @docs/constitutions/current/patterns.md
- No `any` types

**NFR3**: Testability
- Pure function (no side effects beyond process execution)
- Easy to mock in tests (just mock Bun.spawn or execa)
- Co-located tests per @docs/constitutions/current/testing.md

**NFR4**: Maintainability
- Single file implementation (~80-100 LOC)
- Clear separation of Bun vs Node paths
- Comprehensive test coverage (>90%)

## Architecture

> **Layer boundaries**: @docs/constitutions/current/architecture.md
> **Required patterns**: @docs/constitutions/current/patterns.md

### Components

**New Files:**
- `src/utils/shell.ts` - Shell execution adapter with runtime detection
- `src/utils/__tests__/shell.test.ts` - Comprehensive tests for both runtimes

**Modified Files:**
- `src/agents/base-agent.ts` - Replace `execa` imports with `exec` from utils/shell
- `src/cli/helpers.ts` - Replace `execa` imports with `exec` from utils/shell
- `src/agents/__tests__/base-agent.test.ts` - Simplify to mock Bun.spawn
- `src/agents/__tests__/claude.test.ts` - Simplify to mock Bun.spawn
- `src/agents/__tests__/codex.test.ts` - Simplify to mock Bun.spawn
- `src/cli/__tests__/helpers.test.ts` - Simplify to mock Bun.spawn

### API Design

```typescript
// src/utils/shell.ts

/**
 * Options for shell command execution
 */
export type ShellExecOptions = {
  /** Working directory for command execution */
  cwd: string;
  /** Timeout in milliseconds (optional) */
  timeout?: number;
  /** Input to pass to command stdin (optional) */
  input?: string;
};

/**
 * Result of shell command execution
 */
export type ShellExecResult = {
  /** Standard output from command */
  stdout: string;
  /** Standard error from command */
  stderr: string;
  /** Exit code (0 = success) */
  exitCode: number;
};

/**
 * Execute shell command with runtime-appropriate implementation
 *
 * Uses Bun.spawn in Bun runtime, execa in Node runtime.
 *
 * @param command - Command to execute (e.g., 'git', 'claude')
 * @param args - Array of arguments
 * @param options - Execution options (cwd, timeout, input)
 * @returns Promise resolving to command result
 * @throws {Error} If command fails, times out, or is not found
 */
export async function exec(
  command: string,
  args: string[],
  options: ShellExecOptions
): Promise<ShellExecResult>;
```

### Implementation Strategy

**Runtime Detection:**
```typescript
const isBun = typeof process.versions.bun !== 'undefined';
```

**Bun Path:**
- Use `Bun.spawn(command, { args, cwd, stdin, timeout })`
- Capture stdout/stderr via `await result.text()`
- Map Bun result to ShellExecResult

**Node Path:**
- Use `execa(command, args, { cwd, input, timeout })`
- Map execa result to ShellExecResult
- Preserve existing error handling

### Dependencies

**Existing packages:**
- `execa` - Already used, keep for Node runtime execution

**No new dependencies required.**

### Integration Points

**Utils Module:**
- Follows pure function pattern per @docs/constitutions/current/patterns.md
- Co-located tests per @docs/constitutions/current/testing.md
- Exported from `src/utils/index.ts` barrel

**Agent Layer:**
- BaseAgent.checkAvailability() uses exec('which', [cliCommand])
- BaseAgent.executeCommand() implementations use exec() instead of execa
- No changes to agent interface or template method flow

**CLI Layer:**
- CLI helpers use exec() for git commands
- No changes to CLI command structure

## Acceptance Criteria

**Constitution compliance:**
- [x] Pure function in utils module (@docs/constitutions/current/architecture.md §Utils Module)
- [x] No stateful utilities (@docs/constitutions/current/patterns.md §V3 Pattern Changes)
- [x] Co-located tests (@docs/constitutions/current/testing.md §Test Organization)
- [x] Type-safe with Zod schemas (@docs/constitutions/current/patterns.md §Schema-First Development)

**Feature-specific:**
- [ ] `exec()` function works identically in Bun and Node runtimes
- [ ] Runtime detection uses `process.versions.bun`
- [ ] All existing execa calls replaced with exec()
- [ ] Bun tests mock Bun.spawn (no execa mocking)
- [ ] Node runtime still uses execa (no behavior change)
- [ ] Error handling preserves existing behavior
- [ ] All options (cwd, timeout, input) work correctly

**Testing:**
- [ ] Unit tests for exec() in both Bun and Node paths (>90% coverage)
- [ ] Tests verify runtime detection logic
- [ ] Tests verify error handling (timeout, exit code, ENOENT)
- [ ] Integration tests verify BaseAgent works with exec()
- [ ] All existing tests pass with simplified mocking

**Verification:**
- [ ] All tests pass: `bun test`
- [ ] Type checking passes: `bun run type-check`
- [ ] Linting passes: `bun run lint`
- [ ] Build succeeds: `bun run build`
- [ ] CLI works end-to-end: `./dist/cli.js --dry-run`

## Migration Strategy

**Phase 1: Add Shell Adapter**
1. Create `src/utils/shell.ts` with exec() implementation
2. Add comprehensive tests in `src/utils/__tests__/shell.test.ts`
3. Verify tests pass in both Bun and Node runtimes

**Phase 2: Update Agent Layer**
1. Update `src/agents/base-agent.ts` to import/use exec()
2. Simplify agent tests to mock Bun.spawn
3. Verify all agent tests pass

**Phase 3: Update CLI Layer**
1. Update `src/cli/helpers.ts` to import/use exec()
2. Simplify CLI helper tests to mock Bun.spawn
3. Verify all CLI tests pass

**Phase 4: Validation**
1. Run full test suite: `bun test`
2. Run manual E2E test: `./dist/cli.js --dry-run`
3. Verify both Bun and Node runtimes work

**Note**: Implementation order and task decomposition handled by `/spectacular:plan` command.

## Open Questions

None - design is clear and validated through brainstorming phases.

## References

- Architecture: @docs/constitutions/current/architecture.md
- Patterns: @docs/constitutions/current/patterns.md
- Schema Rules: @docs/constitutions/current/schema-rules.md
- Tech Stack: @docs/constitutions/current/tech-stack.md
- Testing: @docs/constitutions/current/testing.md
- Bun.spawn API: https://bun.sh/docs/api/spawn
- execa API: https://github.com/sindresorhus/execa
