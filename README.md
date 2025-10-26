# commitment

> AI coding assistant-powered commit message generator

<img width="500" height="304" alt="commitment - AI-powered commit messages" src="https://github.com/user-attachments/assets/827862c0-8f1d-4eb0-a989-4ed7f37ea721" />

[![npm version](https://img.shields.io/npm/v/@arittr/commitment)](https://www.npmjs.com/package/@arittr/commitment)
[![license: ISC](https://img.shields.io/badge/license-ISC-blue.svg)](./LICENSE)
[![build](https://img.shields.io/github/actions/workflow/status/arittr/commitment/ci.yml?branch=main)](https://github.com/arittr/commitment/actions)

We all know we should write better commit messages. But we don't.

**commitment** analyzes your git diffs using your favorite AI coding assistant and generates professional, conventional commit messages automatically.

## Why commitment?

- **No API Keys**: Uses your local AI CLI (Claude, Codex, or Gemini) to generate commit messages
- **Consistency**: Every commit follows [Conventional Commits](https://www.conventionalcommits.org/) format
- **Context-aware**: AI understands your changes and adds helpful context
- **Frictionless**: Just add the hook and stop committing `wip2` and `formatting`

## Features

- 🤖 **AI-powered generation** using your local AI CLI (Claude, Codex, or Gemini) for accurate, context-aware messages - no extra API keys required!
- 📊 **Code analysis** detects functions, tests, types, and patterns in your changes
- ✨ **Conventional Commits** for a standard format (feat:, fix:, docs:, etc.)
- 🚀 **One-command setup** with `commitment init` for automatic hook installation
- 🪝 **Hook integration** with husky, simple-git-hooks, or plain git hooks
- 🌍 **Cross-platform** support for macOS, Linux, and Windows
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

That's it! Every commit now gets an AI-generated, pretty good commit message.

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
  - [Claude CLI](https://docs.claude.com/en/docs/claude-code/overview) (recommended) - Install with `npm install -g @anthropic-ai/claude-code`
  - [Codex CLI](https://developers.openai.com/codex/cli) - Install with `npm install -g @openai/codex`
  - [Gemini CLI](https://geminicli.com/docs/) - Install with `npm install -g @google/gemini-cli`

>[!IMPORTANT]
>commitment requires an AI CLI to function.

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
# or
npx commitment --agent gemini
```

## How It Works

1. **Analyze**: Reads your staged changes with `git diff --cached`
2. **Generate**: Sends diff to AI CLI with a detailed prompt
3. **Validate**: Ensures response follows Conventional Commits format
4. **Commit**: Creates commit with generated message

## Example

```bash
$ git add src/api/ src/types/
$ npx commitment
```

**Generated:**
```
test: update test naming conventions and mock patterns

- Rename runner tests to reflect unit vs integration scope
- Update base-agent tests to use `command -v` instead of `which`
- Fix mock expectations to require non-empty stdout for availability checks
- Reorganize markdown reporter tests to use timestamped directories
- Add responseTimeMs validation to eval runner tests
- Update CLI invocation mocks to use shell wrapper pattern

🤖 Generated with Claude via commitment
```

## Configuration

### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--agent <name>` | AI agent to use (`claude`, `codex`, or `gemini`) | `claude` |
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
| macOS    | ✅ | ✅ | ✅ Claude, Codex, Gemini |
| Linux    | ✅ | ✅ | ✅ Claude, Codex, Gemini |
| Windows  | ✅ | ⚠️ Git Bash/WSL | ✅ Claude, Codex, Gemini |

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
- Built with [Claude CLI](https://docs.claude.com/en/docs/claude-code/overview), [Zod](https://zod.dev), and [Bun](https://bun.sh)
- Developed using [Spectacular](https://github.com/arittr/spectacular) and [Superpowers](https://github.com/obra/superpowers) for Claude Code
- Inspired by years of bad commit messages
