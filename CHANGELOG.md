# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Breaking Changes

#### Removed Manual Fallback Mode

The `--no-ai` flag and rule-based fallback generation have been removed. commitment is now AI-only, providing consistent, high-quality commit messages through AI agents.

**Migration Guide:**

If you previously used `--no-ai`:

1. **Install an AI CLI** (if not already installed):
   - **Claude CLI** (recommended): https://www.anthropic.com/claude/cli
   - **Codex CLI**: https://github.com/tom-doerr/codex_cli
   - **Gemini CLI**: https://ai.google.dev/gemini-api/docs/cli

2. **Remove the `--no-ai` flag** from your commands and scripts

3. **Update git hooks** (if manually configured):
   ```bash
   # Before
   npx commitment --no-ai --message-only > "$1"

   # After
   npx @arittr/commitment --message-only > "$1"
   ```

**Why This Change?**

- AI-generated messages are consistently higher quality than rule-based alternatives
- Eliminates ~200 LOC of maintenance burden
- Simplifies the codebase and user experience
- Aligns with commitment's "AI-first" philosophy

If an AI CLI is not available, commitment will display clear error messages with installation instructions.

### Added

- **`--quiet` flag**: Suppress progress messages (useful for scripting)
  ```bash
  npx commitment --quiet
  ```
- **Prompts module**: Extracted prompt generation logic to `src/prompts/` for better testability and maintainability
- **Standardized agent execution**: All agents (Claude, Codex, Gemini) now use consistent CLI execution patterns

### Changed

- **Progress messages now visible in git hooks**: By default, commitment shows "🤖 Generating commit message with [agent]..." during git commit operations (use `--quiet` to suppress)
- **Codex agent refactored**: Now uses direct CLI execution (stdin/args) instead of temp file I/O, reducing from ~160 LOC to ~70 LOC

### Removed

- **`--no-ai` CLI flag**: No longer supported (see migration guide above)
- **Rule-based fallback**: Removed manual commit message generation methods
- **Manual file categorization**: LLMs handle this more effectively

## [0.15.1] - 2025-11-03

### Fixed

- Update script name documentation from `type-check` to `check-types`

## [0.15.0] - 2025-11-03

### Changed

- Clean script no longer removes node_modules

---

[Unreleased]: https://github.com/arittr/commitment/compare/v0.15.1...HEAD
[0.15.1]: https://github.com/arittr/commitment/compare/v0.15.0...v0.15.1
[0.15.0]: https://github.com/arittr/commitment/releases/tag/v0.15.0
