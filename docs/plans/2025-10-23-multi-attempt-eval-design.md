# Multi-Attempt Evaluation System Design

**Date:** 2025-10-23
**Status:** Approved
**Author:** Claude Code (with user validation)

## Problem Statement

The current evaluation system generates one commit message per agent per fixture, leading to:

1. **Inconsistent results** - Single-shot generation has ~25% failure rate due to thinking/COT artifacts
2. **No reliability measurement** - Can't distinguish between "agent is unreliable" vs "got unlucky once"
3. **Limited data** - Single attempt doesn't show variance in quality or consistency
4. **Poor debugging** - When output is bad, we don't know if it's systematic or random

## Goals

1. **Measure reliability** - Track success rate across multiple attempts (3x per agent)
2. **Capture variance** - Understand consistency of output quality
3. **Track errors** - Record failure reasons (cleaning, validation, generation, API) for debugging
4. **Meta-evaluation** - Use GPT to assess overall agent performance considering both quality and reliability
5. **Maintain compatibility** - Preserve existing result format for comparison/regression detection

## Non-Goals

- **No retry logic** - Not trying to fix failures, just recording them
- **No automatic cleaning improvements** - Track failures first, improve patterns later based on data
- **No parallelization** - Sequential attempts to avoid API rate limits and maintain simplicity

## Architecture

### Three-Layer Design

```
┌─────────────────────────────────────────────────────────┐
│ Layer 3: Meta-Evaluation                                │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ MetaEvaluator                                       │ │
│ │ - evaluateAttempts(3 outcomes) → MetaEvaluation    │ │
│ │ - Uses GPT to assess consistency, error rate       │ │
│ │ - Returns finalScore (0-10) + reasoning            │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │
┌─────────────────────────────────────────────────────────┐
│ Layer 2: Multi-Attempt Orchestration                    │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ AttemptRunner                                       │ │
│ │ - runAttempts(fixture, agent) → 3 outcomes         │ │
│ │ - Calls Layer 1 three times                        │ │
│ │ - Categorizes errors (cleaning/validation/etc)     │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Single Generation (existing)                   │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ CommitMessageGenerator                              │ │
│ │ - generateCommitMessage() → message                │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Evaluator                                           │ │
│ │ - evaluate(message) → EvalResult (4 metrics + score)│ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Data Flow:**
```
Fixture → AttemptRunner
             ↓
          3x (generate → evaluate)
             ↓
          [outcome1, outcome2, outcome3]
             ↓
          MetaEvaluator
             ↓
          MetaEvaluation (finalScore + reasoning)
```

## Schema Design

### New Types

#### `AttemptOutcome` (Discriminated Union)

```typescript
export const attemptOutcomeSchema = z.discriminatedUnion('status', [
  // Success case
  z.object({
    status: z.literal('success'),
    attemptNumber: z.number().int().min(1).max(3),
    commitMessage: z.string().min(1),
    metrics: evalMetricsSchema, // 4 metrics from ChatGPT
    overallScore: z.number().min(0).max(10),
  }),

  // Failure case
  z.object({
    status: z.literal('failure'),
    attemptNumber: z.number().int().min(1).max(3),
    failureReason: z.string().min(1),
    failureType: z.enum([
      'cleaning',    // Thinking artifacts remain after cleaning
      'validation',  // Invalid conventional commit format
      'generation',  // Agent CLI execution failed
      'api_error'    // ChatGPT evaluation API failed
    ]),
  })
]);

export type AttemptOutcome = z.infer<typeof attemptOutcomeSchema>;
```

**Design rationale:**
- Discriminated union ensures type safety (can't access `commitMessage` on failure)
- `failureType` enables categorization of issues for debugging
- `attemptNumber` helps track which attempt failed

#### `MetaEvaluation`

```typescript
export const metaEvaluationSchema = z.object({
  finalScore: z.number().min(0).max(10)
    .describe('Overall score considering quality + reliability'),

  consistencyScore: z.number().min(0).max(10)
    .describe('How consistent are the successful attempts'),

  errorRateImpact: z.number().min(0).max(10)
    .describe('Penalty for failures (3/3=10, 2/3=7, 1/3=3, 0/3=0)'),

  reasoning: z.string().min(50)
    .describe('GPT explanation of scores'),

  successRate: z.number().min(0).max(1)
    .describe('Proportion of successful attempts (e.g., 2/3 = 0.667)'),
});

