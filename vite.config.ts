import { viteConfig } from '@batoanng/vite-config';
import { mergeConfig } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';

export default mergeConfig(viteConfig, {
  build: {
    target: 'esnext',
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'frontend-server',
      fileName: 'frontend-server',
    },
    rollupOptions: {
      external: ['fs', 'fs/promises', 'path', 'crypto', 'url'],
    },
    sourcemap: true,
    minify: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
