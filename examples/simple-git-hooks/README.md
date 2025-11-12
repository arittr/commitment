# simple-git-hooks Integration Example

This example shows how to use `commitment` with [simple-git-hooks](https://github.com/toplenboren/simple-git-hooks), a lightweight alternative to husky.

## Why simple-git-hooks?

- Minimal dependencies (just 1 package)
- Simple configuration in package.json
- Fast and lightweight
- No additional scripts or directories

## Quick Setup (Recommended)

Use the `commitment init` command for automatic setup:

```bash
# Install commitment and simple-git-hooks
npm install -D commitment simple-git-hooks
# or: yarn add -D commitment simple-git-hooks
# or: bun add -D commitment simple-git-hooks

# Set up hooks (uses Claude by default)
npx commitment init --hook-manager simple-git-hooks

# Or specify a different agent
npx commitment init --hook-manager simple-git-hooks --agent codex

# Activate the hooks
npm run prepare
# or: yarn prepare
# or: bun run prepare
```

## Manual Setup

### 1. Install dependencies:

```bash
# Using npm
npm install -D commitment simple-git-hooks

# Using yarn
yarn add -D commitment simple-git-hooks

# Using bun
bun add -D commitment simple-git-hooks
```

### 2. Add configuration to your `package.json`:

**For Claude (default):**

```json
{
  "scripts": {
    "prepare": "simple-git-hooks"
  },
  "simple-git-hooks": {
    "prepare-commit-msg": "[ -z \"$2\" ] && npx commitment generate --message-only > $1"
  }
}
```

**For Codex:**

```json
{
  "scripts": {
    "prepare": "simple-git-hooks"
  },
  "simple-git-hooks": {
    "prepare-commit-msg": "[ -z \"$2\" ] && npx commitment --agent codex --message-only > $1"
  }
}
```

### 3. Initialize hooks:

```bash
npm run prepare
# or: yarn prepare
# or: bun run prepare
```

## Usage

After setup, commit messages will be automatically generated:

```bash
git add .
git commit  # Opens editor with AI-generated message
```

## Configuration Options

### Use different AI agent

```json
{
  "simple-git-hooks": {
    "prepare-commit-msg": "[ -z \"$2\" ] && npx commitment --agent codex --message-only > $1"
  }
}
```

### Skip for merge commits

```json
{
  "simple-git-hooks": {
    "prepare-commit-msg": "[ -z \"$2\" ] && npx commitment generate --message-only > $1"
  }
}
```

## Troubleshooting

### Hooks not running

Make sure you've run the prepare script:

```bash
npm run prepare
```

### Permission errors on Windows

Use Git Bash or WSL for better compatibility.

## Learn More

- [commitment documentation](https://github.com/yourusername/commitment)
- [simple-git-hooks documentation](https://github.com/toplenboren/simple-git-hooks)
