# lint-staged Integration Example

This example shows how to integrate `commitment` with lint-staged for automatic commit message generation as part of your pre-commit checks.

## Setup

### 1. Install Dependencies

```bash
npm install -D husky lint-staged commitment
npx husky init
```

### 2. Configure package.json

Add the lint-staged configuration:

```json
{
  "scripts": {
    "prepare": "husky"
  },
  "lint-staged": {
    "*": ["prettier --write", "eslint --fix"]
  }
}
```

### 3. Create Pre-commit Hook

Create `.husky/pre-commit`:

```bash
#!/bin/sh
npx lint-staged
```

Make it executable:

```bash
chmod +x .husky/pre-commit
```

### 4. Create Prepare-commit-msg Hook

Create `.husky/prepare-commit-msg`:

```bash
#!/bin/sh
if [ -z "$2" ]; then
  exec < /dev/tty && npx commitment --message-only > "$1"
fi
```

Make it executable:

```bash
chmod +x .husky/prepare-commit-msg
```

## How It Works

1. You run `git commit`
2. The `pre-commit` hook runs lint-staged (formatting, linting)
3. The `prepare-commit-msg` hook generates the commit message
4. Your editor opens with the generated message
5. You can edit or accept the message

## Advanced Configuration

### Run commitment only after successful linting

Update `.husky/pre-commit`:

```bash
#!/bin/sh
npx lint-staged && npx commitment --message-only > .git/COMMIT_EDITMSG
```

### Skip commitment for specific commits

```bash
# Skip for merge commits
if [ -z "$2" ] && ! git rev-parse -q --verify MERGE_HEAD; then
  exec < /dev/tty && npx commitment --message-only > "$1"
fi
```

## Notes

- lint-staged runs before commit message generation
- This ensures your commit only includes properly formatted code
- You can combine multiple tools in the pre-commit workflow
