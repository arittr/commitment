# Constitution Metadata

**Version:** 2
**Created:** 2025-10-21
**Previous Version:** v1

## Summary

Streamlined constitution reflecting the "commitment simplification" refactor. Removes over-engineering (provider chains, auto-detection, base classes) in favor of direct, simple implementations. Adds first-class cross-platform support and one-command hook installation.

## Rationale

This v2 constitution codifies the architectural simplifications and new capabilities added in the streamlined refactor:

1. **Agents not Providers**: The term "agent" is clearer and simpler than "provider". Each agent is a standalone class (~80 LOC) with inline CLI execution logic - no base classes, no factories, no shared utilities. This drastically reduced code complexity while maintaining functionality.

2. **No Auto-Detection or Fallback Chains**: v1's auto-detection system and provider fallback chains added ~2,000 LOC of complexity for features users rarely needed. v2 removes these in favor of a single `--agent <name>` flag. AI fallback is handled by the generator (AI fails → use rule-based), not by chaining multiple AI providers.

3. **Init Command for Hook Setup**: The new `commitment init` command auto-detects hook managers (husky, simple-git-hooks) and installs appropriate hooks with one command. This dramatically improves first-time user experience and cross-platform compatibility.

4. **Cross-Platform First**: Added `.gitattributes` to ensure LF line endings for hook scripts on all platforms. Documented Windows-specific considerations. Added `simple-git-hooks` support as a lightweight alternative to husky.

5. **Removed Dependencies**: Eliminated `ora` spinner library. All status output uses simple `chalk` formatting, reducing bundle size and complexity.

6. **Hook Message Preservation**: All hook templates now check `$2` parameter to avoid overriding user-specified commit messages (`git commit -m "..."`), merge commits, and squash commits.

## What Changed from Previous Version

**Architectural Changes:**
- Provider Layer → Agent Layer (terminology and implementation)
- Removed: provider-chain, auto-detect, provider-factory, base classes
- Simplified: Each agent is self-contained with inline logic

**New Features:**
- `commitment init` command for automatic hook installation
- Auto-detection of existing hook managers
- `simple-git-hooks` support (in addition to husky and plain git hooks)
- Cross-platform line ending management via `.gitattributes`

**Removed:**
- Provider fallback chains (now: AI → rule-based fallback in generator)
- Provider auto-detection (now: explicit `--agent` flag)
- `--provider-config` JSON configuration
- `--check-provider` and `--list-providers` commands (merged into main help)
- `ora` dependency (spinner library)
- Base classes: `BaseCLIProvider`, `BaseAPIProvider`
- Utility modules: `cli-executor`, `cli-response-parser`

**Documentation:**
- Comprehensive README with init command, cross-platform support
- Updated CLAUDE.md to reference v2 constitution
- Examples for all three hook managers with proper `$2` checks

## Migration Guide from v1 to v2

### For Contributors

**Code Changes:**
1. Import from `src/agents/` instead of `src/providers/`
2. Use `Agent` interface instead of `Provider` interface
3. Agent implementations are standalone - no base classes
4. Use `--agent <name>` instead of `--provider-config`

**Removed Modules:**
- `src/providers/provider-chain.ts` → Removed
- `src/providers/auto-detect.ts` → Removed
- `src/providers/provider-factory.ts` → Removed
- `src/providers/base/` directory → Removed
- `src/providers/utils/` directory → Removed

**New Modules:**
- `src/cli/commands/init.ts` → Hook installation command
- `.gitattributes` → Line ending management

### For Users

**Breaking Changes:**
- None! CLI interface is backward compatible
- `--agent` flag works the same way
- Existing hooks continue to work

**New Capabilities:**
- Run `npx commitment init` for automatic hook setup
- Use `--hook-manager` to specify husky, simple-git-hooks, or plain
- Better Windows support with LF line endings
- Lightweight `simple-git-hooks` option

## Related Documents

- CLAUDE.md - Updated to reference v2 constitution and document init command
- README.md - Comprehensive user documentation with init command
- specs/aefd60-commitment-refactor/spec.md - Original refactor specification

## Notes for Future Versions

When creating v3, consider:
- API-based agents (OpenAI, Gemini) in addition to CLI agents
- Configuration file support (`commitment.config.js`)
- Custom hook templates and hooks beyond `prepare-commit-msg`
- Plugin system for user-defined agents
- Workspace/monorepo support
