---
runId: 9e9a7f
feature: gemini-cli-integration
created: 2025-10-24
status: draft
---

# Feature: Gemini CLI Agent Integration with Refactored Agent System

**Status**: Draft
**Created**: 2025-10-24
**Run ID**: 9e9a7f

## Problem Statement

**Current State:**
commitment supports two AI agents (Claude and Codex) for commit message generation. Each agent is instantiated via if/else chain in generator.ts. Common cleaning patterns (commit message markers, AI preambles) are duplicated across agent implementations.

**Desired State:**
Support Google's Gemini CLI as a third agent option while improving code quality through:
1. Eliminating duplication in response cleaning logic
2. Making agent registration more maintainable and extensible
3. Preserving the v3 architecture's simplicity and explicitness

**Gap:**
- No Gemini CLI support
- Duplicated cleaning logic in Claude and Codex agents
- if/else chain for agent instantiation will grow linearly with each new agent
- Missing common cleaning patterns that should be universal (AI preamble removal)

## Requirements

> **Note**: All features must follow @docs/constitutions/current/

### Functional Requirements

**FR1: Gemini CLI Integration**
- Add GeminiAgent that extends BaseAgent following the established pattern
- Use `gemini -p "<prompt>"` for non-interactive commit message generation
- Support standard 120-second timeout consistent with other agents
- Verify CLI availability via inherited checkAvailability() method

**FR2: Shared Cleaning Utilities**
- Extract `cleanCommitMessageMarkers()` to remove `<<<COMMIT_MESSAGE_START/END>>>` markers
- Extract `cleanAIPreambles()` to remove "here is the commit message:", "commit message:" patterns
- Update `cleanAIResponse()` in agent-utils.ts to apply both new utilities
- Remove duplicated cleaning code from Claude and Codex agents

**FR3: Agent Factory Pattern**
- Create `src/agents/factory.ts` with `createAgent()` function
- Use ts-pattern for exhaustive agent instantiation (per @docs/constitutions/current/patterns.md)
- Replace if/else chain in generator.ts with factory function call
- Maintain type safety with AgentName union type

**FR4: Type System Updates**
- Update `AgentName` type to `'claude' | 'codex' | 'gemini'`
- Update `CommitMessageGeneratorConfig.agent` type to match
- Update CLI schemas if agent validation exists
- Ensure type safety across all agent references

**FR5: CLI Integration**
- Update `--agent` option help text to include 'gemini'
- Maintain 'claude' as default agent
- No other CLI changes required

### Non-Functional Requirements

**NFR1: Code Quality**
- Reduce duplication: Extract 2 cleaning functions, remove 6+ lines of duplicated code
- Improve maintainability: Single location to add new agents (factory.ts)
- Preserve simplicity: Factory function ≤15 LOC using ts-pattern

**NFR2: Backwards Compatibility**
- Existing 'claude' and 'codex' agent behavior unchanged
- Default agent remains 'claude'
- No breaking changes to public API

**NFR3: Testing Coverage**
- All new code must meet 80%+ coverage requirement (@docs/constitutions/current/testing.md)
- Test GeminiAgent execution, error handling, CLI availability
- Test new cleaning utilities independently
- Test factory exhaustiveness checking

**NFR4: Constitutional Compliance**
- Agent factory using ts-pattern approved per patterns.md
- BaseAgent extension pattern preserved from v3
- Pure utility functions for cleaning logic
- Co-located tests in `__tests__/` directories

## Architecture

> **Layer boundaries**: @docs/constitutions/current/architecture.md
> **Required patterns**: @docs/constitutions/current/patterns.md
> **Tech stack**: @docs/constitutions/current/tech-stack.md

### Components

**New Files:**

- `src/agents/gemini.ts` - GeminiAgent implementation extending BaseAgent (~40-60 LOC)
  - Implements executeCommand() to invoke `gemini -p` with prompt
  - Inherits standard cleaning, validation, and error handling from BaseAgent
  - No cleanResponse() override needed (Gemini produces clean output)

- `src/agents/factory.ts` - Agent factory using ts-pattern (~15 LOC)
  - `createAgent(name: AgentName): Agent` function
  - Uses ts-pattern match().with().exhaustive() for type-safe instantiation
  - Replaces if/else chain in generator.ts

- `src/agents/__tests__/gemini.test.ts` - GeminiAgent unit tests
  - Test CLI execution with mocked gemini command
  - Test CLI not found error handling
  - Test standard flow via BaseAgent inheritance

- `src/agents/__tests__/factory.test.ts` - Factory function tests
  - Verify correct agent instance returned for each name
  - Verify exhaustiveness checking catches missing cases
  - Verify type safety

**Modified Files:**

- `src/agents/agent-utils.ts` - Add shared cleaning utilities
  - Add `cleanCommitMessageMarkers(output: string): string`
  - Add `cleanAIPreambles(output: string): string`
  - Update `cleanAIResponse()` to call new utilities in cleaning pipeline
  - All functions remain pure with no side effects

- `src/agents/__tests__/agent-utils.test.ts` - Add tests for new utilities
  - Test marker removal with various formats
  - Test preamble removal with various AI-generated prefixes
  - Test updated cleanAIResponse() includes new cleaning stages

- `src/agents/claude.ts` - Remove duplicated cleaning
  - Delete 2 lines removing commit message markers (now in agent-utils)
  - cleanResponse() override becomes simpler

- `src/agents/codex.ts` - Remove duplicated cleaning
  - Delete 4 lines removing commit message markers and AI preambles
  - Retain only Codex-specific cleaning (activity logs, metadata fields)

- `src/agents/types.ts` - Update agent type definitions
  - Change `AgentName` from `'claude' | 'codex'` to `'claude' | 'codex' | 'gemini'`