export type MetaEvaluation = z.infer<typeof metaEvaluationSchema>;
```

**GPT Evaluation Criteria:**
1. **Consistency** - Low variance in quality across successful attempts gets high score
2. **Error Rate Impact** - Failures reduce score even if successes are perfect
3. **Best vs Average** - Consider both peak capability and typical performance
4. **Failure Types** - Cleaning failures worse than API errors (indicates agent quality issue)

### Extended `EvalResult`

```typescript
export const evalResultSchema = z.object({
  // Existing fields (unchanged)
  agent: z.enum(['claude', 'codex']),
  fixture: z.string().min(1),
  timestamp: z.string().datetime(),

  // NEW: Multi-attempt data
  attempts: z.array(attemptOutcomeSchema).length(3),
  metaEvaluation: metaEvaluationSchema,

  // BACKWARD COMPATIBILITY: Existing consumers expect these
  overallScore: z.number().min(0).max(10),  // = metaEvaluation.finalScore
  commitMessage: z.string().optional(),      // = best attempt's message (if any)
  metrics: evalMetricsSchema.optional(),     // = best attempt's metrics (if any)
  feedback: z.string().optional(),           // = metaEvaluation.reasoning
});

export type EvalResult = z.infer<typeof evalResultSchema>;
```

**Backward compatibility strategy:**
- `overallScore` set to `metaEvaluation.finalScore`
- `commitMessage` set to highest-scoring successful attempt
- `metrics` set to highest-scoring successful attempt's metrics
- `feedback` set to meta-evaluation reasoning

This allows existing comparison logic to work without changes.

## Component Design

### 1. AttemptRunner (`src/eval/attempt-runner.ts`)

**Responsibilities:**
- Orchestrate 3 generations per agent
- Catch and categorize errors per attempt
- Return all outcomes (no short-circuit on failure)

**Key Methods:**

```typescript
export class AttemptRunner {
  private readonly evaluator: Evaluator;

  constructor(evaluator?: Evaluator) {
    this.evaluator = evaluator ?? new Evaluator();
  }

  /**
   * Run 3 generation attempts for one agent on one fixture
   *
   * @param fixture - The test fixture with git changeset
   * @param agent - Which agent to test ('claude' or 'codex')
   * @param workdir - Working directory for git operations
   * @returns Array of 3 outcomes (success or failure)
   */
  async runAttempts(
    fixture: EvalFixture,
    agent: 'claude' | 'codex',
    workdir: string
  ): Promise<AttemptOutcome[]> {
    const outcomes: AttemptOutcome[] = [];

    // Create generator for this agent
    const generator = new CommitMessageGenerator({
      agent,
      enableAI: true,
    });

    // Create minimal task from fixture
    const task = {
      title: `Evaluate ${fixture.name}`,
      description: fixture.description,
      produces: [],
    };

    // Run 3 attempts sequentially
    for (let i = 1; i <= 3; i++) {
      try {
        console.log(`[${agent}] Attempt ${i}/3...`);

        // Step 1: Generate commit message
        const message = await generator.generateCommitMessage(task, { workdir });

        // Validate message was generated
        if (!hasContent(message)) {
          throw new Error('Generator returned empty message');
        }

        // Step 2: Evaluate with ChatGPT
        const evaluation = await this.evaluator.evaluate(
          message,
          fixture.gitStatus,
          fixture.gitDiff,
          fixture.name,
          agent
        );

        // Success!
        console.log(`[${agent}] Attempt ${i}/3... ✅ Score: ${evaluation.overallScore.toFixed(1)}`);

        outcomes.push({
          status: 'success',
          attemptNumber: i,
          commitMessage: message,
          metrics: evaluation.metrics,
          overallScore: evaluation.overallScore,
        });

      } catch (error) {
        // Categorize the failure
        const { failureType, failureReason } = this.categorizeError(error);

        console.log(`[${agent}] Attempt ${i}/3... ❌ ${failureType}`);

        outcomes.push({
          status: 'failure',
          attemptNumber: i,
          failureType,
          failureReason,
        });
      }
    }

    return outcomes;
  }

