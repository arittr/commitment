# Schema and Validation Rules

## Core Principle

**Schema-first development: Define schemas once, derive types automatically, validate at boundaries.**

Violating this principle allows invalid data to propagate through the system, causing runtime errors and poor user experience.

## The Schema-First Philosophy

### Why Schema-First?

**Problem:** TypeScript provides compile-time safety but NO runtime validation.

```typescript
type Config = { timeout: number };

function createThing(config: Config) {
  // TypeScript thinks config.timeout is a number
  // But at runtime, it could be ANYTHING!
  // User could pass: { timeout: "invalid" }
  // Or: { timeout: -1 }
  // Or: { timeout: NaN }
}

createThing({ timeout: "oops" } as Config);  // TypeScript: ✅  Runtime: ⛔
```

**Solution:** Schema-first with Zod.

```typescript
const configSchema = z.object({
  timeout: z.number().positive(),
});

type Config = z.infer<typeof configSchema>;

function createThing(config: unknown) {
  const validated = configSchema.parse(config);  // Runtime validation!
  // Now validated.timeout is GUARANTEED to be positive number
}

createThing({ timeout: "oops" });  // Throws ZodError with helpful message
```

### Benefits

1. **Single Source of Truth:** Schema defines both runtime validation AND TypeScript types
2. **Runtime Safety:** Catch invalid data at boundaries, not deep in execution
3. **Better Errors:** Zod provides detailed, actionable error messages
4. **Type Inference:** TypeScript types automatically derived from schemas
5. **Consistency:** Same validation logic in dev and production
6. **Documentation:** Schemas are self-documenting (min, max, format)

## Mandatory Pattern

**All types that cross system boundaries MUST follow this pattern:**

```typescript
// 1. Define Zod schema (SINGLE SOURCE OF TRUTH)
export const myTypeSchema = z.object({
  field1: z.string().min(1),
  field2: z.number().positive().optional(),
  field3: z.array(z.string()).default([]),
});

// 2. Infer TypeScript type (NO manual type definition)
export type MyType = z.infer<typeof myTypeSchema>;

// 3. Create validation helper
export function validateMyType(input: unknown): MyType {
  return myTypeSchema.parse(input);
}

// 4. Optional: Safe validation variant
export function safeValidateMyType(input: unknown): { success: true; data: MyType } | { success: false; error: ZodError } {
  return myTypeSchema.safeParse(input);
}
```

**Violation breaks architecture:** Manual type definitions and schemas can diverge.

## System Boundaries (Where to Validate)

### ALWAYS Validate At:

1. **CLI Input**
   - Commander options → `cliOptionsSchema.parse()`
   - Provider config JSON → `providerConfigSchema.parse()`

2. **Generator Construction**
   - Constructor config → `generatorConfigSchema.parse()`

3. **Public API Entry Points**
   - `generateCommitMessage(options)` → `commitOptionsSchema.parse()`

4. **External Command Output**
   - Git status → `gitStatusSchema.parse()`
   - Provider response → Parse and validate

5. **File I/O**
   - Config files → Validate on read
   - JSON parsing → Validate after parse

### NEVER Validate:

1. **Internal Functions**
   - Data already validated at boundary
   - Trust the types internally

2. **Test Setup**
   - Tests can construct typed data directly
   - No validation overhead in tests

3. **Type Guards**
   - Use TypeScript type guards (`is` predicates)
   - No runtime parsing needed

**Rule:** Validate once at boundary, trust types internally.

## Schema Organization

### By Domain

**Mandatory:** Organize schemas by domain, not by type.

```
src/
├── types/
│   └── schemas.ts           # Core domain types
├── cli/
│   └── schemas.ts           # CLI-specific types
├── utils/
│   └── git-schemas.ts       # Git output types
├── providers/
│   └── types.ts             # Provider types (with schemas)
```

**Violation breaks architecture:** Mixing schemas makes them hard to find.

### File Contents

