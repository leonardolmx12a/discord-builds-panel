import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import postcssNesting from 'postcss-nesting';

export default defineConfig({
    base: './',
    plugins: [
        react({
            jsxRuntime: 'classic',
        }),
    ],
    esbuild: {
        jsxInject: `import React from 'react'`,
    },
    resolve: {
        alias: [
            { find: /^components-sdk.*$/, replacement: resolve(__dirname, '../components-sdk/src') },
            { find: '@website', replacement: resolve(__dirname, '../website/src') },
        ],
    },
    css: {
        postcss: {
            plugins: [postcssNesting],
        },
    },
    server: {
        host: '127.0.0.1',
        port: 3100,
        proxy: {
            '/api': 'http://127.0.0.1:4783',
        },
    },
});