  /**
   * Categorize errors into failure types for debugging
   */
  private categorizeError(error: unknown): {
    failureType: 'cleaning' | 'validation' | 'generation' | 'api_error';
    failureReason: string;
  } {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check error patterns
    if (errorMessage.includes('Invalid conventional commit format')) {
      return { failureType: 'validation', failureReason: errorMessage };
    }

    if (errorMessage.includes('ENOENT') || errorMessage.includes('not found')) {
      return { failureType: 'generation', failureReason: errorMessage };
    }

    if (errorMessage.includes('API') || errorMessage.includes('OpenAI')) {
      return { failureType: 'api_error', failureReason: errorMessage };
    }

    // Default to cleaning issue (likely thinking artifacts)
    return { failureType: 'cleaning', failureReason: errorMessage };
  }
}
```

**Error Categorization Logic:**
- `validation` - Message doesn't match conventional commit pattern
- `generation` - Agent CLI failed (command not found, timeout, etc.)
- `api_error` - ChatGPT evaluation API failed
- `cleaning` - Default (likely thinking/COT artifacts remain)

### 2. MetaEvaluator (`src/eval/meta-evaluator.ts`)

**Responsibilities:**
- Evaluate all 3 attempts together using ChatGPT
- Calculate consistency, error rate impact, final score
- Provide reasoning even if all attempts failed

**Key Methods:**

```typescript
export class MetaEvaluator {
  /**
   * Evaluate all 3 attempts together
   *
   * Uses ChatGPT to assess:
   * - Consistency across successful attempts
   * - Impact of error rate on reliability
   * - Best vs average performance
   * - Type of failures
   *
   * @param attempts - Array of 3 outcomes (success or failure)
   * @param agent - Which agent produced these attempts
   * @param fixture - The fixture context (for reference)
   * @returns MetaEvaluation with final score and reasoning
   */
  async evaluateAttempts(
    attempts: AttemptOutcome[],
    agent: 'claude' | 'codex',
    fixture: EvalFixture
  ): Promise<MetaEvaluation> {
    // Build comprehensive prompt
    const prompt = this.buildMetaPrompt(attempts, agent, fixture);

    // Define structured output schema
    const schema = z.object({
      finalScore: z.number().min(0).max(10),
      consistencyScore: z.number().min(0).max(10),
      errorRateImpact: z.number().min(0).max(10),
      reasoning: z.string().min(50),
    });

    // Create GPT agent with evaluation instructions
    const gptAgent = new Agent({
      name: 'meta-evaluator',
      model: 'gpt-5',
      outputType: schema,
      instructions: `You are evaluating the reliability and consistency of an AI commit message generator across 3 attempts.

Scoring Dimensions:

1. Consistency Score (0-10):
   - 10: All successful attempts have similar quality (scores within 0.5 points)
   - 7: Moderate variance (scores within 1.5 points)
   - 3: High variance (one excellent, one poor)
   - 0: Cannot assess (0 or 1 successful attempts)

2. Error Rate Impact (0-10):
   - 10: 3/3 attempts successful
   - 7: 2/3 attempts successful
   - 3: 1/3 attempts successful
   - 0: 0/3 attempts successful

3. Final Score (0-10):
   Holistic assessment considering:
   - Quality of successful attempts (average of individual scores)
   - Consistency (penalize high variance)
   - Reliability (penalize failures, especially cleaning/validation failures)
   - Type of failures (cleaning/validation worse than API errors)

   Formula guidance:
   - If 3/3 success + consistent: finalScore ≈ average of 3 scores
   - If 2/3 success: finalScore ≈ average minus 1-2 points
   - If 1/3 success: finalScore ≈ 3-5 (very unreliable)
   - If 0/3 success: finalScore = 0 (but provide reasoning on failure patterns)

Reasoning:
Explain your scores in 2-3 sentences. Address:
- Quality and consistency of successful attempts
- Impact of failures (how many, what types)
- Overall assessment of agent reliability`,
    });

    // Call GPT
    const result = await run(gptAgent, prompt);

    // Validate structured output
    const parsed = schema.safeParse(result.finalOutput);
    if (!parsed.success) {
      throw EvaluationError.evaluationFailed(
        `Meta-evaluation produced invalid output: ${parsed.error.message}`
      );
    }

    // Calculate success rate
    const successCount = attempts.filter(a => a.status === 'success').length;
    const successRate = successCount / 3;

    return {
      ...parsed.data,
      successRate,
    };
  }

