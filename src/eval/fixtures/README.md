# Evaluation Fixtures

This directory contains fixtures for testing commit message quality evaluation.

## Fixture Types

### Mocked Fixtures

Fast fixtures using pre-captured git output (no real git commands):

- **simple/**: Single-file bug fix (null safety)
- **complex/**: Multi-file feature (export functionality)

Each contains:
- `mock-status.txt`: Git status --porcelain output
- `mock-diff.txt`: Git diff output
- `metadata.json`: Fixture metadata (name, description, expectedType)

### Live Git Fixtures

Real git repositories with staged changes for comprehensive testing:

- **simple-live/**: Single-file bug fix (null safety)
- **complex-live/**: Multi-file feature (export functionality)

Each contains source files and `metadata.json`. The git repositories must be initialized before use.

## Initializing Live Fixtures

Live fixtures need git repos initialized with staged changes:

### simple-live

```bash
cd examples/eval-fixtures/simple-live
git init
git add parser.ts
git commit -m "Initial commit"
# Edit parser.ts to add null safety (input?.trim() ?? '')
git add parser.ts
# Leave staged (don't commit)
```

### complex-live

```bash
cd examples/eval-fixtures/complex-live
git init
git add README.md src/types/index.ts
git commit -m "Initial commit"
# Add new files: src/features/export.ts, src/features/__tests__/export.test.ts
# Edit: src/types/index.ts, README.md
git add .
# Leave staged (don't commit)
```

## Setup Script

Run this script to initialize all live fixtures:

```bash
#!/bin/bash
set -e

# Initialize simple-live
cd examples/eval-fixtures/simple-live
if [ ! -d .git ]; then
  git init
  # Create initial version
  cat > parser.ts << 'EOF'
export interface ParsedResult {
  value: string;
  length: number;
}

export function parseInput(input: string): ParsedResult {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Input cannot be empty');
  }
  return {
    value: trimmed,
    length: trimmed.length,
  };
}
EOF
  git add parser.ts
  git commit -m "Initial commit"

  # Apply null safety fix
  cat > parser.ts << 'EOF'
export interface ParsedResult {
  value: string;
  length: number;
}

export function parseInput(input: string): ParsedResult {
  const trimmed = input?.trim() ?? '';
  if (!trimmed) {
    throw new Error('Input cannot be empty');
  }
  return {
    value: trimmed,
    length: trimmed.length,
  };
}
EOF
  git add parser.ts
  echo "✓ simple-live initialized with staged changes"
fi

# Initialize complex-live
cd ../complex-live
if [ ! -d .git ]; then
  git init
  git add README.md src/types/index.ts
  git commit -m "Initial commit"
  git add .
  echo "✓ complex-live initialized with staged changes"
fi

cd ../../..
echo "✓ All live fixtures ready"
```

Save as `examples/eval-fixtures/init-live-fixtures.sh` and run:

```bash
chmod +x examples/eval-fixtures/init-live-fixtures.sh
./examples/eval-fixtures/init-live-fixtures.sh
```

## Usage in Tests

### Mocked Mode (Fast)

```typescript
const fixture = runner.loadFixture('simple', 'mocked');
// Uses mock-status.txt and mock-diff.txt
```

### Live Mode (Comprehensive)

```typescript
const fixture = runner.loadFixture('simple', 'live');
// Executes real git commands in simple-live/
```

## Metadata Schema

Each fixture has `metadata.json`:

```json
{
  "name": "simple",
  "description": "Single-file bug fix (null safety)",
  "expectedType": "fix",
  "complexity": "simple"
}
```

- `name`: Fixture identifier
- `description`: Human-readable description
- `expectedType`: Expected conventional commit type (fix, feat, etc.)
- `complexity`: simple or complex
