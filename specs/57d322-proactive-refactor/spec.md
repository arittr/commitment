# Feature: Proactive Refactor - Agent Consolidation & Code Quality

**Status**: Draft
**Created**: 2025-10-22
**Run ID**: 57d322

## Problem Statement

**Current State:**
- Agent implementations (Claude, Codex, ChatGPT) duplicate ~70% of code across 684 LOC total
- CLI has 6-7 helper functions making main file 265 LOC, reducing readability
- Type schemas have arbitrary constraints (max 200, max 1000) without justification
- Dead code exports exist (`FileCategorization` type alias, stale v1 comments)
- Overly defensive response cleaning patterns for modern AI agents

**Desired State:**
- Agents use simple base class template pattern (~40-60 LOC each after extraction)
- Shared utilities extracted to focused, stateless helper functions
- CLI helpers separated for improved testability and readability
- Type schemas have only meaningful constraints (non-empty, positive numbers, enums)
- Dead code removed, stale comments cleaned

**Gap:**
While v2 successfully removed over-abstraction (factories, chains, auto-detection), legitimate code duplication remains. Agents repeat identical validation, cleaning, and error handling logic. This refactor consolidates duplication through simple utilities and base classes without reintroducing v1's complexity.

## Requirements

> **Note**: All changes must follow @docs/constitutions/current/

### Functional Requirements

**FR1: Agent Base Class**
- Create `BaseAgent` abstract class implementing `Agent` interface
- Provide standard flow: availability check → execute → clean → validate
- Define 3 extension points: `executeCommand()` (required), `cleanResponse()` (optional), `validateResponse()` (optional)
- No factory pattern, no provider chains - agents still instantiated with simple if/else

**FR2: Agent Utilities**
- Extract shared logic to `src/agents/agent-utils.ts`:
  - `cleanAIResponse(output: string): string` - remove common AI artifacts
  - `validateConventionalCommit(message: string): boolean` - basic format check
  - `isCLINotFoundError(error: unknown): boolean` - ENOENT detection
- Functions must be pure, stateless, and focused

**FR3: CLI Helpers**
- Extract display/execution helpers to `src/cli/helpers.ts`:
  - `displayStagedChanges()`, `displayGenerationStatus()`, `displayCommitMessage()`, `executeCommit()`
- Improve testability and reduce `cli.ts` from 265 LOC → ~150 LOC

**FR4: Type Schema Hardening**
- Remove arbitrary max constraints (`.max(200)`, `.max(1000)`)
- Add meaningful validation only (non-empty strings, positive numbers, enum types)
- Make required vs optional explicit with `.default()` or `.optional()`
- Add `agentNameSchema = z.enum(['claude', 'codex'])` for type safety

**FR5: Dead Code Removal**
- Remove `FileCategorization` type alias (use `FileCategories` directly)
- Clean stale v1 migration comments across codebase
- Keep ChatGPT agent (needed as eval scorer)
- Simplify overly defensive response cleaning (trust modern agents more)

### Non-Functional Requirements

**NFR1: Architecture Preservation**
- No factories, no provider chains, no auto-detection (v2 simplifications preserved)
- Agents remain readable end-to-end (~40-60 LOC each)
- Layer boundaries unchanged (CLI → Generator → Agent → External)
- Base class is simple template, not complex inheritance hierarchy

**NFR2: Backward Compatibility**
- Agent interface unchanged - existing tests remain valid
- Generator instantiation unchanged - same if/else pattern
- Public APIs unchanged - no breaking changes

**NFR3: Test Coverage**
- All new utilities have unit tests
- All modified agents have updated tests
- Integration tests validate layer interactions still work
- Coverage must not decrease (maintain 80%+ per @docs/constitutions/current/testing.md)

**NFR4: Future Extensibility**
- Adding new agent requires ~20-40 LOC (extend BaseAgent, implement `executeCommand()`)
- Clear template pattern for new contributors
- Well-documented extension points

## Architecture

> **Layer boundaries**: @docs/constitutions/current/architecture.md
> **Required patterns**: @docs/constitutions/current/patterns.md
> **Testing requirements**: @docs/constitutions/current/testing.md

### Components

**New Files:**
- `src/agents/base-agent.ts` (~80 LOC) - Abstract base class with template method pattern
- `src/agents/agent-utils.ts` (~100 LOC) - Shared utility functions (pure, stateless)
- `src/cli/helpers.ts` (~80 LOC) - CLI display and execution helpers

**Modified Files:**
- `src/agents/claude.ts` (219 LOC → ~40 LOC) - Extends BaseAgent, implements `executeCommand()`
- `src/agents/codex.ts` (255 LOC → ~60 LOC) - Extends BaseAgent, overrides `cleanResponse()` for Codex artifacts
- `src/agents/chatgpt.ts` (210 LOC → ~50 LOC) - Extends BaseAgent (kept for eval scorer)
- `src/agents/index.ts` - Export BaseAgent
- `src/cli.ts` (265 LOC → ~150 LOC) - Import and use CLI helpers
- `src/types/schemas.ts` - Remove arbitrary constraints, add agentNameSchema enum
- `src/utils/git-schemas.ts` - Remove `FileCategorization` type alias

