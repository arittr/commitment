# Git Hooks Integration Example

This example shows how to integrate `commitment` with native Git hooks (without using Husky).

## Quick Setup (Recommended)

Use the `commitment init` command for automatic setup:

```bash
# Install commitment
npm install -D commitment
# or: yarn add -D commitment
# or: bun add -D commitment

# Set up git hooks (uses Claude by default)
npx commitment init --hook-manager plain

# Or specify a different agent
npx commitment init --hook-manager plain --agent codex
```

## Manual Setup

### 1. Install commitment

```bash
# Using npm
npm install -D commitment

# Using yarn
yarn add -D commitment

# Using bun
bun add -D commitment
```

### 2. Create the Hook

**For Claude (default):**

```bash
cat > .git/hooks/prepare-commit-msg << 'EOF'
#!/bin/sh
# Only run for regular commits
if [ -z "$2" ]; then
  npx commitment generate --message-only > "$1" || true
fi
EOF

chmod +x .git/hooks/prepare-commit-msg
```

**For Codex:**

```bash
cat > .git/hooks/prepare-commit-msg << 'EOF'
#!/bin/sh
# Only run for regular commits (using Codex)
if [ -z "$2" ]; then
  npx commitment --agent codex --message-only > "$1" || true
fi
EOF

chmod +x .git/hooks/prepare-commit-msg
```

## How It Works

1. You run `git commit` (without `-m` flag)
2. Git runs the `prepare-commit-msg` hook before opening your editor
3. `commitment` generates a message based on staged changes
4. Your editor opens with the AI-generated message pre-filled
5. You can edit or accept the message

## Usage

```bash
# Stage your changes
git add .

# Commit (editor opens with AI-generated message)
git commit
```

## Limitations

⚠️ **Important**: Git hooks in `.git/hooks/` are **not version controlled** and **not shared** with your team.

Each developer must install the hooks manually. Consider using Husky if you want to version control hooks.

## Advanced Usage

### Multiple Hooks

You can combine multiple prepare-commit-msg behaviors:

```bash
#!/bin/sh

# Only run for regular commits
if [ -z "$2" ]; then
  # Generate AI commit message
  npx commitment generate --message-only > "$1" || true

  # Add issue number from branch name
  BRANCH_NAME=$(git symbolic-ref --short HEAD)
  if [[ $BRANCH_NAME =~ ^[A-Z]+-[0-9]+ ]]; then
    ISSUE_NUMBER="${BRANCH_MATCH[0]}"
    echo "" >> "$1"
    echo "Refs: $ISSUE_NUMBER" >> "$1"
  fi
fi
```

### Conditional Generation

Only generate for certain branches:

```bash
#!/bin/sh

BRANCH_NAME=$(git symbolic-ref --short HEAD)

# Only generate for feature branches
if [[ $BRANCH_NAME == feature/* ]] && [ -z "$2" ]; then
  npx commitment generate --message-only > "$1" || true
fi
```

## Sharing Hooks with Your Team

### Option 1: Use Husky

See the `examples/husky/` directory for Husky integration, which version controls hooks.

### Option 2: Manual Installation Script

Create `scripts/install-hooks.sh`:

```bash
#!/bin/bash
cp hooks/prepare-commit-msg .git/hooks/
chmod +x .git/hooks/prepare-commit-msg
echo "Git hooks installed!"
```

Add to your README:

```markdown
## Setup

After cloning, install git hooks:

\`\`\`bash
./scripts/install-hooks.sh
\`\`\`
```

### Option 3: Git Templates

Use Git's init template directory:

```bash
# Create template directory
mkdir -p ~/.git-templates/hooks
cp examples/git-hooks/prepare-commit-msg ~/.git-templates/hooks/
chmod +x ~/.git-templates/hooks/prepare-commit-msg

# Configure Git to use template
git config --global init.templateDir ~/.git-templates

# For existing repos, reinitialize
git init
```

## Disabling the Hook

Temporarily disable:

```bash
# Skip the hook for one commit
git commit --no-verify

# Or use -m flag to bypass prepare-commit-msg
git commit -m "Manual message"
```

Permanently remove:

```bash
rm .git/hooks/prepare-commit-msg
```
