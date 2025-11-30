import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import swc from 'unplugin-swc';
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Load test environment variables before tests run
const envPath = resolve(process.cwd(), '.env.test');
if (!existsSync(envPath)) {
  throw new Error(
    '.env.test file not found. E2E tests require database configuration. ' +
    'Create .env.test with POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB.'
  );
}

const result = config({ path: envPath });
if (result.error) {
  throw new Error(`Failed to load .env.test: ${result.error.message}`);
}

export default defineConfig({
  plugins: [tsconfigPaths(), swc.vite()],
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*-real.e2e-spec.ts'], // Only run tests that require real database
    setupFiles: ['reflect-metadata'],
  },
});
