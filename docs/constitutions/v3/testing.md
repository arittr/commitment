# Testing Requirements

## Core Principle

**All code must be tested. Tests are not optional. Tests are architecture.**

Untested code is broken code waiting to fail. If you can't test it, you can't trust it.

## Testing Philosophy

### Why We Test

1. **Confidence:** Tests prove code works as intended
2. **Refactoring:** Tests enable fearless refactoring
3. **Documentation:** Tests show how to use the API
4. **Regression Prevention:** Tests catch bugs before production
5. **Design Feedback:** Hard-to-test code signals design problems

### What We Test

**Everything.**

- Public APIs
- Private methods (indirectly through public APIs)
- Edge cases
- Error conditions
- Validation logic
- Integration between layers

**Exceptions:**
- Trivial getters/setters
- Type-only code
- Generated code

## Test Organization

### Co-located Tests (Mandatory)

**All unit tests MUST be co-located with source in `__tests__/` directories.**

```
src/
├── cli/
│   ├── __tests__/
│   │   ├── schemas.test.ts
│   │   └── provider-config-builder.test.ts
│   ├── schemas.ts
│   └── provider-config-builder.ts
├── providers/
│   ├── __tests__/
│   │   ├── provider-factory.test.ts
│   │   └── provider-chain.test.ts
│   ├── implementations/
│   │   ├── __tests__/
│   │   │   ├── claude-provider.test.ts
│   │   │   └── codex-provider.test.ts
│   │   ├── claude-provider.ts
│   │   └── codex-provider.ts
```

**Violation breaks architecture:** Tests far from source become stale.

### Integration Tests

**Location:** `src/__tests__/integration/`

Integration tests that span multiple layers belong at root.

```
src/
├── __tests__/
│   └── integration/
│       ├── validation.test.ts     # Cross-module validation
│       └── error-messages.test.ts # User-facing errors
```

## Test Framework: bun:test

**Mandatory:** All tests use bun:test.

```typescript
import { describe, it, expect, mock, spyOn, beforeEach, afterEach } from 'bun:test';

describe('MyClass', () => {
  it('should do something', () => {
    expect(result).toBe(expected);
  });
});
```

**Note:** Bun provides `describe`, `it`, and `expect` as globals via `bun-types`, so the import is optional. However, `mock` and `spyOn` must be imported.

**Forbidden:** Jest, Mocha, Jasmine, Vitest (use bun:test exclusively).

## Test Structure

### Naming Conventions

**Test Files:** `*.test.ts` (NOT `.spec.ts`)

**Describe Blocks:** Name of class/function being tested

```typescript
describe('CommitMessageGenerator', () => {
  // Tests for CommitMessageGenerator class
});

describe('validateProviderConfig', () => {
  // Tests for validateProviderConfig function
});
```

**Test Cases:** Use "should" or describe behavior

```typescript
✅ Correct:
it('should validate correct config')
it('should throw on invalid provider name')
it('returns null when no provider available')

❌ Wrong:
it('test config validation')  // Too vague
it('works')                   // Useless description
it('#validateConfig')         // Just method name
```

### AAA Pattern (Arrange-Act-Assert)

**Mandatory:** Structure tests with clear sections.

```typescript
it('should generate commit message with AI', async () => {
  // Arrange - Set up test data and mocks
  const mockProvider = {
    generateCommitMessage: mock(async () => 'feat: add feature'),
  };
  const generator = new CommitMessageGenerator({
    provider: mockProvider,
  });

  // Act - Execute the code being tested
  const result = await generator.generate(
    { title: 'Add feature', description: 'Desc', produces: [] },
    { workdir: '/tmp' }
  );

  // Assert - Verify the results
  expect(result).toBe('feat: add feature');
  expect(mockProvider.generateCommitMessage).toHaveBeenCalledTimes(1);
});
```

**Benefits:**
- Clear test structure
- Easy to understand
- Easy to maintain

## Test Coverage Requirements

### Target Coverage

**Minimum:** 80% overall coverage
**Goal:** 90%+ coverage

**Measured by:**
- Statements
- Branches
- Functions
- Lines

### What Must Be 100% Covered

1. **Validation logic** (all schemas)
2. **Error handling** (all error paths)
3. **Public APIs** (all exported functions/classes)
4. **Critical paths** (commit generation, provider selection)

### What May Have Lower Coverage

1. CLI output formatting (visual, hard to test)
2. Process.exit calls (tested via integration tests)
3. Error recovery paths (tested via integration tests)

### Checking Coverage

```bash
bun test --coverage
```

**CI Requirement:** Coverage must not decrease in PRs.

## Unit Test Patterns

### Testing Pure Functions

**Pure functions are easiest to test.**

```typescript
// Pure function (deterministic, no side effects)
export function categorizeFiles(files: string[]): FileCategories {
  // ...
}

// Test
describe('categorizeFiles', () => {
  it('should categorize test files', () => {
    const files = ['src/foo.test.ts', 'src/bar.ts'];
    const result = categorizeFiles(files);
    expect(result.tests).toEqual(['src/foo.test.ts']);
  });
});
```

