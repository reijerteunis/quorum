// The one ESLint configuration for the workspace. It encodes three of the rules harness/rules.md
// states and nothing else enforced: no `any`, no `@ts-ignore`/`@ts-expect-error` without a reason,
// and no deprecated API.
//
// WHICH GATE OWNS WHAT. `tsc --noEmit` owns types; nothing here duplicates a type error, and no
// second type-aware rule is on. What `tsc` does NOT own is deprecation — `@deprecated` is an
// editor strikethrough to TypeScript and never an error — so until Q-0069 nobody owned it, and
// `lint` and `typecheck` both reported green over 21 deprecated calls in `packages/shared`.
// `@typescript-eslint/no-deprecated` is the rule that sees one, and it is the reason type-aware
// parsing is on below: for that rule alone, never for the `strict` preset it also ships in.
// See docs/DECISIONS.md, "Type-aware linting is on for exactly one rule" (2026-08-27).
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.turbo/**', '**/coverage/**'],
  },
  {
    // `apps/**/*.tsx` is here because a flat-config `**/*.ts` pattern does NOT match `.tsx`, so
    // until Q-0014 these three rules reached no line of the app — the largest body of new source in
    // M3 — while `lint` reported green over it. That is Q-0069's finding on a new corpus: `tsc
    // --noEmit` covers `.tsx` once `jsx` is configured, so `typecheck` was never the gap and `lint`
    // silently was. This widens a corpus and changes no policy: no rule is added, removed or
    // downgraded, and nothing is added to `ignores`.
    files: ['packages/**/*.ts', 'apps/**/*.ts', 'apps/**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        // Every package carries a `tsconfig.json` extending the base with no `include`, so the
        // service finds a project for every linted file and none needs `allowDefaultProject`
        // (requirements/errata.md E-2). `tsconfigRootDir` is `import.meta.dirname` rather than a
        // cwd-relative path because `lint` runs as `eslint .` from inside each package.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
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
      '@typescript-eslint/no-deprecated': 'error',
    },
  },
);