  /**
   * Build prompt for meta-evaluation
   */
  private buildMetaPrompt(
    attempts: AttemptOutcome[],
    agent: 'claude' | 'codex',
    fixture: EvalFixture
  ): string {
    let prompt = `Evaluate ${agent}'s performance across 3 attempts on fixture: ${fixture.name}\n\n`;
    prompt += `Expected type: ${fixture.expectedType}\n\n`;

    // Add each attempt
    for (const attempt of attempts) {
      prompt += `--- Attempt ${attempt.attemptNumber} ---\n`;

      if (attempt.status === 'success') {
        prompt += `Status: ✅ Success\n`;
        prompt += `Commit Message:\n${attempt.commitMessage}\n\n`;
        prompt += `Scores:\n`;
        prompt += `  Conventional Compliance: ${attempt.metrics.conventionalCompliance}\n`;
        prompt += `  Clarity: ${attempt.metrics.clarity}\n`;
        prompt += `  Accuracy: ${attempt.metrics.accuracy}\n`;
        prompt += `  Detail Level: ${attempt.metrics.detailLevel}\n`;
        prompt += `  Overall: ${attempt.overallScore.toFixed(2)}\n\n`;
      } else {
        prompt += `Status: ❌ Failure\n`;
        prompt += `Type: ${attempt.failureType}\n`;
        prompt += `Reason: ${attempt.failureReason}\n\n`;
      }
    }

    // Add fixture context
    prompt += `\n--- Fixture Context ---\n`;
    prompt += `Git Status:\n${fixture.gitStatus}\n\n`;
    prompt += `Git Diff:\n${fixture.gitDiff.substring(0, 500)}...\n\n`;

    return prompt;
  }
}
```

**GPT Evaluation Philosophy:**
- Even 0/3 successes gets evaluated (GPT explains failure patterns)
- Failures penalize final score (2/3 success ≠ average of 2 scores)
- Consistency matters (3 varying scores worse than 3 similar scores)
- Failure type matters (cleaning/validation worse than API timeout)

### 3. Modified EvalRunner (`src/eval/runner.ts`)

**Changes:**
- Inject `AttemptRunner` and `MetaEvaluator` as dependencies
- `runFixture()` orchestrates attempts → meta-evaluation
- Populate backward-compatible fields from best attempt
- Use `finalScore` for winner comparison

**Updated Method:**

```typescript
async runFixture(
  fixture: EvalFixture,
  agent?: 'claude' | 'codex',
  workdir: string = process.cwd()
): Promise<EvalComparison> {
  console.log(`[Runner] Starting evaluation for fixture: ${fixture.name}`);

  const runClaude = !agent || agent === 'claude';
  const runCodex = !agent || agent === 'codex';

  let claudeResult: EvalResult | undefined;
  let codexResult: EvalResult | undefined;

  // Run Claude (3 attempts + meta-evaluation)
  if (runClaude) {
    const attempts = await this.attemptRunner.runAttempts(fixture, 'claude', workdir);
    console.log('[Claude] Meta-evaluation...');
    const metaEval = await this.metaEvaluator.evaluateAttempts(attempts, 'claude', fixture);
    console.log(`[Claude] Final: ${metaEval.finalScore.toFixed(1)}/10 (Success rate: ${(metaEval.successRate * 100).toFixed(1)}%)`);

    claudeResult = {
      agent: 'claude',
      fixture: fixture.name,
      timestamp: new Date().toISOString(),
      attempts,
      metaEvaluation: metaEval,
      // Backward compatibility
      overallScore: metaEval.finalScore,
      commitMessage: this.getBestAttempt(attempts)?.commitMessage,
      metrics: this.getBestAttempt(attempts)?.metrics,
      feedback: metaEval.reasoning,
    };
  }

  // Run Codex (same pattern)
  if (runCodex) {
    const attempts = await this.attemptRunner.runAttempts(fixture, 'codex', workdir);
    console.log('[Codex] Meta-evaluation...');
    const metaEval = await this.metaEvaluator.evaluateAttempts(attempts, 'codex', fixture);
    console.log(`[Codex] Final: ${metaEval.finalScore.toFixed(1)}/10 (Success rate: ${(metaEval.successRate * 100).toFixed(1)}%)`);

    codexResult = {
      agent: 'codex',
      fixture: fixture.name,
      timestamp: new Date().toISOString(),
      attempts,
      metaEvaluation: metaEval,
      // Backward compatibility
      overallScore: metaEval.finalScore,
      commitMessage: this.getBestAttempt(attempts)?.commitMessage,
      metrics: this.getBestAttempt(attempts)?.metrics,
      feedback: metaEval.reasoning,
    };
  }

  // Compare using finalScore
  let scoreDiff: number;
  let winner: 'claude' | 'codex' | 'tie' | undefined;

  if (claudeResult && codexResult) {
    scoreDiff = claudeResult.metaEvaluation.finalScore - codexResult.metaEvaluation.finalScore;
    winner = Math.abs(scoreDiff) < 0.5 ? 'tie' : scoreDiff > 0 ? 'claude' : 'codex';
  } else {
    scoreDiff = 0;
    winner = undefined;
  }

  return {
    claudeResult,
    codexResult,
    fixture: fixture.name,
    scoreDiff,
    winner,
  };
}

