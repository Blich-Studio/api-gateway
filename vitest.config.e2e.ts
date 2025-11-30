import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import swc from 'unplugin-swc';
import { config } from 'dotenv';

// Load test environment variables before tests run
config({ path: '.env.test' });

export default defineConfig({
  plugins: [tsconfigPaths(), swc.vite()],
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*-real.e2e-spec.ts'], // Only run real E2E tests
    setupFiles: ['reflect-metadata'],
  },
});
