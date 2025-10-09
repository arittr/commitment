# Specification: Type Safety and Encapsulation Refactor Pass

**Status**: Draft
**Created**: 2025-10-08
**Epic**: Type Safety & Architecture Hardening
**Related Issues**: Post-Codex cleanup, firm type boundaries

## Overview

Perform a comprehensive refactor pass to establish firm type boundaries, add Zod validation at all system boundaries, improve encapsulation, and maintain a clean, easy-to-extend architecture.

## Background

### Current State

**Strong Points**:

- Zod schemas already exist in `src/providers/types.ts` for provider configs
- Provider system has good abstraction layers (Base classes, interfaces)
- Strict TypeScript configuration enabled
- Clean separation between CLI, generator, and provider layers
- Error hierarchy well-established

**Areas for Improvement**:

1. **Generator types lack runtime validation** - `CommitMessageGeneratorConfig`, `CommitMessageOptions`, `CommitTask` are pure TypeScript
2. **CLI options parsing is manual** - Commander options converted manually without validation
3. **Mixed type/schema patterns** - Some modules use Zod, others use pure TS
4. **Implicit type boundaries** - No clear validation at module boundaries
5. **Generator config accepts both instances and configs** - Type union `AIProvider | ProviderConfig` makes validation complex
6. **Guards module is minimal** - Only one guard function exists
7. **No validation for git output** - Assumes git commands return valid data
8. **CLI file categorization logic is duplicated** - Same patterns in generator and CLI

### Problems

1. **Runtime Safety Gap**: TypeScript types provide compile-time safety but no runtime validation
2. **Configuration Errors**: Invalid configurations fail at runtime instead of being caught early
3. **Type Boundaries Unclear**: No clear contracts between modules
4. **Maintainability**: Adding new features requires touching multiple files with manual validation
5. **Testing Complexity**: Mocking requires understanding internal type juggling
6. **Documentation Drift**: Types and validation can diverge from actual usage

### Goals

1. **Comprehensive Zod schemas** for all public interfaces
2. **Runtime validation** at all system boundaries
3. **Clear type boundaries** between modules
4. **Single source of truth** for types (Zod schemas → TypeScript types)
5. **Improved developer experience** with better error messages
6. **Maintainable patterns** that scale as the codebase grows

## Requirements

### Functional Requirements

#### FR1: Zod Schemas for All Public Interfaces

- **FR1.1**: Create Zod schema for `CommitTask` type
- **FR1.2**: Create Zod schema for `CommitMessageOptions` type
- **FR1.3**: Create Zod schema for `CommitMessageGeneratorConfig` type
- **FR1.4**: Create Zod schema for `GenerateOptions` type
- **FR1.5**: Create Zod schemas for CLI option parsing
- **FR1.6**: All existing Zod schemas remain unchanged (backward compatible)

#### FR2: Runtime Validation at Boundaries

- **FR2.1**: Validate generator config in `CommitMessageGenerator` constructor
- **FR2.2**: Validate commit options in `generateCommitMessage` method
- **FR2.3**: Validate CLI parsed options before generator creation
- **FR2.4**: Validate git output structure in generator
- **FR2.5**: Provide clear, actionable error messages on validation failures

#### FR3: Type Guard Utilities

- **FR3.1**: Expand `guards.ts` with comprehensive type guards
- **FR3.2**: Add guards for discriminated unions (provider configs)
- **FR3.3**: Add guards for optional/nullable types
- **FR3.4**: Add guards for array validation
- **FR3.5**: All guards include proper TypeScript type predicates

#### FR4: Type Boundaries

- **FR4.1**: Generator module has clear input/output contracts
- **FR4.2**: Provider module exports only validated types
- **FR4.3**: CLI module validates before passing to generator
- **FR4.4**: No type assertions (`as`) in production code except where absolutely necessary
- **FR4.5**: All module exports are properly typed

### Non-Functional Requirements

#### NFR1: Performance

- **NFR1.1**: Schema validation adds < 5ms overhead per operation
- **NFR1.2**: Schemas are compiled once and reused
- **NFR1.3**: No performance regression in existing flows

#### NFR2: Code Quality

