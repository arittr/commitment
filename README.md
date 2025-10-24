# commitment

> AI-powered commit message generator

<img width="500" height="304" alt="commitment - AI-powered commit messages" src="https://github.com/user-attachments/assets/827862c0-8f1d-4eb0-a989-4ed7f37ea721" />

We all know we should write better commit messages. But we don't.

**commitment** analyzes your git diffs using AI and generates professional, conventional commit messages automatically.

## Why commitment?

- **Save time**: Stop thinking about commit message phrasing - focus on code
- **Consistency**: Every commit follows [Conventional Commits](https://www.conventionalcommits.org/) format
- **Context-aware**: AI understands your changes, not just file names
- **Frictionless**: One-command setup, then forget about it

## Features

- 🤖 **AI-powered generation** using Claude CLI or Codex CLI for accurate, context-aware messages
- 📊 **Code analysis** detects functions, tests, types, and patterns in your changes
- ✨ **Conventional commits** follows standard format (feat:, fix:, docs:, etc.)
- 🚀 **One-command setup** with `commitment init` for automatic hook installation
- 🪝 **Hook integration** works with husky, simple-git-hooks, or plain git hooks
- 🌍 **Cross-platform** supports macOS, Linux, and Windows
- 📦 **Zero config** works out of the box with sensible defaults

## Quick Start

```bash
# 1. Install
npm install -D @arittr/commitment

# 2. Set up git hooks (automatic)
npx commitment init

# 3. Make changes and commit
git add .
git commit  # Message generated automatically!
```

That's it! Every commit now gets an AI-generated message.

## Installation

```bash
# Using npm
npm install -D @arittr/commitment

# Using yarn
yarn add -D @arittr/commitment

# Using pnpm
pnpm add -D @arittr/commitment

# Using bun
bun add -D @arittr/commitment
```

## Requirements

- **Node.js** >= 18
- **Git repository**
- **AI CLI** (one of):
  - [Claude CLI](https://docs.claude.com/docs/claude-code) (recommended) - Install with `npm install -g @anthropic-ai/claude-code`
  - [Codex CLI](https://cursor.sh) (via Cursor) - Requires Cursor installation

> **Important**: commitment requires an AI CLI to function. If you don't have one installed, see [Troubleshooting](#ai-cli-not-installed).

## Usage

### Automatic (Recommended)

After running `npx commitment init`, commit messages are generated automatically:

```bash
git add src/components/Button.tsx
git commit  # Opens editor with AI-generated message
```

### Manual

Generate a message and commit in one step:

```bash
git add .
npx commitment
```

Generate message only (preview without committing):

```bash
npx commitment --dry-run
```

Use a specific AI agent:

```bash
npx commitment --agent codex
```

## How It Works

1. **Analyze**: Reads your staged changes with `git diff --cached`
2. **Generate**: Sends diff to AI (Claude or Codex) with a detailed prompt
3. **Validate**: Ensures response follows Conventional Commits format
4. **Commit**: Creates commit with generated message

### What Gets Analyzed

commitment's AI understands:

- **Code patterns**: Function/method additions, removals, modifications
- **Test changes**: New tests, updated assertions, test refactoring
- **Type definitions**: Interfaces, types, schemas
- **File context**: Components, utilities, configs, documentation
- **Change magnitude**: Lines added/removed, scope of changes

## Examples

### Simple Feature

```bash
$ git add src/components/Button.tsx
$ npx commitment
```

**Generated:**
```
feat: add button component with variant support

- Create reusable Button component with TypeScript
- Add props interface for size and variant options
- Include hover and focus states with animations
```

### Bug Fix

```bash
$ git add src/utils/validation.ts
$ npx commitment
```

**Generated:**
```
fix: correct email validation regex pattern

- Fix regex to handle plus signs in email addresses
- Update test cases for edge cases
- Add validation for international domains
```

### Multiple Files

```bash
$ git add src/api/ src/types/
$ npx commitment
```

**Generated:**
```
feat: implement user authentication API

- Add login and logout endpoints with JWT support
- Create token generation and validation utilities
- Update user type definitions with auth fields
- Add authentication middleware for protected routes
```

## Configuration

### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--agent <name>` | AI agent to use (`claude` or `codex`) | `claude` |
| `--dry-run` | Generate message without creating commit | `false` |
| `--message-only` | Output only the commit message | `false` |
| `--cwd <path>` | Working directory | current directory |

See [docs/CLI.md](./docs/CLI.md) for complete CLI reference.

### Hook Setup

commitment supports multiple hook managers:

| Manager | Command | Best For |
|---------|---------|----------|
| **Auto-detect** | `npx commitment init` | Most projects |
| **Husky** | `npx commitment init --hook-manager husky` | Teams with existing husky setup |
| **simple-git-hooks** | `npx commitment init --hook-manager simple-git-hooks` | Lightweight alternative to husky |
| **Plain Git Hooks** | `npx commitment init --hook-manager plain` | No dependencies |

See [docs/HOOKS.md](./docs/HOOKS.md) for detailed hook integration guide.

## Troubleshooting

### AI CLI Not Installed

**Error:**
```
Command "claude" not found. Please ensure it is installed and in your PATH.
```

**Solution:**

Install Claude CLI (recommended):
```bash
npm install -g @anthropic-ai/claude-code
```

Or use Codex (requires Cursor):
```bash
# Install Cursor from https://cursor.sh
npx commitment --agent codex
```

### No Staged Changes

**Error:**
```
No staged changes to commit
```

**Solution:**
```bash
git add .
npx commitment
```

### Hooks Not Running

**Check installation:**
```bash
# For husky
ls -la .husky/prepare-commit-msg

# For plain git hooks
ls -la .git/hooks/prepare-commit-msg
```

**Reinstall:**
```bash
npx commitment init
```

**Check permissions (Unix-like systems):**
```bash
chmod +x .husky/prepare-commit-msg
# or
chmod +x .git/hooks/prepare-commit-msg
```

### Hooks Override My Custom Messages

This should **not** happen. Hooks check if you've specified a message:

```bash
git commit -m "my message"  # Uses your message ✅
git commit                  # Generates message ✅
```

If hooks override your messages, please [file an issue](https://github.com/arittr/commitment/issues).

### Windows Issues

**Symptoms:**
- Hooks don't run
- Line ending errors (`\r` in scripts)

**Solutions:**

1. **Use Git Bash or WSL** instead of CMD/PowerShell
2. **Verify line endings** - `commitment init` handles this automatically
3. **Check git config:**
   ```bash
   git config core.autocrlf false
   ```

## Cross-Platform Support

| Platform | CLI Usage | Hooks | AI Agents |
|----------|-----------|-------|-----------|
| macOS    | ✅ | ✅ | ✅ Claude, Codex |
| Linux    | ✅ | ✅ | ✅ Claude, Codex |
| Windows  | ✅ | ⚠️ Git Bash/WSL | ✅ Claude, Codex |

> **Note**: Windows users should use Git Bash or WSL for best hook compatibility.

## Contributing

Contributions welcome!

### For Contributors

**Requirements:**
- Bun 1.1.0+ (development, bundling, testing)

**Development:**
```bash
# Install dependencies
bun install

# Run tests
bun test

# Run linting
bun run lint

# Build
bun run build

# Run evaluation system
bun run eval
```

**Adding a New AI Agent:**

See [CLAUDE.md](./CLAUDE.md) for detailed instructions.

**Architecture:**

This project follows a strict layered architecture with schema-first type safety. See [docs/constitutions/current/](./docs/constitutions/current/) for:
- Architecture guidelines
- Testing patterns
- Type safety rules
- Code style requirements

## Evaluation System

commitment includes a comprehensive evaluation framework that compares AI agents using multi-attempt testing:

```bash
# Run full evaluation
bun run eval

# Test specific fixture
bun run eval:fixture simple

# Test with live git changes
bun run eval:live
```

Results are saved to `.eval-results/` with:
- Per-attempt scores and metrics
- Meta-evaluation across attempts
- Success rates and consistency analysis
- Response time measurements

This is **not** part of the test suite - it's a standalone tool for evaluating agent quality.

## License

ISC

## Acknowledgments

- Follows [Conventional Commits](https://www.conventionalcommits.org/) specification
- Built with [Claude CLI](https://docs.claude.com/docs/claude-code), [Zod](https://zod.dev), and [Bun](https://bun.sh)
- Developed using [Spectacular](https://github.com/superpowers-dev/spectacular) and [Superpowers](https://github.com/superpowers-dev/superpowers) for Claude Code
- Inspired by the need for better commit messages in modern development workflows
