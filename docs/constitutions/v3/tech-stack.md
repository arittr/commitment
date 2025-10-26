# Technology Stack

## Core Principle

**commitment uses a focused, modern tech stack. All dependencies MUST be justified.**

Adding a dependency requires understanding its trade-offs and ensuring it aligns with our architectural principles.

## Language and Runtime

### TypeScript (Strict Mode)

**Version:** Latest stable (currently 5.x)
**Status:** ✅ MANDATORY

**Rationale:**
- Strict type safety catches bugs at compile time
- Excellent tooling and IDE support
- ESM-first with modern module system

**Configuration:**
```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true,
  "exactOptionalPropertyTypes": true
}
```

**All strict flags MUST be enabled.** Disabling strict flags breaks architecture.

### Node.js

**Version:** 18+ (LTS or higher)
**Status:** ✅ MANDATORY

**Rationale:**
- Native ESM support
- Modern JavaScript features
- Widespread deployment

**Target:** ESM-only, no CommonJS compatibility.

## Build and Tooling

### Bun

**Version:** 1.1.0+
**Status:** ✅ MANDATORY

**Rationale:**
- All-in-one toolkit: package manager, bundler, test runner
- Significantly faster than traditional Node.js tools (2-3x faster installs, builds, tests)
- Native TypeScript support with zero configuration
- Built-in test runner with Jest-compatible API
- Efficient bundler with ESM-first approach

**Features:**
- Package Manager: Fast, disk-efficient with binary lockfile (bun.lockb)
- Build Tool: Native bundler via `Bun.build()` API
- Test Runner: `bun:test` with native mocking support
- See: https://bun.sh/docs

**Alternatives Rejected:**
- pnpm - Good but Bun is faster and more integrated
- tsup - Bun's bundler is built-in and faster
- Vitest - Bun's test runner is built-in and faster

### pnpm

**Version:** Latest stable
**Status:** ❌ REMOVED (replaced by Bun)

**Removal Rationale:**
- Bun provides all package management features
- Bun is 2-3x faster for installs
- Bun's lockfile is more efficient (binary format)
- Consolidates tooling (one tool instead of pnpm + tsup + vitest)

**Migration:** Use `bun install` instead of `pnpm install`

## Core Dependencies

### Commander.js

**Purpose:** CLI argument parsing
**Status:** ✅ APPROVED

**Rationale:**
- Industry standard for Node.js CLIs
- Declarative API
- Built-in help generation

**Usage:**
```typescript
import { Command } from 'commander';

const program = new Command();
program
  .option('--ai', 'Enable AI generation')
  .option('--provider <name>', 'AI provider to use');
```

### Zod

**Purpose:** Runtime type validation and schema definition
**Status:** ✅ MANDATORY

**Rationale:**
- Schema-first type safety (TypeScript types inferred from schemas)
- Runtime validation at boundaries
- Excellent error messages
- Composable schemas

**Usage Pattern:**
```typescript
const schema = z.object({
  name: z.string(),
  timeout: z.number().positive(),
});

type Config = z.infer<typeof schema>;
```

**Alternatives Rejected:**
- io-ts - More complex API
- yup - Less TypeScript-friendly
- joi - Runtime-only, no type inference

**When adding validation, Zod is MANDATORY.** Other validation libraries are forbidden.

### execa

**Purpose:** Execute external commands (git, claude, codex)
**Status:** ✅ APPROVED

**Rationale:**
- Better API than child_process
- Promise-based
- Proper error handling
- Cross-platform

**Usage:**
```typescript
import { execa } from 'execa';

const { stdout } = await execa('git', ['status', '--porcelain']);
```

### chalk

**Purpose:** Terminal text formatting
**Status:** ✅ APPROVED

**Rationale:**
- Industry standard for CLI coloring
- Simple API
- Works across terminals

**Usage:**
```typescript
import chalk from 'chalk';

console.log(chalk.green('✓ Success'));
console.log(chalk.red('✗ Error'));
```

### ts-pattern

**Purpose:** Pattern matching for discriminated unions
**Status:** ✅ APPROVED

