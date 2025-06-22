// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import peerDepsExternal from '@chrisneedham/rollup-plugin-peer-deps-external';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  // @ts-ignore nodeResolve type is not compatible with Vite
  plugins: [peerDepsExternal(), nodeResolve(), dts({ insertTypesEntry: true })],
  build: {
    target: 'esnext',
    lib: {
      entry: resolve(__dirname, './index.ts'),
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
      // for TypeScript path alias import like : @/x/y/z
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