/**
 * Get the best successful attempt (for backward compatibility)
 */
private getBestAttempt(attempts: AttemptOutcome[]): SuccessOutcome | undefined {
  const successes = attempts.filter(
    (a): a is SuccessOutcome => a.status === 'success'
  );

  if (successes.length === 0) {
    return undefined;
  }

  return successes.reduce((best, current) =>
    current.overallScore > best.overallScore ? current : best
  );
}
```

### 4. Updated EvalReporter (`src/eval/reporter.ts`)

**New Markdown Sections:**

```markdown
## Fixture: simple-bugfix

### Claude Results
- **Success Rate:** 2/3 (66.7%)
- **Final Score:** 7.8/10
- **Consistency:** 7.5/10
- **Error Impact:** 7.0/10

**Attempts:**
1. ✅ 8.5/10 - `feat: add null safety check to parser`
2. ❌ Validation failure - "Invalid conventional commit format"
3. ✅ 8.0/10 - `fix: add null safety to parser module`

**Meta-Evaluation:**
High quality when successful, but inconsistent reliability. One validation failure indicates occasional problems with conventional commit format adherence.

---

### Codex Results
- **Success Rate:** 3/3 (100%)
- **Final Score:** 7.9/10
- **Consistency:** 9.2/10
- **Error Impact:** 10.0/10

**Attempts:**
1. ✅ 7.5/10 - `fix: add null check in parser`
2. ✅ 8.0/10 - `fix: add null safety to parser`
3. ✅ 8.0/10 - `fix: improve parser null handling`

**Meta-Evaluation:**
Consistent quality across all attempts. Reliable output with minimal variance. All messages properly formatted and accurate.

---

### Winner: Codex (+0.1)
Codex wins due to perfect reliability despite slightly lower average quality on individual attempts.
```

**CLI Output Format:**

```
$ bun run eval:fixture simple

🧪 Commitment Evaluation System
Mode: mocked
Agents: claude vs codex
Fixture: simple

[Runner] Starting evaluation for fixture: simple

[claude] Attempt 1/3... ✅ Score: 8.5
[claude] Attempt 2/3... ❌ validation
[claude] Attempt 3/3... ✅ Score: 8.0
[Claude] Meta-evaluation... Final: 7.8/10 (Success rate: 66.7%)

[codex] Attempt 1/3... ✅ Score: 7.5
[codex] Attempt 2/3... ✅ Score: 8.0
[codex] Attempt 3/3... ✅ Score: 8.0
[Codex] Meta-evaluation... Final: 7.9/10 (Success rate: 100%)

