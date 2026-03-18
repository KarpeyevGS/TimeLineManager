import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig(({ command }) => ({
    plugins: [react()],
    base: command === 'serve' ? '/' : './',
    resolve: {
        alias: {
            "@": path.resolve(process.cwd(), "./src"),
        },
    },
}));
