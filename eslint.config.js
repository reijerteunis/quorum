// The one ESLint configuration for the workspace. It encodes the two rules harness/rules.md
// states and nothing else enforced: no `any`, and no `@ts-ignore`/`@ts-expect-error` without a
// reason. Type-aware linting is deliberately off — `tsc --noEmit` owns types.
// `spike/` is out of scope: it is plain Node ESM on npm and keeps its own tooling until Q-0009.
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.turbo/**', '**/coverage/**', 'spike/**'],
  },
  {
    files: ['packages/**/*.ts', 'apps/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': 'allow-with-description',
          'ts-expect-error': 'allow-with-description',
        },
      ],
    },
  },
);
