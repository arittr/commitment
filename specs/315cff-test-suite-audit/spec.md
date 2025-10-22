---
runId: 315cff
feature: test-suite-audit
created: 2025-01-22
status: draft
---

# Test Suite Audit: Remove Non-Business-Logic Tests

## Problem Statement

The current test suite contains **extensive tests for Zod schema validation** that don't test business logic. These tests verify that Zod works correctly (e.g., "rejects non-string input", "rejects empty string") rather than testing our actual application logic.

**Issues:**
1. **Testing the library, not our code** - Zod is a well-tested library; we don't need to verify it works
2. **Maintenance burden** - ~60% of test LOC are schema validation tests
3. **Obscured business logic** - Important tests are buried in schema tests
4. **Violates TDD principles** - These tests don't drive design decisions

## Current State Analysis

### Files with Excessive Schema Testing

**1. `src/types/__tests__/schemas.test.ts` (829 LOC)**
- ❌ 772 LOC testing Zod parsing (lines 18-789)
- ✅ 57 LOC testing type inference (lines 772-829)
- **Recommendation**: Delete 93% of this file

Example of what to remove:
```typescript
// ❌ Testing Zod, not our business logic
it('should reject non-string title', () => {
  const task = {
    description: 'Valid description',
    produces: [],
    title: 123,
  };
  expect(() => commitTaskSchema.parse(task)).toThrow(ZodError);
});
```

**2. `src/cli/__tests__/schemas.test.ts` (360 LOC)**
- ❌ 315 LOC testing Zod parsing (lines 14-315)
- ✅ 45 LOC testing `formatValidationError()` (lines 267-315)
- **Recommendation**: Keep only `formatValidationError` tests, delete the rest

**3. `src/utils/__tests__/git-schemas.test.ts` (1294 LOC)**
- ❌ ~900 LOC testing Zod parsing directly
- ✅ ~400 LOC testing business logic (`parseGitStatus`, `categorizeFiles`, `analyzeChanges`)
- **Recommendation**: Keep business logic tests (lines 644-1166), delete Zod tests

**4. `src/agents/__tests__/types.test.ts` (259 LOC)**
- ❌ 220 LOC testing Zod parsing (lines 41-257)
- ✅ 39 LOC testing Agent interface (lines 12-39)
- **Recommendation**: Keep interface tests only

### Files with Appropriate Testing

**✅ Keep as-is:**
- `src/utils/__tests__/guards.test.ts` - Tests custom type guard logic (business logic)
- `src/agents/__tests__/base-agent.test.ts` - Tests template method pattern (business logic)
- `src/agents/__tests__/claude.test.ts` - Tests agent behavior (business logic)
- `src/cli/__tests__/helpers.test.ts` - Tests display/execution helpers (business logic)

## Specification

### Functional Requirements

**FR1: Schema Test Removal**
- Remove all tests that verify Zod correctly parses/rejects input types
- Keep only tests for **custom business logic** built on top of schemas

**FR2: Business Logic Preservation**
- Preserve tests for functions that **transform or analyze** data:
  - `parseGitStatus()` - parses git output into structured data
  - `categorizeFiles()` - categorizes files by type
  - `analyzeChanges()` - extracts change statistics
  - `formatValidationError()` - formats errors for users
  - Type guards (`hasContent`, `isNonEmptyArray`, etc.)

**FR3: Type Safety Verification**
- Keep minimal type inference tests to verify schema → type mapping works
- One test per schema to verify `z.infer<>` produces correct type

### Non-Functional Requirements

**NFR1: Test Suite Size Reduction**
- Target: Reduce test suite by **~1500 LOC** (60% reduction in schema test files)
- Maintain 100% coverage of business logic functions

**NFR2: Maintainability**
- Tests should focus on **behavior we own**, not library behavior
- Each test should answer: "Does this test our logic or Zod's logic?"

**NFR3: TDD Alignment**
- All remaining tests should follow TDD principle: "test drives design"
- Schema validation tests don't drive design (Zod already designed)

### Architecture Integration

**Pattern:** Schema-First Development (@docs/constitutions/current/schema-rules.md)

The constitution states:
> "Validate at boundaries, trust types internally"

**Implication**: We validate **once** at boundaries using Zod schemas. We don't need extensive tests proving Zod works - we need tests proving our **boundary validation logic** works.

**What to test:**
1. ✅ Custom validation logic (e.g., `formatValidationError()`)
2. ✅ Data transformation logic (e.g., `parseGitStatus()`)
3. ✅ Type guards (our custom logic)
4. ❌ Zod's ability to reject invalid types
5. ❌ Zod's ability to apply defaults
6. ❌ Zod's error messages

### Acceptance Criteria

**AC1: Schema Test Files Cleaned**
- [ ] `src/types/__tests__/schemas.test.ts` reduced to <100 LOC (type inference only)
- [ ] `src/cli/__tests__/schemas.test.ts` reduced to <50 LOC (`formatValidationError` only)
- [ ] `src/utils/__tests__/git-schemas.test.ts` reduced to ~400 LOC (business logic only)
- [ ] `src/agents/__tests__/types.test.ts` reduced to <50 LOC (interface tests only)

**AC2: Business Logic Coverage Maintained**
- [ ] All helper functions tested (`parseGitStatus`, `categorizeFiles`, `analyzeChanges`, `formatValidationError`)
- [ ] All type guards tested
- [ ] All agent logic tested
- [ ] All CLI helpers tested

