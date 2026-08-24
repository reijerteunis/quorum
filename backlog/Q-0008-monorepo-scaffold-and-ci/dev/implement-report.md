# Q-0008 — implementation report

*`developer-generalist`, chore flow. Revision round: the scaffold was built in the previous run and is carried on this branch; the requirement has since been amended (`requirements/errata.md`). This report covers the whole branch diff, because that is what the reviewer reads beside it, and marks clearly which parts changed **this** round.*

---

## 1. What this round changed

Three review iterations produced exactly one finding, restated unchanged each time: the declared `engines.node` range is wider than the locked toolchain supports. The requirement was amended for it on 2026-08-24 (`requirements/errata.md` §1; criterion 1 now reads `">=22.13.0"`). Two files changed.

### `package.json` — `engines.node` from `">=22"` to `">=22.13.0"`

The finding is real and the amendment is the right resolution. The alternative the reviewer offered first — "select maintained dependencies that support the full declared range" — is closed, and the errata records why: `eslint-visitor-keys@5.0.1` declares `^20.19.0 || ^22.13.0 || >=24`, and it is a direct dependency of `@typescript-eslint/visitor-keys`. Criterion 4 names `typescript-eslint` as the sole supplier of `no-explicit-any` and `ban-ts-comment` — the two rules that criterion exists to enforce — so there is no dependency set satisfying criterion 4 and Node 22.0 at once. `vite@8.2.2` and its Rolldown bindings add `>=22.12.0` independently.

The Risks entry's stated reason survives intact: its objection was to `"22.x"` excluding Node 24, and `">=22.13.0"` still admits Node 24, which is what the maintainer runs (v24.15.0). The string changed; the reason did not.

`pnpm-lock.yaml` did **not** need regenerating — `engines` is not recorded in a v9 lockfile, and `pnpm install --frozen-lockfile` reports *"Lockfile is up to date"* after the edit.

### `.gitignore` — `.turbo` to `.turbo/`, `coverage` to `coverage/`

Criterion 6 specifies these two entries with trailing slashes, and every existing directory entry in the file (`node_modules/`, `.quorum/`, `.harness/`, `dist/`) uses that form. The previous round wrote them without. Both forms pass the criterion's verification, so this is literal conformance and consistency with the file's own style rather than a defect fix — flagged here so it is not read as unrequested churn. The slash also narrows each pattern to a directory, which is what both entries name.

**Nothing else changed this round.** The changed-path set is byte-for-byte the same list as before, which is criterion 10's whole point.

---

## 2. The branch, file by file

### Workspace root

| File | What it is |
| --- | --- |
| `package.json` | `private: true`, `type: module`, `packageManager: "pnpm@10.31.0"`, `engines.node: ">=22.13.0"`. Three scripts, each delegating: `lint`/`typecheck`/`test` to `turbo run <task>`. **No `bin` field** — the binary is Q-0010's. |
| `pnpm-workspace.yaml` | Exactly `packages/*` and `apps/*`. `spike` is neither listed nor matched by a glob. |
| `pnpm-lock.yaml` | `lockfileVersion: '9.0'`, written by the pinned pnpm 10.31.0. |
| `.nvmrc` | `22`. The single Node pin; CI reads it through `node-version-file` rather than repeating a version. |
| `tsconfig.base.json` | The only file in the repository with `compilerOptions` (see §3). |
| `eslint.config.js` | The only ESLint configuration in the repository (see §4). |
| `turbo.json` | Three tasks, explicit empty `outputs`, default `inputs`, no `build` task (see §5). |
| `vitest.shared.js` | The one Vitest configuration; each package re-exports it in one line. |
| `.gitignore` | Gains `.turbo/`, `coverage/` and `*.tsbuildinfo` beside the six existing entries. |
| `.github/workflows/ci.yml` | Two jobs (see §6). |

### The seven packages

`packages/core`, `packages/server`, `packages/cli`, `packages/compiler`, `packages/templates`, `packages/shared`, `apps/web` — exactly the seven boundaries `docs/04-architecture.md` draws, and no eighth registered directory. Each is identical in shape:

