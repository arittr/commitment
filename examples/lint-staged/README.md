# lint-staged Integration Example

This example shows how to integrate `commitment` with lint-staged for automatic commit message generation as part of your pre-commit checks.

## Quick Setup (Recommended)

```bash
# Install dependencies
npm install -D @evilmartians/lefthook lint-staged @arittr/commitment
# or: yarn add -D @evilmartians/lefthook lint-staged @arittr/commitment
# or: bun add -D @evilmartians/lefthook lint-staged @arittr/commitment

# Set up commitment hooks (uses Claude by default)
npx commitment init --hook-manager lefthook

# Or specify a different agent
npx commitment init --hook-manager lefthook --agent codex
```

Add lint-staged configuration to `package.json`:

```json
{
  "scripts": {
    "prepare": "lefthook install"
  },
  "lint-staged": {
    "*.{js,ts,jsx,tsx}": ["prettier --write", "eslint --fix"]
  }
}
```

Create `lefthook.yml` in your project root:

```yaml
pre-commit:
  parallel: true
  commands:
    lint-staged:
      run: npx lint-staged

prepare-commit-msg:
  skip:
    - merge
    - rebase
  commands:
    commitment:
      run: |
        case "{2}" in
          *"{"*) npx @arittr/commitment --message-only > "{1}" ;;
        esac
      interactive: true
```

## Manual Setup

### 1. Install Dependencies

```bash
# Using npm
npm install -D @evilmartians/lefthook lint-staged @arittr/commitment

# Using yarn
yarn add -D @evilmartians/lefthook lint-staged @arittr/commitment

# Using bun
bun add -D @evilmartians/lefthook lint-staged @arittr/commitment
```

### 2. Configure package.json

Add the lint-staged configuration and prepare script:

```json
{
  "scripts": {
    "prepare": "lefthook install"
  },
  "lint-staged": {
    "*.{js,ts,jsx,tsx}": ["prettier --write", "eslint --fix"]
  }
}
```

### 3. Create lefthook.yml

Create a `lefthook.yml` file in your project root:

**For Claude (default):**

```yaml
pre-commit:
  parallel: true
  commands:
    lint-staged:
      run: npx lint-staged

prepare-commit-msg:
  skip:
    - merge
    - rebase
  commands:
    commitment:
      run: |
        case "{2}" in
          *"{"*) npx @arittr/commitment --message-only > "{1}" ;;
        esac
      interactive: true
```

**For Codex:**

```yaml
pre-commit:
  parallel: true
  commands:
    lint-staged:
      run: npx lint-staged

prepare-commit-msg:
  skip:
    - merge
    - rebase
  commands:
    commitment:
      run: |
        case "{2}" in
          *"{"*) npx @arittr/commitment --agent codex --message-only > "{1}" ;;
        esac
      interactive: true
```

**For Gemini:**

```yaml
pre-commit:
  parallel: true
  commands:
    lint-staged:
      run: npx lint-staged

prepare-commit-msg:
  skip:
    - merge
    - rebase
  commands:
    commitment:
      run: |
        case "{2}" in
          *"{"*) npx @arittr/commitment --agent gemini --message-only > "{1}" ;;
        esac
      interactive: true
```

### 4. Install hooks

```bash
npm install
# This will run the prepare script and install lefthook hooks
```

## How It Works

1. You run `git commit`
2. The `pre-commit` hook runs lint-staged (formatting, linting) in parallel
3. If lint-staged succeeds, modified files are automatically staged (`stage_fixed: true`)
4. The `prepare-commit-msg` hook generates the commit message
5. Your editor opens with the generated message
6. You can edit or accept the message

## Advanced Configuration

### Sequential execution (lint first, then format)

```yaml
pre-commit:
  parallel: false  # Run commands sequentially
  commands:
    lint:
      glob: "*.{js,ts,jsx,tsx}"
      run: npm run lint -- --fix {staged_files}
      stage_fixed: true
    format:
      glob: "*.{js,ts,jsx,tsx,json,md}"
      run: npm run prettier -- --write {staged_files}
      stage_fixed: true
```

### Skip commitment for specific branches

```yaml
prepare-commit-msg:
  skip:
    - merge
    - rebase
    - run: git rev-parse --abbrev-ref HEAD | grep -q "^main$"
  commands:
    commitment:
      run: |
        case "{2}" in
          *"{"*) npx @arittr/commitment --message-only > "{1}" ;;
        esac
      interactive: true
```

### Add type checking

```yaml
pre-commit:
  parallel: true
  commands:
    type-check:
      glob: "*.{ts,tsx}"
      run: npm run type-check
    lint-staged:
      run: npx lint-staged

prepare-commit-msg:
  skip:
    - merge
    - rebase
  commands:
    commitment:
      run: |
        case "{2}" in
          *"{"*) npx @arittr/commitment --message-only > "{1}" ;;
        esac
      interactive: true
```

## Notes

- lint-staged runs before commit message generation
- This ensures your commit only includes properly formatted code
- `stage_fixed: true` automatically stages files modified by linters/formatters
- Parallel execution speeds up pre-commit checks
- You can combine multiple tools in the pre-commit workflow
