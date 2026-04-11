/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 3010,
        proxy: {
            '/api': {
                target: 'http://localhost:5010',
                changeOrigin: true,
            },
            '/socket.io': {
                target: 'http://localhost:5010',
                ws: true,
            },
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/shared/config/tests/setupTests.ts',
        css: false,
    },
});