- `package.json` — `private: true`, name `@quorum/<dir>`, `type: module`, the three scripts (`eslint .`, `tsc --noEmit`, `vitest run`). **No `dependencies` key in any of them**; the first runtime dependency to appear here is a port that started early.
- `tsconfig.json` — one key, `"extends": "../../tsconfig.base.json"`. No `compilerOptions`.
- `src/index.ts` — one line, `export const name = '@quorum/<dir>';`. Seven lines across all seven packages, against criterion 2's ceiling of fifty.
- `src/index.test.ts` — one Vitest test asserting that constant.
- `vitest.config.js` — `export { default } from '../../vitest.shared.js';`, the re-export criterion 5 permits, so a package runs on its own without diverging from the shared config.

`apps/web` additionally has `vite.config.ts` — `defineConfig({})` and nothing else. No React, no router, no theme, no build target. That is M3 and Q-0014.

`packages/templates` ships **no** harness assets. `spike/templates/harness/**` stays where it is until Q-0009 moves it.

### `docs/04-architecture.md`

Status line only, bumped to record that the scaffold now exists, dated 2026-08-24, naming Q-0008 and stating that the seven boundaries drawn below it are now real directories, empty on purpose until Q-0009. No structural edit to the document.

---

## 3. TypeScript: the choices criterion 3 asks me to state

`tsconfig.base.json` is the single source, and nothing re-declares or weakens it.

| Option | Value | Reason |
| --- | --- | --- |
| `strict` | `true` | The requirement, and `harness/rules.md`. |
| `module` | `nodenext` | Quorum is a Node ≥ 22 ESM program that reads and writes files and spawns vendor CLIs. `nodenext` is the only setting that models Node's actual ESM/CJS resolution, so the compiler enforces the extension-bearing specifiers Node requires at runtime instead of accepting bundler-shaped imports that would fail on execution. |
| `moduleResolution` | `nodenext` | Forced by `module: nodenext`, and correct for the same reason. |
| `target` | `es2023` | Node 22 implements ES2023 fully; a lower target would downlevel output for a runtime that does not need it. |
| `skipLibCheck` | `true` | Not a relaxation on our own code — it skips type-checking `.d.ts` files inside dependencies, whose errors we cannot fix and which are not evidence about this repository. It keeps `typecheck` proportional to the code that is ours. |

**No additional strictness flags** (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and friends) were added. There is no code to hold to them yet; turning one on later against seven one-line files is free, whereas turning on one that Q-0009's port cannot satisfy would be a decision taken on that ticket's behalf — the thing this role is told not to do. Flagged as Q-0009's call.

**Verified, not asserted:** appending `const n: number = "x";` to `packages/core/src/index.ts` makes `pnpm typecheck` exit non-zero with `src/index.ts(2,7): error TS2322: Type 'string' is not assignable to type 'number'.` and `Failed: @quorum/core#typecheck`. Reverted; the subsequent full run returns `FULL TURBO` on all three tasks, which is itself proof the revert was byte-exact — a changed input could not hit the cache.

---

## 4. ESLint

`eslint.config.js` is the only ESLint configuration in the repository — `git ls-files | grep -i eslint` prints one path. Flat config. It applies to `packages/**/*.ts` and `apps/**/*.ts`, and ignores `node_modules`, `dist`, `.turbo`, `coverage` and `spike/**`.

It sets exactly the two rules `harness/rules.md` states and nothing has ever enforced:

- `@typescript-eslint/no-explicit-any: 'error'`
- `@typescript-eslint/ban-ts-comment`, with `ts-ignore` and `ts-expect-error` both set to `allow-with-description`

Type-aware linting is **off**, per the criterion: `tsc` owns types, ESLint owns style, and a type-aware pass doubles CI time for packages that are currently one line each. Q-0009 may turn it on if it earns it.

**Both rules verified firing:**

- `const x: any = 1;` in `packages/shared/src/index.ts` — `pnpm lint` exits non-zero, `Failed: @quorum/shared#lint`.
- An undescribed `// @ts-ignore` — `error  Include a description after the "@ts-ignore" directive to explain why the @ts-ignore is necessary … @typescript-eslint/ban-ts-comment`, exit 1.

Both reverted.

---

## 5. Turbo and Vitest

