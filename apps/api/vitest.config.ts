import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    // esbuild strips emitDecoratorMetadata, which silently breaks Nest DI —
    // the swc plugin is mandatory for these tests
    swc.vite({ module: { type: 'commonjs' } }),
  ],
  test: {
    include: ['test/**/*.spec.ts'],
    // the suites share one database — no concurrent migrator runs
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
