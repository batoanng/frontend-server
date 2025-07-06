// @ts-ignore
import { viteConfig } from '@batoanng/vite-config';
import peerDepsExternal from '@chrisneedham/rollup-plugin-peer-deps-external';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import dts from 'vite-plugin-dts';

import path from 'path';
import { fileURLToPath } from 'url';
import { mergeConfig } from 'vite';

export default mergeConfig(viteConfig, {
  plugins: [peerDepsExternal(), nodeResolve(), dts({ insertTypesEntry: true })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
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
});