`turbo.json` declares `lint`, `typecheck` and `test`. Each carries an explicit `outputs: []` — none of the three emits anything, so a cache hit means the task genuinely had nothing to do rather than that its output was restored. `inputs` are left at the default deliberately: narrowing them is how a cache reports success for a task that never saw the changed file. `globalDependencies` lists `tsconfig.base.json`, `eslint.config.js`, `vitest.shared.js` and `.nvmrc`, so editing a root config invalidates every package instead of silently hitting cache.

**No `build` task ships** — `grep -c '"build"' turbo.json` prints `0`. Nothing emits yet; Q-0009 adds it with the first package that does. No remote cache, no account, no signing secret.

Every package's `test` script is `vitest run`, never bare `vitest`. Bare `vitest` watches, and `harness.yaml`'s `commands.timeout_ms` is 900000 — a watching suite would burn fifteen minutes and then report as a timeout rather than as a mistake, in CI and at `integrate` alike.

**Verified:** `pnpm test` gives 7 tasks successful of 7 total, sub-second, and returns to the prompt. A second consecutive run gives `Tasks: 7 successful … Cached: 7 cached, 7 total … >>> FULL TURBO`. `pnpm --filter @quorum/core test` gives `Test Files 1 passed (1)` — one suite, not seven.

---

## 6. CI

`.github/workflows/ci.yml`, triggering on `push` and `pull_request`, two jobs on `ubuntu-latest`:

**`workspace`** — checkout, `pnpm/action-setup` (pnpm taken from the root `packageManager` field), `actions/setup-node` with `node-version-file: .nvmrc` so the Node pin lives in one place, `pnpm install --frozen-lockfile`, `actions/cache` restoring `.turbo` between runs, then `pnpm lint`, `pnpm typecheck` and `pnpm test` as three separate steps so a failure names which task failed.

**`spike`** — checkout, the same Node version from `.nvmrc`, then a git identity, then `npm ci` and `npm test` with `working-directory: spike`. The identity step is not optional: the suite drives the engine, which commits worktrees with the *ambient* identity, and a bare runner has none — the first commit would fail before a single check ran. Running the spike on Node 22 also surfaces whatever its `engines: ">=20"` currently permits; surfacing it is the correct outcome, and fixing it is not this ticket's business.

Without this second job the badge would mean "seven placeholder tests pass" while claiming to mean "the tests pass". Until Q-0009 ports it, the spike suite is the only regression evidence this repository has.

**BYOS verified:** `grep -c 'secrets\.' .github/workflows/ci.yml` prints `0`, and `grep -n 'env:' .github/workflows/ci.yml` prints nothing — the workflow declares no `env:` block at all, so there is no environment variable named for a credential. This is the check as amended by `requirements/errata.md` §2; the original `grep -iE '(KEY|TOKEN)'` matched `actions/cache`'s required `key:` input, which the same criterion mandates.

No release, publish, deploy or dependency-update automation. No matrix.

---

## 7. The spike, and the harness command

`git diff --name-only main...HEAD -- spike/` prints **nothing**. Not one file under `spike/` is changed. It stays outside the pnpm workspace, outside ESLint's scope and outside turbo's task graph, and keeps npm with its own `package-lock.json`.

`harness/harness.yaml` already carries both keys criterion 8 asks for:

    install: npm install --prefix spike --no-audit --no-fund --silent && pnpm install --frozen-lockfile
    test:    npm test --prefix spike && pnpm turbo run test

**Their absence from the branch diff is correct, not a gap**, and `requirements/errata.md` §3 explains why: they landed on `main` in `b389dbe`, the requirements-approval commit, deliberately and before this run started. `bin/harness.js:56` parses `harness.yaml` once at run start, so an implementer editing it mid-run could not affect its own `integrate` step; landing it on `main` first also keeps this worktree from conflicting on those lines. The reviewer should not read criterion 10's mention of `harness/harness.yaml` as a missing path here.

---

## 8. Verification log

