# Type Safety Refactor - Clarifications & FAQs

**Specification**: type-safety-refactor.md
**Plan**: type-safety-refactor.plan.yaml
**Created**: 2025-10-08
**Status**: Pre-implementation

## Overview

This document addresses common questions and clarifications about the type safety refactor pass.

## Why This Refactor?

### Q: Why add runtime validation when TypeScript already provides type safety?

**A**: TypeScript only provides **compile-time** type safety. Runtime validation is essential because:

1. **User Input**: CLI arguments, config files, and environment variables are unknown at compile time
2. **External Data**: Git output, API responses, and file contents can be malformed
3. **Configuration**: Users can pass invalid JSON or misconfigured provider settings
4. **Early Failure**: Better to fail fast with a clear error than crash deep in execution
5. **Better DX**: Validation errors can guide users to fix issues immediately

**Example**:

```typescript
// TypeScript says this is fine at compile time:
const config: ProviderConfig = JSON.parse(userInput);
// But userInput might be invalid JSON or wrong shape!

// With Zod:
const config = providerConfigSchema.parse(JSON.parse(userInput));
// Now we get clear errors if the structure is wrong
```

### Q: Why Zod instead of other validation libraries?

**A**: Zod was chosen because:

1. **Already in use**: We already use Zod for provider configs (`src/providers/types.ts`)
2. **Type inference**: TypeScript types are automatically inferred from schemas
3. **Great errors**: Zod provides detailed, structured error messages
4. **Composable**: Schemas can be composed and extended easily
5. **Performance**: Fast validation with good tree-shaking
6. **TypeScript-first**: Built specifically for TypeScript

### Q: Won't this add significant performance overhead?

**A**: No, for several reasons:

1. **Boundary validation only**: We validate at system boundaries (CLI input, generator construction), not in hot loops
2. **One-time cost**: Most validation happens once at startup or command invocation
3. **Target < 5ms**: Our performance target is < 5ms overhead per operation
4. **Zod is fast**: Zod is highly optimized for runtime validation
5. **Benchmarking**: We'll benchmark before/after to ensure no regression

**Validation points** (infrequent):

- CLI options parsing: Once per command
- Generator construction: Once per commit
- Provider config: Once at initialization

**Not validated** (frequent):

- Internal function calls
- String operations
- Array iterations

## Architecture Questions

### Q: Why create separate schema files instead of putting schemas in existing files?

**A**: Separation of concerns and clarity:

1. **Single Responsibility**: Schema files focus solely on type definitions and validation
2. **Easy to Find**: Developers know exactly where to look for type schemas
3. **Easier Testing**: Schema files can be tested independently
4. **Reusability**: Schemas can be imported and composed
5. **Clarity**: Keeps business logic separate from type definitions

**File organization**:

```
src/types/schemas.ts     → Core domain types
src/cli/schemas.ts       → CLI-specific types
src/utils/git-schemas.ts → Git output types
src/providers/types.ts   → Provider types (already exists)
```

### Q: Why not just use inline validation with Zod in existing files?

**A**: That would work but has downsides:

1. **Schema Discovery**: Harder to find all schemas when scattered
2. **Duplication Risk**: Same schema might be redefined in multiple places
3. **Testing Complexity**: Harder to test schemas in isolation
4. **Documentation**: Single source of truth makes documentation easier
5. **Migration**: Centralized schemas make future changes easier

### Q: How does this relate to the provider type system that already uses Zod?

**A**: This refactor **extends** the pattern established in `src/providers/types.ts`:

**Current state**:

- ✅ Provider configs: Use Zod schemas (`providerConfigSchema`)
- ❌ Generator types: Pure TypeScript (no validation)
- ❌ CLI options: Pure TypeScript (no validation)
- ❌ Git outputs: Pure TypeScript (no validation)

**After refactor**:

- ✅ **Everything** uses Zod schemas for consistency
- ✅ Single pattern across the entire codebase
- ✅ Runtime safety everywhere, not just providers

### Q: Why create new directories like `src/types/` and `src/cli/`?