✅ Complete
Winner: Codex
Score diff: +0.1
Results: ./.eval-results/latest-simple.json
```

## Implementation Plan

### Phase 1: Schema Changes
1. Add `attemptOutcomeSchema` to `src/eval/schemas.ts`
2. Add `metaEvaluationSchema` to `src/eval/schemas.ts`
3. Extend `evalResultSchema` with `attempts` and `metaEvaluation` fields
4. Export type helpers and validation functions

### Phase 2: AttemptRunner
1. Create `src/eval/attempt-runner.ts`
2. Implement `runAttempts()` method (3 generation loop)
3. Implement `categorizeError()` method (failure classification)
4. Add unit tests for error categorization

### Phase 3: MetaEvaluator
1. Create `src/eval/meta-evaluator.ts`
2. Implement `evaluateAttempts()` method (GPT agent call)
3. Implement `buildMetaPrompt()` method (format all attempts)
4. Add unit tests with mocked GPT responses

### Phase 4: Runner Integration
1. Update `EvalRunner` to use `AttemptRunner` and `MetaEvaluator`
2. Modify `runFixture()` to orchestrate 3 attempts + meta-evaluation
3. Add `getBestAttempt()` helper for backward compatibility
4. Update console output to show per-attempt progress

### Phase 5: Reporter Updates
1. Modify `storeMarkdownReport()` to show attempt-level detail
2. Update CLI output formatting in `run-eval.ts`
3. Add success rate to summary statistics
4. Update baseline comparison to use `finalScore`

### Phase 6: Testing & Validation
1. Run eval system with multi-attempt on existing fixtures
2. Collect failure examples (thinking artifacts, validation errors)
3. Analyze failure patterns to inform cleaning improvements
4. Verify backward compatibility (existing comparison logic works)

## Success Criteria

1. **Reliability Measurement**
   - Success rate tracked per agent per fixture
   - Can distinguish 3/3 success vs 2/3 success vs 1/3 success

2. **Error Visibility**
   - Each failure categorized (cleaning, validation, generation, api_error)
   - Failure reasons captured for debugging
   - Report shows which attempts failed and why

3. **Meta-Evaluation Quality**
   - GPT provides final score accounting for consistency + error rate
   - Reasoning explains why agent scored X given Y successes and Z failures
   - Works even with 0/3 successes (explains failure patterns)

4. **Backward Compatibility**
   - Existing `EvalComparison` logic uses `finalScore` seamlessly
   - Best attempt's message/metrics available for inspection
   - Reports can be compared across old/new format

5. **Data Collection**
   - After first run, have real failure examples to improve cleaning
   - Can measure impact of cleaning improvements (failure rate before/after)

## Future Enhancements

1. **Adaptive Cleaning** - Use failure examples to improve `cleanAIResponse()` patterns
2. **Parallel Generation** - Generate 3 attempts concurrently (requires rate limit handling)
3. **Configurable Attempts** - Allow 1, 3, 5, or 10 attempts via CLI flag
4. **Statistical Analysis** - Calculate confidence intervals, standard deviation
5. **Regression Detection** - Alert when success rate drops significantly from baseline

## Risks & Mitigations

### Risk: 3x API calls = 3x cost
**Mitigation:** Eval system is not run frequently (only when benchmarking). Cost acceptable for better data.

### Risk: GPT meta-evaluation may be inconsistent
**Mitigation:** Use structured output (Zod schema) to enforce consistency. Run meta-eval multiple times if needed.

### Risk: Backward incompatibility breaks existing tools
**Mitigation:** Preserve `overallScore`, `commitMessage`, `metrics` fields. Existing code works unchanged.

### Risk: Error categorization may misclassify
**Mitigation:** Start with simple heuristics, iterate based on real data. Log misclassifications for improvement.

## Open Questions

1. **Should we cache meta-evaluations?** - If re-running same fixture, could reuse GPT analysis
2. **Should attempt order matter?** - Currently treat attempts as independent, but could track improvement/degradation
3. **Should we support mixed modes?** - E.g., run Claude 3x but Codex 1x (for cost reasons)

## Approval

This design has been validated through incremental presentation with user confirmation at each section.

- ✅ Architecture (3-layer design)
- ✅ Schema (AttemptOutcome, MetaEvaluation, extended EvalResult)
- ✅ AttemptRunner (3x generation with error categorization)
- ✅ MetaEvaluator (GPT-based consistency + reliability scoring)
- ✅ EvalRunner integration (orchestration + backward compatibility)
- ✅ Reporter output (markdown + CLI formatting)

**Ready for implementation.**