**Rationale:**
- Type-safe pattern matching
- Exhaustiveness checking
- Cleaner than if/else chains for complex branching

**Usage:**
```typescript
import { match } from 'ts-pattern';

const result = match(provider)
  .with({ type: 'cli', provider: 'claude' }, (cfg) => new ClaudeProvider(cfg))
  .with({ type: 'cli', provider: 'codex' }, (cfg) => new CodexProvider(cfg))
  .exhaustive();
```

**When to use:**
- Discriminated union handling
- Provider factory pattern
- Complex conditional logic

**When NOT to use:**
- Simple if/else (use guard clauses)
- Two-branch logic (use ternary or if/else)

## Development Dependencies

### bun:test

**Purpose:** Testing framework
**Status:** ✅ MANDATORY

**Rationale:**
- Native Bun test runner (no additional dependencies)
- Jest-compatible API (describe, it, expect)
- Built-in mocking with `mock()` and `spyOn()`
- Fast execution (significantly faster than Vitest)
- Built-in coverage reporting

**Configuration:** `bunfig.toml` for test settings

**Forbidden:** Jest, Vitest (use bun:test exclusively)

### Biome

**Purpose:** Linting and formatting
**Status:** ✅ MANDATORY

**Rationale:**
- Fast Rust-based linter and formatter
- Zero configuration out of the box
- Replaces ESLint + Prettier with single tool
- TypeScript-first design
- Import sorting built-in

**Configuration:** `biome.json` for rules

**Key Features:**
- TypeScript strict rules
- Import organization
- Code formatting
- Fast performance

### Husky + lint-staged

**Purpose:** Git hooks
**Status:** ✅ APPROVED

**Rationale:**
- Enforce code quality pre-commit
- Self-dogfooding (commitment generates own commits)

**Hooks:**
- `pre-commit` - Run linting and build
- `prepare-commit-msg` - Generate commit message with commitment

## AI Provider CLIs

### Claude CLI

**Purpose:** Primary AI provider
**Status:** ✅ APPROVED

**Command:** `claude --print <prompt>`

**Detection:** Check for `claude` in PATH

### Codex CLI

**Purpose:** Secondary AI provider (fallback)
**Status:** ✅ APPROVED

**Command:** `codex --print <prompt>`

**Detection:** Check for `codex` in PATH

### OpenAI Agents SDK

**Purpose:** Evaluation system - ChatGPT as commit message judge
**Status:** ✅ APPROVED (eval system only)

**Package:** `@openai/agents`

**Rationale:**
- Structured output with Zod schemas
- Built-in agent loop handling
- Type-safe response parsing

**Usage Pattern:**
```typescript
import { Agent, run } from '@openai/agents';
import { z } from 'zod';

// Define structured output schema
const evaluationSchema = z.object({
  score: z.number().min(0).max(10),
  feedback: z.string(),
});

// Create agent with outputType
const agent = new Agent({
  name: 'Evaluator',
  instructions: 'Your instructions here...',
  model: 'gpt-5',  // Always use gpt-5 for OpenAI SDKs
  outputType: evaluationSchema,
});

// Run and access structured output
const result = await run(agent, 'Your prompt here');
const output = result.finalOutput;  // Typed as z.infer<typeof evaluationSchema>
```

**Critical Rules:**
- **Always use `gpt-5`** as the model name (NOT `gpt-4o`, `gpt-4-turbo`, etc.)
- Use `outputType` with Zod schema for structured output
- Access data via `result.finalOutput`, NOT `result.toolCalls`
- Do NOT use `tool()` for structured output - use `outputType` instead

**Scope:** Evaluation system only (`src/eval/`). NOT for core commit generation.

### Future Providers

**Status:** 🟡 UNDER CONSIDERATION

Potential additions:
- Gemini API
- Local LLMs (ollama, etc.)
- Additional OpenAI models (for commit generation, not evaluation)

**Adding new providers:**
1. Must follow agent pattern (~40-60 LOC)
2. Must support availability detection
3. Must output conventional commit format
4. Must have tests

## Workflow Tools

### git-spice

**Purpose:** Stacked branch workflow
**Status:** ✅ RECOMMENDED