- `src/agents/index.ts` - Add Gemini exports
  - Export `GeminiAgent` from './gemini'
  - Export `createAgent` from './factory'

- `src/generator.ts` - Use agent factory
  - Import `createAgent` from './agents/factory'
  - Replace ternary operator with `this.agent = createAgent(agentName)`
  - Update default signature logic to include Gemini case using ts-pattern
  - Update `CommitMessageGeneratorConfig` type to include 'gemini'

- `src/cli.ts` - Update help text
  - Change `--agent` description to: `'AI agent to use: claude, codex, gemini (default: "claude")'`

- `src/cli/schemas.ts` - Update validation if needed
  - Ensure CLI schema accepts 'gemini' as valid agent name

**No Changes Required:**
- BaseAgent template pattern remains unchanged
- Generator validation logic remains unchanged
- Git utilities remain unchanged
- Test framework and organization remain unchanged

### Dependencies

**Existing Dependencies (No New Packages):**
- `ts-pattern` - Already approved in tech-stack.md, used for factory function
- `execa` → Updated to use internal `exec` wrapper from `src/utils/shell.ts`
- All cleaning utilities use pure JavaScript/TypeScript (no external deps)

**External CLI Requirement:**
- Gemini CLI must be installed: `npm install -g @google/gemini-cli` or `brew install gemini-cli`
- See: https://github.com/google-gemini/gemini-cli for installation instructions
- Requires Node.js 20+ (already required by commitment)

**No Schema Changes:**
- No database or data model changes
- No migration required

### Integration Points

**Agent Layer:**
- GeminiAgent extends BaseAgent, inheriting template method pattern
- Uses shared utilities from agent-utils for cleaning
- Instantiated via factory.ts using ts-pattern

**Generator Layer:**
- Imports createAgent() from factory
- Calls factory with validated agent name from config
- No other generator logic changes

**CLI Layer:**
- Accepts 'gemini' as valid --agent option value
- Validation happens at schema boundary
- Error messages include Gemini in agent list

**Utility Layer:**
- New cleaning functions in agent-utils are pure, stateless
- Used by BaseAgent.cleanResponse() default implementation
- All agents benefit from enhanced cleaning pipeline

### Design Patterns Applied

**Template Method Pattern (BaseAgent):**
- Preserved from v3 architecture
- GeminiAgent implements only executeCommand() extension point
- Inherits checkAvailability(), cleanResponse(), validateResponse()

**Factory Pattern (createAgent):**
- Uses ts-pattern for type-safe, exhaustive matching
- Approved pattern per @docs/constitutions/current/patterns.md
- Simplifies agent instantiation without complex factory classes

**Pure Functions (Cleaning Utilities):**
- All new utilities are stateless, side-effect-free
- Composable and independently testable
- Follows v3 principle from architecture.md

**Dependency Injection:**
- Agent injected into Generator via constructor
- Preserves testability with mock agents
- No change to existing pattern

## Acceptance Criteria

**Constitution Compliance:**
- [ ] BaseAgent extension follows v3 pattern (@docs/constitutions/current/architecture.md)
- [ ] ts-pattern used for factory (@docs/constitutions/current/patterns.md)
- [ ] Pure utility functions for shared logic (@docs/constitutions/current/architecture.md)
- [ ] Co-located tests in `__tests__/` directories (@docs/constitutions/current/testing.md)
- [ ] No factories/provider chains beyond simple factory function (@docs/constitutions/current/architecture.md)

**Feature-Specific:**
- [ ] `commitment --agent gemini` generates commit messages using Gemini CLI
- [ ] GeminiAgent properly handles CLI not found error with helpful message
- [ ] GeminiAgent respects 120-second timeout consistent with other agents
- [ ] Commit message markers removed by shared utility (Claude/Codex no longer duplicate)
- [ ] AI preambles removed by shared utility (universal across all agents)
- [ ] Factory function returns correct agent instance for each AgentName
- [ ] Factory function provides exhaustiveness checking via ts-pattern
- [ ] Default agent remains 'claude' when not specified

**Code Quality:**
- [ ] Duplication eliminated: 6+ lines of cleaning code removed
- [ ] GeminiAgent implementation ~40-60 LOC (consistent with Claude/Codex)
- [ ] Factory function ≤15 LOC using ts-pattern
- [ ] All cleaning utilities are pure functions (no state, no side effects)

**Testing:**
- [ ] GeminiAgent unit tests cover executeCommand(), errors, CLI availability
- [ ] Factory tests verify correct instantiation and exhaustiveness
- [ ] Cleaning utility tests verify marker and preamble removal
- [ ] Claude and Codex tests still pass after removing duplicated code
- [ ] Integration tests verify end-to-end Gemini agent flow
- [ ] Overall test coverage ≥80% maintained (@docs/constitutions/current/testing.md)

**Verification:**
- [ ] `bun test` passes all tests
- [ ] `bun run lint` passes with no violations
- [ ] `bun run type-check` passes with no errors
- [ ] `bun test --coverage` shows coverage ≥80%
- [ ] Manual test: `./dist/cli.js --agent gemini --dry-run` generates valid commit message
- [ ] Manual test: Gemini CLI not installed produces helpful error message

## Open Questions

None - design fully validated through brainstorming phases.

## References

- Architecture: @docs/constitutions/current/architecture.md
- Patterns: @docs/constitutions/current/patterns.md
- Tech Stack: @docs/constitutions/current/tech-stack.md
- Testing: @docs/constitutions/current/testing.md
- Gemini CLI: https://github.com/google-gemini/gemini-cli
- ts-pattern: https://github.com/gvergnaud/ts-pattern
