# Husky Integration Example

This example shows how to integrate `commitment` with Husky for automatic commit message generation.

## Quick Setup (Recommended)

Use the `commitment init` command for automatic setup:

```bash
# Install commitment and husky
npm install -D commitment husky
# or: yarn add -D commitment husky
# or: bun add -D commitment husky

# Initialize husky
npx husky init

# Set up commitment hooks (uses Claude by default)
npx commitment init --hook-manager husky

# Or specify a different agent
npx commitment init --hook-manager husky --agent codex
```

## Manual Setup

### 1. Install Dependencies

```bash
# Using npm
npm install -D commitment husky

# Using yarn
yarn add -D commitment husky

# Using bun
bun add -D commitment husky
```

### 2. Initialize Husky

```bash
npx husky init
```

### 3. Add the prepare-commit-msg hook

**For Claude (default):**

```bash
cat > .husky/prepare-commit-msg << 'EOF'
#!/bin/sh
# Generate commit message with AI
if [ -z "$2" ]; then
  exec < /dev/tty && npx @arittr/commitment --message-only > "$1" || true
fi
EOF

chmod +x .husky/prepare-commit-msg
```

**For Codex:**

```bash
cat > .husky/prepare-commit-msg << 'EOF'
#!/bin/sh
# Generate commit message with AI (using Codex)
if [ -z "$2" ]; then
  exec < /dev/tty && npx @arittr/commitment --agent codex --message-only > "$1" || true
fi
EOF

chmod +x .husky/prepare-commit-msg
```

## How It Works

1. You run `git commit` (without `-m` flag)
2. The `prepare-commit-msg` hook runs before your editor opens
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

## Notes

- The hook only runs for regular commits (not merge, squash, etc.)
- `exec < /dev/tty` allows the CLI to read from terminal if needed
- You can still use `git commit -m "message"` to bypass the hook
