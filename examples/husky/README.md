# Husky Integration Example

This example shows how to integrate `commitment` with Husky for automatic commit message generation.

## Setup

### 1. Install Husky

```bash
npm install -D husky
npx husky init
```

### 2. Add the prepare-commit-msg hook

Copy the `prepare-commit-msg` file to `.husky/`:

```bash
cp examples/husky/prepare-commit-msg .husky/
chmod +x .husky/prepare-commit-msg
```

Or create it manually:

```bash
cat > .husky/prepare-commit-msg << 'EOF'
#!/bin/sh
# Generate commit message with AI
if [ -z "$2" ]; then
  exec < /dev/tty && npx commitment --message-only > "$1"
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
