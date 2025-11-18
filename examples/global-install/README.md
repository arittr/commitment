# Global Install Example

This example shows how to use `commitment` with a global installation, perfect for:

- Non-TypeScript/Non-Node.js projects (Python, Go, Rust, etc.)
- Simple projects without package.json
- Personal repositories
- Quick setup without adding dependencies

## Prerequisites

- Git installed
- Claude CLI, Codex CLI, or Gemini CLI installed (one of these)
- Bash/Zsh shell (or Git Bash on Windows)

## Global Installation

Install commitment globally so it's available in your PATH:

```bash
# Using npm
npm install -g @arittr/commitment

# Using yarn
yarn global add @arittr/commitment

# Using bun
bun add -g @arittr/commitment

# Using pnpm
pnpm add -g @arittr/commitment
```

## Verify Installation

```bash
commitment --version
```

## Setup for a Project

### Option 1: Automatic Setup (Recommended)

```bash
cd your-project

# For plain git hooks (no dependencies)
commitment init --hook-manager plain

# For plain git hooks with specific agent
commitment init --hook-manager plain --agent codex
```

### Option 2: Manual Setup

Create the git hook manually:

**For Claude (default):**

```bash
cat > .git/hooks/prepare-commit-msg << 'EOF'
#!/bin/sh
# Generate commit message with commitment (global install)
if [ -z "$2" ]; then
  commitment --message-only > "$1" || true
fi
EOF

chmod +x .git/hooks/prepare-commit-msg
```

**For Codex:**

```bash
cat > .git/hooks/prepare-commit-msg << 'EOF'
#!/bin/sh
# Generate commit message with commitment (global install)
if [ -z "$2" ]; then
  commitment --agent codex --message-only > "$1" || true
fi
EOF

chmod +x .git/hooks/prepare-commit-msg
```

**For Gemini:**

```bash
cat > .git/hooks/prepare-commit-msg << 'EOF'
#!/bin/sh
# Generate commit message with commitment (global install)
if [ -z "$2" ]; then
  commitment --agent gemini --message-only > "$1" || true
fi
EOF

chmod +x .git/hooks/prepare-commit-msg
```

## Usage

```bash
# Stage your changes
git add .

# Commit (message generated automatically)
git commit
```

## Example: Python Project

```bash
# Navigate to your Python project
cd ~/projects/my-python-app

# Install commitment globally (once)
npm install -g @arittr/commitment

# Set up the git hook
commitment init --hook-manager plain

# Use it!
git add app.py
git commit
# Editor opens with AI-generated commit message
```

## Example: Go Project

```bash
# Navigate to your Go project
cd ~/projects/my-go-service

# Set up the git hook (assuming commitment already installed globally)
commitment init --hook-manager plain --agent codex

# Use it!
git add main.go handlers.go
git commit
# Editor opens with AI-generated commit message
```

## Example: Rust Project

```bash
# Navigate to your Rust project
cd ~/projects/my-rust-cli

# Set up the git hook
commitment init --hook-manager plain

# Use it!
git add src/main.rs Cargo.toml
git commit
# Editor opens with AI-generated commit message
```

## Advantages of Global Install

✅ **No package.json required**: Works in any Git repository
✅ **No dependencies**: No need to install Node.js packages in your project
✅ **Fast setup**: One command to set up any project
✅ **Language agnostic**: Works with Python, Go, Rust, Java, etc.
✅ **Consistent across projects**: Same commitment version everywhere

## Limitations

⚠️ **Manual updates**: Need to update globally (`npm update -g @arittr/commitment`)
⚠️ **Team setup**: Each team member needs to install globally
⚠️ **Version sync**: Different team members might have different versions

## Updating

```bash
# Using npm
npm update -g @arittr/commitment

# Using yarn
yarn global upgrade @arittr/commitment

# Using bun
bun update -g @arittr/commitment
```

## Uninstalling

```bash
# Remove global installation
npm uninstall -g @arittr/commitment

# Remove git hook from a project
rm .git/hooks/prepare-commit-msg
```

## Alternative: Git Template (System-wide)

Set up commitment for ALL new repositories:

```bash
# 1. Create template directory
mkdir -p ~/.git-templates/hooks

# 2. Create the hook
cat > ~/.git-templates/hooks/prepare-commit-msg << 'EOF'
#!/bin/sh
if [ -z "$2" ]; then
  commitment --message-only > "$1" || true
fi
EOF

chmod +x ~/.git-templates/hooks/prepare-commit-msg

# 3. Configure Git to use template
git config --global init.templateDir ~/.git-templates

# 4. For existing repos, reinitialize
cd your-repo
git init
```

Now every new repository you create will automatically have commitment hooks!

## Troubleshooting

### "commitment: command not found"

The global installation didn't add commitment to your PATH. Solutions:

```bash
# Using npm - check global bin path
npm config get prefix

# Add to your PATH (add to ~/.bashrc or ~/.zshrc)
export PATH="$PATH:$(npm config get prefix)/bin"
```

### Hooks not running

Make sure the hook is executable:

```bash
chmod +x .git/hooks/prepare-commit-msg
```

### Different AI agent not available

Install the required CLI:

```bash
# For Claude
npm install -g @anthropic/claude-cli

# For Codex
npm install -g @codex/cli

# For Gemini
npm install -g @google/gemini-cli
```

## Learn More

- [commitment documentation](https://github.com/arittr/commitment)
- [Git hooks documentation](https://git-scm.com/docs/githooks)
- [Git templates](https://git-scm.com/docs/git-init#_template_directory)