**A**: Current structure already exists but isn't fully utilized:

**Current**:

```
src/
├── cli.ts          ← Single file (could grow)
├── generator.ts    ← Single file
└── providers/      ← Well-organized directory
```

**Proposed**:

```
src/
├── types/          ← NEW: Core type schemas
├── cli/            ← NEW: CLI module (currently just cli.ts)
├── generator.ts    ← Stays as-is
└── providers/      ← Already well-organized
```

This prepares for growth:

- CLI might grow beyond a single file
- Types deserve dedicated space
- Mirrors provider structure (clean separation)

**Alternative considered**: Keep everything in single files. Rejected because it doesn't scale well.

## Implementation Questions

### Q: What happens to existing TypeScript types?

**A**: They're **replaced** by types inferred from Zod schemas:

**Before**:

```typescript
// Manual type definition
export type CommitTask = {
  title: string;
  description: string;
  produces: string[];
};
```

**After**:

```typescript
// Schema is source of truth
export const commitTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  produces: z.array(z.string()).default([]),
});

// Type is automatically inferred
export type CommitTask = z.infer<typeof commitTaskSchema>;
```

**Benefits**:

- Single source of truth (schema)
- Runtime validation available
- Types stay in sync with validation rules

### Q: How do we handle the generator's `provider` field that accepts both `AIProvider | ProviderConfig`?

**A**: This is a known complexity. Two approaches:

**Option 1: Keep current union, add validation helper** (Recommended)

```typescript
// In generator constructor:
if (config.provider) {
  if ('generateCommitMessage' in config.provider) {
    // It's an AIProvider instance - use directly
    this.provider = config.provider;
  } else {
    // It's a ProviderConfig - validate and create
    const validated = providerConfigSchema.parse(config.provider);
    this.provider = createProvider(validated);
  }
}
```

**Option 2: Separate config fields**

```typescript
type Config = {
  provider?: AIProvider; // Instance
  providerConfig?: ProviderConfig; // Config to create instance
};
```

We'll use **Option 1** to maintain backward compatibility.

### Q: What about the deprecated fields like `aiCommand` and `aiTimeout`?

**A**: They remain supported but with warnings:

**Schema**:

```typescript
export const commitMessageGeneratorConfigSchema = z
  .object({
    // ... other fields ...

    // Deprecated but still accepted
    aiCommand: z.string().optional(),
    aiTimeout: z.number().positive().optional(),
  })
  .superRefine((config, ctx) => {
    if (config.aiCommand || config.aiTimeout) {
      // Could add warning here or handle in constructor
    }
  });
```

**Constructor**:

```typescript
constructor(config: CommitMessageGeneratorConfig) {
  const validated = validateGeneratorConfig(config);

  if (validated.aiCommand || validated.aiTimeout) {
    this.logger.warn('aiCommand and aiTimeout are deprecated');
  }

  // ... rest of constructor
}
```

This maintains **backward compatibility** while guiding users to new APIs.

### Q: How do we validate git output without breaking existing functionality?

**A**: Git validation is **defensive**, not strict:

**Strategy**:

1. **Validate structure**: Ensure basic shape is correct
2. **Allow flexibility**: Don't be overly strict on content
3. **Graceful degradation**: If validation fails, log warning but continue
4. **Focus on critical fields**: Validate what matters (file paths, status codes)

**Example**:

```typescript
async function getGitStatus(cwd: string): Promise<GitStatus> {
  const { stdout } = await execa('git', ['status', '--porcelain'], { cwd });

  // Parse into structure
  const parsed = {
    hasChanges: stdout.trim().length > 0,
    stagedFiles: /* ... */,
    statusLines: /* ... */,
  };

  // Validate - throws if critical fields are wrong
  try {
    return validateGitStatus(parsed);
  } catch (error) {
    // Could log error but still return parsed data if needed
    logger.warn('Git status validation failed', error);
    return parsed; // Fallback
  }
}
```

### Q: How do type guards fit in with Zod validation?

**A**: They serve different purposes:

**Zod validation** → For **unknown data** (user input, external data)

