import { defineSharedConfig } from '@blich-studio/eslint-config'

export default [
  ...defineSharedConfig({
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  }),
  {
    ignores: ['**/*.spec.ts', '**/*.e2e-spec.ts', 'test/**/*'],
  },
  {
    files: ['**/postgres.module.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },
]