**Mandatory:** Each schema file must contain:

1. Schema definitions
2. Type inference (`z.infer`)
3. Validation helpers (`validateX`, `safeValidateX`)
4. TSDoc comments with examples

**Example:**

```typescript
/**
 * Schema for commit message generation options
 *
 * @example
 * ```typescript
 * const options = validateCommitOptions({
 *   workdir: '/path/to/repo',
 *   files: ['src/file.ts'],
 * });
 * ```
 */
export const commitOptionsSchema = z.object({
  workdir: z.string().min(1, 'Working directory required'),
  files: z.array(z.string()).optional(),
  output: z.string().optional(),
});

export type CommitOptions = z.infer<typeof commitOptionsSchema>;

export function validateCommitOptions(options: unknown): CommitOptions {
  return commitOptionsSchema.parse(options);
}
```

## Schema Design Guidelines

### Descriptive Field Names

**Mandatory:** Use clear, unambiguous field names.

```typescript
✅ Correct:
z.object({
  timeoutMs: z.number(),         // Clear units
  enableAI: z.boolean(),         // Clear boolean
  providerName: z.string(),      // Clear entity
})

❌ Wrong:
z.object({
  timeout: z.number(),           // Seconds? Milliseconds?
  ai: z.boolean(),               // Enable or status?
  provider: z.string(),          // Name or instance?
})
```

### Validation Constraints

**Mandatory:** Add meaningful constraints.

```typescript
✅ Correct:
z.string()
  .min(1, 'Name cannot be empty')
  .max(100, 'Name too long (max 100 chars)');

z.number()
  .positive('Timeout must be positive')
  .max(600000, 'Timeout too large (max 10 minutes)');

❌ Wrong:
z.string();  // No constraints
z.number();  // Could be negative, NaN, Infinity
```

### Default Values

**Mandatory:** Provide defaults for optional fields with sensible defaults.

```typescript
✅ Correct:
z.object({
  enableAI: z.boolean().default(true),
  timeout: z.number().default(120000),
  files: z.array(z.string()).default([]),
})

❌ Wrong:
z.object({
  enableAI: z.boolean().optional(),  // undefined or true/false?
  timeout: z.number().optional(),    // What's the default?
})
```

**When to use `.optional()` vs `.default()`:**
- `.optional()` - When absence has semantic meaning
- `.default()` - When field should have sensible default

### Error Messages

**Mandatory:** Provide user-friendly error messages.

```typescript
✅ Correct:
z.string()
  .min(1, 'Provider name is required')
  .refine(
    (name) => VALID_PROVIDERS.includes(name),
    (name) => ({ message: `Unknown provider "${name}". Valid: ${VALID_PROVIDERS.join(', ')}` })
  );

❌ Wrong:
z.string().min(1);  // Error: "String must contain at least 1 character(s)"
```

## Schema Composition

### Extending Schemas

**Mandatory:** Use `.extend()` for schema inheritance.

```typescript
const baseConfigSchema = z.object({
  timeout: z.number().positive().optional(),
});

export const cliProviderSchema = baseConfigSchema.extend({
  type: z.literal('cli'),
  provider: z.enum(['claude', 'codex']),
  command: z.string().optional(),
});
```

### Discriminated Unions

**Mandatory:** Use discriminated unions for type-safe variants.

```typescript
const cliProviderSchema = z.object({
  type: z.literal('cli'),        // Discriminant
  provider: z.enum(['claude', 'codex']),
});

const apiProviderSchema = z.object({
  type: z.literal('api'),        // Discriminant
  apiKey: z.string(),
});

export const providerConfigSchema = z.discriminatedUnion('type', [
  cliProviderSchema,
  apiProviderSchema,
]);

// TypeScript knows which fields exist based on 'type'
function useProvider(config: ProviderConfig) {
  if (config.type === 'cli') {
    console.log(config.provider);  // ✅ TypeScript knows this exists
  } else {
    console.log(config.apiKey);    // ✅ TypeScript knows this exists
  }
}
```

