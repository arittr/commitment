# Architecture

## Core Principle

**commitment follows a layered architecture with strict boundaries and dependency flow.**

Violating these boundaries breaks the architecture and makes the system unmaintainable.

## Architectural Layers

```
┌─────────────────────────────────────────┐
│              CLI Layer                  │  ← User interface
│  • Command parsing & validation         │
│  • Option handling                      │
│  • Error formatting for users           │
│  • Init command (hook installation)     │
└─────────────┬───────────────────────────┘
              │ validated config + options
              ▼
┌─────────────────────────────────────────┐
│          Generator Layer                │  ← Business logic
│  • Commit message generation            │
│  • AI vs fallback decision              │
│  • Task orchestration                   │
└─────────────┬───────────────────────────┘
              │ prompts + workdir
              ▼
┌─────────────────────────────────────────┐
│            Agent Layer                  │  ← AI integration
│  • Template pattern (BaseAgent)         │
│  • Agent-specific execution logic       │
│  • Shared utilities (pure functions)    │
└─────────────┬───────────────────────────┘
              │ CLI commands
              ▼
┌─────────────────────────────────────────┐
│         External Systems                │  ← External dependencies
│  • Claude CLI / Codex CLI               │
│  • Git commands                         │
│  • File system                          │
└─────────────────────────────────────────┘
```

## Dependency Rules

**Mandatory:** Dependencies flow DOWNWARD only.

