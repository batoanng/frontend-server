/// <reference types="vitest" />
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      // for TypeScript path alias import like : @/x/y/z
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