**Violation breaks architecture:** Union without discriminant requires manual type narrowing.

### Lazy Schemas

**Mandatory:** Use `.lazy()` to avoid circular dependencies.

```typescript
// In src/types/schemas.ts
export const generatorConfigSchema = z.object({
  providerConfig: z
    .lazy(() => import('../providers/types.js').then((m) => m.providerConfigSchema))
    .optional(),
});
```

## Advanced Validation

### Refinements

**Use `.refine()` for custom validation logic.**

```typescript
export const generatorConfigSchema = z
  .object({
    provider: providerConfigSchema.optional(),
    providerChain: z.array(providerConfigSchema).optional(),
  })
  .refine(
    (data) => {
      // Ensure mutual exclusivity
      const hasProvider = data.provider !== undefined;
      const hasChain = data.providerChain !== undefined;
      return !(hasProvider && hasChain);
    },
    {
      message: 'Cannot specify both "provider" and "providerChain"',
      path: ['provider'],
    }
  );
```

**When to use:**
- Multi-field validation
- Mutual exclusivity
- Complex business rules

### Transformations

**Use `.transform()` for data normalization.**

```typescript
export const gitStatusLineSchema = z
  .string()
  .min(3)
  .transform((line) => {
    const statusCode = line.slice(0, 2);
    const filename = line.slice(3);
    return {
      statusCode,
      filename,
      isStaged: statusCode[0] !== ' ' && statusCode[0] !== '?',
    };
  });

// Input:  "M  src/file.ts"
// Output: { statusCode: "M ", filename: "src/file.ts", isStaged: true }
```

**When to use:**
- Parsing structured strings
- Normalizing formats
- Computing derived fields

## Error Handling

### Throwing Validation

**Use for critical validation (must succeed or fail fast).**

```typescript
try {
  const config = validateGeneratorConfig(userInput);
  // Proceed with validated config
} catch (error) {
  if (error instanceof z.ZodError) {
    // Format error for user
    console.error('Configuration error:');
    for (const issue of error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
  }
  process.exit(1);
}
```

### Safe Validation

**Use for non-critical validation (can handle failure gracefully).**

```typescript
const result = safeValidateProviderConfig(userInput);

if (result.success) {
  const provider = createProvider(result.data);
} else {
  console.warn('Invalid config, using default');
  const provider = createProvider(DEFAULT_CONFIG);
}
```

### Formatting Errors

**Mandatory:** Format ZodError for users, not developers.

```typescript
❌ Wrong:
console.error(error.toString());  // Developer-facing format

✅ Correct:
function formatValidationError(error: z.ZodError): string {
  const lines = error.issues.map((issue) => {
    const path = issue.path.join('.');
    return `  - ${path}: ${issue.message}`;
  });
  return lines.join('\n');
}

console.error('Configuration errors:');
console.error(formatValidationError(error));
```

## Type Guards vs Schemas

**Type Guards:** For narrowing known types internally.

```typescript
// In src/utils/guards.ts
export function hasContent(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

// Usage
if (hasContent(maybeString)) {
  // TypeScript knows maybeString is string
  console.log(maybeString.toUpperCase());
}
```

**Schemas:** For validating unknown data at boundaries.

```typescript
// In src/types/schemas.ts
export const configSchema = z.object({ /* ... */ });

// Usage
const config = configSchema.parse(unknownInput);  // Runtime + compile time
```

**Rule:** Schemas at boundaries, guards internally.

## Testing Schemas

### Schema Tests MUST Cover:

1. **Valid inputs** (success cases)
2. **Invalid inputs** (error cases)
3. **Edge cases** (empty, null, undefined, boundaries)
4. **Defaults** (fields with defaults)
5. **Error messages** (user-friendly)

**Example:**