```typescript
// Parse unknown data into typed data
const config = providerConfigSchema.parse(unknownInput);
```

**Type guards** → For **narrowing known types** (discriminated unions, optional values)

```typescript
// Narrow a known type
if (isCLIProviderConfig(config)) {
  // TypeScript now knows config.command exists
  console.log(config.command);
}
```

**Both together**:

```typescript
// 1. Validate unknown input
const config = providerConfigSchema.parse(userInput);

// 2. Narrow the validated type
if (isCLIProviderConfig(config)) {
  // Safe to access CLI-specific fields
}
```

## Testing Questions

### Q: How much test coverage is expected?

**A**: **100% for schema modules**, normal coverage for refactored files:

**New schema files** (100% required):

- `src/types/schemas.ts`
- `src/cli/schemas.ts`
- `src/utils/git-schemas.ts`

**Refactored files** (maintain existing coverage):

- `src/generator.ts`
- `src/cli.ts`
- `src/providers/*`

**Rationale**: Schemas are critical infrastructure and small enough to test exhaustively.

### Q: What kind of tests are needed?

**A**: Three categories:

**1. Schema Validation Tests** (unit tests)

```typescript
describe('commitTaskSchema', () => {
  it('accepts valid task', () => {
    const task = { title: 'Test', description: 'Desc', produces: [] };
    expect(() => commitTaskSchema.parse(task)).not.toThrow();
  });

  it('rejects empty title', () => {
    const task = { title: '', description: 'Desc', produces: [] };
    expect(() => commitTaskSchema.parse(task)).toThrow();
  });

  // ... more edge cases
});
```

**2. Integration Tests** (validation across boundaries)

```typescript
describe('CLI to Generator validation', () => {
  it('validates CLI options before creating generator', () => {
    const invalidOptions = { cwd: '', ai: 'not-a-boolean' };
    expect(() => validateCLIOptions(invalidOptions)).toThrow();
  });
});
```

**3. Error Message Tests** (validate user experience)

```typescript
describe('Error messages', () => {
  it('provides actionable error for invalid config', () => {
    try {
      validateGeneratorConfig({ enableAI: 'yes' }); // wrong type
    } catch (error) {
      expect(error.message).toContain('enableAI');
      expect(error.message).toContain('boolean');
    }
  });
});
```

### Q: How do we test backward compatibility?

**A**: Existing tests should all pass:

**Strategy**:

1. **Run full test suite** before any changes (establish baseline)
2. **After each phase**, ensure all existing tests pass
3. **Add regression tests** for deprecated fields
4. **Manual testing** of common workflows

**Example regression test**:

```typescript
describe('Backward compatibility', () => {
  it('accepts deprecated aiCommand field', () => {
    const config = {
      aiCommand: 'claude',
      aiTimeout: 30000,
    };

    expect(() => new CommitMessageGenerator(config)).not.toThrow();
  });
});
```

## Migration Questions

### Q: Is this a breaking change?

**A**: **No**, this refactor maintains full backward compatibility:

**No breaking changes**:

- ✅ All existing APIs work identically
- ✅ Deprecated fields still supported (with warnings)
- ✅ All existing tests pass
- ✅ Generator constructor accepts same inputs
- ✅ CLI flags unchanged

**New capabilities**:

- ✅ Better error messages
- ✅ Runtime validation
- ✅ Type safety guarantees

### Q: Do users need to change their code?

**A**: **No** for current users, **recommended** for new code:

**Existing code** (still works):

```typescript
const generator = new CommitMessageGenerator({
  aiCommand: 'claude', // Still works, deprecated
  aiTimeout: 30000,
});
```

**New code** (recommended):

```typescript
const generator = new CommitMessageGenerator({
  providerConfig: {
    type: 'cli',
    provider: 'claude',
    timeout: 30000,
  },
});
```

### Q: How long will deprecated fields be supported?

**A**: Until next major version (1.0.0):

**Timeline** (proposed):