**Rationale:**
- Simplifies multi-branch workflows
- Auto-restacking on changes
- Generates branch names from commits

**Usage:**
```bash
gs bc feat-name        # Create branch
git add .
./dist/cli.js          # Generate commit with commitment
gs stack submit        # Submit PRs
```

**Not mandatory:** Projects may use standard git workflow if preferred.

## Forbidden Dependencies

### ❌ pnpm

**Reason:** Replaced by Bun.

**Alternative:** Use `bun install` for package management.

### ❌ tsup

**Reason:** Replaced by Bun's built-in bundler.

**Alternative:** Use `Bun.build()` API in `build.ts`.

### ❌ Vitest

**Reason:** Replaced by bun:test.

**Alternative:** Use `bun test` with built-in test runner.

### ❌ Lodash

**Reason:** Modern JavaScript has built-in alternatives.

Use native methods:
- `Array.map/filter/reduce`
- `Object.keys/values/entries`
- Optional chaining `?.`
- Nullish coalescing `??`

### ❌ Moment.js

**Reason:** Deprecated, large bundle size.

**Alternative:** Native `Date` or `date-fns` if complex date logic needed.

### ❌ Request

**Reason:** Deprecated.

**Alternative:** `fetch` (native in Node 18+) or `execa` for CLI commands.

### ❌ Inquirer

**Reason:** We're non-interactive by design.

CLI should work in scripts and CI. No interactive prompts.

### ❌ dotenv

**Reason:** No environment variables needed (yet).

If config becomes complex, prefer `cosmiconfig` for config files.

## Dependency Evaluation Criteria

When considering a new dependency:

1. **Necessity:** Can we build it ourselves in <100 LOC?
2. **Maintenance:** Is it actively maintained? (commits in last 6 months)
3. **Type Safety:** Does it have TypeScript types or `@types` package?
4. **Bundle Size:** What's the impact? (use `bundlephobia.com`)
5. **API Quality:** Is the API well-designed and documented?
6. **Alternatives:** What else did we consider? Why is this better?
7. **Architecture Fit:** Does it align with our patterns?

**Document decisions in PR description.**

## Version Pinning Strategy

### Production Dependencies

**Pin major + minor:** `^5.2.0` (allows patch updates)

**Rationale:** Patches should be safe, minors may break in subtle ways.

### Dev Dependencies

**Pin major only:** `^5.0.0` (allows minor + patch)

**Rationale:** Tooling updates less critical, want latest features.

**Exception:** `bun-types` uses `latest` to match Bun runtime version.

### Critical Dependencies

**Exact versions:** `5.2.0` (no updates without testing)

**Examples:**
- TypeScript (affects all code)
- Zod (affects all validation)
- Bun (specified in packageManager field)

**Update explicitly after testing.**

## Updating Dependencies

**Process:**

1. Check changelog for breaking changes
2. Update in separate PR
3. Run full test suite
4. Test CLI manually
5. Document any breaking changes

**Automation:**

- Renovate or Dependabot for automated PRs
- Auto-merge for patches if tests pass
- Review minors manually

## Future Considerations

### Monorepo Tools

**Status:** 🟡 NOT NEEDED YET

If commitment grows to multiple packages:
- Turbo
- Nx
- Workspace features of pnpm

### API Providers

**Status:** ✅ PARTIALLY ADOPTED

Current usage:
- OpenAI Agents SDK (for evaluation system only)

Future consideration:
- Anthropic SDK (for direct Claude API access)
- OpenAI SDK (for direct GPT API access, commit generation)

**Criteria:** Add only if specific use case requires API over CLI.

### Configuration Management

**Status:** 🟡 NOT NEEDED YET

If config becomes complex:
- cosmiconfig (for `.commitmentrc` files)
- zod-to-json-schema (for config schema)

## Tech Stack Evolution

**Adding approved technology:**
1. Propose in PR
2. Document rationale
3. Get review + approval

**Removing approved technology:**
1. Requires new constitution version
2. Document migration path
3. Update all affected code

**Version 1 tech stack is current as of 2025-10-21.**