```typescript
describe('commitOptionsSchema', () => {
  it('accepts valid options', () => {
    const options = {
      workdir: '/path',
      files: ['src/file.ts'],
    };
    expect(() => validateCommitOptions(options)).not.toThrow();
  });

  it('rejects empty workdir', () => {
    const options = { workdir: '' };
    expect(() => validateCommitOptions(options)).toThrow('Working directory required');
  });

  it('applies default for files', () => {
    const options = { workdir: '/path' };
    const result = commitOptionsSchema.parse(options);
    expect(result.files).toBeUndefined();  // Or default value
  });

  it('rejects non-string workdir', () => {
    const options = { workdir: 123 };
    expect(() => validateCommitOptions(options)).toThrow(z.ZodError);
  });
});
```

## Performance Considerations

### Validate Once

**Mandatory:** Validate at boundary, cache result.

```typescript
✅ Correct:
class CommitMessageGenerator {
  private validatedConfig: GeneratorConfig;

  constructor(config: unknown) {
    this.validatedConfig = validateGeneratorConfig(config);  // Once
  }

  generate() {
    // Use this.validatedConfig (no re-validation)
  }
}

❌ Wrong:
class CommitMessageGenerator {
  constructor(private config: unknown) {}

  generate() {
    const validated = validateGeneratorConfig(this.config);  // Every time!
  }
}
```

### Avoid Hot Paths

**Mandatory:** Never validate in loops or frequently called functions.

```typescript
❌ Wrong:
for (const file of files) {
  validateFilePath(file);  // Validation in loop
  processFile(file);
}

✅ Correct:
const validatedFiles = files.map((file) => validateFilePath(file));  // Once
for (const file of validatedFiles) {
  processFile(file);  // No validation
}
```

## Migration Strategy

### Adding Validation to Existing Code

**Phase 1:** Create schema alongside existing types.

```typescript
// Existing
export type MyType = { field: string };

// New (Phase 1)
export const myTypeSchema = z.object({ field: z.string() });
export type MyTypeValidated = z.infer<typeof myTypeSchema>;

// Both exist temporarily
```

**Phase 2:** Add validation at boundaries.

```typescript
export function doThing(input: MyType) {
  const validated = myTypeSchema.parse(input);  // Add validation
  // Rest of code uses validated
}
```

**Phase 3:** Remove old type, rename validated type.

```typescript
export type MyType = z.infer<typeof myTypeSchema>;  // Replace

export function doThing(input: unknown) {  // Accept unknown
  const validated = myTypeSchema.parse(input);
  // ...
}
```

## Schema Versioning

**Future consideration:** When schemas need breaking changes:

1. Create `myTypeSchemaV2`
2. Support both versions temporarily
3. Migrate incrementally
4. Remove old version

**Not implemented yet.** For v1, breaking changes allowed with migration.

## Anti-Patterns

### ❌ Schemas Without Constraints

```typescript
const schema = z.object({
  timeout: z.number(),  // Could be negative!
  name: z.string(),     // Could be empty!
});
```

### ❌ Manual Types + Schemas

```typescript
export type Config = { timeout: number };  // Manual type
export const configSchema = z.object({ timeout: z.number() });  // Schema

// Types can diverge!
```

### ❌ Validation Deep in Code

```typescript
function deepFunction(data: MyType) {
  validateMyType(data);  // Too late! Should validate at boundary
}
```

### ❌ Any in Schemas

```typescript
const schema = z.object({
  data: z.any(),  // Defeats the purpose!
});
```

## Schema Evolution

**Adding fields:** Non-breaking if optional or has default.

**Removing fields:** Breaking change, requires migration.

**Changing validation:** May be breaking, test thoroughly.

**Document all schema changes in PR.**

## Summary

**Schema-first development is mandatory for commitment v1:**

1. ✅ Define Zod schemas first
2. ✅ Infer TypeScript types
3. ✅ Validate at boundaries
4. ✅ Trust types internally
5. ✅ Provide helpful errors
6. ✅ Test schemas thoroughly

**When in doubt:** Add more validation at boundaries, not less.
