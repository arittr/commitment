# Constitution Metadata

**Version:** 1
**Created:** 2025-10-21
**Previous Version:** N/A (initial version)

## Summary

Initial constitution for commitment project, establishing foundational architectural rules, patterns, and tech stack decisions.

## Rationale

This v1 constitution codifies the existing architectural patterns and standards that have evolved in the commitment codebase:

1. **Schema-First Type Safety**: After adding Zod validation to the provider system, we've proven that schema-first development with runtime validation catches configuration errors early and provides better developer experience. This v1 constitution formalizes this pattern as mandatory across all system boundaries.

2. **Modular Architecture**: The recent refactor extracted CLI commands into separate modules (`src/cli/commands/`), demonstrating the value of single-responsibility modules. This constitution establishes module boundaries and separation of concerns as core architectural principles.

3. **Provider Abstraction**: The pluggable provider system (Claude, Codex, etc.) with base classes and fallback chains has proven extensible. This constitution documents the provider architecture as the foundation for AI integration.

4. **ESM-Only + Strict TypeScript**: The decision to use ESM exclusively and enable all strict TypeScript flags has eliminated entire classes of bugs. This constitution makes these decisions explicit and non-negotiable.

5. **Self-Dogfooding**: Using commitment to generate its own commit messages via git hooks has been invaluable for quality assurance. This constitution formalizes self-dogfooding as a testing requirement.

6. **Co-located Tests**: Keeping unit tests in `__tests__/` directories next to source files has improved discoverability and maintenance. This constitution establishes co-located testing as standard.

## What Changed from Previous Version

N/A (initial version)

## Related Documents

- CLAUDE.md - Comprehensive project documentation (to be gradually migrated)
- .speckit/type-safety-refactor.md - Specification driving schema-first patterns

## Notes for Future Versions

When creating v2, consider:
- Migration path from CLAUDE.md to constitution (should CLAUDE.md reference constitution?)
- API provider implementation patterns (currently only CLI providers exist)
- Configuration file support (commitment.config.js)
- Schema versioning strategy for breaking changes
