---
runId: acdebf
feature: eval-system
created: 2025-01-22
status: draft
---

# Feature: Commit Message Quality Evaluation System

**Status**: Draft
**Created**: 2025-01-22

## Problem Statement

**Current State:**
commitment generates commit messages using AI agents (Claude, Codex), but we have no automated way to:
- Measure message quality objectively
- Compare agent performance
- Detect when code changes degrade message quality
- Iterate experimentally to improve generation

**Desired State:**
An evaluation system that:
- Measures message quality across multiple dimensions
- Compares Claude vs Codex performance
- Tracks quality over time to detect regressions
- Provides actionable feedback for improvements
- Runs as part of test suite (not regular CI)

**Gap:**
Need a benchmark suite that generates messages from controlled fixtures, evaluates quality using ChatGPT, and stores results for comparison.

## Requirements

> **Note**: All features must follow @docs/constitutions/current/

### Functional Requirements

**FR1: Fixture-Based Evaluation**
- Load predefined changesets (simple & complex)
- Support two modes: mocked git (fast) and live git (comprehensive)
- Fixtures include git status, diff, and expected commit type

**FR2: Dual-Agent Message Generation**
- Generate commit messages using BOTH Claude and Codex agents
- Use existing `CommitMessageGenerator` and agent implementations
- Fail if either agent unavailable (need both for comparison)

**FR3: ChatGPT Quality Scoring**
- Evaluate each message using OpenAI ChatGPT
- Score across four dimensions (0-10 scale):
  - Conventional Commit compliance
  - Clarity and informativeness
  - Accuracy vs actual changeset
  - Appropriate detail level
- Return structured evaluation with scores + textual feedback

**FR4: Results Storage & Comparison**
- Store timestamped JSON results in `.eval-results/`
- Maintain symlinks to latest results per fixture
- Support baseline comparison to detect regressions
- Generate human-readable markdown reports

**FR5: Experimental Iteration Support**
- Provide feedback suggesting prompt/logic improvements
- Track score trends over time
- Compare agent performance (which generates better messages)

### Non-Functional Requirements

**NFR1: Live AI Testing**
- Always use real API calls (no mocked AI responses)
- Separate from main test suite (`pnpm test:eval` not `pnpm test`)
- Skipped in regular CI if API keys unavailable

**NFR2: API Key Requirements**
- Requires `OPENAI_API_KEY` for evaluation
- Requires BOTH `claude` and `codex` CLIs in PATH
- Clear error messages if dependencies missing

**NFR3: Test Organization**
- Follow @docs/constitutions/current/testing.md patterns
- Co-located unit tests for eval modules
- Integration test in `src/__tests__/integration/`
- 80%+ coverage for eval code (unit tests with mocked APIs)

**NFR4: Performance**
- Mocked git mode: Fast execution (<30s for all fixtures)
- Live git mode: Acceptable for thorough testing
- Results cached to avoid redundant API calls

## Architecture

> **Layer boundaries**: @docs/constitutions/current/architecture.md
> **Required patterns**: @docs/constitutions/current/patterns.md

### Components

**New Files:**

**Eval Module (`src/eval/`):**
- `src/eval/evaluator.ts` - Orchestrates ChatGPT evaluation (~100 LOC)
- `src/eval/runner.ts` - Runs fixtures through generation + eval (~120 LOC)
- `src/eval/reporter.ts` - Formats markdown + JSON results (~80 LOC)
- `src/eval/schemas.ts` - Zod schemas for eval types
- `src/eval/index.ts` - Barrel exports
- `src/eval/__tests__/evaluator.test.ts` - Unit tests (mocked ChatGPT)
- `src/eval/__tests__/runner.test.ts` - Unit tests (mocked components)
- `src/eval/__tests__/reporter.test.ts` - Unit tests (result formatting)

**ChatGPT Agent (`src/agents/`):**
- `src/agents/chatgpt.ts` - ChatGPT evaluator agent (~80 LOC, inline logic)
- Follows existing agent pattern (no base classes)
- Uses OpenAI Agents SDK for structured evaluation

**Integration Test:**
- `src/__tests__/integration/eval-live.test.ts` - Live AI evaluation tests

**Fixtures:**
- `examples/eval-fixtures/simple/` - Simple changeset (single-file fix)
  - `mock-status.txt` - Git status output
  - `mock-diff.txt` - Git diff output
  - `metadata.json` - Fixture description
- `examples/eval-fixtures/complex/` - Complex changeset (multi-file feature)
  - Same structure as simple
- `examples/eval-fixtures/simple-live/` - Real git repo for live mode
- `examples/eval-fixtures/complex-live/` - Real git repo for live mode

**Results Storage:**
- `.eval-results/` - Timestamped JSON + markdown (gitignored)
- `.eval-results/latest-{fixture}.json` - Symlinks to latest
- `.eval-results/baseline.json` - Optional baseline for comparison