### Testing Classes with Dependencies

**Use dependency injection for testability.**

```typescript
class CommitMessageGenerator {
  constructor(
    private config: GeneratorConfig,
    private provider: AIProvider,  // Injected dependency
  ) {}
}

// Test with mock
describe('CommitMessageGenerator', () => {
  it('should use provider for generation', async () => {
    const mockProvider = {
      generateCommitMessage: mock(async () => 'feat: test'),
    };

    const generator = new CommitMessageGenerator({
      provider: mockProvider,
    });

    await generator.generate(/* ... */);
    expect(mockProvider.generateCommitMessage).toHaveBeenCalled();
  });
});
```

### Testing Async Code

**Always use async/await in tests.**

```typescript
✅ Correct:
it('should generate message asynchronously', async () => {
  const result = await generator.generate(task, options);
  expect(result).toBeTruthy();
});

❌ Wrong:
it('should generate message', () => {
  generator.generate(task, options).then((result) => {
    expect(result).toBeTruthy();  // May not run before test ends!
  });
});
```

### Testing Error Cases

**Mandatory:** Test all error paths.

```typescript
describe('validateProviderConfig', () => {
  it('should throw on invalid provider name', () => {
    const invalid = { type: 'cli', provider: 'unknown' };

    expect(() => validateProviderConfig(invalid)).toThrow(z.ZodError);
  });

  it('should throw with helpful message', () => {
    const invalid = { type: 'cli', provider: '' };

    expect(() => validateProviderConfig(invalid)).toThrow(
      /Provider name is required/
    );
  });
});
```

### Testing Validation Schemas

**Mandatory:** Test schemas comprehensively.

```typescript
describe('providerConfigSchema', () => {
  // Success cases
  it('should accept valid CLI provider config', () => {
    const valid = {
      type: 'cli',
      provider: 'claude',
      command: 'claude',
    };
    expect(() => validateProviderConfig(valid)).not.toThrow();
  });

  // Error cases
  it('should reject missing type', () => {
    const invalid = { provider: 'claude' };
    expect(() => validateProviderConfig(invalid)).toThrow();
  });

  it('should reject unknown provider', () => {
    const invalid = { type: 'cli', provider: 'unknown' };
    expect(() => validateProviderConfig(invalid)).toThrow();
  });

  // Edge cases
  it('should reject empty provider name', () => {
    const invalid = { type: 'cli', provider: '' };
    expect(() => validateProviderConfig(invalid)).toThrow();
  });

  // Defaults
  it('should apply default timeout', () => {
    const partial = { type: 'cli', provider: 'claude' };
    const result = providerConfigSchema.parse(partial);
    expect(result.timeout).toBeUndefined(); // or default value
  });
});
```

## Mocking Strategies

### When to Mock

**Mock external dependencies:**
- File system (fs operations)
- Network calls (APIs)
- External commands (execa)
- Other providers

**Don't mock:**
- Pure functions
- Internal helpers
- Type guards
- Validation schemas

### Mocking External Commands

```typescript
import { describe, it, expect, mock } from 'bun:test';
import { execa } from 'execa';

mock.module('execa', () => ({
  execa: mock(async () => ({
    stdout: 'feat: test message',
    stderr: '',
    exitCode: 0,
  })),
}));

describe('ClaudeProvider', () => {
  it('should call claude command', async () => {
    const provider = new ClaudeProvider();
    const result = await provider.generateCommitMessage('prompt', { workdir: '/tmp' });

    expect(result).toBe('feat: test message');
  });
});
```

**Note:** Bun's `mock.module()` replaces entire modules. For more control, use dependency injection.

### Mocking Providers

```typescript
const mockProvider: AIProvider = {
  getName: mock(() => 'MockProvider'),
  isAvailable: mock(async () => true),
  generateCommitMessage: mock(async () => 'feat: mock'),
};
```

## Integration Testing

### Cross-Layer Tests

**Test interactions between layers.**

```typescript
describe('CLI → Generator → Provider integration', () => {
  it('should validate CLI options and generate message', async () => {
    const cliOptions = {
      ai: true,
      provider: 'claude',
      cwd: '/tmp',
    };

    const validated = validateCliOptions(cliOptions);
    const generator = new CommitMessageGenerator(validated);
    const message = await generator.generate(task, options);

    expect(message).toMatch(/^(feat|fix|refactor):/);
  });
});
```

### Validation Integration

**Test validation across boundaries.**

```typescript
describe('Validation integration', () => {
  it('should catch invalid config at CLI boundary', () => {
    const invalidCli = { provider: 'invalid' };

    expect(() => validateCliOptions(invalidCli)).toThrow();
  });

  it('should catch invalid config at generator boundary', () => {
    const invalidGenerator = { provider: { type: 'invalid' } };

    expect(() => new CommitMessageGenerator(invalidGenerator)).toThrow();
  });
});
```

### Error Message Quality

**Test that errors are user-friendly.**

```typescript
describe('Error messages', () => {
  it('should provide helpful message for invalid provider', () => {
    const invalid = { type: 'cli', provider: 'unknown' };

    try {
      validateProviderConfig(invalid);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error.message).toMatch(/Unknown provider/);
      expect(error.message).toMatch(/Valid providers:/);
    }
  });
});
```