Run in this worktree, from the amended state, after every negative test was reverted.

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | `Lockfile is up to date` · `Already up to date` · exit 0 |
| `pnpm ls -r --depth -1` | root `quorum` plus seven `@quorum/*`, all `(PRIVATE)`, no `spike` |
| `pnpm lint` | 7 successful, 7 total |
| `pnpm typecheck` | 7 successful, 7 total |
| `pnpm test` | 7 successful, 7 total, sub-second, no watch |
| `pnpm test` (repeat) | 7 cached, 7 total, `>>> FULL TURBO` |
| `pnpm --filter @quorum/core test` | 1 test file, 1 test |
| type error, then `pnpm typecheck` | exit 2, `TS2322`, `Failed: @quorum/core#typecheck` — reverted |
| `any`, then `pnpm lint` | exit 1, `no-explicit-any`, `Failed: @quorum/shared#lint` — reverted |
| undescribed `@ts-ignore`, then lint | exit 1, `ban-ts-comment` — reverted |
| `grep -rn "spike" packages apps --include="*.ts" --include="*.json"` | no output |
| `grep -l '"dependencies"' <all seven package.json>` | no output |
| `wc -l <all seven src/index.ts>` | `7 total`, against a ceiling of 50 |
| `grep -n 'compilerOptions' <all seven tsconfig.json>` | no output |
| `git ls-files | grep -i eslint` | `eslint.config.js` — one path |
| `grep -c '"build"' turbo.json` | `0` |
| `grep -c 'secrets\.' .github/workflows/ci.yml` | `0` |
| `grep -n 'env:' .github/workflows/ci.yml` | no output |
| `git status --short` with `.turbo/` and `node_modules/` present | only the two intended edits; both new ignore patterns bite |
| `git diff --name-only main...HEAD -- spike/` | no output |
| `git diff --name-only main...HEAD -- README.md CLAUDE.md docs/DECISIONS.md` | no output |
| `git diff --name-only main...HEAD` | exactly criterion 10's list — see §11 |

**On the "pnpm does not hoist" risk.** It is closed, and by mechanism rather than by luck: no package declares a devDependency, and every package's scripts nonetheless resolve `eslint`, `tsc` and `vitest`, because resolution walks up from `packages/<x>/` to the workspace root's `node_modules`, where pnpm installs root devDependencies directly. All seven packages ran all three tasks. `apps/web`'s `tsc --noEmit` type-checks `vite.config.ts` and resolves `vite`'s types the same way.

---

## 9. Two things I could not close — reported, not improvised around

**(a) I could not execute the spike suite in this worktree.** The sandbox this run executes in denies `npm install` and `npm ci`, and denies reads outside the worktree, so `spike/node_modules` cannot be populated. `npm test --prefix spike` therefore fails here with `ERR_MODULE_NOT_FOUND` on a missing dependency — an environment fact, not a repository one. What *is* established: `spike/` is byte-identical to `main`, so its greenness is exactly `main`'s, and the CI `spike` job is what proves it on Node 22. **The reviewer should run `npm install --prefix spike --no-audit --no-fund --silent && npm test --prefix spike` and record the result.** Criterion 8 asks for that check and I am reporting the gap rather than claiming it.

**(b) Criterion 2's `wc -l` check does not test its own intent.** The criterion says `pnpm ls -r --depth -1 | wc -l` prints `8`. It prints **`15`** — pnpm separates entries with blank lines, so eight entries occupy fifteen lines. The substance is satisfied (root plus seven packages, no eighth registered workspace, none of them `spike`); the command is simply not a test of it, and a reviewer running it literally would report a red check against a correct scaffold. This is the same shape as `requirements/errata.md` §2, where criterion 7's `KEY|TOKEN` grep matched the `key:` input the same criterion mandates. The command that tests the intent is `pnpm ls -r --depth -1 | grep -c .`, which prints `8`. **This wants an errata entry at the gate; I have not edited the requirement, which is not mine to edit.**

---

## 10. For the owner at the gate — criterion 9's two items

Both fall outside this role's write authority: `harness/roles/developer-generalist.md` forbids appending to `docs/DECISIONS.md`, and `CLAUDE.md` is not in its path list. Naming them here is what the criterion asks of me.

**(a) `CLAUDE.md` carries a sentence this ticket makes false.** It reads:

> *"Until M2 lands, the runnable code is the spike in `spike/` (plain Node ESM)."*

