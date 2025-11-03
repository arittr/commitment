# Lefthook Integration Example

This example shows how to integrate `commitment` with Lefthook for automatic commit message generation.

## Why Lefthook?

- **Fast**: Written in Go, runs hooks quickly
- **Parallel execution**: Run multiple commands simultaneously
- **Simple YAML config**: Clean, readable configuration
- **Cross-platform**: Works on Linux, macOS, Windows
- **No dependencies**: Single binary, no Node.js required for execution

## Quick Setup (Recommended)

Use the `commitment init` command for automatic setup:

```bash
# Install commitment and lefthook
npm install -D @arittr/commitment @evilmartians/lefthook
# or: yarn add -D @arittr/commitment @evilmartians/lefthook
# or: bun add -D @arittr/commitment @evilmartians/lefthook

# Set up commitment hooks (uses Claude by default)
npx commitment init --hook-manager lefthook

# Or specify a different agent
npx commitment init --hook-manager lefthook --agent codex
```

## Manual Setup

### 1. Install Dependencies

```bash
# Using npm
npm install -D @arittr/commitment @evilmartians/lefthook

# Using yarn
yarn add -D @arittr/commitment @evilmartians/lefthook

# Using bun
bun add -D @arittr/commitment @evilmartians/lefthook
```

### 2. Create lefthook.yml

Create a `lefthook.yml` file in your project root:

**For Claude (default):**

```yaml
prepare-commit-msg:
  commands:
    commitment:
      run: '[ -z "{2}" ] && npx commitment --message-only > {1} || true'
```

**For Codex:**

```yaml
prepare-commit-msg:
  commands:
    commitment:
      run: '[ -z "{2}" ] && npx commitment --agent codex --message-only > {1} || true'
```

**For Gemini:**

```yaml
prepare-commit-msg:
  commands:
    commitment:
      run: '[ -z "{2}" ] && npx commitment --agent gemini --message-only > {1} || true'
```

### 3. Add prepare script to package.json

```json
{
  "scripts": {
    "prepare": "lefthook install"
  }
}
```

### 4. Install hooks

```bash
npm install
# This will run the prepare script and install lefthook hooks
```

## How It Works

1. You run `git commit` (without `-m` flag)
2. The `prepare-commit-msg` hook runs before your editor opens
3. Lefthook executes the configured command
4. The `[ -z "{2}" ]` check ensures it only runs for regular commits (not merge, squash, etc.)
5. `commitment` generates a message based on staged changes
6. Your editor opens with the AI-generated message pre-filled
7. You can edit or accept the message

## Advanced Configuration

### Combining with linting

```yaml
pre-commit:
  parallel: true
  commands:
    lint:
      glob: "*.{js,ts,jsx,tsx}"
      run: npm run lint -- --fix {staged_files}
      stage_fixed: true
    format:
      glob: "*.{js,ts,jsx,tsx,json,md}"
      run: npm run format -- {staged_files}
      stage_fixed: true

prepare-commit-msg:
  commands:
    commitment:
      run: '[ -z "{2}" ] && npx commitment --message-only > {1} || true'
```

### Skip on specific branches

```yaml
prepare-commit-msg:
  skip:
    - ref: main
      run: git rev-parse --abbrev-ref HEAD | grep -q "^main$"
  commands:
    commitment:
      run: '[ -z "{2}" ] && npx commitment --message-only > {1} || true'
```

### Interactive mode for debugging

If you want to see what lefthook is doing:

```bash
LEFTHOOK_VERBOSE=1 git commit
```

## Usage

After setup, commit messages will be automatically generated:

```bash
# Stage your changes
git add .

# Commit (editor opens with AI-generated message)
git commit
```

## Notes

- The hook only runs for regular commits (not merge, squash, etc.)
- `{1}` is replaced with the commit message file path
- `{2}` is replaced with the commit source (empty for normal commits)
- You can still use `git commit -m "message"` to bypass the hook
- Set `LEFTHOOK=0` to temporarily disable all hooks

## Troubleshooting

### Hooks not running

Make sure hooks are installed:

```bash
npx lefthook install
```

### Permission errors

Ensure lefthook has execute permissions:

```bash
chmod +x node_modules/@evilmartians/lefthook/bin/lefthook-*/lefthook
```

### Verify installation

Check that hooks are installed:

```bash
ls -la .git/hooks/prepare-commit-msg
```

You should see a lefthook wrapper script.

## Learn More

- [commitment documentation](https://github.com/arittr/commitment)
- [Lefthook documentation](https://lefthook.dev/)
- [Lefthook GitHub](https://github.com/evilmartians/lefthook)
