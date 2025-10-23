---
runId: 66c7a7
feature: multi-attempt-eval
created: 2025-10-23
status: draft
---

# Feature: Multi-Attempt Evaluation System

**Status**: Draft
**Created**: 2025-10-23
**Run ID**: 66c7a7

## Problem Statement

**Current State:**
The evaluation system generates one commit message per agent per fixture. This leads to:
- ~25% failure rate due to thinking/COT artifacts not cleaned properly
- No way to distinguish between "agent is unreliable" vs "got unlucky once"
- Single data point doesn't show variance in quality or consistency
- When output is bad, unclear if it's systematic or random

**Desired State:**
- Measure reliability across multiple attempts (3x per agent per fixture)
- Track success rates and categorize failure types
- Meta-evaluation that considers both quality AND reliability
- Data-driven insights to improve cleaning patterns

**Gap:**
No reliability measurement or failure categorization. Single-attempt provides insufficient data for agent comparison.

## Requirements

> **Note**: All features must follow @docs/constitutions/current/

### Functional Requirements

**FR1: Multi-Attempt Generation**
- Generate 3 commit messages per agent per fixture
- Never short-circuit on failure (all 3 attempts complete)
- Each attempt is independent (no retry logic)

**FR2: Failure Categorization**
- Categorize each failure into type: `cleaning`, `validation`, `generation`, `api_error`
- Store failure reason string for debugging
- Pattern-based error detection (ENOENT, "Invalid conventional commit", etc.)

**FR3: Meta-Evaluation**
- Use ChatGPT to evaluate all 3 attempts together
- Calculate: `finalScore`, `consistencyScore`, `errorRateImpact`, `successRate`
- Provide reasoning even if 0/3 attempts succeeded
- Penalize failures (2/3 success ≠ average of 2 scores)

**FR4: Result Storage**
- Store all 3 attempt outcomes (success or failure)
- Store meta-evaluation with final score and reasoning
- Include best attempt details for reporting
- JSON files with timestamped naming

**FR5: Reporting**
- Markdown reports show per-attempt detail
- CLI output shows progress for each attempt
- Success rate and error breakdown in summary
- Compare agents using `finalScore`

### Non-Functional Requirements

**NFR1: No Backward Compatibility**
- Multi-attempt is the ONLY mode (no legacy single-attempt support)
- Complete schema redesign allowed
- Existing result files will be regenerated

**NFR2: Schema-First Development**
- All types defined as Zod schemas first
- Validation at boundaries per @docs/constitutions/current/schema-rules.md
- Type inference via `z.infer<typeof schema>`

**NFR3: Modular Architecture**
- Reorganize `src/eval/` into clear module boundaries
- Co-located tests per @docs/constitutions/current/testing.md
- 80%+ test coverage for all new components

**NFR4: OpenAI Agents SDK Pattern**
- Use `gpt-5` model per @docs/constitutions/current/tech-stack.md
- Use `outputType` with Zod schemas (NOT tools)
- Access via `result.finalOutput` (NOT `result.toolCalls`)

**NFR5: Standalone Script**
- Evaluation is a script (`bun run eval`), NOT test suite
- No expensive API calls during `bun test`
- Real API calls only via explicit `bun run eval` command

## Architecture

> **Layer boundaries**: @docs/constitutions/current/architecture.md
> **Required patterns**: @docs/constitutions/current/patterns.md
> **Schema rules**: @docs/constitutions/current/schema-rules.md

### Directory Structure

**New organization of `src/eval/`:**

```
src/eval/
├── core/
│   ├── schemas.ts           # All Zod schemas
│   ├── types.ts             # Re-exported types
│   └── errors.ts            # EvaluationError class
│
├── runners/
│   ├── eval-runner.ts       # Main orchestrator
│   ├── attempt-runner.ts    # 3-attempt loop
│   └── index.ts
│
├── evaluators/
│   ├── single-attempt.ts    # ChatGPT single-attempt scoring
│   ├── meta-evaluator.ts    # GPT meta-evaluation
│   ├── chatgpt-agent.ts     # OpenAI SDK wrapper
│   └── index.ts
│
├── reporters/
│   ├── markdown-reporter.ts
│   ├── json-reporter.ts
│   ├── cli-reporter.ts
│   └── index.ts
│
├── fixtures/
│   ├── {existing fixtures}/
│   ├── loader.ts
│   └── index.ts
│
├── utils/
│   ├── error-categorization.ts
│   ├── best-attempt.ts
│   └── index.ts
│
├── __tests__/              # Co-located tests
│   ├── runners/
│   ├── evaluators/
│   ├── reporters/
│   └── utils/
│
├── run-eval.ts             # Entry point
└── index.ts                # Public API
```

### Components

**New Files:**

**Core:**
- `src/eval/core/schemas.ts` - All Zod schemas (AttemptOutcome, EvalResult, MetaEvaluation)
- `src/eval/core/types.ts` - Type re-exports from schemas
- `src/eval/core/errors.ts` - EvaluationError with factory methods

**Runners:**
- `src/eval/runners/attempt-runner.ts` - Orchestrates 3 generation attempts with error handling
- `src/eval/runners/eval-runner.ts` - Main pipeline: fixture → attempts → meta-eval → comparison

