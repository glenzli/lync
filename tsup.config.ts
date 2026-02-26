import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['cjs'],
    target: 'node18',
    outDir: 'dist',
    clean: true,
    minify: true,
    noExternal: [/.*/],
    banner: {
        js: '#!/usr/bin/env node',
    },
});