## Testing Anti-Patterns

### ❌ Testing Implementation Details

```typescript
❌ Wrong:
it('should call _internalHelper', () => {
  const spy = vi.spyOn(instance, '_internalHelper');
  instance.publicMethod();
  expect(spy).toHaveBeenCalled();
});

✅ Correct:
it('should return correct result', () => {
  const result = instance.publicMethod();
  expect(result).toBe(expected);
});
```

**Test behavior, not implementation.**

### ❌ Brittle Tests

```typescript
❌ Wrong:
expect(message).toBe('feat(cli): add new flag for enabling AI generation');

✅ Correct:
expect(message).toMatch(/^feat\(cli\):/);
expect(message).toContain('AI generation');
```

**Test outcomes, not exact strings.**

### ❌ Flaky Tests

```typescript
❌ Wrong:
it('should timeout after delay', async () => {
  setTimeout(() => { /* ... */ }, 100);
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(completed).toBe(false);  // Race condition!
});

✅ Correct:
it('should timeout after delay', async () => {
  // Use Bun.sleep() for controlled async timing
  const start = Date.now();
  await Bun.sleep(100);
  const elapsed = Date.now() - start;
  expect(elapsed).toBeGreaterThanOrEqual(100);
});
```

**Avoid real delays when possible. Use deterministic async patterns.**

### ❌ Tests Without Assertions

```typescript
❌ Wrong:
it('should call provider', async () => {
  await generator.generate(task, options);
  // No assertions!
});

✅ Correct:
it('should call provider', async () => {
  const result = await generator.generate(task, options);
  expect(result).toBeTruthy();
  expect(mockProvider.generateCommitMessage).toHaveBeenCalled();
});
```

**Every test needs assertions.**

## Test Utilities

### Shared Test Fixtures

**Create reusable test data.**

```typescript
// src/cli/__tests__/fixtures.ts
export const validCliOptions = {
  ai: true,
  provider: 'claude',
  cwd: '/tmp',
};

export const validTask = {
  title: 'Add feature',
  description: 'Implement new feature',
  produces: ['src/feature.ts'],
};
```

### Custom Matchers

**Vitest allows custom matchers.**

```typescript
expect.extend({
  toBeValidCommitMessage(received: string) {
    const pass = /^(feat|fix|refactor|test|docs|chore):/.test(received);
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be valid commit message`
          : `Expected ${received} to be valid commit message`,
    };
  },
});

// Usage
expect(message).toBeValidCommitMessage();
```

## Self-Dogfooding Tests

**Mandatory:** Test commitment on itself.

```bash
# Manual E2E test
cd commitment-repo
git add .
./dist/cli.js --dry-run

# Verify conventional commit format
# Verify message quality
```

**CI Integration:** Run commitment on test repository in CI.

## Performance Testing

**Not mandatory for v1, but recommended:**

```typescript
describe('Performance', () => {
  it('should validate config in < 5ms', () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      validateProviderConfig(validConfig);
    }
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(5);
  });
});
```

## Test Maintenance

### Updating Tests

**When changing code:**
1. Update tests FIRST (TDD)
2. Ensure tests fail for right reason
3. Implement change
4. Ensure tests pass

**When refactoring:**
1. Ensure full test coverage
2. Refactor code
3. Tests should still pass (behavior unchanged)

### Removing Tests

**Never remove tests unless:**
1. Code is removed
2. Test is redundant (covered by other test)
3. Test is flaky and replaced with better test

**Document reason in commit.**

## CI Requirements

### Pre-commit

```bash
bun run lint      # Must pass
bun run check-types # Must pass
bun test          # Must pass
```

### Pre-merge

```bash
bun test --coverage  # Coverage must not decrease
bun run build        # Must build successfully
```

### Test Isolation

**Mandatory:** Tests must not depend on:
- External network
- Real file system (mock fs)
- External commands (mock execa)
- Test execution order

**Each test runs in isolation.**

## Documentation Tests

**TSDoc examples should be testable.**

```typescript
/**
 * Validates provider config
 *
 * @example
 * ```typescript
 * const config = validateProviderConfig({
 *   type: 'cli',
 *   provider: 'claude',
 * });
 * ```
 */
```

**Test that examples work:**

```typescript
it('should work as shown in docs', () => {
  // Copy/paste from TSDoc
  const config = validateProviderConfig({
    type: 'cli',
    provider: 'claude',
  });
  expect(config).toBeDefined();
});
```

## Summary Checklist

**Before merging, ensure:**

- [ ] All new code has tests
- [ ] All tests pass (`bun test`)
- [ ] Coverage is adequate (80%+)
- [ ] Tests are co-located in `__tests__/`
- [ ] Test names describe behavior
- [ ] Tests use AAA pattern
- [ ] No flaky tests
- [ ] No tests of implementation details
- [ ] Error cases are tested
- [ ] Edge cases are tested
- [ ] Integration tests for cross-layer code

**When in doubt: Write more tests, not fewer.**
