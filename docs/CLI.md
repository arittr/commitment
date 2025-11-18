# CLI Reference

Complete command-line interface documentation for commitment.

## Table of Contents

- [Main Command](#main-command)
- [Init Command](#init-command)
- [Global Options](#global-options)
- [Environment Variables](#environment-variables)
- [Exit Codes](#exit-codes)
- [Examples](#examples)

## Main Command

Generate a commit message and create a commit.

### Synopsis

```bash
npx commitment [options]
```

### Description

Analyzes staged git changes, generates a conventional commit message using AI, and creates a git commit.

**Workflow:**
1. Validates there are staged changes
2. Reads git diff and status
3. Sends to AI agent (Claude or Codex)
4. Validates response format
5. Creates commit with generated message

### Options

#### `--agent <name>`

AI agent to use for generation.

- **Type**: `string`
- **Choices**: `claude`, `codex`
- **Default**: `claude`
- **Example**:
  ```bash
  npx commitment --agent codex
  ```

**Agent Details:**

| Agent | CLI Required | Installation |
|-------|-------------|--------------|
| `claude` | Claude CLI | `npm install -g @anthropic-ai/claude-code` |
| `codex` | Codex CLI | `npm install -g @openai/codex` |

#### `--dry-run`

Generate message without creating a commit.

- **Type**: `boolean`
- **Default**: `false`
- **Example**:
  ```bash
  npx commitment --dry-run
  ```

**Use Cases:**
- Preview what message would be generated
- Test AI agent setup
- Debugging commit message quality

**Output:**
```bash
$ npx commitment --dry-run

Generated commit message:
────────────────────────────────────
feat: add user authentication

- Implement JWT token generation
- Add login and logout endpoints
- Create authentication middleware
────────────────────────────────────

Commit NOT created (--dry-run mode)
```

#### `--message-only`

Output only the commit message to stdout (no decorations, no commit).

- **Type**: `boolean`
- **Default**: `false`
- **Example**:
  ```bash
  npx @arittr/commitment --message-only
  ```

**Use Cases:**
- Git hooks integration
- Piping to other tools
- Custom commit workflows

**Output:**
```bash
$ npx @arittr/commitment --message-only
feat: add user authentication

- Implement JWT token generation
- Add login and logout endpoints
- Create authentication middleware
```

**Difference from `--dry-run`:**
- `--dry-run`: Shows formatted output with decorations, says "commit not created"
- `--message-only`: Pure message only, suitable for piping

#### `--cwd <path>`

Working directory for git operations.

- **Type**: `string`
- **Default**: `process.cwd()`
- **Example**:
  ```bash
  npx commitment --cwd /path/to/repo
  ```

**Use Cases:**
- Running from outside repository
- CI/CD pipelines
- Monorepo workflows

### Examples

**Basic usage:**
```bash
git add .
npx commitment
```

**Preview message:**
```bash
npx commitment --dry-run
```

**Use Codex:**
```bash
npx commitment --agent codex
```

**Combine options:**
```bash
npx commitment --agent codex --dry-run
```

**Different directory:**
```bash
npx commitment --cwd ~/projects/my-app
```

## Init Command

Set up git hooks automatically.

### Synopsis

```bash
npx commitment init [options]
```

### Description

Detects or installs git hooks for automatic commit message generation.

**Workflow:**
1. Validates git repository
2. Auto-detects existing hook manager (husky, simple-git-hooks)
3. Installs/updates prepare-commit-msg hook
4. Configures hook to preserve user messages

### Options

#### `--hook-manager <type>`

Explicitly specify which hook manager to use.

- **Type**: `string`
- **Choices**: `husky`, `simple-git-hooks`, `plain`
- **Default**: Auto-detect
- **Example**:
  ```bash
  npx commitment init --hook-manager husky
  ```

**Hook Manager Comparison:**

| Manager | Setup | Dependencies | Best For |
|---------|-------|--------------|----------|
| **Auto-detect** | Automatic | Varies | Most projects (recommended) |
| **husky** | Installs husky if needed | `husky` | Teams, established projects |
| **simple-git-hooks** | Lightweight | `simple-git-hooks` | Minimal dependencies |
| **plain** | No dependencies | None | Simple projects, no npm hooks |

#### `--cwd <path>`

Working directory for git repository.

- **Type**: `string`
- **Default**: `process.cwd()`
- **Example**:
  ```bash
  npx commitment init --cwd /path/to/repo
  ```

### What Gets Installed

#### Husky

Creates `.husky/prepare-commit-msg`:

```bash
#!/bin/sh
# commitment: AI-powered commit messages
if [ -z "$2" ]; then
  echo "🤖 Generating commit message..." > /dev/tty 2>/dev/null || true
  exec < /dev/tty && npx @arittr/commitment --message-only > "$1" || exit 1
fi
```

#### simple-git-hooks

Updates `package.json`:

```json
{
  "simple-git-hooks": {
    "prepare-commit-msg": "[ -z \"$2\" ] && npx @arittr/commitment --message-only > $1"
  }
}
```

#### Plain Git Hooks

Creates `.git/hooks/prepare-commit-msg`:

```bash
#!/bin/sh
# commitment: AI-powered commit messages
if [ -z "$2" ]; then
  echo "🤖 Generating commit message..." > /dev/tty 2>/dev/null || true
  npx @arittr/commitment --message-only > "$1" || exit 1
fi
```

### Hook Behavior

The installed hooks preserve your custom messages:

| Command | Hook Runs? | Result |
|---------|-----------|--------|
| `git commit` | ✅ Yes | Generates AI message |
| `git commit -m "msg"` | ⏭️ Skips | Uses your message |
| `git commit --amend` | ⏭️ Skips | Keeps existing message |
| `git merge` | ⏭️ Skips | Uses merge message |

**Why?** The hook checks the `$2` parameter (commit source):
- Empty → regular commit → generate message
- `"message"` → `-m` flag used → skip
- `"merge"` → merge commit → skip
- `"commit"` → `--amend` → skip

### Examples

**Auto-detect and install:**
```bash
npx commitment init
```

**Force husky:**
```bash
npx commitment init --hook-manager husky
```

**Use simple-git-hooks:**
```bash
npx commitment init --hook-manager simple-git-hooks
```

**Plain git hooks (no npm dependencies):**
```bash
npx commitment init --hook-manager plain
```

**Different directory:**
```bash
npx commitment init --cwd ~/projects/my-app
```

## Global Options

These options work with all commands:

#### `-V, --version`

Output the version number.

```bash
npx commitment --version
# 1.0.0
```

#### `-h, --help`

Display help information.

```bash
npx commitment --help
npx commitment init --help
```

## Environment Variables

commitment respects the following environment variables:

### `COMMITMENT_AGENT`

Default AI agent to use.

```bash
export COMMITMENT_AGENT=codex
npx commitment  # Uses Codex
```

Overridden by `--agent` flag.

### `NODE_ENV`

Affects logging verbosity:

- `production`: Minimal logging
- `development`: Verbose logging
- Other: Normal logging

### `DEBUG`

Enable debug output:

```bash
DEBUG=commitment npx commitment
```

Shows:
- Git command execution
- AI agent requests/responses
- Validation steps
- Timing information

## Exit Codes

commitment uses standard exit codes:

| Code | Meaning | Example |
|------|---------|---------|
| `0` | Success | Commit created successfully |
| `1` | General error | Git command failed |
| `2` | Validation error | No staged changes |
| `3` | AI error | Claude CLI not found |
| `4` | User cancellation | User aborted in interactive mode |

**Usage in scripts:**

```bash
#!/bin/bash
npx commitment
if [ $? -eq 0 ]; then
  echo "Commit created!"
else
  echo "Commit failed!"
  exit 1
fi
```

## Examples

### Basic Workflow

```bash
# 1. Make changes
vim src/components/Button.tsx

# 2. Stage changes
git add src/components/Button.tsx

# 3. Generate commit
npx commitment

# Output:
# ✨ Generated commit message:
# feat: add button component with variant support
#
# - Create reusable Button component
# - Add TypeScript props interface
# - Include hover states
#
# ✅ Commit created successfully!
```

### Preview Before Committing

```bash
git add .

# Preview what would be generated
npx commitment --dry-run

# If satisfied, commit
npx commitment
```

### Use Different Agent

```bash
# Try Claude
npx commitment --agent claude

# Or try Codex
npx commitment --agent codex
```

### Hook Setup

```bash
# One-time setup
npx commitment init

# Now every commit uses AI
git add .
git commit  # Opens editor with generated message
```

### Manual Message Override

```bash
# Hook skips generation when you provide message
git commit -m "docs: update README"
```

### CI/CD Integration

```bash
#!/bin/bash
# .github/workflows/auto-commit.yml

cd /path/to/repo
git add .

# Generate and commit
npx commitment --cwd /path/to/repo

if [ $? -eq 0 ]; then
  git push
fi
```

### Monorepo Workflow

```bash
# Commit changes in workspace
npx commitment --cwd packages/web

# Commit changes in another workspace
npx commitment --cwd packages/api
```

### Debugging

```bash
# See what's happening
DEBUG=commitment npx commitment --dry-run

# Check git status
git status

# Check staged changes
git diff --cached
```

## Tips and Tricks

### Alias for Quick Access

Add to your shell profile (`.bashrc`, `.zshrc`, etc.):

```bash
alias c='npx commitment'
```

Usage:
```bash
git add .
c  # Instead of `npx commitment`
```

### Git Alias

Add to `.gitconfig`:

```ini
[alias]
  ca = !git add . && npx commitment
```

Usage:
```bash
# Stage and commit in one command
git ca
```

### Pre-commit Checks

Combine with linting:

```bash
#!/bin/bash
# pre-commit-check.sh

# Run linter
npm run lint || exit 1

# Run tests
npm test || exit 1

# Generate commit
npx commitment
```

### Custom Workflow

```bash
#!/bin/bash
# smart-commit.sh

# Interactive staging
git add -p

# Preview message
echo "Preview:"
npx commitment --dry-run

# Confirm
read -p "Create commit? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  npx commitment
fi
```

## See Also

- [Hooks Documentation](./HOOKS.md) - Detailed hook setup guide
- [CLAUDE.md](../CLAUDE.md) - Development documentation
- [Troubleshooting](../README.md#troubleshooting) - Common issues
