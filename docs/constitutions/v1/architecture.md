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
└─────────────┬───────────────────────────┘
              │ validated config + options
              ▼
┌─────────────────────────────────────────┐
│          Generator Layer                │  ← Business logic
│  • Commit message generation            │
│  • AI vs fallback decision              │
│  • Task orchestration                   │
└─────────────┬───────────────────────────┘
              │ prompts + options
              ▼
┌─────────────────────────────────────────┐
│          Provider Layer                 │  ← AI integration
│  • Provider abstraction                 │
│  • Fallback chain support               │
│  • Response parsing                     │
└─────────────┬───────────────────────────┘
              │ CLI commands / API calls
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
- ✅ Generator → Provider ← allowed
- ✅ Provider → External ← allowed
- ❌ Generator → CLI ← FORBIDDEN
- ❌ Provider → Generator ← FORBIDDEN
- ❌ External → Provider ← N/A (external systems don't import our code)

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

**Forbidden:**
- Direct provider instantiation (use generator)
- Business logic (delegate to generator)
- Prompt construction (delegate to generator)

**Dependencies:**
- Generator (to create commit messages)
- Provider types (for configuration)
- Validation schemas (for option validation)

### Generator Module (`src/generator.ts`)

**Responsibility:** Coordinate commit message generation with AI or fallback.

**Allowed:**
- Instantiate providers
- Decide AI vs fallback
- Construct prompts
- Parse git output
- Orchestrate generation flow

**Forbidden:**
- CLI-specific logic (exit codes, formatting)
- Provider implementation details (use provider interface)
- Direct external command execution (use providers or utilities)

**Dependencies:**
- Provider abstractions
- Validation schemas
- Git utilities
- Type guards

### Provider Module (`src/providers/`)

**Responsibility:** Abstract AI provider implementations and manage fallback.

**Allowed:**
- Execute AI commands
- Parse AI responses
- Handle provider-specific errors
- Implement fallback chain logic

**Forbidden:**
- Business logic (message generation logic)
- CLI concerns (argument parsing)
- Git operations (delegate to utilities)

**Sub-components:**
- `types.ts` - Provider type definitions and schemas
- `provider-factory.ts` - Provider instantiation
- `provider-chain.ts` - Fallback chain management
- `auto-detect.ts` - Provider availability detection
- `base/` - Base classes for providers
- `implementations/` - Concrete provider classes
- `utils/` - Provider-specific utilities

### Types Module (`src/types/`)

**Responsibility:** Centralize core domain types and schemas.

**Allowed:**
- Zod schema definitions
- Type inference from schemas
- Validation helper functions
- Type exports

**Forbidden:**
- Business logic
- Provider-specific types (those go in `src/providers/types.ts`)
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
│   └── schemas.ts
├── providers/
│   ├── __tests__/           ← Provider core tests
│   │   └── provider-chain.test.ts
│   ├── implementations/
│   │   ├── __tests__/       ← Implementation tests
│   │   │   └── claude-provider.test.ts
│   │   └── claude-provider.ts
```

**Violation breaks architecture:** Tests far from source become stale and decrease discoverability.

### Integration Tests

**Location:** `src/__tests__/integration/`

Integration tests that span multiple layers belong in the top-level integration directory.

### Barrel Exports

**Mandatory:** Each module MUST have an `index.ts` for clean public API.

```typescript
// src/providers/index.ts
export { ClaudeProvider } from './implementations/claude-provider.js';
export { CodexProvider } from './implementations/codex-provider.js';
export type { ProviderConfig, CLIProviderConfig } from './types.js';
```

**Violation breaks architecture:** Direct imports from implementation files expose internal structure.

## Cross-Cutting Concerns

### Validation

**Boundary Rule:** Validate data at system boundaries using Zod schemas.

**Validation Points:**
1. CLI options → validated before generator
2. Generator config → validated in constructor
3. Provider config → validated in factory
4. Git output → validated before use
5. External responses → validated before return

**Never validate internal data:** Once validated, trust the types.

### Error Handling

**Layer-Specific Errors:**
- CLI: User-friendly messages, exit codes
- Generator: Domain errors (GeneratorError)
- Provider: Provider errors (ProviderError, ProviderNotAvailableError)
- Utils: Validation errors (ZodError)

**Error Flow:** Lower layer errors bubble up, upper layers format for audience.

### Logging

**Logger Injection:** Generator accepts optional logger for warnings.

```typescript
const generator = new CommitMessageGenerator({
  logger: { warn: (msg) => console.warn(msg) }
});
```

**No console.log in libraries:** Only CLI may use console directly.

## Extension Points

### Adding a New Provider

1. Implement in `src/providers/implementations/`
2. Extend `BaseCLIProvider` or `BaseAPIProvider`
3. Update factory in `src/providers/provider-factory.ts`
4. Update auto-detect in `src/providers/auto-detect.ts`
5. Add to provider enum in `src/providers/types.ts`

**Architecture preserved:** Provider interface unchanged, no changes to generator or CLI.

### Adding a New CLI Command

1. Create module in `src/cli/commands/`
2. Export from `src/cli/commands/index.ts`
3. Call from `src/cli.ts` main()

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
  callProvider() { /* ... */ }
  formatForUser() { /* ... */ }
}
// ❌ Too many responsibilities
```

### ❌ Leaky Abstractions

**Never:**
```typescript
// generator.ts exposing provider details
if (provider.command === 'claude') {  // ❌ Generator shouldn't know provider internals
  // ...
}
```

**Instead:**
```typescript
if (await provider.isAvailable()) {  // ✅ Use provider interface
  // ...
}
```

## Testing Architecture

**Unit Tests:** Test each layer in isolation with mocked dependencies.

**Integration Tests:** Test layer interactions with real dependencies.

**E2E Tests:** Test full CLI → Generator → Provider flow.

See `testing.md` for detailed requirements.
