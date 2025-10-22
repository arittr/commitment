#!/bin/bash
set -e

echo "Initializing live git fixtures..."

# Initialize simple-live
cd "$(dirname "$0")/simple-live"
if [ ! -d .git ]; then
  echo "Initializing simple-live..."
  git init

  # Create initial version (without null safety)
  cat > parser.ts << 'EOF'
/**
 * Parser utility for processing input strings
 */
export interface ParsedResult {
  value: string;
  length: number;
}

/**
 * Parse and validate input string
 * @param input - String to parse
 * @returns Parsed result with value and length
 * @throws {Error} If input is empty
 */
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

  # Apply null safety fix (this will be staged)
  cat > parser.ts << 'EOF'
/**
 * Parser utility for processing input strings
 */
export interface ParsedResult {
  value: string;
  length: number;
}

/**
 * Parse and validate input string
 * @param input - String to parse
 * @returns Parsed result with value and length
 * @throws {Error} If input is empty
 */
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
  echo "✓ simple-live initialized with staged null safety fix"
else
  echo "✓ simple-live already initialized"
fi

# Initialize complex-live
cd ../complex-live
if [ ! -d .git ]; then
  echo "Initializing complex-live..."
  git init

  # Create initial version (without export feature)
  mkdir -p src/types
  cat > src/types/index.ts << 'EOF'
export type Status = 'pending' | 'completed';
export type Priority = 'low' | 'medium' | 'high';
EOF

  # Save the original README
  cat > README.md << 'EOF'
# Example Project

Simple example project for testing.

## Installation

```bash
npm install commitment
```

## Usage

See documentation for details.

## License

MIT
EOF

  git add README.md src/types/index.ts
  git commit -m "Initial commit"

  # Add export feature files (this will be staged)
  mkdir -p src/features/__tests__

  cat > src/features/export.ts << 'EOF'
/**
 * Export functionality for data serialization
 */
export class Exporter {
  /**
   * Export data to JSON format
   *
   * @param data - Data to export
   * @returns JSON string with pretty formatting
   */
  async exportToJSON(data: unknown): Promise<string> {
    return JSON.stringify(data, null, 2);
  }
}
EOF

  cat > src/features/__tests__/export.test.ts << 'EOF'
import { describe, expect, it } from 'vitest';
import { Exporter } from '../export.js';

describe('Exporter', () => {
  it('exports to JSON', async () => {
    const exporter = new Exporter();
    const result = await exporter.exportToJSON({ foo: 'bar' });
    expect(result).toBe('{\n  "foo": "bar"\n}');
  });

  it('handles empty objects', async () => {
    const exporter = new Exporter();
    const result = await exporter.exportToJSON({});
    expect(result).toBe('{}');
  });
});
EOF

  cat >> src/types/index.ts << 'EOF'

/**
 * Supported export formats
 */
export type ExportFormat = 'json' | 'csv';
EOF

  cat > README.md << 'EOF'
# Example Project

Simple example project for testing.

## Installation

```bash
npm install commitment
```

## Usage

## Export Feature

The export feature allows you to serialize data to various formats:

- JSON export with pretty formatting

See documentation for details.

## License

MIT
EOF

  git add .
  echo "✓ complex-live initialized with staged export feature"
else
  echo "✓ complex-live already initialized"
fi

cd ../..
echo ""
echo "✓ All live fixtures ready!"
echo ""
echo "Verify with:"
echo "  cd examples/eval-fixtures/simple-live && git status"
echo "  cd examples/eval-fixtures/complex-live && git status"
