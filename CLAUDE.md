# CLAUDE.md

This file provides guidance to Claude Code and other AI coding agents when working with code in this repository.

## Project Overview

**commitment** is an AI-powered commit message generator with intelligent fallback. It uses AI agents (Claude CLI or Codex CLI) to generate high-quality, conventional commit messages from git diffs, with a rule-based fallback for when AI is unavailable.

**Architecture Philosophy:** Selective abstraction. Simple base class (≤3 extension points) + pure utilities, but no factories or provider chains. Agents extend BaseAgent (~40-60 LOC each). One-command setup with `commitment init` for automatic hook installation.

**Constitution:** This project follows @docs/constitutions/current/ (v3). See current/meta.md for version history.

## Development Commands

### Building and Development

```bash
# Build the project
bun run build

# Watch mode development
bun run dev

# Clean build artifacts
bun run clean
```

### Code Quality

```bash
# Run linting (type-check + format-check + biome)
bun run lint

# Fix linting issues automatically
bun run lint:fix

# Format code
bun run format

# Check formatting
bun run format:check

# Type checking
bun run type-check
```

### Testing

```bash
# Run tests
bun test

# Watch mode testing
bun test --watch

# Run tests with coverage
bun test --coverage
```

## Git Workflow with git-spice

**IMPORTANT**: When working on tickets/issues in this repository, use [git-spice](https://abhinav.github.io/git-spice/) for branch and commit management instead of standard `git commit`.

### Why git-spice?

git-spice enables stacked branch workflows, making it easy to:

- Create branches stacked on top of each other
- Submit multiple related PRs in a stack
- Automatically restack branches when changes are made
- Generate branch names from commit messages

### Basic Workflow

1. **Create a new branch for your ticket** (stacked on current branch):

   ```bash
   gs branch create <branch-name>
   # or let git-spice generate the name from your commit message:
   gs bc
   ```

2. **Make your changes and commit** (use commitment itself!):

   ```bash
   # Stage your changes
   git add .

   # Let commitment generate the message
   ./dist/cli.js
   ```

3. **Create another stacked branch for the next ticket**:

   ```bash
   # Creates a branch on top of the current one
   gs bc feat-2
   ```

4. **Restack after changes** (if you modify an earlier branch):

   ```bash
   # Restack all branches in the current stack
   gs stack restack

   # Or restack just the current branch
   gs branch restack
   ```

5. **Submit pull requests** for the entire stack:
   ```bash
   gs stack submit
   ```

### Common Commands

- `gs branch create` (alias: `gs bc`) - Create a new stacked branch
- `gs branch track` - Track an existing branch in the stack
- `gs branch squash` - Squash commits in the current branch
- `gs stack restack` - Rebase all branches in the stack
- `gs upstack restack` - Restack branches upstack from current
- `gs stack submit` - Submit PRs for all branches in stack

### Example: Working on Multiple Tickets

```bash
# Start from main
git checkout main

# Ticket 1: Add feature X
gs bc add-feature-x
# Make changes, commit with commitment
git add .
./dist/cli.js

# Ticket 2: Add feature Y (stacked on feature X)
gs bc add-feature-y
# Make changes, commit
git add .
./dist/cli.js

# Ticket 3: Add tests (stacked on feature Y)
gs bc add-tests
# Make changes, commit
git add .
./dist/cli.js

# Submit all PRs in the stack
gs stack submit
```

If you need to modify Ticket 1 after creating Tickets 2 and 3:

```bash
git checkout add-feature-x
# Make changes
git add .
git commit --amend --no-edit
# Restack everything
gs stack restack
```

## Code Style Requirements

### TypeScript Guidelines

- Use strict TypeScript with all strict flags enabled
- All public functions must have explicit return types
- No `any` types allowed
- Use `const assertions` and `as const` for immutable data
- Follow naming conventions:
  - `camelCase` for functions and variables
  - `PascalCase` for types
  - `kebab-case` for files
  - Leading underscore for private members (e.g., `_privateMethod`)

### ESLint and Prettier

The project uses strict ESLint rules including:

- TypeScript strict rules
- Import organization (external → internal)
- Promise best practices
- Unicorn rules for modern JavaScript
- Sorted imports and exports

**Always run `bun run lint:fix` before committing.**

### Import Organization

Imports must be organized in this order:

1. External dependencies
2. Internal imports (use named exports only)

Example:

```typescript
import chalk from 'chalk';
import { execa } from 'execa';

import { CommitMessageGenerator } from './generator.js';
import { hasContent } from './utils/guards.js';
```

## Architecture Overview

**See @docs/constitutions/current/architecture.md for full architectural rules and boundaries.**

### Core Components

- **CLI** (`src/cli.ts`): Command-line interface (~200 lines)
  - **Init Command** (`src/cli/commands/init.ts`): Automatic hook installation with auto-detection
  - **CLI Schemas** (`src/cli/schemas.ts`): CLI option validation
- **Generator** (`src/generator.ts`): CommitMessageGenerator class with AI and rule-based generation
- **Agents** (`src/agents/`): Standalone AI agent implementations (no base classes)
  - `claude.ts` - Claude CLI agent (~80 LOC, self-contained)
  - `codex.ts` - Codex CLI agent (~80 LOC, self-contained)
  - `types.ts` - Minimal Agent interface
- **Schemas** (`src/types/schemas.ts`, `src/cli/schemas.ts`, `src/utils/git-schemas.ts`): Zod schemas for runtime validation
- **Git Utilities** (`src/utils/git-schemas.ts`): Git output parsing and file categorization
  - `parseGitStatus()` - Parse and validate git status output
  - `categorizeFiles()` - Categorize files by type (tests, components, configs, etc.)
  - `analyzeChanges()` - Extract change statistics (added, modified, deleted, renamed)
- **Guards** (`src/utils/guards.ts`): Type guard utilities for safer code

### Key Design Patterns

1. **AI-First with Fallback**: Always try AI generation first, fall back to rule-based
2. **Conventional Commits**: All messages follow conventional commit format
3. **Inline Agent Logic**: Each agent is standalone (~80 LOC) with all logic inline - no base classes, no factories
4. **Direct Instantiation**: Simple if/else for agent selection - no auto-detection or provider chains
5. **One-Command Setup**: `commitment init` auto-detects and installs hooks
6. **ESM-Only**: Built as ESM modules using latest TypeScript and Node.js features
7. **Strict TypeScript**: All strict compiler options enabled
8. **Self-Dogfooding**: commitment uses itself via git hooks
9. **Schema-First Type Safety**: Runtime validation at system boundaries using Zod schemas
10. **Cross-Platform**: LF line endings via `.gitattributes`, Windows-compatible hooks

## Type Safety Patterns

commitment uses a **schema-first** approach to type safety, combining TypeScript's compile-time checks with Zod's runtime validation. This ensures data integrity at system boundaries while maintaining excellent developer experience.

### Philosophy: Schema-First Development

**Core Principle**: Define schemas once, derive types automatically, validate at boundaries.

**Benefits**:

- **Single Source of Truth**: Schemas define both runtime validation and TypeScript types
- **Runtime Safety**: Catch invalid data from users, files, git, or external systems
- **Better Errors**: Zod provides detailed, actionable error messages
- **Type Inference**: TypeScript types are automatically inferred from schemas
- **Consistency**: Same validation logic in development and production

### Schema Organization

Schemas are organized by domain:

```
src/
├── types/schemas.ts          # Core domain types (CommitTask, CommitMessageOptions, GeneratorConfig)
├── cli/schemas.ts            # CLI-specific types (CliOptions, provider config parsing)
├── utils/git-schemas.ts      # Git output parsing (GitStatus, FileCategories)
└── providers/types.ts        # Provider configurations (ProviderConfig, CLIProviderConfig, APIProviderConfig)
```

### Pattern 1: Validation at Boundaries

**Rule**: Validate data at system boundaries (user input, external commands, file I/O), trust it internally.

**Boundaries in commitment**:

1. CLI argument parsing
2. Generator construction
3. Provider configuration
4. Git command output
5. JSON parsing

**Example: CLI Validation**

```typescript
import { validateCliOptions } from './cli/schemas.js';

// Boundary: User input from commander
const rawOptions = program.opts();

// Validate immediately
const options = validateCliOptions(rawOptions);
// Now options is fully typed with defaults applied

// Use validated data internally (no need to re-validate)
const generator = new CommitMessageGenerator({
  enableAI: options.ai,
  provider: buildProviderConfig(options),
});
```

**Example: Git Output Validation**

```typescript
import { parseGitStatus } from './utils/git-schemas.js';

// Boundary: External git command
const { stdout } = await execa('git', ['status', '--porcelain'], { cwd });

// Parse and validate git output
const status = parseGitStatus(stdout);
// status is now typed as GitStatus with validated structure

// Use internally without re-validation
if (status.hasChanges) {
  const files = status.stagedFiles; // string[] guaranteed
}
```

### Pattern 2: Schema Definition Best Practices

**Guidelines**:

1. Use descriptive field names and add JSDoc comments
2. Include validation constraints (min, max, positive, etc.)
3. Provide clear error messages
4. Use .default() for optional fields with defaults
5. Use .transform() for data normalization

**Example: Well-Defined Schema**

````typescript
import { z } from 'zod';

/**
 * Schema for commit task validation
 *
 * @example
 * ```typescript
 * const task = {
 *   title: 'Add feature',
 *   description: 'Implement new feature',
 *   produces: ['src/feature.ts']
 * };
 * const validated = validateCommitTask(task);
 * ```
 */
export const commitTaskSchema = z.object({
  /**
   * Short, descriptive title of the task
   */
  title: z
    .string()
    .min(1, 'Task title must not be empty')
    .max(200, 'Task title must not exceed 200 characters'),

  /**
   * Detailed description of what the task accomplishes
   */
  description: z
    .string()
    .min(1, 'Task description must not be empty')
    .max(1000, 'Task description must not exceed 1000 characters'),

  /**
   * List of files or outputs produced by this task
   */
  produces: z.array(z.string()).min(0).default([]),
});

// Type is automatically inferred
export type CommitTask = z.infer<typeof commitTaskSchema>;

// Validation function with clear signature
export function validateCommitTask(task: unknown): CommitTask {
  return commitTaskSchema.parse(task);
}
````

### Pattern 3: Error Handling

**Two approaches**: Throwing vs. Safe parsing

**Throwing (use for critical validation)**:

```typescript
// Will throw ZodError if invalid
const config = validateGeneratorConfig(userInput);
```

**Safe parsing (use for optional validation or user-facing errors)**:

```typescript
const result = safeValidateGeneratorConfig(userInput);

if (result.success) {
  // result.data is validated config
  console.log('Valid config:', result.data);
} else {
  // result.error is ZodError with details
  console.error('Validation failed:', result.error.issues);
}
```

**Example: User-Friendly CLI Errors**

```typescript
import { z } from 'zod';
import chalk from 'chalk';
import { validateCliOptions, formatValidationError } from './cli/schemas.js';

try {
  const options = validateCliOptions(rawOptions);
  // Proceed with valid options
} catch (error) {
  if (error instanceof z.ZodError) {
    // Format errors for users
    console.error(chalk.red('Invalid options:'));
    console.error(formatValidationError(error));
    console.log(chalk.gray('\nRun --help for usage information'));
    process.exit(1);
  }
  throw error;
}
```

### Pattern 4: Type Guards vs. Schemas

**Use schemas for**: Validating unknown/external data
**Use type guards for**: Narrowing known types

**Example: Combining Both**

```typescript
import { isCLIProviderConfig } from './providers/types.js';
import { validateProviderConfig } from './providers/types.js';

// 1. Validate unknown data (boundary)
const config = validateProviderConfig(userInput);
// config is now ProviderConfig (CLIProviderConfig | APIProviderConfig)

// 2. Narrow validated type (internal logic)
if (isCLIProviderConfig(config)) {
  // TypeScript knows config.command exists
  console.log('CLI command:', config.command);
}
```

**Type Guards in guards.ts**:

```typescript
import { hasContent, isNonEmptyArray, isDefined } from './utils/guards.js';

// String validation
const input: string | null = getUserInput();
if (hasContent(input)) {
  // input is string, not null/undefined/empty
  console.log(input.toUpperCase());
}

// Array validation with type narrowing
const items: string[] = getItems();
if (isNonEmptyArray(items)) {
  // items is [string, ...string[]]
  const first = items[0]; // No undefined check needed!
}

// Defined check
const value: string | null | undefined = getValue();
if (isDefined(value)) {
  // value is string
  console.log(value.length);
}
```

### Pattern 5: Composing Schemas

**Strategy**: Build complex schemas from simple, reusable pieces.

**Example: Provider Schema Composition**

```typescript
import { z } from 'zod';

// Base schema with common fields
const baseProviderSchema = z.object({
  timeout: z.number().positive().optional(),
});

// CLI-specific schema extends base
export const cliProviderSchema = baseProviderSchema.extend({
  type: z.literal('cli'),
  provider: z.enum(['claude', 'codex', 'cursor']),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
});

// API-specific schema extends base
export const apiProviderSchema = baseProviderSchema.extend({
  type: z.literal('api'),
  provider: z.enum(['openai', 'gemini']),
  apiKey: z.string().min(1),
  endpoint: z.string().url().optional(),
});

// Discriminated union for type-safe handling
export const providerConfigSchema = z.discriminatedUnion('type', [
  cliProviderSchema,
  apiProviderSchema,
]);
```

### Pattern 6: Schema Refinements

**Use .refine()** for custom validation logic that spans multiple fields.

**Example: Mutual Exclusivity**

```typescript
export const generatorConfigSchema = z
  .object({
    provider: z
      .union([
        /* ... */
      ])
      .optional(),
    providerChain: z.array(/* ... */).optional(),
  })
  .refine(
    (data) => {
      // Ensure provider and providerChain are mutually exclusive
      const hasProvider = data.provider !== undefined;
      const hasProviderChain = data.providerChain !== undefined;
      return !(hasProvider && hasProviderChain);
    },
    {
      message: 'Cannot specify both "provider" and "providerChain"',
      path: ['provider'],
    },
  );
```

### Pattern 7: Transformations

**Use .transform()** to normalize data during validation.

**Example: Git Status Line Parsing**

```typescript
export const gitStatusLineSchema = z
  .string()
  .min(4)
  .refine((line) => /^[ !?ACDMRU]{2}$/.test(line.slice(0, 2)))
  .transform((line) => {
    const statusCode = line.slice(0, 2);
    const filename = line.slice(3);
    const isStaged = !statusCode.startsWith('?') && !statusCode.startsWith(' ');

    return {
      statusCode,
      filename,
      isStaged,
      stagedStatus: statusCode[0],
      unstagedStatus: statusCode[1],
    };
  });

// Input:  "M  src/file.ts"
// Output: { statusCode: "M ", filename: "src/file.ts", isStaged: true, ... }
```

### Pattern 8: Default Values

**Strategy**: Use .default() and .optional() to handle missing data gracefully.

```typescript
export const cliOptionsSchema = z.object({
  ai: z.boolean().default(true), // Defaults to true
  cwd: z.string().default(process.cwd()), // Defaults to current dir
  provider: z.string().optional(), // Undefined if not provided
  timeout: z.string().default('120000'), // Defaults to 120s
});

const options = validateCliOptions({});
// options.ai === true (default applied)
// options.cwd === process.cwd() (default applied)
// options.provider === undefined (optional)
```

### Migration Guide: TypeScript to Zod

**Before (pure TypeScript)**:

```typescript
// types.ts
export type ProviderConfig = {
  type: 'cli' | 'api';
  provider: string;
  timeout?: number;
};

// usage.ts
function createProvider(config: ProviderConfig) {
  // No runtime validation!
  // config.timeout could be negative, NaN, etc.
}
```

**After (schema-first with Zod)**:

```typescript
// types.ts
import { z } from 'zod';

export const providerConfigSchema = z.object({
  type: z.enum(['cli', 'api']),
  provider: z.string().min(1),
  timeout: z.number().positive().optional(),
});

// Type is inferred from schema
export type ProviderConfig = z.infer<typeof providerConfigSchema>;

// Validation helper
export function validateProviderConfig(config: unknown): ProviderConfig {
  return providerConfigSchema.parse(config);
}

// usage.ts
function createProvider(config: unknown) {
  // Validate at boundary
  const validated = validateProviderConfig(config);
  // Now guaranteed: timeout is positive or undefined
  // Now guaranteed: provider is non-empty string
}
```

### Migration Checklist

When migrating a type to schema-first:

1. **Create the schema** in appropriate file (`src/types/schemas.ts`, `src/cli/schemas.ts`, etc.)
2. **Add validation constraints** (min, max, positive, etc.)
3. **Infer the type** using `z.infer<typeof schema>`
4. **Create validation function** (both throwing and safe variants)
5. **Add JSDoc** with examples
6. **Update imports** to use inferred types
7. **Add validation** at boundaries
8. **Write tests** for schema validation
9. **Update documentation** (this file!)

### Testing Type Safety

**Schema tests** should cover:

1. Valid inputs (success cases)
2. Invalid inputs (error cases)
3. Edge cases (empty, null, undefined, boundary values)
4. Error messages (ensure they're helpful)

**Example Test**:

```typescript
import { describe, expect, it } from 'bun:test';
import { validateCommitTask, commitTaskSchema } from '../types/schemas.js';

describe('commitTaskSchema', () => {
  it('accepts valid task', () => {
    const task = {
      title: 'Add feature',
      description: 'Implement new feature',
      produces: ['src/feature.ts'],
    };

    const result = validateCommitTask(task);
    expect(result).toEqual(task);
  });

  it('rejects empty title', () => {
    const task = {
      title: '',
      description: 'Desc',
      produces: [],
    };

    expect(() => validateCommitTask(task)).toThrow('Task title must not be empty');
  });

  it('applies default for produces', () => {
    const task = {
      title: 'Test',
      description: 'Desc',
      // produces omitted
    };

    const result = commitTaskSchema.parse(task);
    expect(result.produces).toEqual([]);
  });

  it('rejects title exceeding max length', () => {
    const task = {
      title: 'x'.repeat(201),
      description: 'Desc',
      produces: [],
    };

    expect(() => validateCommitTask(task)).toThrow('must not exceed 200 characters');
  });
});
```

### Performance Considerations

**Zod validation is fast**, but follow these guidelines:

1. **Validate once** at boundaries, cache the result
2. **Don't re-validate** internal data that's already typed
3. **Use .safeParse()** for non-critical validation
4. **Avoid validation in loops** when possible

**Example: Validate Once**

```typescript
class CommitMessageGenerator {
  private validatedConfig: CommitMessageGeneratorConfig;

  constructor(config: unknown) {
    // Validate once in constructor
    this.validatedConfig = validateGeneratorConfig(config);
  }

  // Use cached validated config everywhere else
  async generate(options: CommitMessageOptions): Promise<string> {
    // No re-validation needed
    if (this.validatedConfig.enableAI) {
      // ...
    }
  }
}
```

### Common Patterns Reference

**Parse unknown data**:

```typescript
const validated = schema.parse(unknownData); // Throws on error
```

**Safe parse with error handling**:

```typescript
const result = schema.safeParse(unknownData);
if (result.success) {
  /* use result.data */
} else {
  /* handle result.error */
}
```

**Narrow discriminated union**:

```typescript
if (config.type === 'cli') {
  // TypeScript knows config is CLIProviderConfig
}
```

**Check non-empty array**:

```typescript
if (isNonEmptyArray(items)) {
  const first = items[0]; // No undefined!
}
```

**Check string content**:

```typescript
if (hasContent(str)) {
  console.log(str.toUpperCase()); // Not null/undefined/empty
}
```

### Further Reading

- **Zod Documentation**: https://zod.dev
- **Type Guards**: See `src/utils/guards.ts` for examples
- **Schema Files**: Explore `src/types/schemas.ts`, `src/cli/schemas.ts`, `src/utils/git-schemas.ts`
- **Provider Types**: See `src/providers/types.ts` for advanced patterns

## Adding a New AI Agent

**See @docs/constitutions/current/architecture.md for full extension point documentation.**

The agent system uses selective abstraction - simple base class (≤3 extension points), no factories, no auto-detection. Each agent extends BaseAgent (~40-60 LOC) implementing only executeCommand() with all flow inherited.

### Step 1: Create Agent Class

Create a new file in `src/agents/`:

```typescript
import { execa } from 'execa';
import { AgentError } from '../errors.js';
import type { Agent } from './types.js';

/**
 * My AI agent for generating commit messages
 *
 * Implements the Agent interface with CLI execution logic inlined.
 * No base classes - all logic is self-contained.
 *
 * @example
 * ```typescript
 * const agent = new MyAgent();
 * const message = await agent.generate(prompt, '/path/to/repo');
 * ```
 */
export class MyAgent implements Agent {
  readonly name = 'my-cli';

  async generate(prompt: string, workdir: string): Promise<string> {
    // 1. Check CLI availability
    try {
      await execa('which', ['my-cli']);
    } catch {
      throw AgentError.cliNotFound('my-cli', 'My CLI');
    }

    // 2. Execute CLI with prompt
    let result;
    try {
      result = await execa('my-cli', ['--prompt', prompt], {
        cwd: workdir,
        timeout: 120_000,
      });
    } catch (error) {
      const exitCode = error instanceof Error && 'exitCode' in error ? error.exitCode : 'unknown';
      const stderr = error instanceof Error && 'stderr' in error ? error.stderr : 'Unknown error';
      throw AgentError.executionFailed('My CLI', exitCode, stderr as string, error as Error);
    }

    // 3. Parse and validate response
    const output = result.stdout.trim();
    if (!output || !output.includes(':')) {
      throw AgentError.malformedResponse('My CLI', output);
    }

    return output;
  }
}
```

### Step 2: Update Types

Add your agent to the `AgentName` type in `src/agents/types.ts`:

```typescript
export type AgentName = 'claude' | 'codex' | 'my-cli';
```

### Step 3: Update Generator

Add agent instantiation in `src/generator.ts`:

```typescript
// In generateWithAI() method
if (this.config.agent === 'claude') {
  agent = new ClaudeAgent();
} else if (this.config.agent === 'codex') {
  agent = new CodexAgent();
} else if (this.config.agent === 'my-cli') {
  agent = new MyAgent();
}
```

### Step 4: Export Agent

Add to `src/agents/index.ts`:

```typescript
export { MyAgent } from './my-agent.js';
```

### Step 5: Add Tests

Create `src/agents/__tests__/my-agent.test.ts`:

```typescript
import { describe, expect, it, mock } from 'bun:test';
import { MyAgent } from '../my-agent.js';

describe('MyAgent', () => {
  it('should have correct name', () => {
    const agent = new MyAgent();
    expect(agent.name).toBe('my-cli');
  });

  it('should generate commit message', async () => {
    const agent = new MyAgent();
    // Mock CLI execution and test success case
  });

  it('should throw when CLI not found', async () => {
    const agent = new MyAgent();
    // Mock missing CLI and verify error
  });
});
```

### Step 6: Update CLI Help

Add your agent to the help text in `src/cli.ts`:

```typescript
.option('--agent <name>', 'AI agent to use: claude, codex, my-cli (default: "claude")', 'claude')
```

**That's it!** Your agent is now fully integrated and can be used with `--agent my-cli`.

### Design Philosophy

- **No base classes**: Each agent implements the `Agent` interface directly
- **Inline logic**: All CLI execution and parsing logic is in the agent class (~50-100 LOC)
- **Self-contained**: No shared utilities or factories - just the agent class
- **Simple configuration**: Just an agent name string, no complex configs
- **Actionable errors**: All errors follow "what, why, how-to-fix" pattern using `AgentError`

## Self-Dogfooding

commitment uses itself for its own commit messages via git hooks:

- **pre-commit**: Runs linting and builds dist/
- **prepare-commit-msg**: Calls `./dist/cli.js --message-only` to generate commit message

This ensures commitment is battle-tested on itself and provides a real-world example.

## CLI Architecture

**See @docs/constitutions/current/architecture.md for CLI module boundaries and responsibilities.**

The CLI is simplified to core functionality - no complex command modules, no provider chains, no auto-detection.

### Structure

```
src/cli/
├── cli.ts         # Main CLI entry point (~200 lines) with commands
├── schemas.ts     # CLI option validation with Zod
└── commands/
    ├── init.ts    # Hook installation command (~250 LOC)
    └── index.ts   # Command exports
```

### CLI Commands

**Main Command:** Generate and create commit
```bash
npx commitment [options]
```

**Init Command:** Set up git hooks automatically
```bash
npx commitment init [options]
```

### Core CLI Flags

**Main Command Flags:**
- `--agent <name>` - AI agent to use: claude, codex (default: "claude")
- `--dry-run` - Generate message without creating commit
- `--message-only` - Output only the commit message (no commit)
- `--no-ai` - Disable AI generation, use rule-based only
- `--cwd <path>` - Working directory (default: current directory)

**Init Command Flags:**
- `--hook-manager <type>` - Hook manager: husky, simple-git-hooks, plain
- `--cwd <path>` - Working directory (default: current directory)

### ESLint Configuration for CLI

The CLI file uses relaxed ESLint rules since it needs `console.log` and `process.exit`:

```typescript
/* eslint-disable no-console, unicorn/no-process-exit */
import chalk from 'chalk';

// Console and process.exit are allowed in CLI files
console.log(chalk.green('✅ Commit created'));
process.exit(0);
```

## Testing

The project uses Vitest for all testing with comprehensive coverage:

- **678 total tests** across 20 test files
- **Co-located tests**: Unit tests live alongside source files in `__tests__/` directories
- **Integration tests**: Located in `src/__tests__/integration/`
- **Test patterns**: All public APIs, edge cases, error handling, and validation

### Test Organization

```
src/
├── __tests__/
│   └── integration/           # Integration tests
│       ├── validation.test.ts # Cross-module validation tests
│       └── error-messages.test.ts # User-facing error tests
├── cli/
│   ├── __tests__/
│   │   ├── schemas.test.ts
│   │   └── provider-config-builder.test.ts
│   └── commands/__tests__/
│       ├── list-providers.test.ts
│       ├── check-provider.test.ts
│       └── auto-detect.test.ts
├── providers/
│   ├── __tests__/             # Provider core tests
│   ├── implementations/__tests__/ # Provider implementation tests
│   └── utils/__tests__/       # Provider utility tests
├── types/__tests__/
│   └── schemas.test.ts
└── utils/__tests__/
    ├── guards.test.ts
    └── git-schemas.test.ts
```

### Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test src/cli/__tests__/schemas.test.ts

# Run tests in watch mode
bun test --watch

# Run tests with coverage
bun test --coverage
```

### Test Patterns

**Schema Validation Tests**:

```typescript
describe('mySchema', () => {
  it('accepts valid input', () => {
    const valid = { field: 'value' };
    expect(() => validateMySchema(valid)).not.toThrow();
  });

  it('rejects invalid input', () => {
    const invalid = { field: 123 };
    expect(() => validateMySchema(invalid)).toThrow(ZodError);
  });

  it('applies defaults', () => {
    const partial = {};
    const result = mySchema.parse(partial);
    expect(result.field).toBe('default');
  });
});
```

**Provider Tests**:

```typescript
describe('MyProvider', () => {
  it('should check availability', async () => {
    const provider = new MyProvider();
    const available = await provider.isAvailable();
    expect(typeof available).toBe('boolean');
  });

  it('should generate commit message', async () => {
    const provider = new MyProvider();
    const message = await provider.generateCommitMessage('prompt', {
      workdir: '/tmp',
    });
    expect(message).toBeTruthy();
  });
});
```

**CLI Command Tests** (see "Testing CLI Commands" section above)

## File Structure

**See @docs/constitutions/current/architecture.md for module organization rules.**

```
src/
├── cli.ts                      # CLI entry point (~200 lines)
├── generator.ts                # CommitMessageGenerator class
├── errors.ts                   # Consolidated error types (AgentError, GeneratorError)
├── index.ts                    # Public API exports (≤10 items)
├── agents/                     # Agent system (simplified, no base classes)
│   ├── types.ts                # Agent interface and types
│   ├── claude.ts               # Claude agent (~80 LOC, self-contained)
│   ├── codex.ts                # Codex agent (~80 LOC, self-contained)
│   └── index.ts                # Agent exports
├── cli/                        # CLI modules
│   ├── schemas.ts              # CLI option validation
│   └── commands/
│       ├── init.ts             # Hook installation command
│       └── index.ts            # Command exports
├── types/                      # Core type definitions
│   └── schemas.ts              # Zod schemas for core types
└── utils/                      # Shared utilities
    ├── guards.ts               # Type guard utilities
    └── git-schemas.ts          # Git output validation

examples/
├── git-hooks/                  # Plain git hooks examples
├── husky/                      # Husky integration examples
├── simple-git-hooks/           # simple-git-hooks integration examples
└── lint-staged/                # lint-staged integration examples

docs/
└── constitutions/
    ├── current -> v2           # Symlink to current version
    ├── v1/                     # Previous constitution
    └── v2/                     # Current constitution (streamlined)
        ├── meta.md
        ├── architecture.md
        ├── patterns.md
        ├── schema-rules.md
        ├── tech-stack.md
        └── testing.md
```

## Publishing

commitment is intended to be published to npm. Before publishing:

```bash
# Clean and build
bun run clean
bun run build

# Verify everything works
./dist/cli.js --dry-run

# Publish (requires npm access)
npm publish
```

The `prepublishOnly` script automatically cleans and builds before publishing.

## Development Notes

- Package manager is Bun (for development) - end users can still use npm/yarn/pnpm
- Build targets Node.js 18+ with ESM-only output
- Uses Bun's built-in bundler for fast builds with dual entry points (CLI + library)
- Test runner is bun:test (Jest-compatible API)
- CLI file has relaxed linter rules (allows `console.log` and `process.exit`)
- Config files have relaxed rules (no default export restriction)
- Always use commitment itself for commits (dogfooding!)

## Contributing

When working on commitment:

1. Create a new stacked branch with `gs bc <branch-name>`
2. Make your changes following the code style guidelines
3. Run `bun run lint:fix` to ensure code quality
4. Use commitment itself to generate commit messages
5. Continue with `gs bc` for the next ticket
6. Submit the stack with `gs stack submit`

## Example Session

```bash
# Start working on issue #1
gs bc issue-1-add-timeout-option
# ... make changes ...
git add .
./dist/cli.js  # Uses commitment to generate message

# Start working on issue #2 (stacked on #1)
gs bc issue-2-improve-error-handling
# ... make changes ...
git add .
./dist/cli.js

# Submit both PRs
gs stack submit

# If you need to update issue #1:
git checkout issue-1-add-timeout-option
# ... make more changes ...
git add .
git commit --amend --no-edit
gs stack restack  # Rebases issue #2 on top
```

This workflow keeps commits clean, branches organized, and PRs reviewable in logical stacks.
