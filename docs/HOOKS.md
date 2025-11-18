# Git Hooks Integration Guide

Complete guide for integrating commitment with git hooks.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Hook Managers](#hook-managers)
  - [Auto-Detection](#auto-detection)
  - [Husky](#husky)
  - [simple-git-hooks](#simple-git-hooks)
  - [Plain Git Hooks](#plain-git-hooks)
- [Hook Behavior](#hook-behavior)
- [Advanced Configuration](#advanced-configuration)
- [Troubleshooting](#troubleshooting)
- [Migration](#migration)

## Overview

Git hooks allow commitment to generate commit messages automatically when you run `git commit`. The `prepare-commit-msg` hook is called before the commit message editor opens, making it perfect for AI-generated messages.

**Benefits:**
- ✅ Automatic message generation on every commit
- ✅ Preserves your custom messages when using `-m`
- ✅ No workflow changes - just `git commit`
- ✅ Works with all git commands (commit, merge, etc.)

**The Hook Lifecycle:**

```
git commit
    ↓
prepare-commit-msg hook runs
    ↓
commitment generates message
    ↓
Message written to .git/COMMIT_EDITMSG
    ↓
Editor opens with generated message
    ↓
You can edit/accept
    ↓
Commit created
```

## Quick Start

**Automatic setup (recommended):**

```bash
npx commitment init
```

This detects your existing hook setup and configures everything automatically.

**That's it!** Now every `git commit` will generate an AI message.

## Hook Managers

### Auto-Detection

The init command automatically detects your hook manager:

```bash
npx commitment init
```

**Detection Order:**
1. Checks for `.husky/` directory → Uses husky
2. Checks for `simple-git-hooks` in package.json → Uses simple-git-hooks
3. Falls back to plain git hooks

**Output:**
```bash
$ npx commitment init

🔍 Detecting hook manager...
✅ Found husky installation
📝 Updating .husky/prepare-commit-msg
✅ Hooks installed successfully!

Test with: git commit
```

### Husky

[Husky](https://typicode.github.io/husky/) is the most popular git hook manager for Node.js projects.

#### Automatic Setup

```bash
npx commitment init --hook-manager husky
```

**What this does:**
1. Installs husky if not present (`npm install -D husky`)
2. Runs `husky install`
3. Creates `.husky/prepare-commit-msg`
4. Makes it executable

#### Manual Setup

**1. Install husky:**

```bash
npm install -D husky
npx husky install
```

**2. Add prepare script to package.json:**

```json
{
  "scripts": {
    "prepare": "husky install"
  }
}
```

**3. Create hook file:**

```bash
npx husky add .husky/prepare-commit-msg
```

**4. Edit `.husky/prepare-commit-msg`:**

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# commitment: AI-powered commit messages
# Only run for regular commits (not merge, squash, or when message specified)
if [ -z "$2" ]; then
  echo "🤖 Generating commit message..." > /dev/tty 2>/dev/null || true
  exec < /dev/tty && npx @arittr/commitment --message-only > "$1" || exit 1
fi
```

**5. Make executable (Unix-like systems):**

```bash
chmod +x .husky/prepare-commit-msg
```

#### Why `exec < /dev/tty`?

Husky runs hooks without a TTY by default. The `exec < /dev/tty` ensures commitment can:
- Show progress/errors to user
- Handle interactive prompts if needed
- Access terminal for AI agent execution

#### Husky Configuration

**package.json:**
```json
{
  "scripts": {
    "prepare": "husky install"
  },
  "devDependencies": {
    "husky": "^8.0.0",
    "@arittr/commitment": "^1.0.0"
  }
}
```

### simple-git-hooks

[simple-git-hooks](https://github.com/toplenboren/simple-git-hooks) is a lightweight alternative to husky.

#### Automatic Setup

```bash
npx commitment init --hook-manager simple-git-hooks
```

**What this does:**
1. Installs simple-git-hooks if not present
2. Adds hook configuration to package.json
3. Runs `npx simple-git-hooks` to install hooks

#### Manual Setup

**1. Install simple-git-hooks:**

```bash
npm install -D simple-git-hooks
```

**2. Add to package.json:**

```json
{
  "scripts": {
    "prepare": "simple-git-hooks"
  },
  "simple-git-hooks": {
    "prepare-commit-msg": "[ -z \"$2\" ] && npx @arittr/commitment --message-only > $1"
  }
}
```

**3. Install hooks:**

```bash
npm run prepare
# or
npx simple-git-hooks
```

#### Configuration

The hook is a one-liner shell command:
```bash
[ -z "$2" ] && npx @arittr/commitment --message-only > $1
```

**Breakdown:**
- `[ -z "$2" ]` - Check if `$2` (commit source) is empty
- `&&` - If true (regular commit), run commitment
- `npx @arittr/commitment --message-only` - Generate message
- `> $1` - Write to commit message file

**Note:** Simple-git-hooks doesn't show progress indicators to keep the one-liner simple. For progress feedback, use husky or plain hooks.

### Plain Git Hooks

No dependencies - uses git's native hook system.

#### Automatic Setup

```bash
npx commitment init --hook-manager plain
```

**What this does:**
1. Creates `.git/hooks/prepare-commit-msg`
2. Makes it executable
3. Adds commitment command

#### Manual Setup

**1. Create hook file:**

```bash
touch .git/hooks/prepare-commit-msg
chmod +x .git/hooks/prepare-commit-msg
```

**2. Edit `.git/hooks/prepare-commit-msg`:**

```bash
#!/bin/sh
# commitment: AI-powered commit messages
# Only run for regular commits (not merge, squash, or when message specified)
if [ -z "$2" ]; then
  echo "🤖 Generating commit message..." > /dev/tty 2>/dev/null || true
  npx @arittr/commitment --message-only > "$1" || exit 1
fi
```

**3. Make executable:**

```bash
chmod +x .git/hooks/prepare-commit-msg
```

#### Important Notes

⚠️ **Not version controlled:** `.git/hooks/` is not tracked by git. Team members must run `commitment init` individually.

⚠️ **Manual updates:** When you pull changes, you need to update hooks manually.

✅ **Best for:** Personal projects, quick prototypes, single-developer repos.

#### Team Usage

For teams using plain hooks, add to README:

```markdown
## Setup

1. Clone repository
2. Install dependencies: `npm install`
3. Install hooks: `npx commitment init`
```

Or create a setup script:

```bash
#!/bin/bash
# setup.sh

npm install
npx commitment init --hook-manager plain
echo "✅ Setup complete!"
```

## Hook Behavior

### When Hooks Run

| Git Command | Hook Runs? | commitment Runs? | Why |
|------------|-----------|-----------------|-----|
| `git commit` | ✅ Yes | ✅ Yes | Regular commit - generate message |
| `git commit -m "msg"` | ✅ Yes | ⏭️ No | Message specified - use user's message |
| `git commit -F file` | ✅ Yes | ⏭️ No | Message from file - use file content |
| `git commit --amend` | ✅ Yes | ⏭️ No | Amending - keep existing message |
| `git merge` | ✅ Yes | ⏭️ No | Merge commit - use merge message |
| `git revert` | ✅ Yes | ⏭️ No | Revert commit - use revert message |
| `git cherry-pick` | ✅ Yes | ⏭️ No | Cherry-pick - use original message |

### The `$2` Parameter

The hook uses git's `$2` parameter (commit source) to decide whether to generate:

```bash
if [ -z "$2" ]; then
  # $2 is empty → regular commit → generate
  echo "🤖 Generating commit message..." > /dev/tty 2>/dev/null || true
  npx @arittr/commitment --message-only > "$1"
fi
```

**Possible `$2` values:**

| Value | Meaning | Hook Action |
|-------|---------|-------------|
| (empty) | Regular `git commit` | Generate message ✅ |
| `message` | `git commit -m "..."` | Skip (use user message) |
| `template` | `git commit -t file` | Skip (use template) |
| `merge` | Merge commit | Skip (use merge message) |
| `squash` | Squash commit | Skip (use squash message) |
| `commit` | `git commit --amend` | Skip (keep existing) |

### Message Editing

After the hook runs, git opens your editor:

```bash
git commit

# Hook generates:
# feat: add user authentication
#
# - Implement JWT token generation
# - Add login endpoint
# - Create middleware

# Editor opens - you can:
# 1. Accept as-is (save and close)
# 2. Edit the message
# 3. Abort (close without saving)
```

**Editor Behavior:**

- **Accept:** Save and close → commit created with AI message
- **Edit:** Modify message, save → commit created with your edits
- **Abort:** Close without saving → commit cancelled

## Advanced Configuration

### Custom Hook Logic

You can extend the hook with custom logic:

**Example: Skip for WIP commits:**

```bash
#!/bin/sh
# .husky/prepare-commit-msg

# Check if staged changes include WIP
if git diff --cached | grep -q "WIP"; then
  # Skip AI generation for work-in-progress
  echo "WIP: work in progress" > "$1"
  exit 0
fi

# Otherwise generate AI message
if [ -z "$2" ]; then
  exec < /dev/tty && npx @arittr/commitment --message-only > "$1" || exit 1
fi
```

**Example: Require AI success:**

```bash
#!/bin/sh
# .husky/prepare-commit-msg

if [ -z "$2" ]; then
  # Generate message, fail commit if AI fails
  npx @arittr/commitment --message-only > "$1"

  if [ $? -ne 0 ]; then
    echo "❌ Failed to generate commit message"
    exit 1  # Abort commit
  fi
fi
```

**Example: Fallback to template:**

```bash
#!/bin/sh
# .husky/prepare-commit-msg

if [ -z "$2" ]; then
  # Try AI generation
  if ! npx @arittr/commitment --message-only > "$1" 2>/dev/null; then
    # If AI fails, use template
    cat > "$1" << EOF
feat:

-
EOF
  fi
fi
```

### Use Specific Agent

Force a specific agent in hooks:

```bash
#!/bin/sh
# .husky/prepare-commit-msg

if [ -z "$2" ]; then
  exec < /dev/tty && npx @arittr/commitment --agent codex --message-only > "$1" || exit 1
fi
```

### Timeout Configuration

Add timeout to prevent hanging:

```bash
#!/bin/sh
# .husky/prepare-commit-msg

if [ -z "$2" ]; then
  # 30 second timeout
  timeout 30 npx @arittr/commitment --message-only > "$1" || exit 1
fi
```

### Conditional Hook Execution

**Skip for certain branches:**

```bash
#!/bin/sh
# .husky/prepare-commit-msg

BRANCH=$(git symbolic-ref --short HEAD)

# Skip AI for main/master
if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
  exit 0
fi

if [ -z "$2" ]; then
  exec < /dev/tty && npx @arittr/commitment --message-only > "$1" || exit 1
fi
```

**Skip for certain file patterns:**

```bash
#!/bin/sh
# .husky/prepare-commit-msg

# Skip for docs-only changes
if git diff --cached --name-only | grep -v "\.md$" > /dev/null; then
  # Has non-markdown changes, use AI
  if [ -z "$2" ]; then
    exec < /dev/tty && npx @arittr/commitment --message-only > "$1" || exit 1
  fi
else
  # Only markdown changes, use simple message
  echo "docs: update documentation" > "$1"
fi
```

## Troubleshooting

### Hooks Not Running

**1. Check hook exists:**

```bash
# For husky
ls -la .husky/prepare-commit-msg

# For plain hooks
ls -la .git/hooks/prepare-commit-msg

# For simple-git-hooks
cat package.json | grep -A 3 "simple-git-hooks"
```

**2. Check permissions (Unix-like):**

```bash
# Should show: -rwxr-xr-x
ls -l .husky/prepare-commit-msg

# Fix permissions
chmod +x .husky/prepare-commit-msg
```

**3. Reinstall:**

```bash
npx commitment init
```

### Hook Runs But No Message Generated

**1. Check for errors:**

```bash
# Run hook manually
.husky/prepare-commit-msg .git/COMMIT_EDITMSG
# or
.git/hooks/prepare-commit-msg .git/COMMIT_EDITMSG

# Check output for errors
```

**2. Test commitment directly:**

```bash
git add .
npx commitment --dry-run
```

**3. Check git commit source:**

```bash
# If using -m, hook skips generation
git commit -m "test"  # Hook won't run commitment

# Use without -m
git commit  # Hook will run commitment
```

### Permission Denied (Windows)

**Issue:** Hook script not executable on Windows.

**Solution:**

Use Git Bash or WSL:
```bash
# In Git Bash
chmod +x .husky/prepare-commit-msg
git commit
```

Or ensure git config allows hooks:
```bash
git config core.hooksPath .husky
```

### Hooks Override My Messages

This should **not** happen if hooks are configured correctly.

**Check hook code:**

```bash
cat .husky/prepare-commit-msg
```

Should have `if [ -z "$2" ]` check:
```bash
if [ -z "$2" ]; then
  npx @arittr/commitment --message-only > "$1"
fi
```

**Test:**
```bash
# Should use your message
git commit -m "my message"

# Should generate AI message
git commit
```

### CI/CD Failures

**Issue:** Hooks run in CI but fail (no TTY, no AI CLI).

**Solution 1 - Skip hooks in CI:**

```bash
# In CI pipeline
git commit --no-verify -m "ci: automated commit"
```

**Solution 2 - Detect CI environment:**

```bash
#!/bin/sh
# .husky/prepare-commit-msg

# Skip in CI
if [ -n "$CI" ]; then
  exit 0
fi

if [ -z "$2" ]; then
  exec < /dev/tty && npx @arittr/commitment --message-only > "$1" || exit 1
fi
```

**Solution 3 - Disable hooks in CI:**

```bash
# In CI config
git config core.hooksPath /dev/null
```

## Migration

### From Manual Commits

Already using commitment manually? Add hooks:

```bash
# Before: Manual every time
git add .
npx commitment

# After: Automatic with hooks
npx commitment init
git add .
git commit  # Auto-generated!
```

### From Other Hook Managers

#### From Husky 4 to Husky 8

```bash
# Remove old husky
npm uninstall husky@4

# Install new husky
npm install -D husky@8
npx husky install

# Install commitment hooks
npx commitment init --hook-manager husky
```

#### From pre-commit to Husky

```bash
# Remove pre-commit
pip uninstall pre-commit
rm .pre-commit-config.yaml

# Install husky and commitment
npm install -D husky
npx commitment init --hook-manager husky
```

#### From Custom Hooks to simple-git-hooks

```bash
# Backup existing hooks
cp .git/hooks/prepare-commit-msg .git/hooks/prepare-commit-msg.bak

# Install simple-git-hooks
npm install -D simple-git-hooks

# Setup commitment
npx commitment init --hook-manager simple-git-hooks
```

### Preserving Custom Hook Logic

If you have custom logic in `prepare-commit-msg`:

**1. Backup existing hook:**
```bash
cp .husky/prepare-commit-msg .husky/prepare-commit-msg.bak
```

**2. Run commitment init:**
```bash
npx commitment init
```

**3. Merge custom logic:**
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Your custom logic here
npm run lint-staged

# commitment integration
if [ -z "$2" ]; then
  exec < /dev/tty && npx @arittr/commitment --message-only > "$1" || exit 1
fi
```

## Best Practices

### 1. Team Consistency

**Add to README:**
```markdown
## Git Hooks

This project uses commitment for automatic commit messages.

Setup: `npx commitment init`
```

**Add to onboarding:**
```bash
#!/bin/bash
# scripts/setup-dev.sh

npm install
npx commitment init
git config commit.template .gitmessage  # Optional: custom template
```

### 2. Fallback Template

Provide template for when AI fails:

```bash
#!/bin/sh
# .husky/prepare-commit-msg

if [ -z "$2" ]; then
  if ! exec < /dev/tty npx @arittr/commitment --message-only > "$1" 2>/dev/null; then
    # AI failed, use template
    cat > "$1" << 'EOF'
# Enter commit message following Conventional Commits:
# feat: add new feature
# fix: fix bug
# docs: update documentation
# style: format code
# refactor: refactor code
# test: add tests
# chore: update tooling
EOF
  fi
fi
```

### 3. Disable for Specific Cases

```bash
# Skip hook for this commit only
git commit --no-verify

# Or set environment variable
SKIP_COMMITMENT=1 git commit
```

Hook can check for this:
```bash
#!/bin/sh
if [ -n "$SKIP_COMMITMENT" ]; then
  exit 0
fi
```

### 4. Logging for Debugging

```bash
#!/bin/sh
# .husky/prepare-commit-msg

LOG_FILE=".git/hooks.log"

echo "[$(date)] prepare-commit-msg started" >> "$LOG_FILE"
echo "  Args: $*" >> "$LOG_FILE"

if [ -z "$2" ]; then
  if exec < /dev/tty npx @arittr/commitment --message-only > "$1" 2>> "$LOG_FILE"; then
    echo "  Result: Success" >> "$LOG_FILE"
  else
    echo "  Result: Failed ($?)" >> "$LOG_FILE"
    exit 1
  fi
fi
```

View logs:
```bash
cat .git/hooks.log
```

## See Also

- [CLI Reference](./CLI.md) - Detailed CLI documentation
- [README](../README.md) - Main documentation
- [Git Hooks Documentation](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks) - Official git hooks guide
