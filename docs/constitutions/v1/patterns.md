# Mandatory Patterns

## Core Principle

**These patterns are non-negotiable. Violating them breaks the architecture.**

If you find yourself needing to violate a pattern, you must either:
1. Refactor to conform to the pattern, OR
2. Propose a new constitution version with rationale

## Naming Conventions

### File Names

**Mandatory:** `kebab-case` for all files.

```
✅ commit-message-generator.ts
✅ provider-config-builder.ts
❌ CommitMessageGenerator.ts
❌ providerConfigBuilder.ts
```

**Violation breaks architecture:** Inconsistent naming makes files hard to find.

### Functions and Variables

**Mandatory:** `camelCase` for functions and variables.

```typescript
✅ function generateCommitMessage()
✅ const providerConfig = ...
❌ function GenerateCommitMessage()
❌ const provider_config = ...
```

### Types and Interfaces

**Mandatory:** `PascalCase` for types, interfaces, classes.

```typescript
✅ type ProviderConfig = ...
✅ interface CommitTask = ...
✅ class ClaudeProvider
❌ type providerConfig = ...
❌ interface commitTask = ...
```

### Private Members

**Mandatory:** Leading underscore for private/internal members.

```typescript
class MyClass {
  ✅ private _internalState: string;
  ✅ private _helperMethod() { }
  ❌ private internalState: string;
}
```

## Import Organization

**Mandatory:** Imports MUST be organized in this exact order:

1. External dependencies (npm packages)
2. Internal imports (project files)

**Within each group:** Alphabetical order.

```typescript
✅ Correct:
import chalk from 'chalk';
import { execa } from 'execa';
import { z } from 'zod';

import { CommitMessageGenerator } from './generator.js';
import { hasContent } from './utils/guards.js';
import type { ProviderConfig } from './providers/types.js';

❌ Wrong:
import { CommitMessageGenerator } from './generator.js';
import chalk from 'chalk';
import { hasContent } from './utils/guards.js';
```

**ESLint enforces this:** The `eslint-plugin-import` rules will fail if imports are misordered.

**Violation breaks architecture:** Random import order makes code hard to scan.

## Type Safety Patterns

### Explicit Return Types

**Mandatory:** All public functions MUST have explicit return types.

```typescript
✅ Correct:
export function validateConfig(config: unknown): ProviderConfig {
  return providerConfigSchema.parse(config);
}

export async function generateMessage(prompt: string): Promise<string> {
  // ...
}

❌ Wrong:
export function validateConfig(config: unknown) {  // Missing return type
  return providerConfigSchema.parse(config);
}
```

**Violation breaks architecture:** Inferred return types can change unexpectedly, breaking consumers.

### No `any` Types

**Mandatory:** NEVER use `any` in production code.

```typescript
❌ Wrong:
function processData(data: any) {  // Never use any
  // ...
}

✅ Correct:
function processData(data: unknown) {  // Use unknown for truly unknown types
  if (isValidData(data)) {
    // Now data is typed
  }
}

✅ Also correct:
function processData<T>(data: T) {  // Use generics for flexible types
  // ...
}
```

**Exception:** Test files may use `any` for mocking with explicit `// eslint-disable`.

**Violation breaks architecture:** `any` defeats TypeScript's type system.

### Avoid Type Assertions

**Mandatory:** Minimize use of `as` type assertions.

```typescript
❌ Wrong:
const config = userInput as ProviderConfig;  // No runtime validation!

✅ Correct:
const config = validateProviderConfig(userInput);  // Runtime + compile time
```

**When assertions are necessary:**
- Add comment explaining why
- Use only when you have external proof of type (e.g., tested library guarantees)

```typescript
✅ Acceptable:
// commander guarantees .opts() returns object matching our option definitions
const options = program.opts() as CLIOptions;
```

**Violation breaks architecture:** Type assertions bypass safety, cause runtime errors.

## Schema-First Development

**Mandatory:** All types that cross system boundaries MUST be defined with Zod schemas first, then infer TypeScript types.

### Pattern