### Key Design Decisions

**Base Class vs Utilities:**
- Base class provides template (standard flow all agents follow)
- Utilities provide focused functions (cleaning, validation, error detection)
- Differs from v1: No abstract methods forcing complex inheritance, no factories
- Agents remain ~40-60 LOC with all logic visible

**Extension Points:**
1. `executeCommand(prompt, workdir): Promise<string>` - **Required** - how to call agent CLI
2. `cleanResponse(output): string` - **Optional** - agent-specific artifact removal
3. `validateResponse(message): void` - **Optional** - agent-specific validation

**Standard Flow (guaranteed by base class):**
```
checkAvailability() → executeCommand() → cleanResponse() → validateResponse() → return
```

### Dependencies

**No new packages required** - refactor uses existing dependencies:
- Zod (validation): https://zod.dev
- bun:test (testing): https://bun.sh/docs/cli/test
- execa (CLI execution): https://github.com/sindresorhus/execa

### Integration Points

**Agent instantiation** (unchanged):
```typescript
// In generator.ts - same simple if/else
if (this.config.agent === 'claude') {
  agent = new ClaudeAgent();
} else if (this.config.agent === 'codex') {
  agent = new CodexAgent();
}
```

**Agent interface** (unchanged):
```typescript
interface Agent {
  readonly name: string;
  generate(prompt: string, workdir: string): Promise<string>;
}
```

## Acceptance Criteria

**Constitution compliance:**
- [ ] Layer boundaries respected (@docs/constitutions/current/architecture.md)
- [ ] No factories, chains, or auto-detection (v2 principles preserved)
- [ ] Schema-first validation (@docs/constitutions/current/schema-rules.md)
- [ ] Tests co-located in `__tests__/` directories (@docs/constitutions/current/testing.md)
- [ ] 80%+ coverage maintained

**Refactor-specific:**
- [ ] BaseAgent class has exactly 3 extension points (no over-abstraction)
- [ ] Each agent ~40-60 LOC after extraction (readable end-to-end)
- [ ] All utilities are pure functions (no state, no side effects)
- [ ] CLI helpers improve testability (can unit test display functions)
- [ ] No arbitrary schema constraints remain (only meaningful validation)
- [ ] FileCategorization type alias removed (one type is enough)
- [ ] All stale v1 comments removed from codebase

**Verification:**
- [ ] All existing tests pass without modification (backward compatible)
- [ ] New utility tests added with 100% coverage
- [ ] Adding new agent takes ~20-40 LOC (test with example)
- [ ] `bun test` passes
- [ ] `bun run lint` passes
- [ ] `bun run type-check` passes

## Testing Strategy

> **Testing requirements**: @docs/constitutions/current/testing.md

**Unit Tests:**
- `src/agents/__tests__/base-agent.test.ts` - Test template flow, extension points
- `src/agents/__tests__/agent-utils.test.ts` - Test each utility function
- `src/cli/__tests__/helpers.test.ts` - Test display/execution helpers
- Update existing agent tests to work with BaseAgent

**Integration Tests:**
- Verify CLI → Generator → Agent flow unchanged
- Verify all 3 agents (Claude, Codex, ChatGPT) work end-to-end
- Verify error handling across layers

**Test Pattern:**
```typescript
// Example: Testing base class template
describe('BaseAgent', () => {
  it('should execute standard flow', async () => {
    const agent = new TestAgent(); // Concrete test implementation
    const result = await agent.generate(prompt, workdir);
    // Verify: checkAvailability called, executeCommand called, cleanResponse called, validateResponse called
  });
});
```

## Open Questions

None - design validated through brainstorming phases 1-3.

## Impact Analysis

**Code size:**
- ~400 LOC removed (agent duplication eliminated)
- ~260 LOC added (base class + utilities)
- **Net: ~140 LOC reduction**

**Maintainability:**
- Adding new agent: 684 LOC avg → ~20-40 LOC template
- Clear extension points for contributors
- Improved testability (helpers can be unit tested)

**Risk:**
- Low - backward compatible, no breaking changes
- All existing tests remain valid
- Gradual rollout possible (convert one agent at a time)

## References

- Architecture: @docs/constitutions/current/architecture.md
- Patterns: @docs/constitutions/current/patterns.md
- Schema Rules: @docs/constitutions/current/schema-rules.md
- Tech Stack: @docs/constitutions/current/tech-stack.md
- Testing: @docs/constitutions/current/testing.md
- Zod documentation: https://zod.dev
- bun:test documentation: https://bun.sh/docs/cli/test
