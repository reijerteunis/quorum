# Q-0008 requirements — errata

`requirements/merged.md` was approved at a human gate on 2026-08-24 and is amended here rather
than silently edited. Each entry names the superseded clause, who found it and what changed. The
amendments are already applied in `merged.md`; this file is the record of why.

## 1. Criterion 1 — `engines.node` raised from `">=22"` to `">=22.13.0"` — 2026-08-24

**Superseded:** criterion 1's `engines: { "node": ">=22" }`, and the Risks entry "Node skew",
which read *"`engines` must be `">=22"`, never `"22.x"`"*.

**Found by:** the `code-reviewer` (codex) in the chore flow, run 2, iteration 1 — and restated
unchanged in iterations 2 and 3. It was the only finding in all three rounds.

**Why.** `">=22"` was a compatibility promise the scaffold cannot honour. `eslint@10.9.0` and
`eslint-visitor-keys@5.0.1` both declare `^20.19.0 || ^22.13.0 || >=24`, and `vite@8.2.2` with its
Rolldown bindings declares `>=22.12.0`; the effective floor is 22.13.0 against a declared floor of
22.0.0. The implementer tested the alternative the reviewer offered first, because it needed no
amendment — selecting dependencies that serve the full range — and proved it closed:
`eslint-visitor-keys` is a direct dependency of `@typescript-eslint/visitor-keys`, and criterion 4
names `typescript-eslint` as the sole supplier of `no-explicit-any` and `ban-ts-comment`, the two
rules that criterion exists to enforce. There is no dependency set satisfying criterion 4 and Node
22.0 at once. The downgrade also *added* a constraint rather than removing one: `@napi-rs/lzma`
at `^22.20`, on the platform `ubuntu-latest` runs.

The Risks entry's stated reason survives intact. Its objection was to `"22.x"` excluding Node 24 —
the maintainer runs v24.15.0 — and `">=22.13.0"` admits Node 24. The string changed; the reason
did not.

**Severity, for the record:** no `.npmrc` exists, so `engine-strict` is off and pnpm warns rather
than refuses. Nothing was breaking. The defect was a machine-readable claim the repository could
not back, which is worth fixing and was not urgent.

## 2. Criterion 7 — the `KEY|TOKEN` check narrowed to `env:` declarations — 2026-08-24

**Superseded:** criterion 7's verification `grep -iE '(KEY|TOKEN)' .github/workflows/ci.yml`
prints nothing.

**Found by:** the `developer-generalist` (claude) while verifying its own work, run 2.

**Why.** The same criterion mandates `actions/cache` to restore `.turbo` between runs, and
`actions/cache`'s required input is named `key:` — a name GitHub defines and the workflow cannot
change. The criterion therefore required a step that makes its own verification fail, and a
reviewer running the command literally would report a red check on a clean workflow. The BYOS
intent is unchanged and is what the narrowed check tests: no secret reference, and no environment
variable named for a credential.

## 3. Criterion 10 — `harness/harness.yaml` is absent from the branch diff, and that is correct

**Not an amendment; a note so the gate does not read it as a gap.**

Criterion 10 lists `harness/harness.yaml` in the expected changed-path set, per criterion 8. The
file already carries both keys criterion 8 asks for: they landed on `main` in `b389dbe`, the
requirements-approval commit, deliberately and before the chore run started. Criterion 8 itself
explains why the timing matters — `bin/harness.js:56` parses `harness.yaml` once at run start, so
an implementer editing it mid-run could not affect its own `integrate` step. Landing it on `main`
first is also what keeps the implementer's worktree from conflicting on those lines, since it
branches from a tree that already carries them.
