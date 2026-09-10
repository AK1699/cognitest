import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    // esbuild strips emitDecoratorMetadata, which silently breaks Nest DI —
    // the swc plugin is mandatory for these tests. Module type stays es6:
    // vitest 4 cannot be require()d from transformed-to-CJS test files.
    swc.vite({ module: { type: 'es6' } }),
  ],
  test: {
    include: ['test/**/*.spec.ts'],
    // the suites share one database — no concurrent migrator runs
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
