# Mandatory Patterns

## Core Principle

**These patterns are non-negotiable. Violating them breaks the architecture.**

If you find yourself needing to violate a pattern, you must either:
1. Refactor to conform to the pattern, OR
2. Propose a new constitution version with rationale

## Bun Development Patterns

### Extensionless Imports

**Mandatory:** With `moduleResolution: "bundler"`, remove `.js` extensions from imports.

```typescript
✅ Correct (Bun):
import { hasContent } from './utils/guards';
import { ClaudeAgent } from './agents/claude';

❌ Wrong (legacy):
import { hasContent } from './utils/guards.js';
import { ClaudeAgent } from './agents/claude.js';
```

**Why:** Bun's bundler resolution doesn't require file extensions. This is the modern standard.

### Build Script Pattern

**Mandatory:** Use `build.ts` for Bun build configuration.

```typescript
#!/usr/bin/env bun
import { build } from 'bun';
import { chmod } from 'node:fs/promises';

// Build library entry point
await build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  target: 'node',
  format: 'esm',
  minify: false,
  sourcemap: 'external',
});

// Build CLI entry point
await build({
  entrypoints: ['./src/cli.ts'],
  outdir: './dist',
  target: 'node',
  format: 'esm',
  minify: false,
  sourcemap: 'external',
});

// Add shebang to CLI
const cliPath = './dist/cli.js';
const content = await Bun.file(cliPath).text();
await Bun.write(cliPath, `#!/usr/bin/env node\n${content}`);

// Make executable (Unix only)
if (process.platform !== 'win32') {
  await chmod(cliPath, 0o755);
}

console.log('✅ Build complete');
```

**Why:** Bun's native build API is fast and requires no configuration files.

### Test Configuration

**Mandatory:** Use `bunfig.toml` for test settings.

```toml
[test]
# Coverage configuration
coverage = true
coverageThreshold = 80
coverageReporters = ["text", "json", "html"]
coverageDir = "coverage"

# Test execution
timeout = 30000  # 30 seconds per test
```

**Why:** Centralized configuration for all test settings.

### Development Commands

**Standard commands:**

```bash
# Install dependencies
bun install

# Build project
bun run build

# Watch mode development
bun run dev   # or bun --watch build.ts

# Run tests
bun test

# Run tests with coverage
bun test --coverage

# Watch mode testing
bun test --watch

# Type checking
bun run check-types   # or bun tsc --noEmit

# Linting
bun run lint
```

**Why:** All commands use `bun` for consistency and performance.

## V3 Pattern Changes

### New Patterns in V3

**1. Template Method Pattern (Simple Base Classes)**

**Mandatory:** Agents extend BaseAgent with ≤3 extension points.

```typescript
✅ V3 Pattern (template method, ~40 LOC):
export class ClaudeAgent extends BaseAgent {
  readonly name = 'claude';

  protected async executeCommand(prompt: string, workdir: string): Promise<string> {
    const result = await execa('claude', ['--prompt', prompt], {
      cwd: workdir,
      timeout: 120_000,
    });
    return result.stdout;
  }

  // Inherits from BaseAgent:
  // - checkAvailability() - ensures CLI exists
  // - cleanResponse() - removes AI artifacts
  // - validateResponse() - checks conventional commit format
  // - error handling - wraps with AgentError
}

❌ Complex Inheritance (>3 extension points):
abstract class ComplexBase {
  abstract method1(): void;
  abstract method2(): void;
  abstract method3(): void;
  abstract method4(): void;  // ❌ Too many extension points
  abstract method5(): void;
}
```

**Why:** Template method pattern with ≤3 extension points eliminates 70% duplication while keeping agents readable (~40-60 LOC each).

**2. Pure Utility Functions (Stateless Helpers)**

**Mandatory:** Shared logic in pure, stateless functions.

```typescript
✅ V3 Pattern (pure functions):
export function cleanAIResponse(output: string): string {
  // No state, no side effects
  return output
    .trim()
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^(thinking|<thinking>)[\s\S]*?(<\/thinking>|$)/gim, '');
}

