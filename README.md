# commitment

> AI-powered commit message generator

<img width="500" height="304" alt="Untitled" src="https://github.com/user-attachments/assets/827862c0-8f1d-4eb0-a989-4ed7f37ea721" />

We all know we should write better commit messages. But we don't.

`commitment` analyzes your git diffs using AI (Claude CLI or Codex CLI) and generates professional, conventional commit messages.

## Features

- 🤖 **AI-powered generation** using Claude CLI or Codex CLI for accurate, context-aware messages
- 🎯 **Intelligent fallback** to rule-based generation when AI fails or is disabled
- 📊 **Code analysis** detects functions, tests, types, and patterns in your changes
- ✨ **Conventional commits** follows standard format (feat:, fix:, etc.)
- 🚀 **One-command setup** with `commitment init` for automatic hook installation
- 🪝 **Hook integration** works with husky, simple-git-hooks, or plain git hooks
- 🌍 **Cross-platform** supports macOS, Linux, and Windows
- 📦 **Zero config** works out of the box with sensible defaults

## Installation

```bash
# Using npm
npm install -D commitment

# Using pnpm
pnpm add -D commitment

# Using yarn
yarn add -D commitment
```

## Requirements

- Node.js >= 18
- Git repository
- Optional: [Claude CLI](https://claude.ai/code) or [Codex CLI](https://developers.openai.com/codex) for AI generation

## Quick Start

### Option 1: Automatic Setup (Recommended)

The fastest way to get started - automatic hook installation:

```bash
# 1. Install commitment
npm install -D commitment

# 2. Set up git hooks automatically
npx commitment init

# 3. Make changes and commit
git add .
git commit  # Commit message generated automatically!
```

### Option 2: Manual Usage

Use commitment directly without hooks:

```bash
# Stage your changes
git add .

# Generate and commit
npx commitment
```

## CLI Reference

### Main Command

Generate a commit message and create a commit:

```bash
npx commitment [options]
```

**Options:**
- `--agent <name>` - AI agent to use: `claude`, `codex` (default: `claude`)
- `--dry-run` - Generate message without creating commit
- `--message-only` - Output only the commit message (no commit)
- `--no-ai` - Disable AI generation, use rule-based only
- `--cwd <path>` - Working directory (default: current directory)
- `-V, --version` - Output version number
- `-h, --help` - Display help

**Examples:**

```bash
# Generate commit with Claude (default)
npx commitment

# Use Codex instead
npx commitment --agent codex

# Preview message without committing
npx commitment --dry-run

# Use rule-based generation only (no AI)
npx commitment --no-ai
```

### Init Command

Set up git hooks automatically:

```bash
npx commitment init [options]
```

**Options:**
- `--hook-manager <type>` - Hook manager to use: `husky`, `simple-git-hooks`, `plain`
- `--cwd <path>` - Working directory (default: current directory)
- `-h, --help` - Display help

**Examples:**

```bash
# Auto-detect and install (recommended)
npx commitment init

# Explicitly use husky
npx commitment init --hook-manager husky

# Use simple-git-hooks (lightweight alternative)
npx commitment init --hook-manager simple-git-hooks

# Use plain git hooks (no dependencies)
npx commitment init --hook-manager plain
```

**What it does:**
- Detects existing hook managers (husky, simple-git-hooks)
- Installs appropriate git hooks for your project
- Configures hooks to generate messages automatically on `git commit`
- Preserves your custom messages when you use `git commit -m "..."`

## Hook Integration

The `commitment init` command handles hook setup automatically, but you can also configure manually:

### Husky

**Automatic (recommended):**
```bash
npx commitment init --hook-manager husky
```

**Manual setup:**

Create `.husky/prepare-commit-msg`:

```bash
#!/bin/sh
# Generate commit message with AI
# Only run for regular commits (not merge, squash, or when message specified)
if [ -z "$2" ]; then
  exec < /dev/tty && npx commitment --message-only > "$1"
fi
```

Make it executable:

```bash
chmod +x .husky/prepare-commit-msg
```

### simple-git-hooks

**Automatic (recommended):**
```bash
npx commitment init --hook-manager simple-git-hooks
```

**Manual setup:**

Add to your `package.json`:

```json
{
  "scripts": {
    "prepare": "simple-git-hooks"
  },
  "simple-git-hooks": {
    "prepare-commit-msg": "[ -z \"$2\" ] && npx commitment --message-only > $1 || exit 0"
  }
}
```

Then run:

```bash
npm install
npm run prepare
```

### Plain Git Hooks

**Automatic (recommended):**
```bash
npx commitment init --hook-manager plain
```

**Manual setup:**

Create `.git/hooks/prepare-commit-msg`:

```bash
#!/bin/sh
# Only run for regular commits (not merge, squash, or when message specified)
if [ -z "$2" ]; then
  npx commitment --message-only > "$1"
fi
```

Make it executable:

```bash
chmod +x .git/hooks/prepare-commit-msg
```

## Programmatic API

Use `commitment` in your Node.js scripts:

```typescript
import { CommitMessageGenerator } from 'commitment';

const generator = new CommitMessageGenerator({
  agent: 'claude',
  enableAI: true,
});

const task = {
  title: 'Add user authentication',
  description: 'Implement JWT-based authentication',
  produces: ['src/auth.ts', 'src/middleware/auth.ts'],
};

const message = await generator.generateCommitMessage(task, {
  workdir: process.cwd(),
  files: ['src/auth.ts', 'src/middleware/auth.ts'],
});

console.log(message);
```

### Configuration Options

```typescript
type CommitMessageGeneratorConfig = {
  /** AI agent to use: 'claude' or 'codex' (default: 'claude') */
  agent?: string;

  /** Enable/disable AI generation (default: true) */
  enableAI?: boolean;
};
```

## How It Works

### AI Generation

1. Analyzes staged changes using `git diff --cached`
2. Sends diff to Claude CLI or Codex CLI with detailed prompt
3. Parses and validates AI response
4. Returns conventional commit message

### Fallback Generation

When AI fails or is disabled (`--no-ai`):

1. Categorizes files (components, APIs, tests, configs, docs)
2. Analyzes change patterns (additions, modifications, deletions)
3. Generates title based on file types
4. Creates bullet points describing changes
5. Follows conventional commits format

### Code Analysis

Detects patterns in your changes:

- Function/method additions and removals
- Test cases (test, it, describe)
- Type definitions and interfaces
- Mocking patterns
- Change magnitude (lines added/removed)

## Examples

### Simple Feature Addition

```bash
$ git add src/components/Button.tsx
$ npx commitment
```

Output:
```
feat: add button component

- Create reusable Button component with TypeScript
- Add props interface for size and variant
- Include hover and focus states
```

### Bug Fix

```bash
$ git add src/utils/validation.ts
$ npx commitment
```

Output:
```
fix: correct email validation regex

- Fix regex pattern to handle plus signs in email addresses
- Update test cases for edge cases
```

### Multiple Files

```bash
$ git add src/api/ src/types/
$ npx commitment
```

Output:
```
feat: implement user authentication API

- Add login and logout endpoints
- Create JWT token generation and validation
- Update user type definitions
- Add authentication middleware
```

## Cross-Platform Support

`commitment` works on all platforms:

| Platform | CLI Usage | Hooks | AI Agents |
|----------|-----------|-------|-----------|
| macOS    | ✅         | ✅     | ✅ Claude, Codex |
| Linux    | ✅         | ✅     | ✅ Claude, Codex |
| Windows  | ✅         | ⚠️ Git Bash/WSL | ✅ Claude, Codex |

⚠️ **Windows users:** For best hook compatibility, use Git Bash or WSL instead of CMD/PowerShell.

### Line Ending Handling

`commitment` includes a `.gitattributes` file to ensure hook scripts use LF line endings on all platforms, preventing Windows CRLF issues.

## Troubleshooting

### "No staged changes to commit"

Make sure you've staged your changes with `git add` first:

```bash
git add .
npx commitment
```

### AI Generation Fails

If Claude CLI fails, `commitment` automatically falls back to rule-based generation.

**Common causes:**
- **Claude CLI not installed:** Install with `npm install -g @anthropic-ai/claude-code`
- **Not authenticated:** Run `claude --help` to authenticate
- **Network issues:** Check your internet connection

**Solutions:**

```bash
# Disable AI and use rule-based only
npx commitment --no-ai

# Try a different agent
npx commitment --agent codex
```

### Hooks Not Running

**Verify hooks are installed:**

```bash
# For husky
ls -la .husky/prepare-commit-msg

# For plain git hooks
ls -la .git/hooks/prepare-commit-msg

# For simple-git-hooks
cat package.json | grep simple-git-hooks
```

**Reinstall hooks:**

```bash
npx commitment init
```

**Check hook permissions (Unix-like systems):**

```bash
chmod +x .husky/prepare-commit-msg
# or
chmod +x .git/hooks/prepare-commit-msg
```

### Hooks Override My Custom Messages

This should not happen! Hooks check if you've specified a message and skip generation if you have:

```bash
git commit -m "my message"  # Uses your message ✅
git commit                  # Generates message ✅
```

If hooks are overriding your messages, please file an issue.

### Windows Hook Issues

**Symptoms:**
- Hooks don't run
- Permission errors
- Line ending errors (`\r` in scripts)

**Solutions:**

1. **Use Git Bash or WSL** instead of CMD/PowerShell
2. **Ensure LF line endings** - `commitment init` handles this automatically
3. **Check git config:**
   ```bash
   git config core.autocrlf false
   ```

## Agent Availability

| Agent  | Installation | Notes |
|--------|--------------|-------|
| Claude | `npm install -g @anthropic-ai/claude-code` | Default, recommended |
| Codex  | Included with [Cursor](https://cursor.sh) | Requires Cursor installation |

**No AI CLI?** Use `--no-ai` flag for intelligent rule-based generation.

## Contributing

Contributions welcome! Please open an issue or PR on [GitHub](https://github.com/yourusername/commitment).

### Adding a New Agent

See [CLAUDE.md](./CLAUDE.md) for detailed instructions on adding new AI agents.

## License

ISC

## Built With

- [Claude CLI](https://claude.ai/code) - AI-powered commit generation
- [execa](https://github.com/sindresorhus/execa) - Subprocess execution
- [commander](https://github.com/tj/commander.js) - CLI parsing
- [chalk](https://github.com/chalk/chalk) - Terminal colors
- [zod](https://github.com/colinhacks/zod) - Runtime validation

## Acknowledgments

- Follows [Conventional Commits](https://www.conventionalcommits.org/) specification
- Inspired by the need for better commit messages in modern development workflows
