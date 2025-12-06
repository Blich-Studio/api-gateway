import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import swc from 'unplugin-swc';

export default defineConfig({
  plugins: [tsconfigPaths(), swc.vite()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['reflect-metadata'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.spec.ts',
        '**/*.e2e-spec.ts',
        '**/test/**',
        // Infrastructure modules - integration tested
        '**/modules/database/**',
        // Guards and decorators are simple wrappers - tested via integration
        '**/guards/**',
        '**/decorators/**',
        // Error class definitions - tested via usage in services
        '**/common/errors/**',
      ],
      thresholds: {
        // Per-file thresholds (80% minimum per file)
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
        perFile: true,
      },
    },
  },
});
