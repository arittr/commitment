# AI Provider Architecture Design

**Status**: Draft
**Created**: 2025-10-08
**Last Updated**: 2025-10-08

## Overview

This document describes the architecture for abstracting AI provider integration in commitment, enabling support for multiple AI providers (Claude, OpenAI Codex, OpenAI API, Cursor, Google Gemini) while maintaining backward compatibility.

## Goals

1. **Multi-Provider Support**: Enable users to choose from multiple AI providers
2. **Unified Interface**: Common interface regardless of provider type (CLI vs API)
3. **Graceful Fallback**: Support fallback chains when primary provider fails
4. **Zero Breaking Changes**: Maintain backward compatibility with existing API
5. **Easy Extension**: Make it trivial to add new providers in the future

## Non-Goals

1. Provider auto-selection based on code analysis
2. Parallel provider queries for consensus
3. Custom prompt engineering per provider (use common prompts)
4. Provider-specific features that break abstraction

## Provider Landscape (as of October 2025)

### CLI-Based Providers

These providers expose a command-line interface:

1. **Claude CLI** (`claude --print`)
   - Uses stdin for prompts
   - Returns response via stdout
   - Current implementation in commitment

2. **OpenAI Codex CLI** (`codex`)
   - Local coding agent from OpenAI
   - Generally available as of October 2025
   - Supports model selection via flags

3. **Cursor CLI** (`cursor-agent`)
   - AI code editor's CLI interface
   - Supports model selection via `-m, --model` flag
   - Can use various models (sonnet-4, gpt-5, etc.)

### API-Based Providers

These providers expose HTTP REST APIs:

1. **OpenAI API** (Chat Completions)
   - REST API: `https://api.openai.com/v1/chat/completions`
   - Requires API key authentication
   - Models: gpt-4, gpt-4o, etc.

2. **Google Gemini API** (generateContent)
   - REST API: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
   - Requires API key authentication
   - Models: gemini-2.5-pro, gemini-2.5-flash, etc.

3. **Cursor API** (AI Code Tracking)
   - REST API: `https://api.cursor.com/analytics/ai-code/`
   - Primarily for analytics, may support code generation

## Architecture Design

### Core Interface: `AIProvider`

All providers must implement this interface:

```typescript
/**
 * Core interface that all AI providers must implement
 */
export interface AIProvider {
  /**
   * Generate a commit message from the given prompt
   * @param prompt - The formatted prompt with git diff and context
   * @param options - Provider-specific options
   * @returns The generated commit message
   * @throws Error if generation fails
   */
  generateCommitMessage(prompt: string, options: GenerateOptions): Promise<string>;

  /**
   * Check if this provider is available and configured correctly
   * @returns true if provider can be used
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get the human-readable name of this provider
   * @returns Provider name (e.g., "Claude CLI", "OpenAI API")
   */
  getName(): string;

  /**
   * Get the provider type for categorization
   * @returns Provider type enum
   */
  getProviderType(): ProviderType;
}

/**
 * Provider type categorization
 */
export enum ProviderType {
  CLI = 'cli',
  API = 'api',
}

/**
 * Common options for all providers
 */
export interface GenerateOptions {
  /** Working directory for context */
  workdir?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Additional context or metadata */
  metadata?: Record<string, unknown>;
}
```

### Base Classes

#### `BaseCLIProvider` (Abstract)

Base class for CLI-based providers using `execa`:

```typescript
export abstract class BaseCLIProvider implements AIProvider {
  protected config: CLIProviderConfig;

  constructor(config: CLIProviderConfig) {
    this.config = config;
  }

  abstract getName(): string;

  getProviderType(): ProviderType {
    return ProviderType.CLI;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await execa(this.config.command, ['--version'], {
        timeout: 5000,
      });
      return true;
    } catch {
      return false;
    }
  }

  async generateCommitMessage(prompt: string, options: GenerateOptions): Promise<string> {
    const args = this.buildCommandArgs(options);
    const execaOptions = this.buildExecaOptions(prompt, options);

    try {
      const { stdout } = await execa(this.config.command, args, execaOptions);
      return this.parseResponse(stdout);
    } catch (error) {
      throw new Error(
        `${this.getName()} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Build command-line arguments for this provider
   * Override in subclasses for provider-specific args
   */
  protected buildCommandArgs(options: GenerateOptions): string[] {
    return this.config.args ?? [];
  }

  /**
   * Build execa options including stdin handling
   */
  protected buildExecaOptions(prompt: string, options: GenerateOptions): ExecaOptions {
    return {
      cwd: options.workdir,
      timeout: options.timeout ?? this.config.timeout ?? 120000,
      stdin: 'pipe',
      input: prompt,
    };
  }

  /**
   * Parse the CLI response to extract the commit message
   * Override in subclasses for provider-specific parsing
   */
  protected abstract parseResponse(stdout: string): string;
}

export interface CLIProviderConfig {
  /** Command to execute (e.g., 'claude', 'codex') */
  command: string;
  /** Additional CLI arguments */
  args?: string[];
  /** Default timeout in milliseconds */
  timeout?: number;
}
```

#### `BaseAPIProvider` (Abstract)

Base class for HTTP API-based providers:

```typescript
export abstract class BaseAPIProvider implements AIProvider {
  protected config: APIProviderConfig;

  constructor(config: APIProviderConfig) {
    this.config = config;
  }

  abstract getName(): string;

  getProviderType(): ProviderType {
    return ProviderType.API;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.config.apiKey) {
      return false;
    }
    // Optionally ping a health endpoint
    return true;
  }

  async generateCommitMessage(prompt: string, options: GenerateOptions): Promise<string> {
    const requestBody = this.buildRequestBody(prompt, options);
    const headers = this.buildHeaders();
    const url = this.buildUrl();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(options.timeout ?? this.config.timeout ?? 120000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseResponse(data);
    } catch (error) {
      throw new Error(
        `${this.getName()} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Build the API endpoint URL
   */
  protected abstract buildUrl(): string;

  /**
   * Build HTTP headers including authentication
   */
  protected buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`,
    };
  }

  /**
   * Build the request body for this provider's API
   * Override in subclasses for provider-specific format
   */
  protected abstract buildRequestBody(
    prompt: string,
    options: GenerateOptions,
  ): Record<string, unknown>;

  /**
   * Parse the API response to extract the commit message
   * Override in subclasses for provider-specific parsing
   */
  protected abstract parseResponse(data: unknown): string;
}

export interface APIProviderConfig {
  /** API key for authentication */
  apiKey: string;
  /** API endpoint URL */
  endpoint?: string;
  /** Model identifier */
  model?: string;
  /** Default timeout in milliseconds */
  timeout?: number;
}
```

### Provider Factory

Factory pattern for creating provider instances using ts-pattern:

```typescript
import { match } from 'ts-pattern';

export class ProviderFactory {
  /**
   * Create a provider from configuration
   * Uses ts-pattern for exhaustive pattern matching
   */
  static createProvider(config: ProviderConfig): AIProvider {
    return (
      match(config)
        // CLI Providers
        .with(
          { type: 'cli', provider: 'claude' },
          (cfg) =>
            new ClaudeProvider({
              command: cfg.command ?? 'claude',
              args: cfg.args ?? ['--print'],
              timeout: cfg.timeout,
            }),
        )
        .with(
          { type: 'cli', provider: 'codex' },
          (cfg) =>
            new CodexProvider({
              command: cfg.command ?? 'codex',
              args: cfg.args,
              timeout: cfg.timeout,
            }),
        )
        .with(
          { type: 'cli', provider: 'cursor' },
          (cfg) =>
            new CursorProvider({
              command: cfg.command ?? 'cursor-agent',
              args: cfg.args,
              timeout: cfg.timeout,
            }),
        )
        // API Providers
        .with(
          { type: 'api', provider: 'openai' },
          (cfg) =>
            new OpenAIProvider({
              apiKey: cfg.apiKey,
              endpoint: cfg.endpoint,
              model: cfg.model ?? 'gpt-4o',
              timeout: cfg.timeout,
            }),
        )
        .with(
          { type: 'api', provider: 'gemini' },
          (cfg) =>
            new GeminiProvider({
              apiKey: cfg.apiKey,
              endpoint: cfg.endpoint,
              model: cfg.model ?? 'gemini-2.5-pro',
              timeout: cfg.timeout,
            }),
        )
        .exhaustive()
    ); // TypeScript ensures all cases are handled
  }