- **v0.x**: Deprecated fields supported with warnings
- **v1.0.0**: Remove deprecated fields (breaking change)
- **Documentation**: Migration guide provided before 1.0.0

## Performance Questions

### Q: What's the actual performance impact of Zod validation?

**A**: Based on Zod benchmarks and our usage:

**Estimated overhead per operation**:

- Simple object validation: **< 1ms**
- Complex nested validation: **< 5ms**
- Array validation: **< 1ms per 100 items**

**Our targets**:

- CLI option parsing: < 2ms (one-time per command)
- Generator config: < 3ms (one-time per commit)
- Provider config: < 2ms (one-time per provider)

**Total overhead per commit**: **< 10ms** (imperceptible to users)

### Q: Can we optimize validation for performance?

**A**: Yes, several strategies:

**1. Parse once, cache result**:

```typescript
class CommitMessageGenerator {
  private validatedConfig: ValidatedConfig;

  constructor(config: unknown) {
    // Validate once in constructor
    this.validatedConfig = validateGeneratorConfig(config);
  }

  // Use cached validated config everywhere
}
```

**2. Use `.safeParse()` for non-critical validation**:

```typescript
// For optional validation that shouldn't throw
const result = schema.safeParse(data);
if (result.success) {
  // Use validated data
} else {
  // Log error, use fallback
}
```

**3. Lazy schema compilation**:

```typescript
// Schemas are compiled once when imported
export const schema = z.object({
  /* ... */
});
// Subsequent parses reuse compiled schema
```

### Q: Will this slow down tests?

**A**: No, for several reasons:

1. **Mocking**: Tests often mock validators or use valid fixtures
2. **Fast validation**: Zod is optimized for speed
3. **Parallel execution**: Vitest runs tests in parallel
4. **Isolated tests**: Schema tests are small and fast

**Target**: Test suite should remain under 30 seconds total.

## Documentation Questions

### Q: Where should users look for type documentation?

**A**: Multiple sources, each serving a purpose:

**1. TypeScript types** (for IDE autocomplete):

```typescript
// Hover over type to see structure
const task: CommitTask = {
  /* IDE shows fields */
};
```

**2. Zod schemas** (for validation rules):

```typescript
// In src/types/schemas.ts
export const commitTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  // ...
});
```

**3. TSDoc comments** (for detailed docs):

````typescript
/**
 * Schema for task that produces a commit
 *
 * @example
 * ```typescript
 * const task = validateCommitTask({
 *   title: 'Add feature',
 *   description: 'Implement new feature',
 *   produces: ['src/feature.ts'],
 * });
 * ```
 */
export const commitTaskSchema = /* ... */;
````

**4. CLAUDE.md** (for patterns and guides):

- Schema-first development
- Validation at boundaries
- Error handling patterns

### Q: How do we document the migration from pure TypeScript to Zod?

**A**: In CLAUDE.md, add migration section:

**Before**:

```typescript
type MyConfig = {
  name: string;
  timeout?: number;
};

function create(config: MyConfig) {
  /* ... */
}
```

**After**:

```typescript
const myConfigSchema = z.object({
  name: z.string(),
  timeout: z.number().positive().optional(),
});

type MyConfig = z.infer<typeof myConfigSchema>;

function create(config: MyConfig) {
  const validated = myConfigSchema.parse(config);
  // ...
}
```

**Benefits explained**:

- Runtime validation
- Better error messages
- Single source of truth
- Type inference

## Edge Cases & Special Scenarios

### Q: What happens when validation fails in the CLI?

**A**: User-friendly error message with guidance:

**Bad input**:

```bash
commitment --provider invalid-provider
```

**Good error output**:

```
❌ Configuration error:
  - provider: Invalid enum value. Expected 'claude' | 'codex' | 'cursor', received 'invalid-provider'

Available providers:
  - claude (Claude CLI)
  - codex (Codex CLI)

Run `commitment --list-providers` for more info
```

**Implementation**:

```typescript
try {
  const config = parseProviderConfig(options.provider);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error(chalk.red('❌ Configuration error:'));
    for (const issue of error.issues) {
      console.error(chalk.red(`  - ${issue.path.join('.')}: ${issue.message}`));
    }
    console.log(chalk.gray('\nRun `commitment --help` for usage info'));
  }
  process.exit(1);
}
```

### Q: What happens when git returns unexpected output?

**A**: Defensive validation with fallback:

**Strategy**:

```typescript
try {
  const validated = validateGitStatus(parsed);
  return validated;
} catch (error) {
  // Log warning but don't crash
  logger.warn('Unexpected git output format', error);

  // Return parsed data anyway (best effort)
  return parsed;
}
```

**Rationale**: Git is external and might vary across versions. Better to warn than crash.

### Q: How do we handle the lazy-loaded provider schema imports?

**A**: Zod's `z.lazy()` handles circular dependencies:

**Problem**: Generator config references provider config, which might reference back
**Solution**: Use `z.lazy()` for delayed evaluation

```typescript
export const commitMessageGeneratorConfigSchema = z.object({
  providerConfig: z
    .lazy(() => import('../providers/types.js').then((m) => m.providerConfigSchema))
    .optional(),
});
```

**How it works**:

1. Schema definition doesn't immediately import provider types
2. First parse triggers lazy import
3. Subsequent parses reuse cached schema
4. Prevents circular dependency issues

### Q: What if a Zod validation is too strict and breaks real-world usage?

**A**: Easy to adjust schemas:

**Process**:

1. Identify the problematic validation
2. Update schema to be more permissive
3. Add regression test to prevent future issues
4. Document the rationale

**Example**:

```typescript
// Too strict
const schema = z.object({
  timeout: z.number().min(1000), // Forces 1s minimum
});

// More permissive
const schema = z.object({
  timeout: z.number().positive(), // Any positive number
});
```

Schemas are **code**, easy to adjust based on real-world needs.

## Future Considerations

### Q: Can we generate JSON schemas from Zod schemas?

**A**: Yes, using `zod-to-json-schema`:

**Future enhancement**:

```typescript
import { zodToJsonSchema } from 'zod-to-json-schema';

const jsonSchema = zodToJsonSchema(commitTaskSchema);
// Output JSON schema for docs, validation, IDE support
```

**Use cases**:

- Generate OpenAPI specs
- Provide schema for config files
- IDE autocomplete for JSON configs

### Q: Could we support config files (e.g., `commitment.config.js`)?

**A**: Yes, validation makes this easy:

**Future feature**:

```typescript
// commitment.config.js
export default {
  providerChain: [
    { type: 'cli', provider: 'claude' },
    { type: 'cli', provider: 'codex' },
  ],
  signature: 'Custom signature',
};
```

**Validation**:

```typescript
import config from './commitment.config.js';
const validated = commitConfigSchema.parse(config);
```

The schemas we're building make this trivial to add later.

### Q: Will this pattern scale as the codebase grows?

**A**: Yes, the pattern is designed to scale:

**Scalability features**:

1. **Composable schemas**: Small schemas compose into larger ones
2. **Modular organization**: Schemas organized by domain
3. **Single source of truth**: One schema per type
4. **Easy to extend**: Add new schemas following same pattern
5. **Clear boundaries**: Each module validates its inputs

**Example of composition**:

```typescript
// Small schemas
const nameSchema = z.string().min(1);
const emailSchema = z.string().email();

// Composed schema
const userSchema = z.object({
  name: nameSchema,
  email: emailSchema,
});

// Further composition
const teamSchema = z.object({
  leader: userSchema,
  members: z.array(userSchema),
});
```

## Summary

This refactor establishes **runtime type safety** as a first-class citizen in the codebase:

✅ **Single source of truth**: Zod schemas define types
✅ **Runtime validation**: Catch errors at boundaries
✅ **Better UX**: Clear, actionable error messages
✅ **Maintainable**: Easy to add new validated types
✅ **Performant**: < 5ms overhead per operation
✅ **Backward compatible**: No breaking changes
✅ **Future-proof**: Scales with codebase growth

The patterns established here will serve as the foundation for all future type safety needs.
