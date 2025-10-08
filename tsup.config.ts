import { defineConfig } from 'tsup';

export default defineConfig([
  // Library build
  {
    clean: true,
    dts: true,
    entry: ['src/index.ts'],
    format: ['esm'],
    outDir: 'dist',
    platform: 'node',
    sourcemap: true,
    splitting: false,
    target: 'node18',
    treeshake: true,
  },
  // CLI build
  {
    banner: {
      js: '#!/usr/bin/env node',
    },
    dts: false,
    entry: ['src/cli.ts'],
    format: ['esm'],
    outDir: 'dist',
    platform: 'node',
    sourcemap: true,
    splitting: false,
    target: 'node18',
    treeshake: true,
  },
]);
