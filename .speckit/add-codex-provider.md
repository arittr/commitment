# Specification: Add CodexProvider and Modularize Provider System

**Status**: Draft
**Created**: 2025-10-08
**Epic**: Provider System Enhancement
**Related Issues**: SNU-110 (Implement CodexProvider)

## Overview

Add support for Codex CLI (Anthropic's Claude for CLI) as a commit message provider, and refactor the provider system to make it trivial to add new AI providers in the future.

## Background

### Current State

- Only `ClaudeProvider` is fully implemented
- Provider factory has stubs for Codex, Cursor, OpenAI, Gemini
- Base classes exist (`BaseCLIProvider`, `BaseAPIProvider`) but need refinement
- Provider chain and auto-detection infrastructure is complete
- Test coverage exists for base classes and interfaces

### Problems

1. **Codex CLI not supported** - Users can't use Codex for commit message generation
2. **Provider implementation unclear** - No clear template or guide for adding new providers
3. **CLI-specific logic scattered** - Command preparation, parsing logic not well-abstracted
4. **Validation inconsistent** - Each provider implements availability checks differently
5. **Testing patterns unclear** - No clear example of how to test a new provider implementation

### Goals

1. Implement fully functional `CodexProvider` with Codex CLI integration
2. Establish clear patterns for CLI provider implementation
3. Create reusable abstractions for common CLI operations
4. Document the process for adding new providers
5. Ensure new providers can be added in < 100 lines of code

## Requirements

### Functional Requirements

#### FR1: CodexProvider Implementation

- **FR1.1**: Implement `CodexProvider` class extending `BaseCLIProvider`
- **FR1.2**: Support Codex CLI command execution for commit message generation
- **FR1.3**: Parse Codex CLI output correctly (handle streaming/non-streaming formats)
- **FR1.4**: Implement availability check by testing `codex --version` or similar
- **FR1.5**: Support custom Codex binary path via config
- **FR1.6**: Support custom arguments via config
- **FR1.7**: Support timeout configuration

#### FR2: Provider Factory Integration

- **FR2.1**: Update `createProvider()` to instantiate `CodexProvider` for `{ type: 'cli', provider: 'codex' }`
- **FR2.2**: Ensure factory pattern remains exhaustive with TypeScript
- **FR2.3**: Update auto-detection to check for Codex availability
- **FR2.4**: Support Codex in provider chains

#### FR3: CLI Integration

- **FR3.1**: Support `--provider codex` CLI flag
- **FR3.2**: Support `--fallback codex` for provider chains
- **FR3.3**: Auto-detect Codex when `--auto-detect` is used
- **FR3.4**: Display helpful error messages when Codex is not installed

### Non-Functional Requirements

#### NFR1: Performance

- **NFR1.1**: Codex availability check completes in < 1 second
- **NFR1.2**: Commit message generation completes in < 30 seconds
- **NFR1.3**: No performance degradation when Codex is in provider chain but not available

#### NFR2: Code Quality

- **NFR2.1**: CodexProvider implementation < 150 lines of code
- **NFR2.2**: 100% test coverage for CodexProvider
- **NFR2.3**: No code duplication between ClaudeProvider and CodexProvider
- **NFR2.4**: Strict TypeScript with no `any` types in production code
- **NFR2.5**: All public methods have TSDoc comments

#### NFR3: Documentation

- **NFR3.1**: Provider implementation guide in CLAUDE.md
- **NFR3.2**: Example showing how to add a new CLI provider
- **NFR3.3**: TSDoc comments on all abstractions
- **NFR3.4**: README updated with Codex support

#### NFR4: Modularity

- **NFR4.1**: Adding a new CLI provider requires modifying < 5 files
- **NFR4.2**: CLI provider abstractions work for Cursor CLI (validated but not implemented)
- **NFR4.3**: No tight coupling between providers
- **NFR4.4**: Provider-specific logic isolated to provider files

## Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Provider System                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Claude     │  │    Codex     │  │   Cursor     │     │
│  │  Provider    │  │   Provider   │  │   Provider   │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                  │              │
│         └─────────────────┴──────────────────┘              │
│                           │                                 │
│                  ┌────────▼─────────┐                      │
│                  │  BaseCLIProvider  │                      │
│                  │                   │                      │
│                  │ - executeCommand  │                      │
│                  │ - parseResponse   │                      │
│                  │ - validateOutput  │                      │
│                  └────────┬──────────┘                      │
│                           │                                 │
│                  ┌────────▼─────────┐                      │
│                  │   AIProvider      │                      │
│                  │   (interface)     │                      │
│                  └───────────────────┘                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 CLI Execution Abstraction                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           CLIExecutor (new utility)                   │  │
│  │                                                       │  │
│  │  - Command preparation (args, env, cwd)              │  │
│  │  - Subprocess execution via execa                    │  │
│  │  - Timeout handling                                  │  │
│  │  - Error standardization                             │  │
│  │  - Stream handling (stdout, stderr)                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              Response Parsing Abstraction                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │      CLIResponseParser (new utility)                  │  │
│  │                                                       │  │
│  │  - Extract text from JSON or plain output            │  │
│  │  - Handle streaming vs. non-streaming formats        │  │
│  │  - Validate response structure                       │  │
│  │  - Clean up formatting artifacts                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Specifications

#### 1. CodexProvider Class

**File**: `src/providers/implementations/codex-provider.ts`

**Purpose**: CLI provider for Codex (Anthropic's Claude for CLI)

**Interface**:

```typescript
export class CodexProvider extends BaseCLIProvider {
  constructor(config?: Omit<CLIProviderConfig, 'type' | 'provider'>);

  // Inherited from AIProvider
  generateCommitMessage(prompt: string, options: GenerateOptions): Promise<string>;
  isAvailable(): Promise<boolean>;
  getName(): string;
  getProviderType(): ProviderType;

  // Inherited from BaseCLIProvider
  protected executeCommand(args: string[], options: ExecuteOptions): Promise<string>;
  protected parseResponse(output: string): string;

  // Codex-specific
  protected preparePrompt(prompt: string): string;
  protected getDefaultCommand(): string; // Returns 'codex'
  protected getDefaultArgs(): string[]; // Returns ['--print', '--no-pager']
}
```

**Behavior**:

- Default command: `codex`
- Default args: `['--print', '--no-pager']` (similar to Claude CLI)
- Availability check: `codex --version`
- Output parsing: Extract text from stdout, handle JSON if present
- Timeout: 30 seconds default (configurable)

#### 2. BaseCLIProvider Enhancements

**File**: `src/providers/base/base-cli-provider.ts`

**Changes**:

1. **Extract common command execution**:

   ```typescript
   protected async executeCommand(
     args: string[],
     options: ExecuteOptions = {}
   ): Promise<string> {
     const command = this.getCommand();
     const timeout = options.timeout ?? this.config.timeout ?? 30_000;

     return CLIExecutor.execute(command, args, {
       timeout,
       cwd: options.workdir,
       env: options.env,
     });
   }
   ```

2. **Add abstract methods**:

   ```typescript
   protected abstract getDefaultCommand(): string;
   protected abstract getDefaultArgs(): string[];
   protected abstract preparePrompt(prompt: string): string;
   ```

3. **Add common validation**:
   ```typescript
   protected async checkCommandAvailable(): Promise<boolean> {
     return CLIExecutor.checkAvailable(this.getCommand());
   }
   ```

#### 3. CLIExecutor Utility

**File**: `src/providers/utils/cli-executor.ts`

**Purpose**: Standardized CLI command execution with error handling

**Interface**:

```typescript
export type ExecuteOptions = {
  timeout?: number;
  cwd?: string;
  env?: Record<string, string>;
  input?: string;
};

export type ExecuteResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
};

export class CLIExecutor {
  /**
   * Execute a CLI command with standardized error handling
   */
  static async execute(
    command: string,
    args: string[],
    options: ExecuteOptions = {},
  ): Promise<string>;

  /**
   * Check if a command is available on the system
   */
  static async checkAvailable(command: string): Promise<boolean>;

  /**
   * Execute and return full result (for advanced use cases)
   */
  static async executeRaw(
    command: string,
    args: string[],
    options: ExecuteOptions = {},
  ): Promise<ExecuteResult>;
}
```

**Error Handling**:

- Wraps execa errors into `ProviderError`
- Standardizes timeout errors
- Provides context (command, args, exit code)
- Sanitizes error messages (no secret leakage)

#### 4. CLIResponseParser Utility

**File**: `src/providers/utils/cli-response-parser.ts`

**Purpose**: Parse and validate CLI output from various formats

**Interface**:

```typescript
export type ParserOptions = {
  expectJSON?: boolean;
  allowEmpty?: boolean;
  trimWhitespace?: boolean;
};

export class CLIResponseParser {
  /**
   * Parse CLI output - handles JSON and plain text
   */
  static parse(output: string, options: ParserOptions = {}): string;

  /**
   * Extract text from JSON response (if present)
   */
  static parseJSON(output: string): string | null;

  /**
   * Clean and validate plain text response
   */
  static parsePlainText(output: string): string;

  /**
   * Validate that output contains a valid commit message
   */
  static validateCommitMessage(message: string): boolean;
}
```

**Parsing Strategy**:

1. Try JSON parsing first (detect `{` at start)
2. Extract message from JSON structure
3. Fall back to plain text parsing
4. Trim whitespace and validate
5. Throw `ProviderError` if invalid

### File Structure Changes

**Current**:

```
src/providers/
├── __tests__/
│   ├── auto-detect.test.ts
│   ├── base-api-provider.test.ts
│   ├── base-cli-provider.test.ts
│   ├── claude-provider.test.ts
│   ├── provider-chain.test.ts
│   ├── provider-factory.test.ts
│   └── validators.test.ts
├── auto-detect.ts
├── base-api-provider.ts
├── base-cli-provider.ts
├── claude-provider.ts
├── errors.ts
├── index.ts
├── provider-chain.ts
├── provider-factory.ts
└── types.ts
```

**Proposed** (refactored):

```
src/providers/
├── __tests__/
│   ├── auto-detect.test.ts
│   ├── provider-chain.test.ts
│   ├── provider-factory.test.ts
│   └── validators.test.ts
├── base/
│   ├── __tests__/
│   │   ├── base-api-provider.test.ts
│   │   └── base-cli-provider.test.ts
│   ├── base-api-provider.ts
│   └── base-cli-provider.ts
├── implementations/
│   ├── __tests__/
│   │   ├── claude-provider.test.ts
│   │   └── codex-provider.test.ts
│   ├── claude-provider.ts
│   └── codex-provider.ts
├── utils/
│   ├── __tests__/
│   │   ├── cli-executor.test.ts
│   │   └── cli-response-parser.test.ts
│   ├── cli-executor.ts
│   └── cli-response-parser.ts
├── auto-detect.ts
├── errors.ts
├── index.ts
├── provider-chain.ts
├── provider-factory.ts
└── types.ts
```

**Benefits**:

1. Clear separation of concerns (base, implementations, utils)
2. Tests co-located with implementation
3. Easy to find provider implementations
4. Utilities isolated for reuse
5. Top-level files remain small and focused

### Codex CLI Research

**Command Structure** (to be validated):

```bash
# Generate commit message
codex --print "Generate a commit message for: <changes>"

# Check availability
codex --version

# Stream output (if supported)
codex --stream "Generate a commit message..."
```

**Expected Output Formats**:

1. **Plain text**:

   ```
   feat: add user authentication

   Implement JWT-based authentication with refresh tokens
   ```

2. **JSON** (if Codex supports it):
   ```json
   {
     "content": "feat: add user authentication\n\nImplement JWT-based..."
   }
   ```

**Error Cases**:

- Command not found: `codex: command not found`
- Auth error: `Error: Not authenticated. Run 'codex login'`
- Timeout: Process exceeds configured timeout
- Invalid output: Empty response or malformed text

### Migration Strategy

#### Phase 1: Create Utilities (No Breaking Changes)

1. Create `CLIExecutor` utility
2. Create `CLIResponseParser` utility
3. Add comprehensive tests for both
4. **No changes to existing providers yet**

#### Phase 2: Refactor Directory Structure

1. Create `base/`, `implementations/`, `utils/` directories
2. Move files to new locations
3. Update imports across codebase
4. Update barrel exports in `index.ts`
5. **Ensure all tests still pass**

#### Phase 3: Refactor BaseCLIProvider

1. Add abstract methods (`getDefaultCommand()`, etc.)
2. Extract execution logic to use `CLIExecutor`
3. Extract parsing logic to use `CLIResponseParser`
4. Update `ClaudeProvider` to use new abstractions
5. **Ensure ClaudeProvider still works identically**

#### Phase 4: Implement CodexProvider

1. Create `CodexProvider` class
2. Implement all required methods
3. Add comprehensive tests
4. Update factory to instantiate `CodexProvider`
5. Update auto-detection to check Codex

#### Phase 5: Documentation & Polish

1. Add provider implementation guide to CLAUDE.md
2. Update README with Codex support
3. Add examples to TSDoc comments
4. Create migration guide if needed

### Testing Strategy

#### Unit Tests

**CodexProvider Tests** (`codex-provider.test.ts`):

```typescript
describe('CodexProvider', () => {
  describe('constructor', () => {
    it('should use default command "codex"');
    it('should accept custom command path');
    it('should accept custom args');
    it('should accept custom timeout');
  });

  describe('getName', () => {
    it('should return "Codex CLI"');
  });

  describe('getProviderType', () => {
    it('should return ProviderType.CLI');
  });

  describe('isAvailable', () => {
    it('should return true when codex is installed');
    it('should return false when codex is not installed');
    it('should handle command execution errors');
  });

  describe('generateCommitMessage', () => {
    it('should execute codex with correct args');
    it('should parse plain text output');
    it('should parse JSON output if present');
    it('should handle timeout errors');
    it('should handle empty responses');
    it('should use custom timeout from options');
    it('should pass workdir to executor');
  });
});
```

**CLIExecutor Tests** (`cli-executor.test.ts`):

```typescript
describe('CLIExecutor', () => {
  describe('execute', () => {
    it('should execute command and return stdout');
    it('should handle command not found');
    it('should handle timeout errors');
    it('should handle non-zero exit codes');
    it('should pass cwd to execa');
    it('should pass env vars to execa');
    it('should pass stdin if provided');
  });

  describe('checkAvailable', () => {
    it('should return true for available commands');
    it('should return false for unavailable commands');
    it('should handle which/where errors gracefully');
  });

  describe('executeRaw', () => {
    it('should return full result object');
    it('should include stdout, stderr, exitCode');
    it('should include timedOut flag');
  });
});
```

**CLIResponseParser Tests** (`cli-response-parser.test.ts`):

```typescript
describe('CLIResponseParser', () => {
  describe('parse', () => {
    it('should parse plain text responses');
    it('should parse JSON responses');
    it('should trim whitespace by default');
    it('should reject empty responses by default');
    it('should allow empty responses if configured');
  });

  describe('parseJSON', () => {
    it('should extract content from JSON');
    it('should return null for non-JSON');
    it('should handle malformed JSON');
  });

  describe('parsePlainText', () => {
    it('should clean and return text');
    it('should trim leading/trailing whitespace');
    it('should preserve internal formatting');
  });

  describe('validateCommitMessage', () => {
    it('should accept valid commit messages');
    it('should reject empty strings');
    it('should reject whitespace-only strings');
    it('should reject messages that are too short');
  });
});
```

#### Integration Tests

**Provider Factory Integration**:

```typescript
describe('createProvider - Codex integration', () => {
  it('should create CodexProvider for codex config');
  it('should pass custom command to CodexProvider');
  it('should pass custom args to CodexProvider');
  it('should pass timeout to CodexProvider');
});
```

**Auto-Detection Integration**:

```typescript
describe('Auto-detection - Codex', () => {
  it('should detect Codex when available');
  it('should skip Codex when unavailable');
  it('should return Codex in getAllAvailableProviders');
});
```

#### E2E Tests (if Codex CLI available)

```typescript
describe('Codex E2E', () => {
  it('should generate commit message via Codex CLI');
  it('should handle real timeout scenarios');
  it('should work in provider chain');
});
```

### Documentation Requirements

#### 1. Provider Implementation Guide (CLAUDE.md)

Add section:

````markdown
## Adding a New Provider

### CLI Provider Example

To add a new CLI provider:

1. **Create provider file** in `src/providers/implementations/`:

   ```typescript
   import { BaseCLIProvider } from '../base/base-cli-provider';

   export class MyProvider extends BaseCLIProvider {
     protected getDefaultCommand(): string {
       return 'my-cli';
     }

     protected getDefaultArgs(): string[] {
       return ['--print'];
     }

     protected preparePrompt(prompt: string): string {
       return prompt; // or customize
     }

     getName(): string {
       return 'My CLI';
     }
   }
   ```
````

2. **Add to types** in `src/providers/types.ts`:

   ```typescript
   provider: z.enum(['claude', 'codex', 'my-provider']);
   ```

3. **Update factory** in `src/providers/provider-factory.ts`:

   ```typescript
   .with({ type: 'cli', provider: 'my-provider' }, (cfg) => {
     return new MyProvider({ /* ... */ });
   })
   ```

4. **Add tests** in `src/providers/implementations/__tests__/`.

5. **Update auto-detection** in `src/providers/auto-detect.ts`.

````

#### 2. README Update

Add to installation/usage section:
```markdown
### Supported Providers

- **Claude CLI** (`claude`) - Anthropic's Claude via CLI
- **Codex CLI** (`codex`) - Anthropic's Codex via CLI ✨ NEW
- More providers coming soon!

### Usage with Codex

```bash
# Use Codex as provider
commitment --provider codex

# Use Codex with fallback to Claude
commitment --provider codex --fallback claude

# Auto-detect (tries Codex, Claude, etc.)
commitment --auto-detect
````

```

## Implementation Plan

### Task Breakdown

**Epic**: Provider System Enhancement

**Tasks**:

1. **Task 1: Create CLI Utilities** (2-3 hours)
   - Create `src/providers/utils/cli-executor.ts`
   - Create `src/providers/utils/cli-response-parser.ts`
   - Add comprehensive unit tests
   - **Deliverable**: Utility classes with 100% test coverage

2. **Task 2: Refactor Directory Structure** (1-2 hours)
   - Create `base/`, `implementations/`, `utils/` directories
   - Move existing files to new locations
   - Update all imports
   - Update barrel exports
   - Ensure all existing tests pass
   - **Deliverable**: New directory structure, all tests green

3. **Task 3: Refactor BaseCLIProvider** (2-3 hours)
   - Add abstract methods
   - Extract execution logic to `CLIExecutor`
   - Extract parsing logic to `CLIResponseParser`
   - Update `ClaudeProvider` to use new abstractions
   - Ensure backward compatibility
   - **Deliverable**: Refactored base class, ClaudeProvider working identically

4. **Task 4: Research Codex CLI** (1 hour)
   - Install Codex CLI (if available)
   - Test command structure
   - Document output formats
   - Identify edge cases
   - **Deliverable**: Codex CLI documentation

5. **Task 5: Implement CodexProvider** (2-3 hours)
   - Create `CodexProvider` class
   - Implement all required methods
   - Add comprehensive tests (12+ tests)
   - **Deliverable**: Fully functional CodexProvider with tests

6. **Task 6: Update Factory & Auto-Detection** (1 hour)
   - Update `createProvider()` to handle Codex
   - Update auto-detection to check Codex
   - Update types and schemas
   - **Deliverable**: Factory integration complete

7. **Task 7: CLI Integration** (1 hour)
   - Test `--provider codex` flag
   - Test `--fallback codex`
   - Test `--auto-detect` with Codex
   - Add error messages
   - **Deliverable**: Full CLI integration

8. **Task 8: Documentation** (1-2 hours)
   - Add provider implementation guide to CLAUDE.md
   - Update README with Codex support
   - Add TSDoc comments
   - Create examples
   - **Deliverable**: Complete documentation

9. **Task 9: E2E Testing** (1 hour)
   - Test with real Codex CLI (if available)
   - Test error scenarios
   - Test in provider chains
   - **Deliverable**: E2E validation

10. **Task 10: Code Review & Polish** (1 hour)
    - Run full test suite
    - Check linting
    - Verify type safety
    - Review code quality
    - **Deliverable**: Production-ready code

**Total Estimated Time**: 13-18 hours

### Dependencies

- **Task 1** → Task 2, Task 3
- **Task 2** → Task 3
- **Task 3** → Task 5
- **Task 4** → Task 5
- **Task 5** → Task 6, Task 7
- **Task 6, Task 7** → Task 9
- **All tasks** → Task 10

### Acceptance Criteria

**Must Have**:
- ✅ CodexProvider fully implemented with all required methods
- ✅ CodexProvider has 100% test coverage
- ✅ All existing tests pass
- ✅ No breaking changes to existing APIs
- ✅ Factory pattern updated to support Codex
- ✅ Auto-detection includes Codex
- ✅ CLI supports `--provider codex` and `--fallback codex`
- ✅ Documentation updated (README, CLAUDE.md)
- ✅ Provider implementation guide created
- ✅ Strict TypeScript with no `any` types
- ✅ All linting passes (0 errors)

**Should Have**:
- ✅ CLIExecutor utility with comprehensive tests
- ✅ CLIResponseParser utility with comprehensive tests
- ✅ Directory structure refactored for clarity
- ✅ BaseCLIProvider enhanced with abstractions
- ✅ E2E tests with real Codex CLI (if available)

**Nice to Have**:
- ✅ Performance benchmarks for Codex vs Claude
- ✅ Example showing custom provider implementation
- ✅ Migration guide for existing users
- ✅ Cursor CLI stub implementation as proof-of-concept

## Success Metrics

### Quantitative
- **Test Coverage**: 100% for new code
- **Performance**: Codex availability check < 1s
- **Code Size**: CodexProvider < 150 lines
- **Build Time**: No increase from baseline
- **Test Time**: < 30s for full suite

### Qualitative
- **Developer Experience**: Adding new CLI provider takes < 2 hours
- **Code Quality**: All strict linting passes
- **Documentation**: Clear guide for adding providers
- **Modularity**: Utilities reusable across providers
- **Maintainability**: Clear separation of concerns

## Risks & Mitigations

### Risk 1: Codex CLI Not Available
**Likelihood**: Medium
**Impact**: High
**Mitigation**:
- Implement based on Claude CLI patterns
- Use mocked tests for validation
- Document expected Codex CLI interface
- Add E2E tests that skip if Codex unavailable

### Risk 2: Codex Output Format Unknown
**Likelihood**: Medium
**Impact**: Medium
**Mitigation**:
- Research Codex CLI documentation
- Test with real Codex if available
- Design parser to handle multiple formats
- Add extensive error handling

### Risk 3: Breaking Changes During Refactor
**Likelihood**: Low
**Impact**: High
**Mitigation**:
- Comprehensive test coverage before refactor
- Phase refactor (utilities → structure → base → provider)
- Run full test suite after each phase
- Backward compatibility tests

### Risk 4: Performance Regression
**Likelihood**: Low
**Impact**: Medium
**Mitigation**:
- Benchmark before/after refactor
- Profile critical paths
- Use lazy loading where appropriate
- Monitor test execution time

## Future Considerations

### Next Steps After CodexProvider
1. **Cursor CLI Provider**: Similar to Codex, should be trivial with new abstractions
2. **OpenAI API Provider**: First API provider, validates BaseAPIProvider abstractions
3. **Gemini API Provider**: Second API provider, ensures API pattern is solid
4. **Provider Configuration UI**: Interactive provider selection and configuration
5. **Provider Performance Comparison**: Tool to benchmark different providers

### Technical Debt Prevention
- Keep utilities focused and single-purpose
- Avoid premature abstraction
- Document "why" not just "what"
- Regular refactoring as patterns emerge

### Extensibility Hooks
- Plugin system for custom providers (future)
- Provider middleware for transformations (future)
- Streaming support for long responses (future)
- Caching layer for provider responses (future)

## Appendix

### Codex CLI Research Notes

**To be filled in after research:**
- Exact command syntax
- Available flags and options
- Authentication requirements
- Output format examples
- Error message formats
- Version compatibility

### Related Specifications
- [Provider Architecture](/docs/architecture/providers.md)
- [Testing Strategy](/docs/testing.md)
- [CLI Design](/docs/cli-design.md)

### References
- TypeScript Handbook: https://www.typescriptlang.org/docs/
- ts-pattern Documentation: https://github.com/gvergnaud/ts-pattern
- execa Documentation: https://github.com/sindresorhus/execa
- Zod Documentation: https://zod.dev/
```
