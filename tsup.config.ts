import { defineConfig } from 'tsup';

const common = {
    format: ['cjs'] as const,
    target: 'node18',
    clean: true,
    minify: true,
    noExternal: [/.*/],
    esbuildOptions(options: any) {
        options.loader = { ...options.loader, '.md': 'text' };
    },
};

export default defineConfig([
    {
        ...common,
        entry: ['packages/core/src/index.ts'],
        outDir: 'packages/core/dist',
    },
    {
        ...common,
        entry: ['packages/cli/src/index.ts'],
        outDir: 'packages/cli/dist',
        banner: {
            js: '#!/usr/bin/env node',
        },
    },
    {
        ...common,
        entry: ['packages/console/src/index.ts'],
        outDir: 'packages/console/dist',
        banner: {
            js: '#!/usr/bin/env node',
        },
    },
]);
