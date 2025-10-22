#!/usr/bin/env bun
import { build } from 'bun';
import { chmod } from 'node:fs/promises';

// Build library entry point
await build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  target: 'node',
  format: 'esm',
  minify: false,
  sourcemap: 'external',
});

// Build CLI entry point
await build({
  entrypoints: ['./src/cli.ts'],
  outdir: './dist',
  target: 'node',
  format: 'esm',
  minify: false,
  sourcemap: 'external',
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
