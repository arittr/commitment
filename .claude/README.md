# Claude Code Configuration

This directory contains configuration and setup files for Claude Code.

## Files

### `settings.json`
Main configuration file for Claude Code. Defines:
- **enabledPlugins**: Plugins that are enabled in this repository
  - `spectacular@spectacular` - Spec-anchored development with stacked branches
  - `superpowers@superpowers-marketplace` - Skills and workflows for Claude Code
- **extraKnownMarketplaces**: Custom plugin marketplaces
  - `spectacular` - github.com/arittr/spectacular
  - `superpowers-marketplace` - github.com/obra/superpowers-marketplace
- **hooks**: SessionStart hook that automatically runs setup-plugins.sh on startup

### `setup-plugins.sh`
Automated setup script for Claude Code Web. **Runs automatically** via SessionStart hook.

**Automatic execution:** This script runs automatically when you open the repository in Claude Code Web.

**Manual execution:**
```bash
bun run setup:claude-plugins
# or
./.claude/setup-plugins.sh
```

**What it does:**
1. Checks if running in Claude Code Web (`CLAUDE_CODE_REMOTE=true`)
2. Adds custom marketplaces (spectacular, superpowers-marketplace)
3. Updates marketplaces to latest versions
4. Installs plugins from those marketplaces

### `settings.local.json` (optional)
Local user-specific settings (gitignored). Override settings.json without committing changes.

### `agents/` (optional)
Custom agent configurations for this repository.

## Claude Code Web

When opening this repository in Claude Code Web, plugins are **installed automatically** via SessionStart hook.

The hook runs `.claude/setup-plugins.sh` which:
- Only executes in Claude Code Web environments (`CLAUDE_CODE_REMOTE=true`)
- Adds custom marketplaces (spectacular, superpowers-marketplace)
- Updates marketplaces to ensure latest versions
- Installs required plugins

**No manual action required** - the setup happens automatically on session start!

## Documentation

- [Claude Code Web docs](https://code.claude.com/docs/en/claude-code-on-the-web)
- [Plugin management](https://code.claude.com/docs/en/claude-code-on-the-web#dependency-management)
- [spectacular plugin](https://github.com/arittr/spectacular)
- [superpowers plugin](https://github.com/obra/superpowers-marketplace)
