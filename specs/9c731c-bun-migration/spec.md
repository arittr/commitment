---
runId: 9c731c
feature: bun-migration
created: 2025-01-22
status: draft
---

# Feature: Bun Tooling Migration

**Status**: Draft
**Created**: 2025-01-22

## Problem Statement

**Current State:**
commitment uses pnpm + tsup + Vitest for package management, building, and testing. While functional, this creates:
- Multiple tool dependencies (pnpm, tsup, vitest, @vitest/*, jiti)
- Slower development cycles (install, build, test all use separate tools)
- Configuration fragmentation (package.json, tsup.config.ts, vitest.config.ts)
- Developer setup requires pnpm installation

**Desired State:**
Use Bun for all development operations:
- Single tool for install/build/test (reduces dependencies)
- Faster development cycles (3-10x speedup across operations)
- Unified configuration (bunfig.toml or bun.config.ts)
- Simpler developer onboarding (just install Bun)
- Published package works with Node.js 18+ AND Bun runtime

**Gap:**
Need to migrate tooling while maintaining:
- Backward compatibility for end users (npm/npx installation still works)
- All existing tests pass with bun:test
- Build outputs remain Node.js compatible
- Constitutional compliance with updated tech stack

## Requirements

> **Note**: All features must follow @docs/constitutions/current/

### Functional Requirements

**FR1: Package Manager Migration**
- Replace `pnpm install` with `bun install`
- Remove pnpm-lock.yaml, add bun.lockb
- Update package.json packageManager field to "bun@1.1.0"
- Preserve all dependency versions (no version bumps during migration)

**FR2: Build System Migration**
- Replace tsup/esbuild with Bun's built-in bundler
- Maintain dual entry points: library (src/index.ts) and CLI (src/cli.ts)
- Generate TypeScript declarations (.d.ts files)
- Add CLI shebang (#!/usr/bin/env node) to dist/cli.js
- Build output targets Node.js 18+ (ESM format)
- Support extensionless imports (moduleResolution: "bundler")

**FR3: Test Runner Migration**
- Replace Vitest with bun:test
- Preserve all 678 existing tests in current locations
- Maintain test co-location pattern (__tests__/ directories)
- Migrate test API: vi.fn() → mock(), vi.mock() → mock.module()
- Achieve equivalent coverage (80%+ minimum)
- Remove Vitest dependencies: vitest, @vitest/ui, @vitest/coverage-v8, jiti

**FR4: TypeScript Configuration**
- Install bun-types for automatic test globals (describe, it, expect)
- Update tsconfig.json: moduleResolution "bundler", types ["bun-types"]
- Keep tsc for type checking (bun tsc --noEmit)
- Remove .js extensions from all import statements
- Maintain strict TypeScript settings per constitution

**FR5: Documentation Updates**
- Update docs/constitutions/current/tech-stack.md: pnpm MANDATORY → REMOVED, Bun MANDATORY
- Update docs/constitutions/current/testing.md: Replace Vitest patterns with bun:test
- Update docs/constitutions/current/patterns.md: Remove pnpm patterns, add Bun-specific
- Update CLAUDE.md: All pnpm commands → bun commands
- Update README.md: Installation and development setup
- Update all specs/*/spec.md and specs/*/plan.md files with pnpm/vitest references
- Update example READMEs: examples/*/README.md

### Non-Functional Requirements

**NFR1: Backward Compatibility**
- Published npm package works with npm/npx installation
- Runtime compatible with Node.js 18+ and Bun 1.0+
- No breaking changes for end users (commitment CLI usage unchanged)

**NFR2: Development Performance**
- Build time improves by at least 2x vs tsup
- Test execution improves by at least 2x vs Vitest
- Package installation improves by at least 2x vs pnpm

**NFR3: CI/CD Compatibility**
- GitHub Actions workflows support Bun setup (oven-sh/setup-bun@v1)
- All CI checks pass: lint, type-check, test, build
- Coverage reporting works with bun:test built-in coverage

**NFR4: Developer Experience**
- Single tool installation (just Bun, no pnpm required)
- Familiar commands: bun install, bun run build, bun test
- Clear migration documentation for contributors

## Architecture

> **Layer boundaries**: @docs/constitutions/current/architecture.md
> **Required patterns**: @docs/constitutions/current/patterns.md

### Components

**Modified Files:**
- `package.json` - Update packageManager, engines, scripts, remove tsup/vitest dependencies
- `tsconfig.json` - Add bun-types, moduleResolution "bundler", update module resolution
- `.gitignore` - Replace pnpm-lock.yaml with bun.lockb
- All `src/**/*.ts` files - Remove .js extensions from imports
- All `src/**/__tests__/*.test.ts` files - Update mock API (vi → mock)

**New Files:**
- `build.ts` - Bun build configuration (replaces tsup.config.ts)
- `bunfig.toml` - Bun configuration for test coverage and build settings

**Removed Files:**
- `tsup.config.ts` - Replaced by build.ts
- `vitest.config.ts` - Replaced by bunfig.toml
- `pnpm-lock.yaml` - Replaced by bun.lockb

### Dependencies

**Removed Packages:**
- `tsup` - Replaced by Bun bundler
- `vitest` - Replaced by bun:test
- `@vitest/ui` - Bun test has no UI mode
- `@vitest/coverage-v8` - Replaced by bun:test built-in coverage
- `jiti` - Bun has native TypeScript support

**Added Packages:**
- `bun-types` (devDependency) - TypeScript types for Bun globals and test API

**Preserved Packages:**
- All production dependencies unchanged (chalk, commander, execa, zod, ts-pattern, @openai/agents)
- TypeScript, @types/node (needed for type checking)
- @biomejs/biome (linter/formatter - Bun agnostic)
- husky (git hooks - Bun agnostic)

**Package Manager:**
- Bun 1.1.0+
- See: https://bun.sh/docs

**Build Tool:**
- Bun's built-in bundler
- See: https://bun.sh/docs/bundler

**Test Runner:**
- bun:test
- See: https://bun.sh/docs/cli/test

### Integration Points

**Build System:**
- Bun bundler creates ESM outputs in dist/
- TypeScript compiler generates .d.ts declarations
- Post-build script adds shebang to CLI entry point

**Test System:**
- bun:test runs all tests in src/**/__tests__/**/*.test.ts
- Built-in coverage reporter (text, json, html)
- Mock API migration: Vitest → Bun test mocking

**Package Management:**
- bun.lockb replaces pnpm-lock.yaml
- Same resolution algorithm (maintains dependency tree)
- Faster installs via binary lockfile format

**CI/CD:**
- GitHub Actions: `uses: oven-sh/setup-bun@v1`
- Cache strategy: bun.lockb instead of pnpm-lock.yaml
- All scripts updated: bun install, bun run build, bun test

## Acceptance Criteria

**Constitution Compliance:**
- [ ] Tech stack updated (@docs/constitutions/current/tech-stack.md reflects Bun as MANDATORY)
- [ ] Testing requirements met (@docs/constitutions/current/testing.md uses bun:test patterns)
- [ ] Architecture boundaries respected (no layer violations)
- [ ] All import statements extensionless (moduleResolution: "bundler")

**Migration Quality:**
- [ ] All 678 tests pass with bun:test
- [ ] Coverage ≥80% maintained
- [ ] Build generates both dist/index.js and dist/cli.js with correct formats
- [ ] CLI shebang present in dist/cli.js
- [ ] TypeScript declarations generated in dist/

**Backward Compatibility:**
- [ ] Package installable via npm install @arittr/commitment
- [ ] CLI works with npx commitment
- [ ] Runtime compatible with Node.js 18+
- [ ] Runtime compatible with Bun 1.0+

**Documentation:**
- [ ] All constitution files updated (tech-stack.md, testing.md, patterns.md)
- [ ] CLAUDE.md updated (all pnpm → bun)
- [ ] README.md updated (installation, development)
- [ ] All specs and plans updated (pnpm/vitest references)
- [ ] Example READMEs updated

**Verification:**
- [ ] `bun install` succeeds
- [ ] `bun run build` succeeds
- [ ] `bun test` passes (all tests)
- [ ] `bun run lint` passes (type-check + biome)
- [ ] `./dist/cli.js --dry-run` works
- [ ] Test in separate repo: npm install + npx commitment works

**Performance (measured against baseline):**
- [ ] Build time improved by ≥2x
- [ ] Test execution improved by ≥2x
- [ ] Install time improved by ≥2x

## Open Questions

1. **Coverage Thresholds**: Should we enforce coverage thresholds in bunfig.toml, or keep current approach?
2. **Watch Mode**: Vitest UI is removed - is bun test --watch sufficient, or should we document an alternative?
3. **CI Matrix**: Should we test both Bun and Node.js runtimes in CI, or just Bun?
4. **Lockfile Migration**: Should we commit the initial bun.lockb in the migration PR, or let CI generate it?

## References

- Architecture: @docs/constitutions/current/architecture.md
- Patterns: @docs/constitutions/current/patterns.md
- Schema Rules: @docs/constitutions/current/schema-rules.md
- Tech Stack: @docs/constitutions/current/tech-stack.md
- Testing: @docs/constitutions/current/testing.md
- Bun Documentation: https://bun.sh/docs
- Bun Bundler: https://bun.sh/docs/bundler
- Bun Test: https://bun.sh/docs/cli/test
- Bun TypeScript: https://bun.sh/docs/runtime/typescript