- **NFR2.1**: All public functions have explicit return types
- **NFR2.2**: No `any` types in production code
- **NFR2.3**: No type assertions except for well-documented edge cases
- **NFR2.4**: Strict TypeScript passes with no warnings
- **NFR2.5**: ESLint passes with no violations

#### NFR3: Documentation

- **NFR3.1**: All Zod schemas have TSDoc comments explaining purpose
- **NFR3.2**: Validation error messages are user-friendly
- **NFR3.3**: Type guards documented with usage examples
- **NFR3.4**: CLAUDE.md updated with type safety patterns

#### NFR4: Maintainability

- **NFR4.1**: Single source of truth for each type (Zod schema)
- **NFR4.2**: Type changes require updating only schema file
- **NFR4.3**: No code duplication in validation logic
- **NFR4.4**: Easy to add new validated types

## Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Type System Layers                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Layer 1: Schema Definitions (Zod)            │  │
│  │                                                      │  │
│  │  - Single source of truth                           │  │
│  │  - Runtime validation rules                         │  │
│  │  - Type inference                                   │  │
│  └────────────────┬─────────────────────────────────────┘  │
│                   │                                         │
│                   │ z.infer<typeof schema>                  │
│                   ▼                                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Layer 2: TypeScript Types (Inferred)         │  │
│  │                                                      │  │
│  │  - Automatically derived from schemas               │  │
│  │  - Used in function signatures                      │  │
│  │  - Compile-time type checking                       │  │
│  └────────────────┬─────────────────────────────────────┘  │
│                   │                                         │
│                   │ Type guards & validation                │
│                   ▼                                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Layer 3: Runtime Validation                  │  │
│  │                                                      │  │
│  │  - Validate at system boundaries                    │  │
│  │  - Type guards for narrowing                        │  │
│  │  - Error messages for users                         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Module Boundaries & Validation Points

```
┌─────────────┐
│   CLI       │
│             │
│  1. Parse   │ ←─ Validation Point A: CLI options
│  2. Validate│    - Parse commander options
│  3. Convert │    - Validate with cliOptionsSchema
└─────┬───────┘    - Convert to generator config
      │
      │ validated config + options
      ▼
┌─────────────┐
│  Generator  │
│             │
│  1. Receive │ ←─ Validation Point B: Generator config
│  2. Validate│    - Validate config with generatorConfigSchema
│  3. Init    │    - Validate options with commitOptionsSchema
└─────┬───────┘    - Create validated task
      │
      │ validated prompt + options
      ▼
┌─────────────┐
│  Provider   │
│             │
│  1. Receive │ ←─ Validation Point C: Provider-specific
│  2. Execute │    - Already validated via providerConfigSchema
│  3. Parse   │    - Parse response
└─────┬───────┘    - Validate output
      │
      │ validated commit message
      ▼
┌─────────────┐
│  Git        │
│             │
│  1. Stage   │ ←─ Validation Point D: Git operations
│  2. Commit  │    - Validate git status output
│  3. Verify  │    - Validate commit success
└─────────────┘
```

### Component Specifications

#### 1. Core Type Schemas (`src/types/schemas.ts` - NEW FILE)

**Purpose**: Central location for all core type schemas

**Contents**:

```typescript
import { z } from 'zod';

/**
 * Schema for task that produces a commit
 */
export const commitTaskSchema = z.object({
  /** Human-readable task title */
  title: z.string().min(1, 'Task title is required'),

  /** Detailed description of what the task accomplishes */
  description: z.string().min(1, 'Task description is required'),

  /** Files or artifacts produced by this task */
  produces: z.array(z.string()).default([]),
});

/**
 * Schema for options passed to commit message generation
 */
export const commitMessageOptionsSchema = z.object({
  /** Working directory for git operations */
  workdir: z.string().min(1, 'Working directory is required'),

  /** Specific files involved in the change */
  files: z.array(z.string()).optional(),

  /** Task execution output or additional context */
  output: z.string().optional(),
});

/**
 * Schema for logger configuration
 */
export const loggerSchema = z.object({
  warn: z.function().args(z.string()).returns(z.void()),
});

/**
 * Schema for commit message generator configuration
 */
export const commitMessageGeneratorConfigSchema = z
  .object({
    /** Enable/disable AI generation (default: true) */
    enableAI: z.boolean().default(true).optional(),

    /** Custom logger function */
    logger: loggerSchema.optional(),

    /** Custom signature to append to commits */
    signature: z.string().optional(),

    /** AI provider configuration (not instance) */
    providerConfig: z
      .lazy(() => import('../providers/types.js').then((m) => m.providerConfigSchema))
      .optional(),

    /** Provider chain configs for fallback support */
    providerChain: z
      .lazy(() => import('../providers/types.js').then((m) => z.array(m.providerConfigSchema)))
      .optional(),

    // Deprecated fields
    aiCommand: z.string().optional(),
    aiTimeout: z.number().positive().optional(),
    autoDetect: z.boolean().optional(),
  })
  .refine(
    (config) => {
      // Ensure providerConfig and providerChain are not both provided
      if (config.providerConfig && config.providerChain) {
        return false;
      }
      return true;
    },
    {
      message: 'Cannot specify both providerConfig and providerChain',
    },
  );

/**
 * TypeScript types inferred from schemas
 */
export type CommitTask = z.infer<typeof commitTaskSchema>;
export type CommitMessageOptions = z.infer<typeof commitMessageOptionsSchema>;
export type CommitMessageGeneratorConfig = z.infer<typeof commitMessageGeneratorConfigSchema>;

/**
 * Validation helpers
 */
export function validateCommitTask(task: unknown): CommitTask {
  return commitTaskSchema.parse(task);
}

export function validateCommitOptions(options: unknown): CommitMessageOptions {
  return commitMessageOptionsSchema.parse(options);
}

export function validateGeneratorConfig(config: unknown): CommitMessageGeneratorConfig {
  return commitMessageGeneratorConfigSchema.parse(config);
}
```

#### 2. CLI Options Schema (`src/cli/schemas.ts` - NEW FILE)

**Purpose**: Validate CLI options from commander

**Contents**:

```typescript
import { z } from 'zod';

/**
 * Schema for raw CLI options from commander
 */
export const cliOptionsSchema = z.object({
  ai: z.boolean().default(true),
  aiCommand: z.string().default('claude'),
  autoDetect: z.boolean().optional(),
  checkProvider: z.boolean().optional(),
  claudeCommand: z.string().optional(),
  claudeTimeout: z.string().optional(),
  cwd: z.string().default(process.cwd()),
  dryRun: z.boolean().optional(),
  fallback: z.array(z.string()).optional(),
  listProviders: z.boolean().optional(),
  messageOnly: z.boolean().optional(),
  provider: z.string().optional(),
  providerConfig: z.string().optional(),
  signature: z.string().optional(),
  timeout: z.string().default('120000'),
});

export type CLIOptions = z.infer<typeof cliOptionsSchema>;

/**
 * Schema for parsed provider configuration from JSON
 */
export const parsedProviderConfigSchema = z.lazy(() =>
  import('../providers/types.js').then((m) => m.providerConfigSchema),
);

/**
 * Validate and parse CLI options
 */
export function validateCLIOptions(options: unknown): CLIOptions {
  return cliOptionsSchema.parse(options);
}

/**
 * Parse and validate provider config JSON string
 */
export function parseProviderConfigJSON(json: string): unknown {
  try {
    const parsed = JSON.parse(json);
    return parsedProviderConfigSchema.parse(parsed);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON: ${error.message}`);
    }
    throw error;
  }
}
```

#### 3. Git Output Schemas (`src/utils/git-schemas.ts` - NEW FILE)

**Purpose**: Validate git command outputs

**Contents**:

```typescript
import { z } from 'zod';

/**
 * Schema for git status line
 * Format: "XY filename" where X = index status, Y = worktree status
 */
export const gitStatusLineSchema = z
  .string()
  .regex(/^[MADRCU?!]{1,2} .+$/, 'Invalid git status line format');

/**
 * Schema for git status output
 */
export const gitStatusSchema = z.object({
  hasChanges: z.boolean(),
  stagedFiles: z.array(z.string()),
  statusLines: z.array(gitStatusLineSchema),
});

/**
 * Schema for git diff output
 */
export const gitDiffSchema = z.string();

/**
 * Schema for categorized files
 */
