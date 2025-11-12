# Repository Guidelines

## Project Structure & Module Organization
Source lives in `src/`, with agent adapters under `src/agents/`, the CLI entry point in `src/cli.ts` plus subcommands in `src/cli/`, shared types in `src/types/`, and reusable helpers in `src/utils/`. Unit and integration specs sit beside code inside `src/__tests__/` and any `*.unit.ts` / `*.integration.ts` files. Scenario fixtures and regression cases are tracked in `specs/`, while published docs live under `docs/` (`docs/CLI.md`, `docs/HOOKS.md`). Built artifacts land in `dist/` and should never be edited directly; run generation tasks instead. Examples for CLI usage live in `examples/`, and coverage reports are emitted to `coverage/`.

## Build, Test, and Development Commands
- `bun run dev` — watch `build.ts` for rapid iteration while editing TypeScript.
- `bun run build` — transpile `src/` into `dist/cli.js` and supporting files.
- `bun run lint` / `bun run lint:check` — run Biome with autofix disabled/enabled plus a type check gate.
- `bun run check-types` — strict `tsc --noEmit` verification.
- `bun run test`, `bun run test:unit`, `bun run test:integration` — execute Bun’s test runner for all, unit-only, or integration-only specs.
- `bun run test:coverage` — generate HTML + LCOV coverage inside `coverage/`.
- `bun run eval:codex` (or `eval:claude`, `eval:gemini`) — exercise AI agents against fixtures in `specs/`.
- `bun run prepare` — build and install lefthook hooks; rerun after dependency installs.

## Coding Style & Naming Conventions
The repo is TypeScript-first with Biome enforcing 2-space indentation, LF endings, single quotes, semicolons, and max 100-character lines. Filenames must remain kebab-case, and exports default to named exports (Biome errors on default exports except for configs defined in `biome.jsonc`). Follow camelCase for variables/functions, PascalCase for types, and CONSTANT_CASE for immutable flags per the Biome naming rules. Prefer pure functions and pattern matching via `ts-pattern`, validate external input with `zod`, and route CLI logging through utilities in `src/utils/logger.ts` or the CLI layer where console output is explicitly allowed.

## Testing Guidelines
Unit specs target individual helpers (`*.unit.ts`) and should mock shell invocations; integration specs (`*.integration.ts`) exercise real CLI workflows. Co-locate tests with the code they cover or within `src/__tests__/` using descriptive filenames. Maintain coverage parity with main by gating PRs with `bun run test:coverage`; investigate dips when LCOV shows hotspots. Evaluation harnesses in `src/eval/` expect determinism, so seed random data and keep fixtures in `specs/` current.

## Commit & Pull Request Guidelines
Use Conventional Commits (`type(optional-scope): summary`), as seen in `fix: refine Codex response cleaning` and `refactor: update CLI command structure…`. Squash incidental WIP commits locally and ensure `bun run lint && bun run test` pass before pushing. PRs should describe the behavioral change, list manual validation (CLI, hook install, etc.), link any Linear/GitHub issue, and include screenshots or terminal snippets when UX output changes. Mention impacted agents (Claude, Codex, Gemini) so reviewers can re-run `bun run eval:<agent>` as needed.

## Security & Configuration Tips
No API keys are stored in this repo—commitment shells out to locally installed AI CLIs. Never commit personal CLI configs; keep them under `~/.config`. Biome’s `noSecrets` rule backs this up, so prefer environment variables or `.env.local` entries ignored by git. After pulling new hook definitions, run `bun run prepare` so lefthook stays updated and continues enforcing lint/test gates before commits.
