// @ts-ignore
import { viteConfig } from '@batoanng/vite-config';
import path from 'path';
import { fileURLToPath } from 'url';
import { mergeConfig } from 'vite';

export default mergeConfig(viteConfig, {
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      name: 'frontend-server',
      fileName: 'frontend-server',
    },
    rollupOptions: {
      external: ['fs', 'fs/promises', 'path', 'crypto', 'url'],
    },
    sourcemap: true,
  },
});
