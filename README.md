# commitment

> AI-powered commit message generator with intelligent fallback

`commitment` uses Claude CLI to analyze your git diffs and generate professional, conventional commit messages. When AI is unavailable, it falls back to intelligent rule-based generation.

## Features

- 🤖 **AI-powered generation** using Claude CLI for accurate, context-aware messages
- 🎯 **Intelligent fallback** to rule-based generation when AI fails
- 📊 **Code analysis** detects functions, tests, types, and patterns in your changes
- ✨ **Conventional commits** follows standard format (feat:, fix:, etc.)
- 🎨 **Customizable** signature, AI command, and timeout options
- 🪝 **Precommit hooks** works seamlessly with husky and lint-staged
- 📦 **Zero config** works out of the box with sensible defaults

## Installation

```bash
# Using npm
npm install -D commitment

# Using pnpm
pnpm add -D commitment

# Using yarn
yarn add -D commitment
```

## Requirements

- Node.js >= 18
- Git repository
- [Claude CLI](https://claude.ai/code) installed and configured (for AI generation)

## Quick Start

### Basic Usage

Stage your changes and run:

```bash
npx commitment
```

This will:

1. Analyze your staged changes
2. Generate a commit message using AI
3. Create the commit

### Dry Run

Preview the message without committing:

```bash
npx commitment --dry-run
```

### Message Only

Output just the message (useful for hooks):

```bash
npx commitment --message-only
```

## CLI Options

```bash
commitment [options]

Options:
  --dry-run              Generate message without creating commit
  --message-only         Output only the commit message (no commit)
  --no-ai                Disable AI generation, use rule-based only
  --cwd <path>           Working directory (default: current directory)
  --signature <text>     Custom signature to append
  --ai-command <cmd>     AI command to use (default: "claude")
  --timeout <ms>         AI timeout in milliseconds (default: "120000")
  -V, --version          Output version number
  -h, --help             Display help
```

## Programmatic API

Use `commitment` in your Node.js scripts:

```typescript
import { CommitMessageGenerator } from 'commitment';

const generator = new CommitMessageGenerator({
  aiCommand: 'claude',
  enableAI: true,
  signature: 'Custom signature here',
});

const task = {
  title: 'Add user authentication',
  description: 'Implement JWT-based authentication',
  produces: ['src/auth.ts', 'src/middleware/auth.ts'],
};

const message = await generator.generateCommitMessage(task, {
  workdir: process.cwd(),
  files: ['src/auth.ts', 'src/middleware/auth.ts'],
});

console.log(message);
```

### Configuration Options

```typescript
type CommitMessageGeneratorConfig = {
  /** AI client command (default: 'claude') */
  aiCommand?: string;

  /** Timeout for AI generation in ms (default: 120000) */
  aiTimeout?: number;

  /** Enable/disable AI generation (default: true) */
  enableAI?: boolean;

  /** Custom logger function */
  logger?: {
    warn: (message: string) => void;
  };

  /** Custom signature to append to commits */
  signature?: string;
};
```

## Precommit Hook Integration

### Husky

Create `.husky/prepare-commit-msg`:

```bash
#!/bin/sh
# Generate commit message with AI
exec < /dev/tty && npx commitment --message-only > "$1"
```

Make it executable:

```bash
chmod +x .husky/prepare-commit-msg
```

### lint-staged

Add to your `package.json`:

```json
{
  "lint-staged": {
    "*": "npx commitment --message-only"
  }
}
```

### Git Hooks (without Husky)

Create `.git/hooks/prepare-commit-msg`:

```bash
#!/bin/sh
npx commitment --message-only > "$1"
```

Make it executable:

```bash
chmod +x .git/hooks/prepare-commit-msg
```

## How It Works

### AI Generation

1. Analyzes staged changes using `git diff --cached`
2. Sends diff to Claude CLI with detailed prompt
3. Parses and cleans up AI response
4. Returns conventional commit message

### Fallback Generation

When AI fails or is disabled:

1. Categorizes files (components, APIs, tests, configs, docs)
2. Analyzes change patterns (additions, modifications, deletions)
3. Generates title based on file types
4. Creates bullet points describing changes
5. Follows conventional commits format

### Code Analysis

Detects patterns in your changes:

- Function/method additions and removals
- Test cases (test, it, describe)
- Type definitions and interfaces
- Mocking patterns
- Change magnitude (lines added/removed)

## Examples

### Simple Feature Addition

```bash
$ git add src/components/Button.tsx
$ npx commitment
```

```
feat: add button component

- Create reusable Button component with TypeScript
- Add props interface for size and variant
- Include hover and focus states
```

### Bug Fix

```bash
$ git add src/utils/validation.ts
$ npx commitment
```

```
fix: correct email validation regex

- Fix regex pattern to handle plus signs in email addresses
- Update test cases for edge cases
```

### Multiple Files

```bash
$ git add src/api/ src/types/
$ npx commitment
```

```
feat: implement user authentication API

- Add login and logout endpoints
- Create JWT token generation and validation
- Update user type definitions
- Add authentication middleware
```

## Troubleshooting

### "No staged changes to commit"

Make sure you've staged your changes with `git add` first:

```bash
git add .
npx commitment
```

### AI Generation Fails

If Claude CLI fails, `commitment` automatically falls back to rule-based generation. Common causes:

- Claude CLI not installed: `npm install -g @anthropic-ai/claude-code`
- Not authenticated: Run `claude --help` to authenticate
- Network issues: Check your internet connection

You can also disable AI and use rule-based only:

```bash
npx commitment --no-ai
```

### Custom Signature

Remove or customize the default signature:

```bash
# No signature
npx commitment --signature ""

# Custom signature
npx commitment --signature "Signed-off-by: Your Name <your@email.com>"
```

## License

ISC

## Contributing

Contributions welcome! Please open an issue or PR on GitHub.

## Credits

Extracted from [chopstack](https://github.com/anthropics/chopstack-mcp) - AI-powered PR stack automation tool.

Built with:

- [Claude CLI](https://claude.ai/code) for AI generation
- [execa](https://github.com/sindresorhus/execa) for subprocess execution
- [commander](https://github.com/tj/commander.js) for CLI parsing
- [chalk](https://github.com/chalk/chalk) for terminal colors
- [ora](https://github.com/sindresorhus/ora) for spinners