**Evaluators:**
- `src/eval/evaluators/single-attempt.ts` - ChatGPT scoring for one attempt (renamed from evaluator.ts)
- `src/eval/evaluators/meta-evaluator.ts` - ChatGPT meta-evaluation across 3 attempts
- `src/eval/evaluators/chatgpt-agent.ts` - OpenAI Agents SDK wrapper (shared)

**Reporters:**
- `src/eval/reporters/markdown-reporter.ts` - Multi-attempt markdown format
- `src/eval/reporters/json-reporter.ts` - JSON storage with symlinking
- `src/eval/reporters/cli-reporter.ts` - Per-attempt progress + summary

**Utils:**
- `src/eval/utils/error-categorization.ts` - Pure function: categorizeError()
- `src/eval/utils/best-attempt.ts` - Pure function: getBestAttempt()

**Modified Files:**
- `src/eval/run-eval.ts` - Update to use new runners and reporters
- `src/eval/index.ts` - Update public API exports

**Deleted Files:**
- `src/eval/evaluator.ts` - Replaced by evaluators/single-attempt.ts
- `src/eval/runner.ts` - Replaced by runners/eval-runner.ts
- `src/eval/reporter.ts` - Split into reporters/ directory
- `src/eval/schemas.ts` - Moved to core/schemas.ts

### Schema Design

**New Schemas in `src/eval/core/schemas.ts`:**

1. **`attemptOutcomeSchema`** - Discriminated union (status: "success" | "failure")
   - Success: includes commitMessage, metrics, overallScore, attemptNumber
   - Failure: includes failureType enum, failureReason, attemptNumber

2. **`evalResultSchema`** - Multi-attempt-first result (no backward compat)
   - `attempts: AttemptOutcome[]` (length = 3)
   - `finalScore`, `consistencyScore`, `errorRateImpact`, `successRate` (from meta-eval)
   - `reasoning` (GPT explanation)
   - `bestAttempt` (optional, for reporting)

3. **`evalComparisonSchema`** - Simplified comparison
   - Both agent results
   - Winner computed from `finalScore` directly

All schemas follow @docs/constitutions/current/schema-rules.md

### Dependencies

**Existing packages (no new dependencies):**
- `@openai/agents` - Already approved for eval system
- `zod` - Schema validation
- See: https://platform.openai.com/docs/guides/agents

**OpenAI Agents SDK Usage:**
- Model: `gpt-5` (per tech-stack.md requirement)
- Pattern: `outputType` with Zod schema
- Access: `result.finalOutput` NOT `result.toolCalls`
- Docs: https://github.com/openai/openai-agents-sdk

### Integration Points

**Layer 1 (Existing):**
- `CommitMessageGenerator` - Used by AttemptRunner for each attempt
- Git utilities - Used for fixture loading

**Layer 2 (New):**
- `AttemptRunner` - Calls CommitMessageGenerator 3x, delegates to SingleAttemptEvaluator
- `SingleAttemptEvaluator` - Wraps ChatGPT for single-attempt scoring
- `MetaEvaluator` - Wraps ChatGPT for 3-attempt meta-evaluation

**Layer 3 (New):**
- `EvalRunner` - Orchestrates entire pipeline (fixtures → attempts → meta-eval → comparison)
- `Reporters` - Format and store results

**Error Handling:**
- AttemptRunner catches all errors, categorizes into failureType
- MetaEvaluator throws EvaluationError for GPT failures
- EvalRunner catches top-level, uses fallback scoring if meta-eval fails
- Follows error patterns in @docs/constitutions/current/patterns.md

## Acceptance Criteria

**Constitution compliance:**
- [ ] All patterns followed (@docs/constitutions/current/patterns.md)
- [ ] Architecture boundaries respected (@docs/constitutions/current/architecture.md)
- [ ] Schema-first development (@docs/constitutions/current/schema-rules.md)
- [ ] Testing requirements met (@docs/constitutions/current/testing.md)
- [ ] OpenAI SDK usage per tech-stack.md (gpt-5, outputType pattern)

**Feature-specific:**
- [ ] 3 attempts run for each agent on each fixture
- [ ] All 3 attempts complete even if some fail
- [ ] Failures categorized into 4 types (cleaning, validation, generation, api_error)
- [ ] Meta-evaluation produces finalScore considering consistency + error rate
- [ ] Meta-evaluation provides reasoning even for 0/3 success
- [ ] Success rate tracked (0/3, 1/3, 2/3, 3/3)
- [ ] Reports show per-attempt detail
- [ ] CLI shows progress for each attempt
- [ ] JSON results stored with attempt-level data
- [ ] Winner comparison uses finalScore

**Verification:**
- [ ] All tests pass (80%+ coverage)
- [ ] Linting passes (bun run lint)
- [ ] Type checking passes (bun run type-check)
- [ ] Eval runs successfully: `bun run eval`
- [ ] Per-attempt data appears in markdown report
- [ ] Failure categorization works correctly

## Open Questions

None. Design approved after iterative brainstorming.

## References

- Architecture: @docs/constitutions/current/architecture.md
- Patterns: @docs/constitutions/current/patterns.md
- Schema Rules: @docs/constitutions/current/schema-rules.md
- Tech Stack: @docs/constitutions/current/tech-stack.md
- Testing: @docs/constitutions/current/testing.md
- Design Document: @docs/plans/2025-10-23-multi-attempt-eval-design.md
- OpenAI Agents SDK: https://github.com/openai/openai-agents-sdk
- OpenAI Platform Docs: https://platform.openai.com/docs/guides/agents
