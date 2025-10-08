# CLAUDE.md

This file provides guidance to Claude Code and other AI coding agents when working with code in this repository.

## Project Overview

**commitment** is an AI-powered commit message generator with intelligent fallback. It uses Claude CLI to generate high-quality, conventional commit messages from git diffs, with a rule-based fallback for when AI is unavailable.

## Development Commands

### Building and Development

```bash
# Build the project
pnpm run build

# Watch mode development
pnpm run dev

# Clean build artifacts
pnpm run clean
```

### Code Quality

```bash
# Run linting (type-check + format-check + eslint)
pnpm run lint

# Fix linting issues automatically
pnpm run lint:fix

# Format code
pnpm run format

# Check formatting
pnpm run format:check

# Type checking
pnpm run type-check
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

**Always run `pnpm run lint:fix` before committing.**

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

### Core Components

- **CLI** (`src/cli.ts`): Command-line interface for generating and creating commits
- **Generator** (`src/generator.ts`): CommitMessageGenerator class with AI and rule-based generation
- **Providers** (`src/providers/`): Modular AI provider system supporting multiple backends
- **Guards** (`src/utils/guards.ts`): Type guard utilities for safer code

### Key Design Patterns

1. **AI-First with Fallback**: Always try AI generation first, fall back to rule-based
2. **Conventional Commits**: All messages follow conventional commit format
3. **Provider Abstraction**: Pluggable AI providers (Claude CLI, Codex CLI, etc.)
4. **ESM-Only**: Built as ESM modules using latest TypeScript and Node.js features
5. **Strict TypeScript**: All strict compiler options enabled
6. **Self-Dogfooding**: commitment uses itself via git hooks

## Adding a New AI Provider

The provider system is designed to make adding new AI providers trivial. Follow these steps:

### Step 1: Create Provider Class

Create a new file in `src/providers/implementations/`:

```typescript
import type { CLIProviderConfig } from '../types';
import { BaseCLIProvider } from '../base/base-cli-provider';
import { CLIResponseParser } from '../utils/cli-response-parser';

export class MyProvider extends BaseCLIProvider {
  constructor(config: Omit<CLIProviderConfig, 'type' | 'provider'> = {}) {
    super({
      type: 'cli',
      provider: 'my-provider',
      ...config,
    });
  }

  protected getCommand(): string {
    return this.config.command ?? 'my-cli';
  }

  protected getArgs(): string[] {
    return this.config.args ?? ['--print'];
  }

  getName(): string {
    return 'My CLI';
  }

  async isAvailable(): Promise<boolean> {
    return this.checkCommandAvailable();
  }

  protected override parseResponse(output: string): string {
    const cleaned = CLIResponseParser.cleanAIArtifacts(output);
    return CLIResponseParser.parse(cleaned);
  }
}
```

### Step 2: Update Types

Add your provider to the enum in `src/providers/types.ts`:

```typescript
provider: z.enum(['claude', 'codex', 'my-provider', 'cursor']),
```

### Step 3: Update Factory

Import and instantiate in `src/providers/provider-factory.ts`:

```typescript
import { MyProvider } from './implementations/my-provider';

// ... in createProvider():
.with({ type: 'cli', provider: 'my-provider' }, (cfg) => {
  return new MyProvider({
    command: cfg.command,
    args: cfg.args,
    timeout: cfg.timeout,
  });
})
```

### Step 4: Update Auto-Detection

Add to `src/providers/auto-detect.ts`:

```typescript
const providersToCheck: AIProvider[] = [
  new ClaudeProvider(),
  new CodexProvider(),
  new MyProvider(), // Add here
];
```

### Step 5: Export Provider

Add to `src/providers/index.ts`:

```typescript
export { MyProvider } from './implementations/my-provider';
```

### Step 6: Add Tests

Create `src/providers/implementations/__tests__/my-provider.test.ts` following the pattern in `codex-provider.test.ts`.

That's it! Your provider is now fully integrated and can be used with `--provider my-provider`.

## Self-Dogfooding

commitment uses itself for its own commit messages via git hooks:

- **pre-commit**: Runs linting and builds dist/
- **prepare-commit-msg**: Calls `./dist/cli.js --message-only` to generate commit message

This ensures commitment is battle-tested on itself and provides a real-world example.

## Testing

Currently, commitment does not have automated tests. When adding tests in the future:

- Use Vitest for all testing
- Follow chopstack's test organization (co-located unit tests, integration tests)
- Test both AI and fallback paths
- Mock external dependencies (git commands, Claude CLI)

## File Structure

```
src/
├── cli.ts          # CLI entry point
├── generator.ts    # CommitMessageGenerator class
├── index.ts        # Library exports
└── utils/
    └── guards.ts   # Type guards

examples/
├── git-hooks/      # Plain git hooks examples
├── husky/          # Husky integration examples
└── lint-staged/    # lint-staged integration examples
```

## Publishing

commitment is intended to be published to npm. Before publishing:

```bash
# Clean and build
pnpm run clean
pnpm run build

# Verify everything works
./dist/cli.js --dry-run

# Publish (requires npm access)
npm publish
```

The `prepublishOnly` script automatically cleans and builds before publishing.

## Development Notes

- Package manager is strictly pnpm (not npm or yarn)
- Build targets Node.js 18+ with ESM-only output
- Uses tsup for fast builds with dual entry points (CLI + library)
- CLI file has relaxed ESLint rules (allows `console.log` and `process.exit`)
- Config files have relaxed rules (no default export restriction)
- Always use commitment itself for commits (dogfooding!)

## Contributing

When working on commitment:

1. Create a new stacked branch with `gs bc <branch-name>`
2. Make your changes following the code style guidelines
3. Run `pnpm run lint:fix` to ensure code quality
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
