#!/bin/bash
# Quick setup script for commitment with global install
# Usage: ./setup.sh [agent]
# Example: ./setup.sh claude
# Example: ./setup.sh codex

set -e

AGENT="${1:-claude}"

echo "Setting up commitment with agent: $AGENT"

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Not a git repository. Run 'git init' first."
    exit 1
fi

# Check if commitment is installed globally
if ! command -v commitment > /dev/null 2>&1; then
    echo "❌ commitment not found in PATH"
    echo "Install it globally first:"
    echo "  npm install -g @arittr/commitment"
    exit 1
fi

# Create the hook
cat > .git/hooks/prepare-commit-msg << EOF
#!/bin/sh
# Generate commit message with commitment (global install)
if [ -z "\$2" ]; then
  echo "🤖 Generating commit message..." > /dev/tty 2>/dev/null || true
  commitment --agent $AGENT --message-only > "\$1" || true
fi
EOF

# Make it executable
chmod +x .git/hooks/prepare-commit-msg

echo "✅ Setup complete!"
echo "   Agent: $AGENT"
echo "   Hook: .git/hooks/prepare-commit-msg"
echo ""
echo "Try it:"
echo "  git add ."
echo "  git commit"
