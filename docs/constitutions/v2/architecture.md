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
│  • Direct CLI execution (inline)        │
│  • Response parsing (inline)            │
│  • No base classes, no factories        │
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
- `cli.ts` - Main CLI entry point with commands (~200 LOC)
- `schemas.ts` - CLI option validation
- `commands/init.ts` - Hook installation command
- `commands/index.ts` - Command exports

### Generator Module (`src/generator.ts`)

**Responsibility:** Coordinate commit message generation with AI or fallback.

**Allowed:**
- Instantiate agents directly (no factory)
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
- Direct agent instantiation with simple if/else

### Agent Module (`src/agents/`)

**Responsibility:** Execute AI CLI commands and parse responses.

**Allowed:**
- Execute AI commands (inline with execa)
- Parse AI responses (inline logic)
- Handle agent-specific errors
- Check CLI availability

**Forbidden:**
- Business logic (message generation logic)
- CLI concerns (argument parsing)
- Git operations (delegate to utilities)
- Sharing logic via base classes (keep agents self-contained)

**Sub-components:**
- `types.ts` - Agent interface and type definitions
- `claude.ts` - Claude agent implementation (~80 LOC)
- `codex.ts` - Codex agent implementation (~80 LOC)
- `index.ts` - Agent exports

**Simplification from v1:**
- No base classes (`BaseCLIProvider`, `BaseAPIProvider`)
- No factories (`provider-factory.ts`)
- No shared utilities (`cli-executor`, `cli-response-parser`)
- Each agent is standalone with all logic inline
- Agent interface is minimal: `{ name, generate() }`

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
2. Implement `Agent` interface with inline logic
3. Add to `AgentName` type in `src/agents/types.ts`
4. Update generator's if/else chain in `generateWithAI()`
5. Export from `src/agents/index.ts`
6. Add tests in `src/agents/__tests__/<agent-name>.test.ts`

**Example:**
```typescript
// src/agents/my-agent.ts
import { execa } from 'execa';
import { AgentError } from '../errors.js';
import type { Agent } from './types.js';

export class MyAgent implements Agent {
  readonly name = 'my-cli';

  async generate(prompt: string, workdir: string): Promise<string> {
    // 1. Check CLI availability
    try {
      await execa('which', ['my-cli']);
    } catch {
      throw AgentError.cliNotFound('my-cli', 'My CLI');
    }

    // 2. Execute CLI
    let result;
    try {
      result = await execa('my-cli', ['--prompt', prompt], {
        cwd: workdir,
        timeout: 120_000,
      });
    } catch (error) {
      throw AgentError.executionFailed(/* ... */);
    }

    // 3. Parse response
    const output = result.stdout.trim();
    if (!output.includes(':')) {
      throw AgentError.malformedResponse('My CLI', output);
    }

    return output;
  }
}
```

**Architecture preserved:** Agent interface unchanged, minimal changes to generator.

**Simplification from v1:**
- No base class to extend
- No factory to update
- No auto-detect to update
- All logic is self-contained (~50-100 LOC per agent)

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

### ❌ Base Class Overuse (v1 anti-pattern)

**Never (in v2):**
```typescript
// v1 pattern - removed in v2
abstract class BaseAgent {
  abstract execute(): Promise<string>;

  async generate() {
    // Shared logic that forces all agents into same shape
  }
}
```

**Instead (v2 pattern):**
```typescript
// Each agent is standalone with inline logic
export class ClaudeAgent implements Agent {
  readonly name = 'claude';

  async generate(prompt: string, workdir: string): Promise<string> {
    // All logic inline - no inheritance, no shared utilities
    // ~80 LOC, self-contained, easy to understand
  }
}
```

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