**AC3: Test Suite Quality**
- [ ] Run `pnpm test` → all tests pass
- [ ] Run `pnpm test --coverage` → coverage ≥ current levels for business logic
- [ ] No tests verify "Zod works correctly"

**AC4: Documentation**
- [ ] Update test files with comments explaining what we test vs. don't test
- [ ] Add comment at top of schema files:
  ```typescript
  // Note: We don't test Zod's validation logic (e.g., "rejects non-string").
  // We test our custom logic built on top of schemas (transformations, formatting).
  ```

## Implementation Guidance

### Decision Rules

**Delete a test if:**
- It verifies Zod rejects invalid types (`expect(() => schema.parse(123)).toThrow()`)
- It verifies Zod applies defaults (`expect(result.field).toBe(default)`)
- It verifies Zod validates constraints (`expect(() => schema.parse('')).toThrow()`)
- It doesn't test any logic **we wrote**

**Keep a test if:**
- It verifies a transformation function works (`parseGitStatus`, `categorizeFiles`)
- It verifies custom validation logic (`formatValidationError`)
- It verifies type guards we wrote (`hasContent`, `isNonEmptyArray`)
- It verifies business logic behavior (agent generation, CLI helpers)

### Example: What to Keep vs. Delete

**❌ DELETE (testing Zod):**
```typescript
describe('commitTaskSchema', () => {
  it('should reject empty title', () => {
    const task = { description: 'Valid', produces: [], title: '' };
    expect(() => commitTaskSchema.parse(task)).toThrow(ZodError);
  });

  it('should reject non-string title', () => {
    const task = { description: 'Valid', produces: [], title: 123 };
    expect(() => commitTaskSchema.parse(task)).toThrow(ZodError);
  });

  it('should apply default for produces', () => {
    const task = { title: 'Test', description: 'Desc' };
    const result = commitTaskSchema.parse(task);
    expect(result.produces).toEqual([]);
  });
});
```

**✅ KEEP (testing our logic):**
```typescript
describe('parseGitStatus', () => {
  it('should parse empty git output', () => {
    const output = '';
    const result = parseGitStatus(output);

    expect(result.hasChanges).toBe(false);
    expect(result.stagedFiles).toEqual([]);
  });

  it('should parse single modified file', () => {
    const output = 'M  src/file.ts';
    const result = parseGitStatus(output);

    expect(result.hasChanges).toBe(true);
    expect(result.stagedFiles).toEqual(['src/file.ts']);
  });
});

describe('formatValidationError', () => {
  it('should format single issue error', () => {
    const options = { cwd: '' };
    try {
      cliOptionsSchema.parse(options);
    } catch (error) {
      const formatted = formatValidationError(error as ZodError);
      expect(formatted).toContain('Validation failed');
      expect(formatted).toContain('cwd');
    }
  });
});
```

### File-by-File Changes

**1. `src/types/__tests__/schemas.test.ts`**
```typescript
// BEFORE: 829 LOC testing Zod parsing
// AFTER: ~50 LOC testing type inference only

describe('Type Inference', () => {
  it('should infer correct CommitTask type', () => {
    const task: CommitTask = {
      description: 'Test description',
      produces: ['file.ts'],
      title: 'Test',
    };
    expect(task.title).toBe('Test');
  });

  // Similar tests for CommitMessageOptions, CommitMessageGeneratorConfig
});
```

**2. `src/cli/__tests__/schemas.test.ts`**
```typescript
// BEFORE: 360 LOC (315 Zod tests + 45 formatValidationError tests)
// AFTER: ~50 LOC (formatValidationError tests only)

describe('formatValidationError', () => {
  // Keep existing tests for formatValidationError (lines 267-315)
});

// Delete all Zod validation tests (lines 14-266)
```

**3. `src/utils/__tests__/git-schemas.test.ts`**
```typescript
// BEFORE: 1294 LOC (~900 Zod + ~400 business logic)
// AFTER: ~400 LOC (business logic only)

// DELETE: lines 22-474 (gitStatusLineSchema, gitStatusSchema, fileCategoriesSchema Zod tests)
// DELETE: lines 476-642 (validation helper Zod tests)
// KEEP: lines 644-761 (parseGitStatus tests)
// KEEP: lines 763-910 (categorizeFiles tests)
// KEEP: lines 912-1166 (changeStatsSchema + analyzeChanges tests)
// DELETE: lines 1168-1226 (validation helper Zod tests)
// KEEP: lines 1228-1293 (type inference tests)
```

**4. `src/agents/__tests__/types.test.ts`**
```typescript
// BEFORE: 259 LOC (39 interface + 220 Zod)
// AFTER: ~40 LOC (interface tests only)

describe('Agent interface', () => {
  // Keep existing interface tests (lines 12-39)
});

// Delete all Zod validation tests (lines 41-257)
```

## References

- **Constitution**: @docs/constitutions/current/schema-rules.md (Schema-First Development)
- **Constitution**: @docs/constitutions/current/testing.md (Testing requirements)
- **Pattern**: "Validate once at boundaries, trust types internally"

## Success Metrics

**Before:**
- Total test LOC: ~4000
- Schema validation test LOC: ~2400 (60%)
- Business logic test LOC: ~1600 (40%)

**After:**
- Total test LOC: ~2500
- Schema validation test LOC: ~100 (4%)
- Business logic test LOC: ~2400 (96%)

**Result**: 37.5% reduction in total test LOC, 96% focused on business logic.
