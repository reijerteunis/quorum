# Type-aware linting is on for exactly one rule — 2026-08-27

**Decision:** `@typescript-eslint/no-deprecated` is enabled at error severity in `eslint.config.js`,
with the type information it requires (`parserOptions.projectService`, `tsconfigRootDir:
import.meta.dirname`). It is the **only** type-aware rule — not the `strict` or
`strict-type-checked` preset it ships in — and it covers exactly the file set ESLint already
covered, `packages/**/*.ts` and `apps/**/*.ts`, tests included. Nothing was added to `ignores` to
make it install, so `spike/**` stays outside ESLint's scope as it already was, and is the one tree
in this repository where a deprecated API is still undetectable. That is stated in
`harness/rules.md` rather than left to be discovered, because the spike is the port's independent
witness and "the workspace detects deprecated APIs" would otherwise read as covering it.

This **supersedes the sentence at `eslint.config.js:3`** — *"Type-aware linting is deliberately off
— `tsc --noEmit` owns types."* That sentence was never a decision entry, which is half of what went
wrong: the policy that cost something lived in a config comment, where nobody looks and nothing
cites it. What each gate owns, written down so the next person weighing a second type-aware rule
has something to argue against rather than a comment to contradict:

- **`tsc --noEmit` owns types.** Unchanged, and the superseded sentence was right about it. No rule
  enabled here duplicates a type error.
- **`pnpm lint` owns deprecation**, because `tsc` never did and never claimed to. `@deprecated` is
  an editor strikethrough to TypeScript and never an error, at any strictness. This is the general
  net: it catches the *next* deprecation, in any dependency, without anyone thinking to look.
- **`pnpm test` owns the pin, not the net.** A source-text assertion in `packages/shared`
  (`flow.test.ts`) refuses the one string this ticket migrated. It exists because
  `harness/harness.yaml`'s `commands.test` is `npm test --prefix spike && pnpm turbo run test` —
  two suites and neither gate — so a chore run's `integrate` cannot see a lint failure at all, and
  the rule above is enforced by CI alone. Whether `integrate` should run `lint` and `typecheck` is
  Q-0065's argument and is deliberately not taken here.

**Alternatives considered:**

**(a) The source-text assertion alone, with no rule.** Free, instant, and already precedented in
the same file (`flow.test.ts` greps every shared source for `.default(` and `.catch(`). Rejected as
the whole answer: it catches one string. The next deprecated API arrives unnoticed, which is the
failure this ticket exists to close rather than to re-file. It ships **as well**, for the gate
reason above, and its own comment says it is a pin and not the net.

**(b) The `strict` or `strict-type-checked` preset, which contains the rule.** Rejected: dozens of
rules nobody has read, arriving under one flag, in a repository whose lint config has held two
rules and an argument for each. One rule, argued for, is the whole change.

**(c) Leave it off and keep the prose rule.** `harness/rules.md` already told contributors to read
a dependency's typings before reaching for an unfamiliar method, and that instruction is what
produced the 21 calls — it was written by the audit that found them. A rule a gate cannot see is
advice, and advice is what was already in place while a landed, cross-vendor-reviewed ticket
accumulated 21 deprecated calls without either gate having anything to say.

**Why:** two green ticks stood over `packages/shared` while every one of its 21 `.passthrough()`
calls was deprecated, and **neither tick was lying about what it checked**. `tsc` does not error on
`@deprecated`; ESLint could not see it without type information; type information was off by a
decision that was correct about types and silent about deprecation. The gap was between the gates,
which is the repository's own named failure — *"a check that skips its subject must not report
success"* (2026-08-25) — reached through a configuration comment instead of a preflight. It is the
second time that shape has cost something in the same class of file: Q-0065 records `turbo.json`
declaring no `passThroughEnv`, so a test that needs an environment variable can never run. Both are
a good decision with a consequence nobody enumerated, sitting in a file that reads as settled.

The rule was demonstrated to have a subject before it was trusted: over the unmigrated tree it
reports **21 errors, every one `@typescript-eslint/no-deprecated` on `passthrough`, all under
`packages/shared/src`**, with the other six packages clean; over the migrated tree, none. A guard
whose only evidence is a green run has not been shown to have a subject.

**Cost accepted:** a dependency bump that deprecates something can turn `pnpm lint` red on code
nobody touched. That is the rule working, and it is still a real cost — mitigated by it being one
rule whose message names both the symbol and its replacement, and by `harness/rules.md`'s standing
instruction that such a migration is its own change rather than a passing fix. Type-aware parsing
also builds the program `tsc` already builds: measured at **+0.4s wall for the whole workspace**
(1.45s → 1.88s, `--force`, seven packages in parallel), not per package.

**Found by:** an audit of the workspace for deprecated APIs on 2026-08-27, which Ruud asked for.
Q-0069.