The workspace now exists. A replacement needs three facts: that the workspace exists and is deliberately empty; that the spike remains the regression suite until Q-0009 retires it; and that this repository now has **two commands called "lint"** — `pnpm lint` lints TypeScript under `packages/**` and `apps/**`, while flows are still linted by `node spike/bin/harness.js lint`. The last one is a trap worth one explicit sentence, because the two share a name and a repository and overlap in neither scope nor implementation.

**(b) One decision entry for `docs/DECISIONS.md`:** *the spike stays outside the pnpm workspace, on npm, and is run as its own CI job and its own half of the repository's test command, until Q-0009 retires it.* The alternatives it should name: making the spike a workspace package — rejected, because its runner is not Vitest, its `lint` script is the flow linter rather than ESLint, and `--frozen-lockfile` would then govern a lockfile npm wrote; and not running it in CI at all — rejected, because it is the only regression evidence M1 produced, and a green badge that skips it means "the scaffold parses" while claiming to mean "the tests pass".

No other dependency needs a decision entry: `docs/04-architecture.md` already names pnpm, Turborepo, TypeScript strict, Node ≥ 22, Vitest, ESLint and Vite.

### devDependency justifications

All six are root-only, and all six are named by `docs/04-architecture.md`.

| Package | Version | One line |
| --- | --- | --- |
| `turbo` | `^2.10.11` | The task graph and cache the ticket specifies. |
| `typescript` | `^5.9.3` | `tsc --noEmit` is the `typecheck` task. |
| `eslint` | `^10.9.0` | The lint pass. |
| `typescript-eslint` | `^8.67.0` | Supplies the TypeScript parser and the two rules criterion 4 enforces; nothing else provides `no-explicit-any` or `ban-ts-comment`. |
| `vitest` | `^4.1.11` | The test runner the spike's suite becomes in Q-0009. |
| `vite` | `^8.2.2` | Required by `apps/web/vite.config.ts`; the placeholder, not a build decision. |

---

## 11. Deliberately left alone

Everything in the ticket's non-goals, and specifically:

- **No publish, release, versioning or changesets machinery.** No `CHANGELOG.md`, no npm name reservation. Q-0010 and M6 own that.
- **No engine code.** Not one function from `spike/src/**` moved. No zod schema (Q-0009). The spike's smoke suite was not copied into a workspace package.
- **No `build` task**, no emitted output, no `dist` anywhere.
- **No bespoke verification script.** No `verify:scaffold`, no `verify:ci`. Every criterion above is checked by a stock command; a script written by this change could not be the evidence this change is correct.
- **No `apps/web` beyond the Vite placeholder** — no React, Tailwind, theme, routing or state management.
- **No harness assets in `packages/templates`.** `spike/templates/harness/**` untouched.
- **No commit hooks**, no husky, no lint-staged. CI is the enforcement point.
- **No Node or OS matrix**, no coverage thresholds, no type-aware lint, no remote turbo cache, no Playwright, no adapter probe in CI, no real-CLI CI run.
- **No inter-package imports, APIs, event formats or runtime dependencies.** No package depends on another; the workspace graph is deliberately flat and empty.
- **No `.npmrc`.** Criterion 10's path list does not include one, so none was created — which is also why `engine-strict` is off and the `engines` field warns rather than refuses. `requirements/errata.md` §1 records that as the reason this round's finding was worth fixing but was never breaking.
- **No flow, role, context file, ticket format, glossary term or development-plan edit.** The only `harness/` change this ticket needed was already on `main` (§7).
- **No `README.md`, `CLAUDE.md` or `docs/DECISIONS.md` edit** — §10 routes the last two to the owner at the gate.
- **No `backlog/` file written**, per the role.
- **Nothing committed.** The harness commits this worktree.

`git diff --name-only main...HEAD` is exactly `.github/workflows/ci.yml`, `.gitignore`, `.nvmrc`, `apps/web/**` (five files), `docs/04-architecture.md`, `eslint.config.js`, `package.json`, `packages/**` (thirty files), `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `turbo.json` and `vitest.shared.js` — forty-six paths, nothing extra, with `harness/harness.yaml` accounted for in §7 and this ticket's folder written by the harness rather than by me.
