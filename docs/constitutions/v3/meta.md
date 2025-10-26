# Constitution Metadata

**Version:** 3
**Created:** 2025-10-22
**Previous Version:** v2

## Summary

Evolution from v2's "no abstraction" to "selective abstraction" philosophy. Allows simple base classes, pure utility functions, and simple factories while maintaining v2's prohibition on complex factories, chains, and complex inheritance. Recognizes that v2's blanket rejection of abstraction was too extreme.

## Rationale

This v3 constitution relaxes v2's strict "no abstraction" rule to allow beneficial patterns while preserving simplicity:

1. **Selective Abstraction Philosophy**: v2 correctly removed v1's over-engineering (complex factories, provider chains, auto-detection), but went too far by banning ALL abstraction. Real-world usage revealed ~70% code duplication across agents. v3 permits **simple** abstraction (base classes with ≤3 extension points, pure utility functions, simple factories) while maintaining v2's prohibition on **complex** abstraction (factory chains, auto-detection, deep inheritance hierarchies).

2. **BaseAgent Pattern**: Agent implementations duplicated ~70% of code (availability checks, response cleaning, validation, error handling). A simple template method pattern with exactly 3 extension points eliminates duplication without reintroducing v1's complexity. Agents remain readable (~40-60 LOC each) with all core logic visible.

3. **Pure Utility Functions**: Shared logic (response cleaning, commit validation, error detection) extracted to stateless, focused functions. These are genuinely reusable helpers, not the complex utility modules v1 had (cli-executor, cli-response-parser with state and side effects).

4. **Simple Factories**: The Gemini agent addition revealed that if/else chains for agent selection were becoming repetitive. A simple factory using ts-pattern provides type-safe exhaustiveness checking (compiler error if AgentName updated but factory not updated) while staying focused on pure instantiation. The three criteria (single responsibility, pure function, exhaustiveness checking) prevent v1's complex factory anti-patterns (chains, auto-detection, state).

5. **Why Now**: The proactive refactor (spec 57d322) and Gemini addition revealed the abstraction sweet spot. v1 had too much (complex factories, chains, complex inheritance). v2 had too little (70% duplication, repetitive if/else). v3 finds the balance: simple templates + pure functions + simple factories, no chains/auto-detection.