- ✅ CLI → Generator ← allowed
- ✅ Generator → Agent ← allowed
- ✅ Agent → External ← allowed
- ❌ Generator → CLI ← FORBIDDEN
- ❌ Agent → Generator ← FORBIDDEN
- ❌ External → Agent ← N/A (external systems don't import our code)

**Violation breaks architecture:** If lower layers depend on upper layers, the system becomes tightly coupled and untestable.

## Module Boundaries

### CLI Module (`src/cli/`)

**Responsibility:** Handle user interaction and command-line interface.

**Allowed:**
- Parse commander options
- Validate CLI arguments
- Format errors for users
- Call generator with validated config
- Handle process exit codes
- Install git hooks (init command)

**Forbidden:**
- Direct agent instantiation (use generator)
- Business logic (delegate to generator)
- Prompt construction (delegate to generator)

**Dependencies:**
- Generator (to create commit messages)
- Agent types (for configuration)
- Validation schemas (for option validation)

**Sub-components:**
- `cli.ts` - Main CLI entry point with commands (~150 LOC)
- `helpers.ts` - Display and execution helpers (~80 LOC)
- `schemas.ts` - CLI option validation
- `commands/init.ts` - Hook installation command
- `commands/index.ts` - Command exports

### Generator Module (`src/generator.ts`)

**Responsibility:** Coordinate commit message generation with AI or fallback.

**Allowed:**
- Instantiate agents via factory (simple pattern)
- Decide AI vs fallback
- Construct prompts
- Parse git output
- Orchestrate generation flow

**Forbidden:**
- CLI-specific logic (exit codes, formatting)
- Agent implementation details (use agent interface)
- Direct external command execution (use agents or utilities)

**Dependencies:**
- Agent abstractions
- Validation schemas
- Git utilities
- Type guards

**Simplification from v1:**
- No provider chains - just one agent at a time
- No auto-detection - explicit `--agent` flag
- Simple factory for agent instantiation (replaces v2's if/else, v1's complex factory)

### Agent Module (`src/agents/`)

**Responsibility:** Execute AI CLI commands and parse responses.

**Allowed:**
- Extend BaseAgent (simple template pattern)
- Execute AI commands (agent-specific logic)
- Override cleanResponse() or validateResponse() if needed
- Use pure utility functions from agent-utils
- Handle agent-specific errors
- Check CLI availability
- Simple factories (see "Simple Factories" section below)

**Forbidden:**
- Business logic (message generation logic)
- CLI concerns (argument parsing)
- Git operations (delegate to utilities)
- Complex inheritance (>3 extension points)
- Complex factories (chains, auto-detection, state)

**Sub-components:**
- `types.ts` - Agent interface and type definitions
- `base-agent.ts` - Abstract base class with template pattern (~80 LOC)
- `agent-utils.ts` - Pure utility functions (~100 LOC)
- `factory.ts` - Simple agent factory with ts-pattern (~30 LOC)
- `claude.ts` - Claude agent implementation (~40 LOC)
- `codex.ts` - Codex agent implementation (~60 LOC)
- `gemini.ts` - Gemini agent implementation (~50 LOC)
- `index.ts` - Agent exports

**Evolution in v3:**
- ✅ Simple base class allowed (BaseAgent with ≤3 extension points)
- ✅ Pure utility functions allowed (stateless helpers in agent-utils)
- ✅ Template method pattern for standard flow
- ✅ Simple factories allowed (single responsibility, pure function, exhaustiveness checking)
- ❌ Still banned: complex factories, provider chains, complex inheritance
- **Why**: Eliminates 70% duplication while keeping agents readable (~40-60 LOC each)

**Preserved from v2:**
- No complex factories (v1's `provider-factory.ts` pattern)
- No provider chains
- No auto-detection
- Agent interface unchanged: `{ name, generate() }`

**Evolution from v2:**
- v2: if/else for agent selection
- v3: Simple factory with ts-pattern for type-safe exhaustiveness

### Types Module (`src/types/`)

**Responsibility:** Centralize core domain types and schemas.

**Allowed:**
- Zod schema definitions
- Type inference from schemas
- Validation helper functions
- Type exports

**Forbidden:**
- Business logic
- Agent-specific types (those go in `src/agents/types.ts`)
- CLI-specific types (those go in `src/cli/schemas.ts`)

### Utils Module (`src/utils/`)

**Responsibility:** Shared utilities used across layers.

**Allowed:**
- Type guards
- Git output parsing
- Schema validation helpers
- Pure functions

**Forbidden:**
- Layer-specific logic
- Stateful operations
- Direct external dependencies (except for parsing)

**Sub-components:**
- `guards.ts` - Type guard utilities
- `git-schemas.ts` - Git output validation

## File Organization Rules

### Co-located Tests

**Mandatory:** Unit tests MUST be co-located with source files in `__tests__/` directories.

```
src/
├── cli/
│   ├── __tests__/           ← CLI tests
│   │   └── schemas.test.ts
│   ├── commands/
│   │   ├── __tests__/       ← Command tests
│   │   │   └── init.test.ts
│   │   └── init.ts
│   └── schemas.ts
├── agents/
│   ├── __tests__/           ← Agent tests
│   │   ├── claude.test.ts
│   │   └── codex.test.ts
│   ├── claude.ts
│   └── codex.ts
```

**Violation breaks architecture:** Tests far from source become stale and decrease discoverability.

### Integration Tests

**Location:** `src/__tests__/integration/`

Integration tests that span multiple layers belong in the top-level integration directory.

### Barrel Exports

**Mandatory:** Each module MUST have an `index.ts` for clean public API.

```typescript
// src/agents/index.ts
export { ClaudeAgent } from './claude.js';
export { CodexAgent } from './codex.js';
export type { Agent, AgentName } from './types.js';
```

**Violation breaks architecture:** Direct imports from implementation files expose internal structure.

## Cross-Cutting Concerns

### Validation

**Boundary Rule:** Validate data at system boundaries using Zod schemas.

**Validation Points:**
1. CLI options → validated before generator
2. Generator config → validated in constructor
3. Git output → validated before use
4. External responses → validated before return

**Never validate internal data:** Once validated, trust the types.

**Simplification from v1:** No provider config validation (no provider chains).

### Error Handling

**Layer-Specific Errors:**
- CLI: User-friendly messages, exit codes
- Generator: Domain errors (GeneratorError)
- Agent: Agent errors (AgentError - consolidated from v1's ProviderError, ProviderNotAvailableError, etc.)
- Utils: Validation errors (ZodError)

**Error Flow:** Lower layer errors bubble up, upper layers format for audience.

**Error Consolidation from v1:**
- v1: ProviderError, ProviderNotAvailableError, ProviderTimeoutError, etc.
- v2: AgentError with static factory methods (cliNotFound, executionFailed, malformedResponse)

### Logging

**Logger Injection:** Generator accepts optional logger for warnings.

```typescript
const generator = new CommitMessageGenerator({
  logger: { warn: (msg) => console.warn(msg) }
});
```

**No console.log in libraries:** Only CLI may use console directly.

**Simplification from v1:** No ora spinner dependency, use simple chalk formatting.

## Extension Points

### Adding a New Agent

1. Create agent class in `src/agents/<agent-name>.ts`
2. Extend `BaseAgent` abstract class
3. Implement `executeCommand()` extension point
4. Override `cleanResponse()` or `validateResponse()` if needed (optional)
5. Add to `AgentName` type in `src/agents/types.ts`
6. Update factory in `src/agents/factory.ts` (add new `.with()` case)
7. Export from `src/agents/index.ts`
8. Add tests in `src/agents/__tests__/<agent-name>.test.ts`

**Example:**
```typescript
// src/agents/my-agent.ts
import { execa } from 'execa';
import { BaseAgent } from './base-agent.js';
import { AgentError } from '../errors.js';

export class MyAgent extends BaseAgent {
  readonly name = 'my-cli';

  protected async executeCommand(prompt: string, workdir: string): Promise<string> {
    const result = await execa('my-cli', ['--prompt', prompt], {
      cwd: workdir,
      timeout: 120_000,
    });
    return result.stdout;
  }

  // Optional: Override cleanResponse if agent has specific artifacts
  // protected cleanResponse(output: string): string {
  //   let cleaned = super.cleanResponse(output);
  //   cleaned = cleaned.replace(/\[MY-CLI\]/g, '');
  //   return cleaned;
  // }
}
```

**Architecture preserved:** Agent interface unchanged, minimal changes to factory.

**v3 Pattern:**
- ✅ Extend BaseAgent (simple template pattern)
- ✅ Implement only executeCommand() (~20-40 LOC)
- ✅ Inherit availability check, cleaning, validation, error handling
- ✅ Override cleanResponse/validateResponse only if needed
- ✅ Update factory with new `.with()` case (type-safe exhaustiveness)
- ❌ No complex factories, no chains, no complex inheritance

### Adding a New CLI Command

1. Create module in `src/cli/commands/<command-name>.ts`
2. Export from `src/cli/commands/index.ts`
3. Register in `src/cli.ts` with `.command()` and `.action()`

**Example:**
```typescript
// src/cli/commands/status.ts
export async function statusCommand(options: { cwd: string }): Promise<void> {
  // Command implementation
}

// src/cli.ts
program
  .command('status')
  .description('Show commitment status')
  .option('--cwd <path>', 'Working directory', process.cwd())
  .action(statusCommand);
```

**Architecture preserved:** Commands are isolated, testable modules.

## Simple Factories

**commitment allows simple factories that meet three criteria.**

### The Three Criteria

A factory is allowed if and only if it meets ALL three:

1. **Single responsibility** - Only instantiation based on discriminator (like AgentName). No chains, no auto-detection, no complex decision trees, no configuration transformation
2. **Pure function** - No state, no side effects. Takes discriminator and optional config, returns instance
3. **Exhaustiveness checking** - Uses ts-pattern or TypeScript discriminated unions to ensure compile-time errors if a case is missing

### Allowed Pattern

```typescript
// src/agents/factory.ts
import { match } from 'ts-pattern';
import type { Agent, AgentName } from './types';

export function createAgent(name: AgentName): Agent {
  return match(name)
    .with('claude', () => new ClaudeAgent())
    .with('codex', () => new CodexAgent())
    .with('gemini', () => new GeminiAgent())
    .exhaustive(); // ✅ TypeScript error if AgentName updated but case missing
}
```

**Why each criterion matters:**
- Single responsibility → No mixing concerns (instantiation vs configuration vs detection)
- Pure function → Testable, predictable, no hidden state
- Exhaustiveness → Compiler catches missing cases when types evolve

**Reasonable config pass-through is allowed:**
```typescript
export function createAgent(name: AgentName, options?: AgentOptions): Agent {
  return match(name)
    .with('claude', () => new ClaudeAgent(options))
    .with('codex', () => new CodexAgent(options))
    .with('gemini', () => new GeminiAgent(options))
    .exhaustive();
}
// ✅ Just forwarding config to constructors
```

**Complex config logic belongs elsewhere:**
```typescript
// ❌ Validation/transformation in factory
export function createAgent(name: AgentName, rawConfig: unknown): Agent {
  const validated = validateConfig(rawConfig); // ❌ Belongs in caller
  const timeout = calculateTimeout(validated); // ❌ Too much logic
  // ...
}
```

## Anti-Patterns

### ❌ Circular Dependencies

**Never:**
```typescript
// generator.ts
import { formatForUser } from './cli.js';  // ❌ UPWARD dependency
```

### ❌ God Objects

**Never:**
```typescript
class CommitManager {
  parseOptions() { /* ... */ }
  generateMessage() { /* ... */ }
  callAgent() { /* ... */ }
  formatForUser() { /* ... */ }
}
// ❌ Too many responsibilities
```

### ❌ Leaky Abstractions

**Never:**
```typescript
// generator.ts exposing agent details
if (agent.command === 'claude') {  // ❌ Generator shouldn't know agent internals
  // ...
}
```

**Instead:**
```typescript
// Generator uses agent interface
const message = await agent.generate(prompt, workdir);  // ✅ Use agent interface
```

### ❌ Complex Inheritance (v1 anti-pattern - still banned in v3)

**Never:**
```typescript
// v1 pattern - TOO COMPLEX, still banned
abstract class BaseProvider {
  abstract checkAvailability(): Promise<boolean>;
  abstract execute(prompt: string): Promise<string>;
  abstract parseResponse(output: string): string;
  abstract validateResponse(message: string): void;
  abstract cleanResponse(output: string): string;
  abstract handleError(error: Error): void;
  // ❌ Too many extension points (>3), forces complex inheritance
}
```

**v3 allows simple base classes:**
```typescript
// v3 pattern - SIMPLE template, ≤3 extension points
abstract class BaseAgent implements Agent {
  // Template method - standard flow
  async generate(prompt: string, workdir: string): Promise<string> {
    await this.checkAvailability();          // concrete method
    const output = await this.executeCommand(prompt, workdir); // abstract
    const cleaned = this.cleanResponse(output);      // virtual (can override)
    this.validateResponse(cleaned);          // virtual (can override)
    return cleaned;
  }

  // Only 3 extension points:
  protected abstract executeCommand(prompt: string, workdir: string): Promise<string>; // required
  protected cleanResponse(output: string): string { /* default */ }  // optional
  protected validateResponse(message: string): void { /* default */ } // optional
}

// Concrete agents are simple (~40-60 LOC)
export class ClaudeAgent extends BaseAgent {
  readonly name = 'claude';

  protected async executeCommand(prompt: string, workdir: string): Promise<string> {
    const result = await execa('claude', ['--prompt', prompt], { cwd: workdir });
    return result.stdout;
  }
  // Inherits cleanResponse and validateResponse
}
```

**The key distinction**: ≤3 extension points = simple template (allowed in v3). >3 extension points = complex inheritance (still banned).

### ❌ Stateful Utilities (v1 anti-pattern - still banned in v3)

**Never:**
```typescript
// v1 pattern - Stateful utility with side effects, still banned
export class CLIExecutor {
  private lastOutput: string = '';
  private executionCount: number = 0;

  async execute(command: string): Promise<string> {
    this.executionCount++;
    this.lastOutput = await execa(command);
    return this.lastOutput;
  }
}
// ❌ State and side effects make utilities hard to test and reason about
```

**v3 allows pure utility functions:**
```typescript
// v3 pattern - Pure, stateless functions
export function cleanAIResponse(output: string): string {
  // No state, no side effects
  return output.trim().replace(/```[\s\S]*?```/g, '');
}

export function validateConventionalCommit(message: string): boolean {
  // No state, no side effects
  return /^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?:.+/.test(message);
}

export function isCLINotFoundError(error: unknown): boolean {
  // Type guard - pure function
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
```

**The key distinction**: Stateless pure functions (allowed in v3). Stateful utility classes (still banned).

### ❌ Complex Factories (v1 anti-pattern - still banned in v3)

**Never:**
```typescript
// v1 pattern - Factory chains, still banned
class ProviderFactory {
  create(config: ProviderConfig): Provider {
    const primary = this.createPrimary(config);
    const fallback = this.createFallback(config);
    return new ProviderChain([primary, fallback]); // ❌ Chaining logic
  }
}
```

```typescript
// Auto-detection factories - still banned
export function createAgent(config?: AgentConfig): Agent {
  // Detect which CLI is available
  if (await isClaudeAvailable()) return new ClaudeAgent();
  if (await isCodexAvailable()) return new CodexAgent();
  throw new Error('No agent available'); // ❌ Detection logic
}
```

```typescript
// Stateful factories - still banned
class AgentFactory {
  private lastCreated?: Agent; // ❌ State

  create(name: AgentName): Agent {
    this.lastCreated = match(name)... // ❌ Side effect
    return this.lastCreated;
  }
}
```

**v3 allows simple factories:**
```typescript
// v3 pattern - Simple, focused factory
export function createAgent(name: AgentName): Agent {
  return match(name)
    .with('claude', () => new ClaudeAgent())
    .with('codex', () => new CodexAgent())
    .with('gemini', () => new GeminiAgent())
    .exhaustive(); // ✅ Type-safe, single responsibility, pure function
}
```

**The key distinction**: Simple instantiation based on discriminator (allowed in v3). Complex logic, chains, or state (still banned).

## Testing Architecture

**Unit Tests:** Test each layer in isolation with mocked dependencies.

**Integration Tests:** Test layer interactions with real dependencies.

**E2E Tests:** Test full CLI → Generator → Agent flow.

See `testing.md` for detailed requirements.

## Cross-Platform Architecture

### Line Ending Management

**Mandatory:** `.gitattributes` ensures LF line endings for hook scripts.

```gitattributes
# Ensure hook files use LF line endings on all platforms
examples/**/*.sh text eol=lf
.husky/* text eol=lf
*.hook text eol=lf
```

**Why:** Windows CRLF line endings (`\r\n`) break bash scripts. LF (`\n`) works on all platforms.

### Hook Installation Architecture

**Init Command Workflow:**
1. Detect git repository
2. Auto-detect existing hook manager (husky, simple-git-hooks)
3. Install appropriate hooks based on detection or `--hook-manager` flag
4. Configure hooks to check `$2` parameter (preserve user messages)

**Hook Preservation Logic:**
```bash
# Only run for regular commits (not merge, squash, or when message specified)
if [ -z "$2" ]; then
  npx commitment --message-only > "$1"
fi
```

**Why:** `$2` contains commit source:
- Empty → `git commit` (generate message) ✅
- `"message"` → `git commit -m "..."` (preserve) ✅
- `"merge"` → merge commit (preserve) ✅

See `init.ts` for implementation details.
