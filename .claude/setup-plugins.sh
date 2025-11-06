#!/usr/bin/env bash
# Setup script for Claude Code Web - installs required plugins and marketplaces

set -e

# Only run in Claude Code Web (remote) sessions
if [ "$CLAUDE_CODE_REMOTE" != "true" ]; then
  echo "ℹ️  Skipping plugin setup (not in Claude Code Web)"
  exit 0
fi

echo "🔧 Setting up Claude Code plugins..."

# Add custom marketplaces (may already exist from settings.json)
echo "📦 Adding custom marketplaces..."
claude plugin marketplace add arittr/spectacular || echo "  → spectacular marketplace already exists"
claude plugin marketplace add obra/superpowers-marketplace || echo "  → superpowers-marketplace already exists"

# Update marketplaces to ensure latest versions
echo "🔄 Updating marketplaces..."
claude plugin marketplace update

# Install plugins from marketplaces
echo "⚡ Installing plugins..."
claude plugin install spectacular@spectacular
claude plugin install superpowers@superpowers-marketplace

echo "✅ Claude Code plugins setup complete!"
