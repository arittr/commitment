#!/usr/bin/env bun
import { chmod } from 'node:fs/promises';
import { build } from 'bun';

// Build CLI entry point
await build({
  entrypoints: ['./src/cli.ts'],
  format: 'esm',
  minify: false,
  outdir: './dist',
  sourcemap: 'external',
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