  /**
   * Create multiple providers from config array
   */
  static createProviders(configs: ProviderConfig[]): AIProvider[] {
    return configs.map((config) => this.createProvider(config));
  }
}

/**
 * Configuration for CLI-based providers (Claude, Codex, Cursor)
 */
export interface CLIProviderConfig {
  /** Discriminator for type narrowing */
  type: 'cli';
  /** Provider identifier */
  provider: 'claude' | 'codex' | 'cursor';
  /** CLI command to execute (defaults to provider name) */
  command?: string;
  /** Additional CLI arguments */
  args?: string[];
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Configuration for API-based providers (OpenAI, Gemini)
 */
export interface APIProviderConfig {
  /** Discriminator for type narrowing */
  type: 'api';
  /** Provider identifier */
  provider: 'openai' | 'gemini';
  /** API key for authentication (required) */
  apiKey: string;
  /** Custom API endpoint URL (optional) */
  endpoint?: string;
  /** Model identifier (e.g., 'gpt-4o', 'gemini-2.5-pro') */
  model?: string;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Discriminated union of all provider configurations
 * TypeScript can narrow the type based on the 'type' field
 */
export type ProviderConfig = CLIProviderConfig | APIProviderConfig;
```

#### Runtime Validation with Zod

Use Zod schemas for runtime validation of provider configurations:

```typescript
import { z } from 'zod';

// Base schema for common fields
const baseProviderSchema = z.object({
  timeout: z.number().positive().optional(),
});

// CLI provider schema
export const cliProviderSchema = baseProviderSchema.extend({
  type: z.literal('cli'),
  provider: z.enum(['claude', 'codex', 'cursor']),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
});

// API provider schema
export const apiProviderSchema = baseProviderSchema.extend({
  type: z.literal('api'),
  provider: z.enum(['openai', 'gemini']),
  apiKey: z.string().min(1),
  endpoint: z.string().url().optional(),
  model: z.string().optional(),
});

// Discriminated union schema
export const providerConfigSchema = z.discriminatedUnion('type', [
  cliProviderSchema,
  apiProviderSchema,
]);

// Infer TypeScript types from Zod schemas
export type CLIProviderConfig = z.infer<typeof cliProviderSchema>;
export type APIProviderConfig = z.infer<typeof apiProviderSchema>;
export type ProviderConfig = z.infer<typeof providerConfigSchema>;

// Validation helper
export function validateProviderConfig(config: unknown): ProviderConfig {
  return providerConfigSchema.parse(config);
}
```

#### Benefits of Discriminated Unions

This approach provides several advantages:

1. **Type Safety**: TypeScript enforces that CLI providers cannot have `apiKey` and API providers must have `apiKey`
2. **IDE Support**: Autocomplete shows only relevant fields based on the `type`
3. **Runtime Safety**: The factory can safely access type-specific fields without null checks
4. **Exhaustive Checking**: TypeScript ensures all provider types are handled in switch statements
5. **Clear Intent**: The configuration explicitly declares whether it's CLI or API-based

Example of type narrowing in action:

```typescript
function validateConfig(config: ProviderConfig) {
  if (config.type === 'cli') {
    // TypeScript knows: command, args, provider are available
    // TypeScript error: config.apiKey does not exist
    console.log(config.command); // ✓ Valid
  } else {
    // TypeScript knows: apiKey, endpoint, model are available
    // TypeScript error: config.command does not exist
    console.log(config.apiKey); // ✓ Valid
  }
}
```

### Fallback Chain

Support trying multiple providers with graceful fallback:

```typescript
export class ProviderChain {
  private providers: AIProvider[];
  private logger?: Logger;