6. **Principles Preserved from v2**:
   - ✅ No complex factories (v1's factory chains and auto-detection still banned)
   - ✅ No provider chains (one agent at a time)
   - ✅ No auto-detection (explicit `--agent` flag)
   - ✅ Agents remain readable end-to-end
   - ✅ Simple instantiation, simple configuration

## What Changed from Previous Version

**Abstraction Rules - RELAXED:**

v2 stated:
> - No base classes (`BaseCLIProvider`, `BaseAPIProvider`)
> - No shared utilities (`cli-executor`, `cli-response-parser`)
> - No factories (use if/else for agent selection)
> - Each agent is standalone with all logic inline

v3 allows:
> - ✅ Simple base classes (≤3 extension points, template method pattern)
> - ✅ Pure utility functions (stateless, no side effects)
> - ✅ Simple factories (single responsibility, pure function, exhaustiveness checking)
> - ❌ Still banned: complex factories, provider chains, complex inheritance (>3 extension points)

**New Patterns:**
- Template Method Pattern - BaseAgent with 3 extension points (executeCommand, cleanResponse, validateResponse)
- Pure Utility Functions - agent-utils.ts with stateless helpers
- Simple Factory Pattern - createAgent() with ts-pattern for type-safe exhaustiveness
- CLI Helper Extraction - display/execution helpers for improved testability

**Architecture Updates:**
- `src/agents/base-agent.ts` - Abstract base class (~80 LOC)
- `src/agents/agent-utils.ts` - Pure utility functions (~100 LOC)
- `src/agents/factory.ts` - Simple agent factory (~30 LOC)
- `src/cli/helpers.ts` - CLI display/execution helpers (~80 LOC)
- Agent implementations reduced from ~200+ LOC → ~40-60 LOC each

**What Stayed the Same:**
- Agent interface unchanged
- No complex factories, no chains, no auto-detection
- Agents remain readable end-to-end
- Layer boundaries preserved

**Impact:**
- Code size: ~140 LOC net reduction (400 LOC duplication removed, 260 LOC base + utils added)
- Maintainability: New agent requires ~20-40 LOC (vs ~200+ in v2)
- Backward compatible: All existing tests remain valid

## Migration Guide from v2 to v3

### For Contributors

**Code Changes:**
1. Import `BaseAgent` from `src/agents/base-agent.js`
2. Change agents from `implements Agent` to `extends BaseAgent`
3. Remove `generate()` method (inherited from BaseAgent)
4. Implement `executeCommand()` extension point
5. Override `cleanResponse()` or `validateResponse()` if needed (optional)

**Example Migration:**

```typescript
// v2: Standalone agent with all logic inline
export class ClaudeAgent implements Agent {
  readonly name = 'claude';

  async generate(prompt: string, workdir: string): Promise<string> {
    // Check availability (~10 LOC)
    // Execute CLI (~15 LOC)
    // Clean response (~20 LOC)
    // Validate (~15 LOC)
    // Error handling (~20 LOC)
  }
} // ~80 LOC total

// v3: Extends BaseAgent
export class ClaudeAgent extends BaseAgent {
  readonly name = 'claude';

  protected async executeCommand(prompt: string, workdir: string): Promise<string> {
    const result = await execa('claude', ['--prompt', prompt], {
      cwd: workdir,
      timeout: 120_000
    });
    return result.stdout;
  }
  // Inherits: availability check, cleaning, validation, error handling
} // ~40 LOC total
```

**New Modules:**
- `src/agents/base-agent.ts` - Abstract base class
- `src/agents/agent-utils.ts` - Pure utility functions
- `src/cli/helpers.ts` - CLI display/execution helpers

**Test Updates:**
- Agent tests updated to work with BaseAgent structure
- New tests added for base-agent, agent-utils, cli/helpers
- All existing tests remain valid (Agent interface unchanged)

### For Users

**Breaking Changes:**
- None! CLI interface unchanged
- All existing commands work identically
- Hooks unchanged

**Internal Improvements:**
- Agents more maintainable (less duplication)
- Better error messages (centralized in BaseAgent)
- Improved testability (CLI helpers can be unit tested)

## The Abstraction Spectrum

This version documents the evolution:

**v1 - Over-Abstraction** (2,500+ LOC):
- ❌ Complex factories with chains and auto-detection
- ❌ Provider chains with fallbacks
- ❌ Auto-detection system
- ❌ Complex base classes with many abstract methods
- ❌ Utility modules with state and side effects
- **Problem**: Too complex, hard to understand, over-engineered

**v2 - No Abstraction** (1,500 LOC):
- ✅ Simple if/else instantiation
- ✅ Each agent standalone
- ❌ 70% code duplication across agents
- ❌ 265 LOC CLI file with inline helpers
- **Problem**: Too much duplication, hard to maintain

**v3 - Selective Abstraction** (1,360 LOC - **current**):
- ✅ Simple template base class (≤3 extension points)
- ✅ Pure utility functions (stateless helpers)
- ✅ Simple factory with ts-pattern (type-safe exhaustiveness)
- ✅ Extracted CLI helpers for testability
- ✅ Agents readable at ~40-60 LOC each
- **Solution**: Balance between DRY and simplicity

## Abstraction Decision Matrix

Use this to decide when to abstract in future:

**✅ Good Abstraction (v3 allows):**
- Template method pattern with ≤3 extension points
- Pure utility functions (no state, no side effects)
- Simple factories (single responsibility, pure function, exhaustiveness checking)
- Stateless helper modules for display/formatting
- **Test**: "Does this reduce duplication >50% while keeping code readable?"

**❌ Bad Abstraction (still banned):**
- Complex factories (chains, auto-detection, state)
- Provider/agent chains (use simple fallback)
- Auto-detection systems (use explicit configuration)
- Complex inheritance (>3 extension points)
- Stateful utility modules
- **Test**: "Does this add indirection without significant duplication savings?"

## Related Documents

- CLAUDE.md - Updated to reference v3 constitution
- specs/57d322-proactive-refactor/spec.md - Refactor that prompted v3
- specs/57d322-proactive-refactor/plan.md - Implementation plan for v3 patterns

## Notes for Future Versions

When creating v4, consider:
- API-based agents (OpenAI, Gemini) - may need APIAgent base class
- Configuration file support (`commitment.config.js`)
- Plugin system - carefully evaluate abstraction level
- Workspace/monorepo support

**Remember**: The abstraction spectrum is v1 (too much) ← v2 (too little) → v3 (just right). Future versions should stay in v3's zone.
