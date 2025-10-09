<!--
Sync Impact Report:
- Version change: N/A → 1.0.0 (initial constitution)
- Principles defined: 7 core principles established
- Added sections: Development Workflow, Governance
- Templates requiring updates: ✅ All templates reviewed and align with constitution
- Follow-up TODOs: None

Constitution History:
- 2025-10-08: Initial constitution created based on CLAUDE.md comprehensive guidance
-->

# commitment Constitution

## Core Principles

### I. Schema-First Type Safety

**MUST validate all data at system boundaries using Zod schemas**

All external data (CLI arguments, git command output, file I/O, provider responses) MUST be validated using Zod schemas before internal use. Types MUST be inferred from schemas using `z.infer<typeof schema>`. Schemas MUST include validation constraints (min, max, positive, etc.) and provide clear error messages. Internal code MAY trust already-validated data without re-validation.

**Rationale**: Runtime validation catches invalid data from users and external systems before it can cause errors. Schema-first approach ensures single source of truth for both runtime validation and TypeScript types, preventing drift between validation logic and type definitions.

### II. Strict TypeScript

**MUST use strict TypeScript with zero tolerance for `any` types**

All strict compiler flags MUST be enabled. All public functions MUST have explicit return types. The `any` type MUST NOT be used. Type guards MUST be used for narrowing known types. Test files MAY use relaxed type safety only when necessary for mocking.

**Rationale**: Strict typing catches bugs at compile time and provides better IDE support. Explicit return types serve as documentation and prevent unintended type inference. Zero tolerance for `any` prevents type safety holes.

### III. Modular Architecture (NON-NEGOTIABLE)

**MUST organize code into focused, independently testable modules**

Each module MUST have a single responsibility. CLI commands MUST be separated into individual command modules in `src/cli/commands/`. Provider implementations MUST extend base classes and live in `src/providers/implementations/`. Schemas MUST be organized by domain (`types/`, `cli/`, `utils/`). Cross-cutting concerns (guards, git utilities) MUST live in `src/utils/`.

**Rationale**: Modular architecture enables independent testing, parallel development, and easier maintenance. Single responsibility principle prevents modules from becoming bloated and hard to understand.

### IV. Test-Driven Development

**MUST write comprehensive tests for all public APIs**

All public APIs, edge cases, error handling, and validation logic MUST have test coverage. Tests MUST be co-located with source in `__tests__/` directories. Schema validation tests MUST cover valid inputs, invalid inputs, edge cases, and error messages. Provider tests MUST verify availability checks and message generation. CLI command tests MUST verify output and exit codes.

**Rationale**: Tests document expected behavior and prevent regressions. Co-located tests are easier to find and maintain. Comprehensive coverage ensures reliability and confidence when refactoring.

### V. Provider Abstraction

**MUST support pluggable AI providers with automatic fallback**

All AI providers MUST implement the `AIProvider` interface. Provider configuration MUST use discriminated unions validated by Zod. The system MUST support provider fallback chains (e.g., Claude → Codex → rule-based). Adding a new provider MUST require only: provider class, type enum update, factory update, auto-detect update, export, and tests.

**Rationale**: Pluggable architecture allows users to choose their preferred AI provider or add new ones. Automatic fallback ensures the tool works even when preferred AI is unavailable. Standardized interface makes providers interchangeable.

### VI. Conventional Commits

**MUST generate commit messages following conventional commit format**

All generated commit messages MUST follow the format: `type(scope): subject` where type is one of: feat, fix, docs, style, refactor, test, chore. Subject MUST be concise and lowercase. Body MUST provide context using bullet points. Both AI-generated and rule-based messages MUST follow this format.

**Rationale**: Conventional commits enable automated changelog generation, semantic versioning, and clear communication of change types. Consistent format improves readability of git history.

### VII. Self-Dogfooding

**MUST use commitment for its own commit messages**

The project MUST use itself via git hooks (prepare-commit-msg). Changes to commit message generation MUST be tested on the project itself before release. The CLI MUST work when invoked from the repository root.

**Rationale**: Using the tool on itself (dogfooding) ensures it works in real-world scenarios and catches usability issues early. It provides confidence in the tool's quality and serves as a living example.

## Development Workflow

### Code Quality Gates

**MUST pass all quality checks before committing**

All code MUST pass: `pnpm run lint` (type-check + format-check + eslint), all tests (`pnpm test`), and build successfully (`pnpm run build`). Imports MUST be organized (external → internal). The git-spice workflow MUST be used for stacked branches (`gs bc` for branch creation, `gs stack submit` for PRs).

**Rationale**: Automated quality checks prevent broken code from reaching main branch. Consistent import organization improves readability. Stacked branch workflow enables parallel work on multiple features.

### File Organization

**MUST follow established file naming and structure conventions**

Files MUST use `kebab-case` naming. Functions and variables MUST use `camelCase`. Types MUST use `PascalCase`. Private members MUST have leading underscore (`_privateMethod`). CLI modules MAY disable `no-console` and `unicorn/no-process-exit` rules. Config files MAY disable `unicorn/no-default-export` rule.

**Rationale**: Consistent naming conventions improve code readability and prevent confusion. Selective ESLint rule disabling acknowledges legitimate use cases while maintaining strictness elsewhere.

## Governance

### Amendment Process

Constitution amendments require: (1) documented rationale for change, (2) verification that templates remain consistent, (3) semantic version bump (MAJOR for breaking changes, MINOR for new principles, PATCH for clarifications), (4) update to LAST_AMENDED_DATE.

### Versioning Policy

Constitution versions follow semantic versioning:
- **MAJOR**: Backward incompatible governance changes or principle removals
- **MINOR**: New principles added or materially expanded guidance
- **PATCH**: Clarifications, wording fixes, non-semantic refinements

### Compliance Review

All PRs MUST verify compliance with constitution principles. Complexity that violates principles MUST be justified in implementation plan. Use CLAUDE.md for runtime development guidance.

**Version**: 1.0.0 | **Ratified**: 2025-10-08 | **Last Amended**: 2025-10-08