export function validateConventionalCommit(message: string): boolean {
  // No state, no side effects
  const pattern = /^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?:.+/;
  return pattern.test(message);
}

export function isCLINotFoundError(error: unknown): boolean {
  // Type guard - pure function
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

❌ Stateful Utilities:
export class ResponseCleaner {
  private cleanCount = 0;  // ❌ State

  clean(output: string): string {
    this.cleanCount++;     // ❌ Side effect
    return output.trim();
  }
}
```

**Why:** Pure functions are easy to test, compose, and reason about. State makes code unpredictable.

**3. CLI Helper Extraction**

**Mandatory:** Extract display/execution helpers for testability.

```typescript
✅ V3 Pattern (extracted helpers):
// src/cli/helpers.ts
export function displayStagedChanges(changes: string): void {
  console.log(chalk.blue('Staged changes:'));
  console.log(changes);
}

export function displayCommitMessage(message: string): void {
  console.log(chalk.green('\n✅ Generated commit message:'));
  console.log(message);
}

export async function executeCommit(message: string, workdir: string): Promise<void> {
  await execa('git', ['commit', '-m', message], { cwd: workdir });
}

// src/cli.ts (uses helpers)
displayStagedChanges(diff);
displayCommitMessage(message);
await executeCommit(message, options.cwd);

❌ Inline in CLI (hard to test):
console.log(chalk.blue('Staged changes:'));
console.log(diff);
// ... 50 more lines of inline display logic
```

**Why:** Extracted helpers can be unit tested independently. Inline logic requires integration tests.

**4. Evaluation as Standalone Script (Not Tests)**

**Mandatory:** Evaluation systems that make external API calls MUST be standalone scripts, NOT test files.

```typescript
✅ V3 Pattern (standalone script):
// src/eval/run-eval.ts - Standalone entry point
#!/usr/bin/env bun
import { EvalRunner } from './runner';
import { EvalReporter } from './reporter';

const runner = new EvalRunner();
const reporter = new EvalReporter('./.eval-results');

// Run evaluation with real API calls
const comparisons = await runner.runAll('mocked');
reporter.storeMarkdownReport(comparisons);

// Usage: bun run eval (NOT bun test)

❌ Evaluation as Test:
// src/eval/__tests__/baseline.eval.test.ts
describe('Eval System', () => {
  it('should compare agents', async () => {
    // ❌ Makes expensive API calls during test run
    // ❌ Times out after 60s
    // ❌ Runs in CI unnecessarily
    const result = await runner.runAll();
    expect(result).toBeDefined();
  }, { timeout: 120000 });
});
```

**Why:**
- Evaluations make expensive API calls (costs money)
- Take 60-120 seconds to run
- Generate reports and store results (side effects)
- Should be run on-demand, not in CI
- Test frameworks are for fast, deterministic tests

**Package.json scripts:**
```json
{
  "scripts": {
    "eval": "bun run src/eval/run-eval.ts",
    "eval:fixture": "bun run src/eval/run-eval.ts --fixture",
    "test": "bun test"  // No evals in regular tests
  }
}
```

### Patterns Preserved from V2

**1. Direct Instantiation (No Factories)**

**Mandatory:** Still no factories - use simple if/else.

```typescript
✅ V3 Pattern (same as v2 - direct instantiation):
if (this.config.agent === 'claude') {
  agent = new ClaudeAgent();
} else if (this.config.agent === 'codex') {
  agent = new CodexAgent();
}

❌ V1 Pattern (removed in v2, still banned in v3):
abstract class BaseProvider {
  abstract execute(): Promise<string>;  // ❌ Base classes removed
}

class ClaudeProvider extends BaseProvider {  // ❌ Inheritance removed
  // Shared logic in base class...
}
```

**Why:** Base classes add indirection. Inline logic is easier to understand and debug. Each agent ~50-100 LOC.

**2. Direct Agent Instantiation (No Factory)**

**Mandatory:** Instantiate agents directly with simple if/else.

```typescript
✅ V2 Pattern:
// In generator.ts
if (this.config.agent === 'claude') {
  agent = new ClaudeAgent();
} else if (this.config.agent === 'codex') {
  agent = new CodexAgent();
}

❌ V1 Pattern (removed in v2):
agent = ProviderFactory.create(config);  // ❌ Factory removed
```

**Why:** Factory adds indirection for no benefit. Simple if/else is clear and explicit.

**3. Hook Installation with Init Command**

**Mandatory:** Use `commitment init` command for hook setup.

**Pattern: Auto-Detection then Installation**

```typescript
// In src/cli/commands/init.ts
async function initCommand(options: InitOptions): Promise<void> {
  // 1. Verify git repository
  await execa('git', ['rev-parse', '--git-dir'], { cwd });

  // 2. Auto-detect hook manager (or use explicit flag)
  let hookManager: HookManager;
  if (options.hookManager !== undefined) {
    hookManager = options.hookManager;
  } else {
    const detected = await detectHookManager(cwd);
    hookManager = detected ?? 'plain';
  }

  // 3. Install appropriate hooks
  switch (hookManager) {
    case 'husky':
      await installHuskyHook(cwd);
      break;
    case 'simple-git-hooks':
      await installSimpleGitHooks(cwd);
      break;
    case 'plain':
      await installPlainGitHook(cwd);
      break;
  }
}
```

**4. Hook Message Preservation**

**Mandatory:** Hooks MUST check `$2` parameter to preserve user messages.

```bash
✅ Correct (all hooks):
#!/bin/sh
# Only run for regular commits (not merge, squash, or when message specified)
if [ -z "$2" ]; then
  npx commitment --message-only > "$1"
fi

❌ Wrong:
#!/bin/sh
npx commitment --message-only > "$1"  # ❌ Overrides user messages!
```

**Why:** `$2` contains commit source:
- Empty → `git commit` (generate message) ✅
- `"message"` → `git commit -m "..."` (preserve user message) ✅
- `"merge"` → merge commit (preserve default merge message) ✅

### Patterns Removed in V2

**1. Provider Chains (Removed)**

```typescript
❌ V1 Pattern (removed):
const chain = [claude, codex, gemini];  // Fallback chain
for (const provider of chain) {
  if (await provider.isAvailable()) {
    return await provider.generate(prompt);
  }
}

✅ V2 Pattern:
// Single agent, explicit --agent flag
// AI fails → generator handles fallback to rule-based
```

**2. Auto-Detection (Removed)**

```typescript
❌ V1 Pattern (removed):
const provider = await autoDetectProvider();  // Magic detection

✅ V2 Pattern:
// Explicit --agent flag (default: 'claude')
```

**3. Provider Config JSON (Removed)**

```typescript
❌ V1 Pattern (removed):
commitment --provider-config '{"type":"cli","provider":"claude","timeout":60000}'

✅ V2 Pattern:
commitment --agent claude  // Simple flag
```

### Cross-Platform Patterns

**1. Line Ending Management**

**Mandatory:** `.gitattributes` ensures LF endings for hook scripts.

```gitattributes
# .gitattributes
examples/**/*.sh text eol=lf
.husky/* text eol=lf
*.hook text eol=lf
* text=auto
```

**Why:** Windows CRLF (`\r\n`) breaks bash scripts. LF (`\n`) works everywhere.

**2. Platform Detection in Node.js**

**Pattern:** Use `process.platform` for platform-specific behavior.

```typescript
✅ Correct:
if (process.platform !== 'win32') {
  await fs.chmod(hookPath, 0o755);  // Make executable (Unix only)
}

❌ Wrong:
await fs.chmod(hookPath, 0o755);  // ❌ Fails on Windows
```

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
const SUPPORTED_PROVIDERS = ['claude', 'codex', 'gemini'] as const;
type Provider = typeof SUPPORTED_PROVIDERS[number];  // 'claude' | 'codex' | 'gemini'

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
  generate: mock(() => {}) as any,  // eslint-disable-line @typescript-eslint/no-explicit-any
};
```

**Mandatory:** Add `eslint-disable-line` comment explaining why.

### Config Files

**Allowed:** Config files may use default exports.

```typescript
// bunfig.toml, build.ts - config files
export default { /* ... */ };
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
