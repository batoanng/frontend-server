/// <reference types="vitest" />
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@frontend-server': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
