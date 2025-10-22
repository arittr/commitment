# simple-git-hooks Integration Example

This example shows how to use `commitment` with [simple-git-hooks](https://github.com/toplenboren/simple-git-hooks), a lightweight alternative to husky.

## Why simple-git-hooks?

- Minimal dependencies (just 1 package)
- Simple configuration in package.json
- Fast and lightweight
- No additional scripts or directories

## Setup

1. Install dependencies:

```bash
npm install -D commitment simple-git-hooks
```

2. Add configuration to your `package.json`:

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

3. Initialize hooks:

```bash
npm run prepare
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
    "prepare-commit-msg": "npx commitment --agent codex --message-only > $1"
  }
}
```

### Disable AI (rule-based only)

```json
{
  "simple-git-hooks": {
    "prepare-commit-msg": "npx commitment --no-ai --message-only > $1"
  }
}
```

### Skip for merge commits

```json
{
  "simple-git-hooks": {
    "prepare-commit-msg": "[ -z \"$2\" ] && npx commitment --message-only > $1 || exit 0"
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