export const fileCategoriesSchema = z.object({
  components: z.array(z.string()).default([]),
  apis: z.array(z.string()).default([]),
  tests: z.array(z.string()).default([]),
  configs: z.array(z.string()).default([]),
  docs: z.array(z.string()).default([]),
});

export type GitStatus = z.infer<typeof gitStatusSchema>;
export type FileCategories = z.infer<typeof fileCategoriesSchema>;

/**
 * Validate git status output
 */
export function validateGitStatus(status: unknown): GitStatus {
  return gitStatusSchema.parse(status);
}

/**
 * Validate file categorization
 */
export function validateFileCategories(categories: unknown): FileCategories {
  return fileCategoriesSchema.parse(categories);
}
```

#### 4. Enhanced Type Guards (`src/utils/guards.ts`)

**Current**: Only `hasContent` guard
**Proposed**: Comprehensive guard utilities

```typescript
/**
 * Type guard utilities for strict boolean expressions
 */

/**
 * Check if a string has content (not null, undefined, or empty after trimming)
 */
export function hasContent(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Check if value is a non-empty array
 */
export function isNonEmptyArray<T>(value: T[] | undefined | null): value is [T, ...T[]] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Check if value is defined (not null or undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Check if value is a valid object (not null, not array)
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Check if error is an instance of Error
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Check if value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Check if value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

/**
 * Check if value is a valid file path (non-empty string)
 */
export function isFilePath(value: unknown): value is string {
  return isString(value) && hasContent(value) && value.length > 0;
}

/**
 * Check if object has property with type guard
 */
export function hasProperty<K extends string>(obj: unknown, key: K): obj is Record<K, unknown> {
  return isObject(obj) && key in obj;
}

/**
 * Type guard for validating arrays of specific type
 */
export function isArrayOf<T>(value: unknown, guard: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every(guard);
}
```

#### 5. Provider Type Refinements (`src/providers/types.ts`)

**Changes**: Add validation helpers and refine schemas

```typescript
// Add to existing file:

/**
 * Validate provider configuration with detailed error messages
 */
export function validateProviderConfigWithDetails(config: unknown): {
  success: boolean;
  data?: ProviderConfig;
  error?: {
    message: string;
    issues: Array<{ path: string; message: string }>;
  };
} {
  const result = providerConfigSchema.safeParse(config);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    error: {
      message: 'Invalid provider configuration',
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    },
  };
}

/**
 * Create validated provider config with defaults
 */
export function createProviderConfig(partial: Partial<ProviderConfig>): ProviderConfig {
  return providerConfigSchema.parse(partial);
}
```

### File Structure Changes

**New Files**:

```
src/
├── types/
│   ├── __tests__/
│   │   └── schemas.test.ts          # Tests for core schemas
│   ├── schemas.ts                   # Core type schemas (NEW)
│   └── index.ts                     # Barrel exports (NEW)
├── cli/
│   ├── __tests__/
│   │   └── schemas.test.ts          # Tests for CLI schemas
│   ├── schemas.ts                   # CLI option schemas (NEW)
│   └── index.ts                     # CLI entry (existing, refactor)
├── utils/
│   ├── __tests__/
│   │   ├── guards.test.ts           # Tests for guards (expanded)
│   │   └── git-schemas.test.ts      # Tests for git schemas (NEW)
│   ├── guards.ts                    # Type guards (expanded)
│   └── git-schemas.ts               # Git output schemas (NEW)
```

**Modified Files**:

- `src/generator.ts` - Use schemas for validation
- `src/cli.ts` - Use CLI schemas for validation
- `src/providers/types.ts` - Add validation helpers
- `src/index.ts` - Export new types and validators

### Migration Strategy

#### Phase 1: Create Schema Infrastructure (No Breaking Changes)

1. Create `src/types/schemas.ts` with all core schemas
2. Create `src/cli/schemas.ts` with CLI option schemas
3. Create `src/utils/git-schemas.ts` with git output schemas
4. Expand `src/utils/guards.ts` with new guards
5. Add comprehensive tests for all new modules
6. **No changes to existing code yet**

**Deliverable**: New schema modules with 100% test coverage

#### Phase 2: Refactor Generator to Use Schemas

1. Update `CommitMessageGenerator` constructor to validate config
2. Update `generateCommitMessage` to validate options
3. Add validation for task parameter
4. Replace inline type checks with schema validation
5. Update error messages to be user-friendly
6. **Ensure backward compatibility**

**Deliverable**: Generator with runtime validation, all tests passing

#### Phase 3: Refactor CLI to Use Schemas

1. Validate commander options using `cliOptionsSchema`
2. Use schema validation for provider config parsing
3. Validate git status output before creating tasks
4. Add validation error handling with helpful messages
5. Update CLI to catch and display Zod validation errors

**Deliverable**: CLI with runtime validation, improved error messages

#### Phase 4: Enhance Provider Type Safety

1. Add validation helpers to provider types
2. Update factory to use validated configs
3. Add runtime checks in base provider classes
4. Update tests to verify validation

**Deliverable**: Provider system with enhanced type safety

#### Phase 5: Documentation & Testing

1. Add TSDoc comments to all schemas
2. Create validation error message guide
3. Update CLAUDE.md with type safety patterns
4. Add integration tests for validation
5. Create examples of proper usage

**Deliverable**: Complete documentation and examples

### Testing Strategy

#### Unit Tests

**Schema Tests** (`src/types/__tests__/schemas.test.ts`):

```typescript
describe('commitTaskSchema', () => {
  it('should validate valid commit task');
  it('should reject empty title');
  it('should reject empty description');
  it('should default produces to empty array');
  it('should validate produces array');
});

describe('commitMessageOptionsSchema', () => {
  it('should validate valid options');
  it('should reject empty workdir');
  it('should accept optional files');
  it('should accept optional output');
});

describe('commitMessageGeneratorConfigSchema', () => {
  it('should validate valid config');
  it('should apply defaults');
  it('should reject both providerConfig and providerChain');
  it('should accept deprecated fields');
  it('should validate logger structure');
});
```

**Guard Tests** (`src/utils/__tests__/guards.test.ts`):

```typescript
describe('hasContent', () => {
  it('should return true for non-empty strings');
  it('should return false for empty strings');
  it('should return false for null/undefined');
  it('should return false for whitespace-only');
});

describe('isNonEmptyArray', () => {
  it('should return true for non-empty arrays');
  it('should return false for empty arrays');
  it('should return false for null/undefined');
  it('should narrow type correctly');
});

// ... tests for all guards
```

**Git Schema Tests** (`src/utils/__tests__/git-schemas.test.ts`):

```typescript
describe('gitStatusLineSchema', () => {
  it('should validate valid status lines');
  it('should reject invalid format');
  it('should handle all git status codes');
});

describe('gitStatusSchema', () => {
  it('should validate valid status object');
  it('should reject invalid structure');
});

describe('fileCategoriesSchema', () => {
  it('should validate valid categories');
  it('should apply defaults');
});
```

#### Integration Tests

**Generator Validation Integration**:

```typescript
describe('CommitMessageGenerator - validation', () => {
  it('should throw on invalid config');
  it('should throw on invalid options');
  it('should throw on invalid task');
  it('should provide helpful error messages');
});
```

**CLI Validation Integration**:

```typescript
describe('CLI - validation', () => {
  it('should validate and parse options correctly');
  it('should catch and format Zod errors');
  it('should validate provider config JSON');
  it('should provide helpful error messages');
});
```

### Documentation Requirements

#### 1. Type Safety Patterns (CLAUDE.md)

Add section:

````markdown
## Type Safety Patterns

### Schema-First Development

commitment uses Zod for runtime type safety. All public interfaces are defined as Zod schemas first, then TypeScript types are inferred from them.

**Pattern**:

```typescript
// 1. Define Zod schema
export const myConfigSchema = z.object({
  name: z.string(),
  timeout: z.number().positive().optional(),
});

// 2. Infer TypeScript type
export type MyConfig = z.infer<typeof myConfigSchema>;

// 3. Create validation helper
export function validateMyConfig(config: unknown): MyConfig {
  return myConfigSchema.parse(config);
}

// 4. Use in code
function createThing(config: MyConfig) {
  // config is validated and typed
}

// At boundaries:
const validated = validateMyConfig(userInput);
createThing(validated);
```

### Validation at Boundaries

Always validate data at system boundaries:

1. **CLI → Generator**: Validate CLI options before creating generator
2. **Generator → Provider**: Validate options before calling provider
3. **External Data → Internal**: Validate git output, API responses, etc.
4. **User Input → Config**: Validate all user-provided configuration

### Type Guards

Use type guards from `src/utils/guards.ts` for narrowing types:

```typescript
import { hasContent, isNonEmptyArray, isDefined } from './utils/guards';

if (hasContent(value)) {
  // value is string
}

if (isNonEmptyArray(items)) {
  // items is [T, ...T[]]
}

if (isDefined(optional)) {
  // optional is T (not null or undefined)
}
```

### Error Handling

Validation errors should be caught and formatted for users:

```typescript
try {
  const validated = validateConfig(input);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('Configuration error:');
    for (const issue of error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
  }
  throw error;
}
```
````

#### 2. API Documentation

Add TSDoc examples to all schemas:

````typescript
/**
 * Schema for task that produces a commit
 *
 * @example
 * ```typescript
 * const task = validateCommitTask({
 *   title: 'Add authentication',
 *   description: 'Implement JWT auth',
 *   produces: ['src/auth.ts'],
 * });
 * ```
 */
export const commitTaskSchema = z.object({ ... });
````

## Implementation Plan

### Task Breakdown

**Epic**: Type Safety & Architecture Hardening

**Tasks**:

1. **Task 1: Create Core Schema Infrastructure** (2-3 hours)
   - Create `src/types/schemas.ts`
   - Define all core schemas (task, options, config)
   - Add validation helpers
   - Write comprehensive tests
   - **Deliverable**: Core schemas with 100% test coverage

2. **Task 2: Create CLI Schema Infrastructure** (1-2 hours)
   - Create `src/cli/schemas.ts`
   - Define CLI option schema
   - Add provider config parsing schema
   - Write tests
   - **Deliverable**: CLI schemas with tests

3. **Task 3: Create Git Schema Infrastructure** (1-2 hours)
   - Create `src/utils/git-schemas.ts`
   - Define git status and output schemas
   - Add file categorization schema
   - Write tests
   - **Deliverable**: Git schemas with tests

4. **Task 4: Expand Type Guards** (1 hour)
   - Expand `src/utils/guards.ts`
   - Add comprehensive guard functions
   - Write tests for all guards
   - **Deliverable**: Comprehensive guard utilities

5. **Task 5: Refactor Generator with Validation** (2-3 hours)
   - Update constructor to validate config
   - Update methods to validate parameters
   - Add runtime validation for git output
   - Update error messages
   - Ensure all tests pass
   - **Deliverable**: Generator with runtime validation

6. **Task 6: Refactor CLI with Validation** (2-3 hours)
   - Validate commander options
   - Add error handling for validation failures
   - Improve error messages for users
   - Update help text
   - **Deliverable**: CLI with validation

7. **Task 7: Enhance Provider Type Safety** (1-2 hours)
   - Add validation helpers to provider types
   - Update factory to use validated configs
   - Add tests
   - **Deliverable**: Enhanced provider type safety

8. **Task 8: Integration Testing** (2 hours)
   - Test validation across boundaries
   - Test error message quality
   - Test backward compatibility
   - Add E2E validation tests
   - **Deliverable**: Comprehensive integration tests

9. **Task 9: Documentation** (2-3 hours)
   - Add TSDoc to all schemas
   - Update CLAUDE.md with patterns
   - Create validation error guide
   - Add usage examples
   - **Deliverable**: Complete documentation

10. **Task 10: Code Review & Polish** (1 hour)
    - Run full test suite
    - Check linting
    - Verify type safety
    - Review error messages
    - **Deliverable**: Production-ready code

**Total Estimated Time**: 15-21 hours

### Dependencies

- **Task 1, 2, 3, 4** → Can run in parallel (no dependencies)
- **Task 1** → Task 5 (generator needs core schemas)
- **Task 2** → Task 6 (CLI needs CLI schemas)
- **Task 1, 5, 6** → Task 8 (integration tests need all modules)
- **All tasks** → Task 9, Task 10

### Acceptance Criteria

**Must Have**:

- ✅ All public interfaces have Zod schemas
- ✅ Runtime validation at all system boundaries
- ✅ 100% test coverage for new schema modules
- ✅ All existing tests pass (no regressions)
- ✅ No breaking changes to public APIs
- ✅ Strict TypeScript with no warnings
- ✅ ESLint passes with no violations
- ✅ User-friendly validation error messages
- ✅ Documentation updated (CLAUDE.md, TSDoc)
- ✅ No `any` types in production code
- ✅ No type assertions except where documented

**Should Have**:

- ✅ Comprehensive type guard utilities
- ✅ Git output validation
- ✅ CLI option validation with helpful errors
- ✅ Integration tests for validation flows
- ✅ Performance benchmarks (< 5ms overhead)

**Nice to Have**:

- ✅ Validation error recovery patterns
- ✅ Schema migration guide
- ✅ Performance profiling results
- ✅ Example of custom schema extension

## Success Metrics

### Quantitative

- **Test Coverage**: 100% for schema modules
- **Type Safety**: 0 `any` types in production code
- **Performance**: < 5ms validation overhead
- **Error Clarity**: 100% of validation errors have actionable messages
- **Code Quality**: 0 ESLint violations, 0 TS warnings

### Qualitative

- **Developer Experience**: Clear error messages guide fixes
- **Maintainability**: Single source of truth for types
- **Extensibility**: Easy to add new validated types
- **Documentation**: Patterns clear and well-documented
- **Reliability**: Runtime validation catches config errors early

## Risks & Mitigations

### Risk 1: Performance Overhead from Validation

**Likelihood**: Low
**Impact**: Medium
**Mitigation**:

- Benchmark validation overhead
- Use Zod's `.parse()` only at boundaries, not in hot paths
- Consider `.safeParse()` for non-critical validation
- Cache parsed schemas where appropriate

### Risk 2: Breaking Changes During Refactor

**Likelihood**: Low
**Impact**: High
**Mitigation**:

- Maintain backward compatibility
- Add schemas alongside existing types initially
- Comprehensive test coverage before changes
- Phase refactor (schemas → generator → CLI → providers)
- Keep deprecated fields during migration

### Risk 3: Complex Validation Logic

**Likelihood**: Medium
**Impact**: Low
**Mitigation**:

- Keep schemas simple and focused
- Use refinements sparingly
- Document complex validation logic
- Provide clear error messages

### Risk 4: Documentation Drift

**Likelihood**: Low
**Impact**: Medium
**Mitigation**:

- TSDoc comments on all schemas
- Examples in documentation
- Integration tests as living documentation
- Regular documentation reviews

## Future Considerations

### Next Steps After Type Safety Refactor

1. **Schema Versioning**: Support multiple schema versions for migration
2. **Custom Validators**: Plugin system for custom validation rules
3. **Schema Generation**: Auto-generate JSON schemas from Zod
4. **Config File Support**: Validate config files (commitment.config.js)
5. **OpenAPI Integration**: Generate OpenAPI specs from schemas (if API added)

### Technical Debt Prevention

- Keep schemas co-located with their usage
- Avoid premature abstraction
- Document validation rationale
- Regular refactoring as patterns emerge
- Monitor validation performance

### Extensibility Hooks

- Schema composition for custom types
- Validation middleware for transformations
- Error formatting customization
- Schema introspection for tooling

## Appendix

### Schema Design Principles

1. **Single Source of Truth**: Define types once in Zod, infer TypeScript types
2. **Fail Fast**: Validate at boundaries, fail with clear errors
3. **User-Friendly Errors**: Every validation failure should guide the user to a fix
4. **Performance-Conscious**: Validate once, cache results
5. **Backward Compatible**: Don't break existing code

### Related Specifications

- [Provider Architecture](.speckit/add-codex-provider.md)
- [Testing Strategy](../vitest.config.ts)
- [ESLint Configuration](../eslint.config.ts)

### References

- Zod Documentation: https://zod.dev/
- TypeScript Handbook: https://www.typescriptlang.org/docs/
- Type Guards: https://www.typescriptlang.org/docs/handbook/2/narrowing.html
