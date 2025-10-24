#!/usr/bin/env bun
import { chmod } from 'node:fs/promises';
import { build } from 'bun';

// Build CLI entry point
// Note: No sourcemaps - CLI users don't need them, and it doubles package size
// For debugging, run TypeScript directly: bun run src/cli.ts
await build({
  entrypoints: ['./src/cli.ts'],
  format: 'esm',
  minify: {
    identifiers: true, // Shorten variable names
    syntax: true, // Minify syntax
    whitespace: true, // Remove whitespace
  },
  outdir: './dist',
  sourcemap: 'none',
  target: 'node',
});

// Add shebang to CLI file
const cliPath = './dist/cli.js';
const content = await Bun.file(cliPath).text();
await Bun.write(cliPath, `#!/usr/bin/env node\n${content}`);

// Make CLI executable (Unix only)
if (process.platform !== 'win32') {
  await chmod(cliPath, 0o755);
}

console.log('✅ Build complete');
