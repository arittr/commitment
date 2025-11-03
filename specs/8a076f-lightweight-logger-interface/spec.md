# Feature: Lightweight Logger Interface

**Status**: Draft
**Created**: 2025-11-03
**RUN_ID**: 8a076f

## Problem Statement

**Current State:**
- Direct `console.log/warn/error` calls scattered throughout codebase (41 files)
- Architecture.md mandates "No console.log in libraries: Only CLI may use console directly"
- Generator has optional logger injection with single method: `{ warn: (msg) => void }`
- No support for `--quiet` flag to suppress progress output
- Testing requires complex console mocking or produces noisy output

**Desired State:**
- Clean Logger abstraction used consistently across all layers
- CLI creates logger based on `--quiet` flag, passes via dependency injection
- Library code (Generator, Agents, Eval system) uses injected logger
- Tests can use SilentLogger to suppress output
- Support for multiple log levels (debug, info, warn, error)

**Gap:**
Need lightweight Logger interface (~50 LOC) that extends existing pattern from `{ warn }` to `{ debug, info, warn, error }` with silent mode support.

## Requirements

> **Note**: All features must follow @docs/constitutions/current/

### Functional Requirements

- FR1: Logger interface with four methods: `debug()`, `info()`, `warn()`, `error()`
- FR2: ConsoleLogger implementation using chalk for formatting (gray for debug, default for info, yellow for warn, red for error)
- FR3: SilentLogger implementation where all methods are no-ops
- FR4: CLI creates logger based on `--quiet` flag (SilentLogger if quiet, ConsoleLogger otherwise)
- FR5: Logger injected via constructors/parameters to all components (Generator, CLI helpers, Agents, Eval system)
- FR6: Backward compatible migration path for existing `{ warn }` pattern

### Non-Functional Requirements

- NFR1: Implementation ≤50 LOC total (interface + 2 implementations)
- NFR2: No schemas or runtime validation needed (we control all instances)
- NFR3: No performance overhead (simple pass-through to console)
- NFR4: No breaking changes to public API (Generator config extends existing pattern)
- NFR5: Tests remain silent by default (use SilentLogger in test setup)

## Architecture

> **Layer boundaries**: @docs/constitutions/current/architecture.md
> **Required patterns**: @docs/constitutions/current/patterns.md

### Components

**New Files:**
- `src/utils/logger.ts` - Logger interface, ConsoleLogger, SilentLogger (~50 LOC)

**Modified Files:**
- `src/generator.ts` - Update `CommitMessageGeneratorConfig.logger` type from `{ warn }` to `Logger`
- `src/cli.ts` - Create logger based on `--quiet` flag, pass to all components
- `src/cli/helpers.ts` - Accept logger parameter in display functions (displayStagedChanges, displayCommitMessage, etc.)
- `src/cli/commands/init.ts` - Accept logger parameter
- `src/agents/base-agent.ts` - Accept optional logger in constructor
- `src/agents/types.ts` - Update Agent interface to include optional logger
- `src/eval/run-eval.ts` - Create and pass logger to runner
- `src/eval/runners/eval-runner.ts` - Accept logger in constructor
- `src/eval/runners/attempt-runner.ts` - Accept logger in constructor
- `src/eval/evaluators/*` - Accept logger in constructors
- All agent implementations (claude.ts, codex.ts, gemini.ts) - Inherit logger from BaseAgent

### Logger Interface Design

```typescript
// src/utils/logger.ts
export interface Logger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}
```

**ConsoleLogger**: Normal output with chalk formatting
- `debug()` → `console.log(chalk.gray(message))`
- `info()` → `console.log(message)`
- `warn()` → `console.warn(chalk.yellow(message))`
- `error()` → `console.error(chalk.red(message))`

**SilentLogger**: All methods are no-ops (for `--quiet` flag and tests)

### Dependency Injection Flow

**CLI Layer (Entry Point):**
```typescript
// src/cli.ts
const logger = options.quiet ? new SilentLogger() : new ConsoleLogger();
```

**Generator Layer:**
```typescript
// Before:
logger?: { warn: (message: string) => void };

// After (backward compatible):
logger?: Logger;
```

**CLI Helpers:**
```typescript
// Before:
export function displayStagedChanges(gitStatus: GitStatus, messageOnly: boolean): void

// After:
export function displayStagedChanges(gitStatus: GitStatus, logger: Logger): void
```

**Agents Layer:**
BaseAgent accepts optional logger in constructor, passes to all subclass instances.

**Eval System:**
Runner/evaluator components accept logger in constructor.

### Integration Points

- **CLI**: `--quiet` flag controls logger type (existing flag, new behavior)
- **Testing**: Pass SilentLogger to suppress output in unit tests
- **Architecture**: Follows existing logger injection pattern in Generator (@docs/constitutions/current/architecture.md:275-285)
- **Patterns**: Pure utility functions, dependency injection (@docs/constitutions/current/patterns.md:720)

### Dependencies

**No new packages required** - uses existing:
- chalk (already approved for terminal formatting)
- Standard TypeScript types

**No schema needed** - Simple TypeScript interface, no runtime validation (we control all instances)

## Acceptance Criteria

**Constitution compliance:**
- [ ] Follows dependency injection pattern (@docs/constitutions/current/patterns.md:720)
- [ ] Logger in utils module as pure functions (@docs/constitutions/current/architecture.md:179)
- [ ] No global state or singletons (@docs/constitutions/current/patterns.md:733)
- [ ] Architecture boundaries respected (CLI creates, library consumes)

**Feature-specific:**
- [ ] Logger interface defined with 4 methods
- [ ] ConsoleLogger implementation with chalk formatting
- [ ] SilentLogger implementation (all no-ops)
- [ ] CLI creates logger based on `--quiet` flag
- [ ] Generator accepts Logger (backward compatible)
- [ ] CLI helpers accept logger parameter
- [ ] BaseAgent accepts optional logger
- [ ] Eval system uses logger
- [ ] All direct console.* calls replaced in library code
- [ ] CLI files keep console.* for critical output (stdout commit messages)

**Verification:**
- [ ] All tests pass with SilentLogger
- [ ] `--quiet` flag suppresses progress output
- [ ] Linting passes (no eslint-disable needed for library code)
- [ ] No breaking changes to public API
- [ ] Implementation ≤50 LOC

## Migration Strategy

**Library Code (MUST use logger):**
- Generator, Agents, Utils, Eval system
- Replace console.* with logger.*

**CLI Code (KEEPS console.log for critical output):**
- Main commit message output to stdout
- Final status messages
- Progress/informational output uses logger (respects --quiet)

**Backward Compatibility:**
- Generator config type changes from `{ warn }` to `Logger`
- Existing code calling `logger.warn()` continues to work
- Tests can gradually adopt SilentLogger

## Open Questions

None - design validated through phases 1-3.

## References

- Architecture: @docs/constitutions/current/architecture.md (sections 273-285: Logging)
- Patterns: @docs/constitutions/current/patterns.md (sections 720-742: Dependency Injection)
- Tech Stack: @docs/constitutions/current/tech-stack.md (chalk approved)
- Testing: @docs/constitutions/current/testing.md (test isolation)
