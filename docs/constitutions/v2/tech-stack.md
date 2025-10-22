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

### tsup

**Version:** Latest stable
**Status:** ✅ MANDATORY

**Rationale:**
- Fast TypeScript bundler built on esbuild
- Zero-config for simple projects
- Dual entry points (CLI + library)

**Alternatives Rejected:**
- tsc alone - Too slow, doesn't bundle
- webpack - Overkill for CLI tool
- rollup - More complex configuration

### pnpm

**Version:** Latest stable
**Status:** ✅ MANDATORY

**Rationale:**
- Fast, efficient disk usage
- Strict dependency resolution
- Monorepo support (future-ready)

**Forbidden:** npm, yarn (use pnpm exclusively)

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

### Vitest

**Purpose:** Testing framework
**Status:** ✅ MANDATORY

**Rationale:**
- Fast, Vite-powered test runner
- ESM-native
- Jest-compatible API
- Built-in coverage

**Forbidden:** Jest (use Vitest exclusively)

### ESLint

**Purpose:** Code linting
**Status:** ✅ MANDATORY

**Configuration:**
- TypeScript strict rules
- Import organization
- Unicorn rules for modern patterns
- Sorted imports

**Key Plugins:**
- `@typescript-eslint` - TypeScript linting
- `eslint-plugin-import` - Import organization
- `eslint-plugin-unicorn` - Modern patterns

### Prettier

**Purpose:** Code formatting
**Status:** ✅ MANDATORY

**Configuration:**
- Single quotes
- No semicolons
- Trailing commas (es5)
- 100 line width

**Integration:** Runs via `eslint-plugin-prettier` for unified linting.

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

### Codex CLI (from Cursor)

**Purpose:** Secondary AI provider (fallback)
**Status:** ✅ APPROVED

**Command:** `codex --print <prompt>`

**Detection:** Check for `codex` in PATH

### Future Providers

**Status:** 🟡 UNDER CONSIDERATION

Potential additions:
- OpenAI API (direct API call, not CLI)
- Gemini API
- Local LLMs (ollama, etc.)

**Adding new providers:**
1. Must fit provider abstraction (BaseCLIProvider or BaseAPIProvider)
2. Must support auto-detection
3. Must parse conventional commit format
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

### Critical Dependencies

**Exact versions:** `5.2.0` (no updates without testing)

**Examples:**
- TypeScript (affects all code)
- Zod (affects all validation)

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

**Status:** 🟡 UNDER CONSIDERATION

For OpenAI/Anthropic API direct access:
- Anthropic SDK
- OpenAI SDK

**Criteria:** Only add if CLI providers insufficient.

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