```typescript
// 1. Define Zod schema
export const myConfigSchema = z.object({
  name: z.string().min(1),
  timeout: z.number().positive().default(120000),
  enabled: z.boolean().default(true),
});

// 2. Infer TypeScript type
export type MyConfig = z.infer<typeof myConfigSchema>;

// 3. Create validation helper
export function validateMyConfig(config: unknown): MyConfig {
  return myConfigSchema.parse(config);
}

// 4. Use at boundaries
function createThing(userInput: unknown): Thing {
  const config = validateMyConfig(userInput);  // Validate at boundary
  // Now config is typed and validated
  return new Thing(config);
}
```

**Violation breaks architecture:** Types without runtime validation allow invalid data to propagate.

### Schema Organization

**Mandatory:** Schemas organized by domain:

- `src/types/schemas.ts` - Core domain types (CommitTask, CommitMessageOptions, GeneratorConfig)
- `src/cli/schemas.ts` - CLI-specific types (CliOptions, command parsing)
- `src/utils/git-schemas.ts` - Git output parsing (GitStatus, FileCategories)
- `src/providers/types.ts` - Provider configurations (ProviderConfig with schemas)

**Violation breaks architecture:** Scattered schemas are hard to find and maintain.

## Error Handling Patterns

### Custom Error Types

**Mandatory:** Use custom error classes for domain errors.

```typescript
✅ Correct:
export class ProviderNotAvailableError extends Error {
  constructor(providerName: string) {
    super(`Provider ${providerName} is not available`);
    this.name = 'ProviderNotAvailableError';
  }
}

throw new ProviderNotAvailableError('claude');

❌ Wrong:
throw new Error('Provider claude is not available');  // Untyped
```

**Violation breaks architecture:** Generic errors can't be caught specifically.

### Error at Boundaries

**Mandatory:** Catch and re-throw errors at layer boundaries with context.

```typescript
✅ Correct:
try {
  await provider.generate(prompt, options);
} catch (error) {
  throw new GeneratorError(
    `Failed to generate commit message: ${error.message}`,
    { cause: error }
  );
}
```

**Violation breaks architecture:** Raw errors from lower layers leak implementation details.

## Module Patterns

### Single Responsibility

**Mandatory:** Each module has ONE clear responsibility.

```typescript
✅ Correct:
// provider-factory.ts - ONLY creates providers
export function createProvider(config: ProviderConfig): AIProvider { }

// auto-detect.ts - ONLY detects available providers
export async function autoDetectProvider(): Promise<AIProvider | null> { }

❌ Wrong:
// providers.ts - Does too many things
export function createProvider() { }
export function autoDetectProvider() { }
export class ClaudeProvider { }
export class CodexProvider { }
```

**Violation breaks architecture:** Multi-responsibility modules become unmaintainable.

### Dependency Injection

**Mandatory:** Pass dependencies via constructor or parameters, not global imports.

```typescript
✅ Correct:
class CommitMessageGenerator {
  constructor(
    private config: CommitMessageGeneratorConfig,
    private provider: AIProvider
  ) {}
}

❌ Wrong:
import { globalProvider } from './global-state.js';

class CommitMessageGenerator {
  generate() {
    globalProvider.generate(...);  // Hard to test
  }
}
```

**Violation breaks architecture:** Global dependencies make code untestable.

## Code Style Patterns

### Const Assertions

**Mandatory:** Use `as const` for literal types and immutable data.

```typescript
✅ Correct:
const SUPPORTED_PROVIDERS = ['claude', 'codex', 'cursor'] as const;
type Provider = typeof SUPPORTED_PROVIDERS[number];  // 'claude' | 'codex' | 'cursor'

const config = {
  timeout: 120000,
  retries: 3,
} as const;
```

**Violation breaks architecture:** Mutable arrays/objects can be accidentally modified.

### Array/Object Destructuring

**Recommended:** Use destructuring for cleaner code.

```typescript
✅ Preferred:
const { enableAI, provider, signature } = config;

❌ Verbose:
const enableAI = config.enableAI;
const provider = config.provider;
const signature = config.signature;
```

**Note:** Not mandatory, but strongly encouraged for readability.

### Template Literals

**Mandatory:** Use template literals for string interpolation.

```typescript
✅ Correct:
const message = `Provider ${name} failed: ${error.message}`;

❌ Wrong:
const message = 'Provider ' + name + ' failed: ' + error.message;
```