**Modified Files:**
- `src/agents/types.ts` - Add ChatGPTAgent to agent types (optional, may not implement full Agent interface)
- `package.json` - Add `test:eval` script

### Dependencies

**New packages:**
- `@openai/agents` - OpenAI Agents SDK for structured evaluation
  - See: https://openai.github.io/openai-agents-js/
  - Purpose: Agent framework with tool/function calling for structured scores
  - Approved for this feature per @docs/constitutions/current/tech-stack.md

**Existing dependencies:**
- `zod` - Schema validation (already approved)
- `vitest` - Testing framework (already approved)
- `execa` - Git command execution (already approved)

### Integration Points

**Generator Layer:**
- Uses existing `CommitMessageGenerator` with no modifications
- Passes fixture changesets through generator

**Agent Layer:**
- Uses existing `ClaudeAgent` and `CodexAgent` implementations
- ChatGPT agent follows same pattern (~80 LOC, inline logic)

**Testing:**
- Co-located unit tests per @docs/constitutions/current/testing.md
- Integration test uses Vitest patterns
- Separate test command to avoid regular CI impact

### Data Flow

```
Fixture Loader
    ↓ (git status + diff)
CommitMessageGenerator (Claude)
    ↓ (commit message)
ChatGPT Evaluator
    ↓ (scores + feedback)
    │
    ├─→ JSON Results (.eval-results/)
    └─→ Markdown Report (.eval-results/)

(Repeat for Codex)

Compare Results → Detect regressions → Report
```

### Key Types (Zod Schemas)

Per @docs/constitutions/current/schema-rules.md, all types defined schema-first:

**EvalFixture:**
- name: string
- gitStatus: string (mocked git status output)
- gitDiff: string (mocked git diff output)
- expectedType: CommitType
- description: string

**EvalMetrics:**
- conventionalCompliance: number (0-10)
- clarity: number (0-10)
- accuracy: number (0-10)
- detailLevel: number (0-10)

**EvalResult:**
- fixture: string
- timestamp: ISO string
- agent: 'claude' | 'codex'
- commitMessage: string
- metrics: EvalMetrics
- feedback: string (ChatGPT explanation)
- overallScore: number (average of metrics)

**EvalComparison:**
- fixture: string
- claudeResult: EvalResult
- codexResult: EvalResult
- winner: 'claude' | 'codex' | 'tie'
- scoreDiff: number

## Error Handling

**New Error Types:**
- `EvalError.fixtureNotFound(name)` - Fixture doesn't exist
- `EvalError.generationFailed(agent, reason)` - Message generation failed
- `EvalError.evaluationFailed(reason)` - ChatGPT eval failed
- `EvalError.apiKeyMissing(service)` - Required API key not set
- `EvalError.agentUnavailable(name)` - Required CLI agent not in PATH

**Error Flow:**
- Agent errors (AgentError) propagate from existing agents
- EvalError wraps eval-specific failures
- Integration test reports clear error messages
- Exit codes: 0 (pass), 1 (error), 2 (quality below threshold)

## Acceptance Criteria

**Constitution compliance:**
- [ ] Architecture follows layered pattern (@docs/constitutions/current/architecture.md)
- [ ] Schema-first with Zod (@docs/constitutions/current/schema-rules.md)
- [ ] Agent follows inline pattern (~80 LOC, no base classes) (@docs/constitutions/current/patterns.md)
- [ ] Tests co-located and cover 80%+ (@docs/constitutions/current/testing.md)
- [ ] OpenAI Agents SDK approved (@docs/constitutions/current/tech-stack.md)

**Feature-specific:**
- [ ] Both simple and complex fixtures defined
- [ ] Eval runs for both Claude and Codex agents
- [ ] ChatGPT returns structured scores (4 metrics + feedback)
- [ ] Results stored as timestamped JSON + markdown
- [ ] Comparison report shows winner and score differences
- [ ] Test skips gracefully if API keys/CLIs missing
- [ ] `pnpm test:eval` runs full evaluation suite
- [ ] Unit tests cover eval modules with mocked APIs
- [ ] Integration test uses live AI calls

**Verification:**
- [ ] All unit tests pass (`pnpm test`)
- [ ] Eval tests pass with valid API keys (`pnpm test:eval`)
- [ ] Results stored in `.eval-results/` directory
- [ ] Markdown reports are human-readable
- [ ] Can detect quality regression by comparing with baseline
- [ ] No impact on regular CI (tests skipped without keys)

## Open Questions

None - design validated through brainstorming phases 1-3.

## References

- Architecture: @docs/constitutions/current/architecture.md
- Patterns: @docs/constitutions/current/patterns.md
- Schema Rules: @docs/constitutions/current/schema-rules.md
- Tech Stack: @docs/constitutions/current/tech-stack.md
- Testing: @docs/constitutions/current/testing.md
- OpenAI Agents JS: https://openai.github.io/openai-agents-js/
- OpenAI API Documentation: https://platform.openai.com/docs/