  constructor(providers: AIProvider[], logger?: Logger) {
    this.providers = providers;
    this.logger = logger;
  }

  /**
   * Try each provider in sequence until one succeeds
   */
  async generateCommitMessage(prompt: string, options: GenerateOptions): Promise<string | null> {
    for (const provider of this.providers) {
      try {
        // Check availability first
        const available = await provider.isAvailable();
        if (!available) {
          this.logger?.warn(`${provider.getName()} is not available, skipping`);
          continue;
        }

        // Try to generate
        this.logger?.info(`Trying ${provider.getName()}...`);
        const message = await provider.generateCommitMessage(prompt, options);
        this.logger?.info(`✓ ${provider.getName()} succeeded`);
        return message;
      } catch (error) {
        this.logger?.warn(
          `${provider.getName()} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Continue to next provider
      }
    }

    // All providers failed
    return null;
  }
}
```

### Integration with CommitMessageGenerator

Update the existing generator to use providers:

```typescript
export class CommitMessageGenerator {
  private providerChain: ProviderChain | null = null;
  private config: CommitMessageGeneratorConfig;

  constructor(config: CommitMessageGeneratorConfig) {
    this.config = config;

    // Build provider chain from config
    if (config.enableAI && config.providers && config.providers.length > 0) {
      const providers = ProviderFactory.createProviders(config.providers);
      this.providerChain = new ProviderChain(providers, config.logger);
    } else if (config.enableAI && config.aiCommand) {
      // Backward compatibility: single Claude provider
      const provider = new ClaudeProvider({
        command: config.aiCommand,
        args: ['--print'],
        timeout: config.aiTimeout,
      });
      this.providerChain = new ProviderChain([provider], config.logger);
    }
  }

  async generateCommitMessage(task: CommitTask, options: CommitMessageOptions): Promise<string> {
    // Try AI providers if enabled
    if (this.providerChain) {
      const prompt = this._buildPrompt(task, options);
      const aiMessage = await this.providerChain.generateCommitMessage(prompt, {
        workdir: options.workdir,
        timeout: this.config.aiTimeout,
      });

      if (aiMessage && this._isValidMessage(aiMessage)) {
        return this._addSignature(aiMessage);
      }

      this.config.logger?.warn('All AI providers failed, falling back to rule-based generation');
    }

    // Fallback to rule-based generation
    const ruleBasedMessage = this._generateRuleBasedCommitMessage(task, options);
    return this._addSignature(ruleBasedMessage);
  }
}

// Updated config type
export interface CommitMessageGeneratorConfig {
  // New provider-based config
  providers?: ProviderConfig[];

  // Legacy config (for backward compatibility)
  aiCommand?: string;
  aiTimeout?: number;
  enableAI?: boolean;

  // Common config
  signature?: string;
  logger?: Logger;
}
```

## Configuration Examples

### CLI-Based Provider (Claude - Legacy)

```typescript
const generator = new CommitMessageGenerator({
  enableAI: true,
  aiCommand: 'claude',
  aiTimeout: 120000,
});
```

### CLI-Based Provider (Claude - New)

```typescript
const generator = new CommitMessageGenerator({
  enableAI: true,
  providers: [
    {
      type: 'cli',
      provider: 'claude',
      command: 'claude',
      timeout: 120000,
    },
  ],
});
```

### API-Based Provider (OpenAI)

```typescript
const generator = new CommitMessageGenerator({
  enableAI: true,
  providers: [
    {
      type: 'api',
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'gpt-4o',
      timeout: 60000,
    },
  ],
});
```

### Fallback Chain (Multiple Providers)

```typescript
const generator = new CommitMessageGenerator({
  enableAI: true,
  providers: [
    // Try Claude first
    {
      type: 'cli',
      provider: 'claude',
    },
    // Fall back to Codex
    {
      type: 'cli',
      provider: 'codex',
    },
    // Fall back to OpenAI API
    {
      type: 'api',
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'gpt-4o',
    },
  ],
});
```

### Environment-Based Configuration

```typescript
// From environment variables
const providers: ProviderConfig[] = [];

if (process.env.CLAUDE_AVAILABLE) {
  providers.push({
    type: 'cli',
    provider: 'claude',
  });
}

if (process.env.OPENAI_API_KEY) {
  providers.push({
    type: 'api',
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL ?? 'gpt-4o',
  });
}

if (process.env.GEMINI_API_KEY) {
  providers.push({
    type: 'api',
    provider: 'gemini',
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL ?? 'gemini-2.5-pro',
  });
}

const generator = new CommitMessageGenerator({
  enableAI: providers.length > 0,
  providers,
});
```

## Error Handling Strategy

### Provider-Level Errors

Each provider should throw descriptive errors:

- **Not Available**: `isAvailable()` returns false, skip provider in chain
- **Execution Error**: CLI/API call fails, try next provider
- **Parse Error**: Response parsing fails, try next provider
- **Timeout**: Operation exceeds timeout, try next provider

### Chain-Level Errors

The `ProviderChain` handles:

1. Try each provider in sequence
2. Log warnings for failures
3. Return `null` if all providers fail
4. Generator falls back to rule-based generation

### User-Facing Errors

Users should see:

```
⚠️ Claude CLI failed: command not found, trying next provider...
⚠️ OpenAI API failed: API key invalid, trying next provider...
⚠️ All AI providers failed, falling back to rule-based generation
```

## File Structure

```
src/
├── providers/
│   ├── types.ts                  # AIProvider interface, enums, types
│   ├── base-cli-provider.ts      # BaseCLIProvider abstract class
│   ├── base-api-provider.ts      # BaseAPIProvider abstract class
│   ├── provider-factory.ts       # ProviderFactory for instantiation
│   ├── provider-chain.ts         # ProviderChain for fallback
│   │
│   ├── claude/
│   │   └── claude-provider.ts    # ClaudeProvider implementation
│   │
│   ├── codex/
│   │   └── codex-provider.ts     # CodexProvider implementation
│   │
│   ├── cursor/
│   │   └── cursor-provider.ts    # CursorProvider implementation
│   │
│   ├── openai/
│   │   └── openai-provider.ts    # OpenAIProvider implementation
│   │
│   └── gemini/
│       └── gemini-provider.ts    # GeminiProvider implementation
│
├── generator.ts                  # Updated CommitMessageGenerator
├── cli.ts                        # Updated CLI with provider flags
└── index.ts                      # Updated exports
```

## Migration Path

### Phase 1: Infrastructure (SNU-108)

Create provider interfaces and base classes:

- `src/providers/types.ts`
- `src/providers/base-cli-provider.ts`
- `src/providers/base-api-provider.ts`
- `src/providers/provider-factory.ts`
- `src/providers/provider-chain.ts`

### Phase 2: Refactor Existing (SNU-109)

Extract current Claude implementation:

- Create `src/providers/claude/claude-provider.ts`
- Extend `BaseCLIProvider`
- Keep backward compatibility

### Phase 3: Add CLI Providers (SNU-110)

Implement Codex and Cursor:

- `src/providers/codex/codex-provider.ts`
- `src/providers/cursor/cursor-provider.ts`

### Phase 4: Add API Providers (SNU-111)

Implement OpenAI and Gemini:

- `src/providers/openai/openai-provider.ts`
- `src/providers/gemini/gemini-provider.ts`

### Phase 5: CLI Integration (SNU-113)

Update CLI to support provider flags:

```bash
# Use specific provider
commitment --provider=openai --api-key=$OPENAI_API_KEY

# Use fallback chain
commitment --providers=claude,codex,openai
```

## Decision Log

### Factory Pattern vs Strategy Pattern

**Decision**: Use Factory Pattern for instantiation, Strategy Pattern (interface) for runtime behavior.

**Rationale**:

- Factory centralizes provider creation logic
- Strategy (AIProvider interface) enables polymorphism
- Combination gives us both flexibility and maintainability

### Fallback Chain vs Auto-Selection

**Decision**: Implement fallback chain (try providers in sequence).

**Rationale**:

- Simpler to implement and reason about
- Predictable behavior for users
- Extensible to auto-selection later if needed
- Matches existing fallback-to-rules pattern

### CLI Base Class vs Per-Provider Implementation

**Decision**: Create `BaseCLIProvider` abstract class.

**Rationale**:

- Reduces code duplication (execa setup, error handling)
- Enforces consistent patterns across CLI providers
- Allows customization via template method pattern
- Similar providers (Claude, Codex, Cursor) share 80% of code

### Backward Compatibility Approach

**Decision**: Support legacy config alongside new provider config.

**Rationale**:

- Zero breaking changes for existing users
- Legacy config maps cleanly to single Claude provider
- Can deprecate in major version bump later
- Allows gradual migration

### Discriminated Unions vs Flat Config

**Decision**: Use discriminated unions with `type` field instead of flat configuration object.

**Rationale**:

- TypeScript enforces correctness at compile time (CLI providers can't have `apiKey`)
- IDE autocomplete shows only relevant fields based on provider type
- Eliminates runtime null checks for type-specific fields
- Makes configuration intent explicit and self-documenting
- Enables exhaustive type checking in factory

### ts-pattern for Control Flow

**Decision**: Use ts-pattern for pattern matching instead of switch/if-else chains.

**Rationale**:

- Exhaustive pattern matching catches missing cases at compile time
- More concise and readable than nested switch statements
- Follows chopstack's architectural pattern (already uses ts-pattern)
- Better type narrowing than traditional control flow
- Functional programming style aligns with project goals

### Zod for Runtime Validation

**Decision**: Use Zod for runtime validation of provider configurations.

**Rationale**:

- Provides runtime type safety for user-provided configurations
- Single source of truth (schemas can infer TypeScript types)
- Better error messages than manual validation
- Validates complex nested structures automatically
- Can be used for environment variable parsing and CLI input

## Open Questions

1. **Should we support provider plugins?**
   - External packages that implement `AIProvider`
   - Would require dynamic loading mechanism
   - Not needed for v1, consider for v2

2. **Should we cache provider availability checks?**
   - `isAvailable()` could be expensive for API providers
   - Cache for X seconds to avoid repeated checks
   - Add in performance optimization phase

3. **How should we handle provider-specific options?**
   - Some providers may have unique capabilities
   - Current design uses generic `metadata` field
   - Could add `providerOptions` per provider in config

4. **Should we expose provider statistics?**
   - Track success/failure rates per provider
   - Help users optimize their fallback chains
   - Nice-to-have for v2

## Success Criteria

- [ ] Architecture document approved
- [ ] All provider types can be abstracted
- [ ] Backward compatibility maintained
- [ ] Fallback chain works reliably
- [ ] Easy to add new providers
- [ ] TypeScript types are sound and complete
- [ ] Error handling is comprehensive

## References

- [OpenAI Chat Completions API](https://platform.openai.com/docs/api-reference/chat)
- [Google Gemini API](https://ai.google.dev/api/generate-content)
- [OpenAI Codex CLI](https://github.com/openai/codex)
- [Cursor API Documentation](https://docs.cursor.com/)
- [Current implementation](../src/generator.ts)