**Violation breaks architecture:** String concatenation is error-prone and less readable.

## ESLint Overrides

### CLI Files

**Allowed:** CLI files may disable `no-console` and `unicorn/no-process-exit`.

```typescript
/* eslint-disable no-console, unicorn/no-process-exit */
import chalk from 'chalk';

export function listProvidersCommand(): void {
  console.log(chalk.green('Available providers:'));
  process.exit(0);
}
```

**Mandatory:** Use directive at top of file, not inline.

### Test Files

**Allowed:** Test files may disable `@typescript-eslint/no-explicit-any` for mocking.

```typescript
// test file only
const mockProvider = {
  generate: vi.fn() as any,  // eslint-disable-line @typescript-eslint/no-explicit-any
};
```

**Mandatory:** Add `eslint-disable-line` comment explaining why.

### Config Files

**Allowed:** Config files may use default exports.

```typescript
// vitest.config.ts, tsup.config.ts - config files
export default defineConfig({ /* ... */ });
```

**All other files:** Named exports only.

## Git Commit Patterns

### Self-Dogfooding

**Mandatory:** Use commitment to generate ALL commit messages.

```bash
✅ Correct:
git add .
./dist/cli.js  # Generate message with commitment
# Review and commit

❌ Wrong:
git commit -m "fix stuff"  # Manual message
```

**Violation breaks architecture:** Not dogfooding means we don't experience our own UX.

### Conventional Commits

**Mandatory:** All commits MUST follow conventional commit format.

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code change that neither fixes nor adds feature
- `test:` - Adding or updating tests
- `docs:` - Documentation changes
- `chore:` - Maintenance tasks
- `perf:` - Performance improvements

**Violation breaks architecture:** Inconsistent commits make history unreadable.

## Documentation Patterns

### TSDoc Comments

**Mandatory:** All exported functions, classes, types MUST have TSDoc comments.

```typescript
✅ Correct:
/**
 * Validates provider configuration with runtime checks
 *
 * @param config - Unknown input to validate
 * @returns Validated and typed provider configuration
 * @throws {ZodError} If configuration is invalid
 *
 * @example
 * ```typescript
 * const config = validateProviderConfig(userInput);
 * const provider = createProvider(config);
 * ```
 */
export function validateProviderConfig(config: unknown): ProviderConfig {
  return providerConfigSchema.parse(config);
}

❌ Wrong:
export function validateProviderConfig(config: unknown): ProviderConfig {
  return providerConfigSchema.parse(config);
}
```

**Violation breaks architecture:** Undocumented exports force readers to infer behavior.

### Inline Comments

**Mandatory:** Use comments to explain WHY, not WHAT.

```typescript
✅ Correct:
// Claude CLI requires --print flag to output message without confirmation
const args = ['--print'];

❌ Wrong:
// Add --print flag
const args = ['--print'];  // Comment says what code already shows
```

## Anti-Patterns

### ❌ Magic Numbers

**Never:**
```typescript
if (timeout > 300000) {  // What is 300000?
```

**Always:**
```typescript
const MAX_TIMEOUT_MS = 300000;  // 5 minutes
if (timeout > MAX_TIMEOUT_MS) {
```

### ❌ Callback Hell

**Never:**
```typescript
doThing((result1) => {
  doAnotherThing((result2) => {
    doFinalThing((result3) => {
      // ...
    });
  });
});
```

**Always:**
```typescript
const result1 = await doThing();
const result2 = await doAnotherThing(result1);
const result3 = await doFinalThing(result2);
```

### ❌ Mutable Exports

**Never:**
```typescript
export let globalProvider: AIProvider | null = null;  // Mutable!
```

**Always:**
```typescript
export function setProvider(provider: AIProvider): void {
  // Explicit setter if needed
}
```

## Pattern Evolution

These patterns are v1. As the codebase evolves:

- **Adding patterns:** Propose in PR, update CLAUDE.md first
- **Removing patterns:** Requires new constitution version
- **Clarifying patterns:** Edit this file in place (non-breaking)

When in doubt: Follow the pattern, or ask for clarification before violating.
