# Q-0008 — implementation report (chore, iteration 3)

*Revision round. Iterations 1 and 2 raised one finding, identically worded both times. This round tested the fix the reviewer proposed, found it does not work, and reverted. **No file changed this round** — the worktree is byte-identical to the commit under review. What is new is the evidence, below, which narrows the finding to a single decision the owner has to take at the gate.*

---

## 1. The open finding: `engines.node: ">=22"` versus the toolchain

**The finding is correct.** Root `package.json` declares `engines: { "node": ">=22" }`. The shipped tree does not support all of that range:

| package | engines | excludes |
| --- | --- | --- |
| `eslint@10.9.0` | `^20.19.0 \|\| ^22.13.0 \|\| >=24` | 22.0 – 22.12 |
| `eslint-visitor-keys@5.0.1` | `^20.19.0 \|\| ^22.13.0 \|\| >=24` | 22.0 – 22.12 |
| `vite@8.2.2` (+ 15 `@rolldown/binding-*`) | `^20.19.0 \|\| >=22.12.0` | 22.0 – 22.11 |

Effective floor: **Node 22.13.0**. Declared floor: **22.0.0**.

Iteration 2 named two resolutions: *"either raise the declared minimum to `>=22.13.0` or select maintained dependencies that support the full declared range"*, prefaced by *"Resolve the requirements conflict, then …"*. I took the second one first, because it is the one that needs no authorisation.

### 1.1 I built the downgrade. It does not remove the floor.

Set `eslint: ^9.39.5` and `vite: ^6.4.3`, regenerated `pnpm-lock.yaml` with the pinned pnpm 10.31.0, and ran everything:

```
pnpm lint       → Tasks: 7 successful, 7 total
pnpm typecheck  → Tasks: 7 successful, 7 total
pnpm test       → Tasks: 7 successful, 7 total
```

Green — and still broken, for four separate reasons.

**(a) The 22.13 floor survives, because it is not ESLint's.** In the downgraded lockfile:

```yaml
'@typescript-eslint/visitor-keys@8.67.0':
  dependencies:
    '@typescript-eslint/types': 8.67.0
    eslint-visitor-keys: 5.0.1        # engines: ^20.19.0 || ^22.13.0 || >=24
```

`eslint-visitor-keys@5.0.1` is a **direct dependency of `@typescript-eslint/visitor-keys`**, not a peer and not ESLint's. It is present in *both* lockfiles — I diffed them. And `typescript-eslint` is the package **criterion 4 requires by name**: it is the sole supplier of `@typescript-eslint/no-explicit-any` and `@typescript-eslint/ban-ts-comment`, the two rules criterion 4 exists to enforce. There is no version of criterion 4 without it, and therefore no dependency selection that satisfies criterion 4 and Node 22.0 simultaneously.

**(b) It raises the floor on CI's own platform.** Vite 6 uses Rollup where Vite 8 uses Rolldown, and Rollup 4.62.5 carries:

```yaml
'@napi-rs/lzma-linux-x64-gnu@1.5.1':
  engines: {node: ^22.20 || ^24.12 || >=25}
  cpu: [x64]   os: [linux]   libc: [glibc]
```

That is `linux-x64-gnu` — the platform `ubuntu-latest` runs. It is an optional dependency, so the practical effect is a skip-or-warn rather than a hard failure, but the declared floor on the runner goes from 22.13 to **22.20**. It is absent from the shipped lockfile (`grep -c "napi-rs/lzma"` → `0`). The downgrade adds a constraint instead of removing one.

**(c) It ships a linter that is out of support.** pnpm prints it on install:

```
WARN deprecated eslint@9.39.5: This version is no longer supported.
     Please see https://eslint.org/version-support for other options.
```

A scaffold's defaults propagate into every ticket after it. Pinning an EOL major as the repository's linter is a worse standing cost than the gap it was meant to close.

**(d) It adds an install warning for every contributor.** Vite 6 pulls `esbuild@0.25.12`, whose postinstall pnpm 10 blocks by default:

```
Ignored build scripts: esbuild@0.25.12.
Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.
```

Silencing it means adding `onlyBuiltDependencies` or `ignoredBuiltDependencies` to `pnpm-workspace.yaml` — deciding, on the maintainer's behalf, whether a dependency may run arbitrary code at install time. Criterion 1 says `pnpm-workspace.yaml` lists exactly `packages/*` and `apps/*`, and that is not a decision a scaffold should take unasked.

**I reverted.** `package.json` and `pnpm-lock.yaml` are restored; regenerating the lockfile from the restored `package.json` produced a byte-identical file, which incidentally re-verifies criterion 1's last clause — the committed lockfile is reproducible under the pinned pnpm.

### 1.2 What is left, and why it is not mine

Path (a) is closed by criterion 4. That leaves the reviewer's path (b): **a requirements change**. Criterion 1 states the value verbatim —

> `engines: { "node": ">=22" }`

— and the Risks section reinforces it: *"`engines` must be `">=22"`, never `"22.x"`"*. My role's instruction is that the merged requirement's acceptance criteria are the whole specification, and that I stop and report rather than choose where it does not cover a case. The reviewer agrees the authority sits elsewhere: *"obtain a requirements change before raising the repository's minimum Node version."* So I have not raised it.

**The amendment I recommend, for the owner at the gate.** Change criterion 1's `engines` to `">=22.13.0"`, and nothing else.

- It matches the measured floor exactly.
- It **preserves the Risks section's stated rationale**. That rationale is *"never `"22.x"`, or the scaffold refuses to install on the machine that built it"* — the objection is to excluding Node 24, and the maintainer runs v24.15.0. `">=22.13.0"` does not exclude Node 24. The literal string changes; the reason behind it is honoured.
- `.nvmrc` stays `22`, which is already correct: `actions/setup-node`'s `node-version-file` resolves `22` to the latest 22.x, currently well above 22.13.
- It costs one line and no dependency churn.

The alternative — accept the deprecated-ESLint tree from §1.1 to serve Node 22.0–22.12 — buys a range nobody in this project uses and does not even deliver it, since the floor stays at 22.13 regardless.

**Severity note, so the gate can size this.** No `.npmrc` exists, so `engine-strict` is off and pnpm's default behaviour on an `engines` mismatch is a warning, not a refusal. The defect is that the repository advertises support it does not have — a documentation-grade dishonesty in a machine-readable field, which is worth fixing and is not currently breaking any install.

---

## 2. Two further requirement defects found while verifying

Neither was raised in iterations 1 or 2. Both are the requirement's, not the diff's, and both are for the owner.

**Criterion 7's verify command contradicts criterion 7's prose.** The prose says the workflow *"defines no environment variable whose name contains `KEY` or `TOKEN`"* — satisfied, and strongly: the workflow has **no `env:` block at all** (`grep -n "env:" .github/workflows/ci.yml` → nothing) and no `secrets.` reference (`grep -c 'secrets\.'` → `0`). But the stated verification is `grep -iE '(KEY|TOKEN)' .github/workflows/ci.yml` *prints nothing*, and it prints two lines:

```
23:          key: turbo-${{ runner.os }}-${{ github.sha }}
24:          restore-keys: turbo-${{ runner.os }}-
```

Those are `actions/cache`'s required inputs — and the same criterion mandates `actions/cache` (*"with `.turbo` restored between runs by `actions/cache`"*). The criterion requires a step that makes its own check fail; the input is named `key` by GitHub and cannot be renamed. A reviewer running the command literally will see a red check on a workflow that is clean. Suggested narrowing, which expresses the BYOS intent and passes: `grep -n "env:" .github/workflows/ci.yml` and `grep -c 'secrets\.'`.

**Criterion 8's `harness/harness.yaml` edit is already on `main`.** It landed in `b389dbe` (*"feat(backlog): Q-0008 requirements approved; integrate now gates both suites"*), the requirements-approval commit, so `harness/harness.yaml` is **absent from this branch's `git diff --name-only main...HEAD`** even though criterion 10 lists it as an expected changed path. It is not a gap — the file on `main` already carries both keys criterion 8 asks for:

```yaml
install: npm install --prefix spike --no-audit --no-fund --silent && pnpm install --frozen-lockfile
test:    npm test --prefix spike && pnpm turbo run test
```

Criterion 10's reviewer runs the changed-path check *first, before opening any file*; this is the one entry that will look missing and is not.

---

## 3. Changes this round

**None.** `git status --short` is empty and `git diff --stat HEAD` is empty. The eslint-9/vite-6 experiment of §1.1 was built, measured and reverted in full.

---

## 4. File-by-file inventory of the change under review

Unchanged from the reviewed commit; restated so the reviewer can read this beside the diff without re-deriving it.

### Root

| file | what it does |
| --- | --- |
| `package.json` | `private`, `type: module`, `packageManager: pnpm@10.31.0`, `engines.node: ">=22"`, three scripts each delegating to `turbo run <task>`. **No `bin` field** — that is Q-0010's. Six devDependencies, all root-level. |
| `pnpm-workspace.yaml` | Exactly `packages/*` and `apps/*`. `spike` is neither listed nor glob-matched. |
| `pnpm-lock.yaml` | Generated by the pinned pnpm 10.31.0; reproducible — regenerating it this round produced a byte-identical file. |
| `.nvmrc` | `22`. Single source of the CI Node version via `node-version-file`. |
| `tsconfig.base.json` | The only file with `compilerOptions`. See §5. |
| `eslint.config.js` | The only ESLint config in the repository. Flat config over `packages/**/*.ts` and `apps/**/*.ts`; ignores `node_modules`, `dist`, `.turbo`, `coverage`, `spike/**`. Two rules, both from `harness/rules.md`. Type-aware linting deliberately off. |
| `turbo.json` | `lint`, `typecheck`, `test`, each with `outputs: []`. `inputs` left at the default on purpose. No `build` task. `globalDependencies` names the four shared root files so a change to any of them busts the cache. |
| `vitest.shared.js` | The one Vitest config: `include: ['src/**/*.test.ts']`. |
| `.gitignore` | Adds `.turbo`, `coverage`, `*.tsbuildinfo` beside the existing six entries. |

*One deviation from the requirement's literal text, stated rather than left for the reviewer to find:* criterion 6 writes the additions as `.turbo/` and `coverage/` with trailing slashes; the file uses the slashless form. A trailing slash restricts a pattern to directories, and `git check-ignore coverage` is evaluated against a path that does not exist on a clean clone — so the slashless form is what reliably satisfies criterion 6's own verification. `git status --ignored --short` confirms every `.turbo/` is excluded.

### Packages — `core`, `server`, `cli`, `compiler`, `templates`, `shared`, and `apps/web`

Seven, each identical in shape and each empty on purpose:

- `package.json` — `private`, `@quorum/<dir>`, `type: module`, the three scripts. `test` is `vitest run`, never bare `vitest`. **No `dependencies` key in any of the seven.**
- `tsconfig.json` — one key: `"extends": "../../tsconfig.base.json"`. No package re-declares or weakens a compiler option.
- `vitest.config.js` — `export { default } from '../../vitest.shared.js';` (one line).
- `src/index.ts` — one line, `export const name = '@quorum/<dir>';`. Seven files, seven lines total.
- `src/index.test.ts` — asserts that constant.

`apps/web` additionally has `vite.config.ts`: `import { defineConfig } from 'vite'; export default defineConfig({});` — two lines. No React, router, theme or build decision. `packages/templates` ships no harness assets; `spike/templates/harness/**` is untouched.

### CI — `.github/workflows/ci.yml`

Two jobs on `push` and `pull_request`.

- **`workspace`** — checkout, `pnpm/action-setup` (version from root `packageManager`), `setup-node` with `node-version-file: .nvmrc` and `cache: pnpm`, `pnpm install --frozen-lockfile`, `actions/cache` over `.turbo`, then `pnpm lint`, `pnpm typecheck`, `pnpm test` as three separate steps so a failure names which task failed.
- **`spike`** — checkout, same Node, **`git config --global user.email`/`user.name`**, then `npm ci` and `npm test` in `spike/`. The git identity is load-bearing: the suite drives the engine, which commits worktrees with the ambient identity, and a bare runner has none.

No `env:` block, no `secrets.`, no release, publish, deploy or dependency-update automation. No matrix.

### `docs/04-architecture.md`

Status line only — one line, bumped with today's date and what changed, per the docs rule.

---

## 5. Compiler options and dependencies, with reasons

Criterion 3 requires `module` and `moduleResolution` stated with a reason here; criterion 9 requires a one-line justification per new devDependency.

**`tsconfig.base.json`:**

- `"module": "nodenext"` and `"moduleResolution": "nodenext"` — the workspace targets Node ≥ 22 running native ESM, and `nodenext` is the only pair that models Node's real resolver: it enforces the `.js` extension on relative ESM imports (which is why the placeholder tests import `'./index.js'`) and honours `exports` maps and the `"type": "module"` boundary. Anything else lets code typecheck here and fail at runtime under Node, and Q-0009 is about to port a real Node program into these packages.
- `"strict": true` — criterion 3, and `harness/rules.md`.
- `"target": "es2023"` — the language level Node 22 implements without downlevelling. Stated because criterion 3 asks for any additional flag to carry a reason.
- `"skipLibCheck": true` — typechecks this repository's source, not its dependencies' shipped `.d.ts` files. Without it `pnpm typecheck` reports errors no one here can fix.

**devDependencies:**

- `turbo` — the task graph and cache criteria 5 and 6 specify.
- `typescript` — `tsc --noEmit` is the `typecheck` task.
- `vitest` — the runner criterion 5 names.
- `eslint` — the linter criterion 4 names.
- `typescript-eslint` — supplies the parser and both rules criterion 4 requires; nothing else provides `no-explicit-any` or `ban-ts-comment`. *(This is the package that sets the Node 22.13 floor — see §1.1.)*
- `vite` — needed twice over: `apps/web/vite.config.ts` imports `defineConfig` from it, and it is Vitest's peer, so it is in the tree regardless.

All six are root-level. pnpm does not hoist, but `pnpm run` puts the workspace root's `node_modules/.bin` on PATH alongside the package's own, so each package's `eslint .` / `tsc --noEmit` / `vitest run` resolves — confirmed by running `pnpm --filter @quorum/core test` from a workspace with no per-package devDependencies. `docs/04-architecture.md` already names pnpm, Turborepo, TypeScript strict, Node ≥ 22, Vitest, ESLint and Vite, so none of the six needs its own DECISIONS entry.

---

## 6. Verification — every criterion, run in this worktree

| # | check | result |
| --- | --- | --- |
| 1 | `pnpm install --frozen-lockfile` | `Lockfile is up to date, resolution step is skipped` |
| 1 | `pnpm ls -r --depth -1` | root + 7 packages, all `(PRIVATE)`, no `spike` |
| 1 | lockfile reproducible under pinned pnpm | regenerated → byte-identical |
| 2 | `pnpm test` | 7 suites, 7 passed |
| 2 | workspace count | 8 entries (root + 7) |
| 2 | `grep -rn "spike" packages apps` | nothing |
| 2 | `grep -l '"dependencies"' …/package.json` | nothing |
| 2 | `wc -l` over the seven `src/index.ts` | **7** lines total (ceiling 50) |
| 3 | `pnpm typecheck` | `Tasks: 7 successful, 7 total` |
| 3 | no package re-declares compiler options | each `tsconfig.json` has only `extends` |
| 3 | **negative:** `const n: number = "x";` in `packages/core/src/index.ts` | `error TS2322: Type 'string' is not assignable to type 'number'` → exit 2 · **reverted** |
| 4 | `git ls-files \| grep -i eslint` | one path: `eslint.config.js` |
| 4 | `pnpm lint` | `Tasks: 7 successful, 7 total` |
| 4 | **negative:** `const x: any = 1;` in `packages/shared/src/index.ts` | `@typescript-eslint/no-explicit-any` → exit 1 · **reverted** |
| 4 | **negative:** bare `// @ts-ignore` | `@typescript-eslint/ban-ts-comment: Include a description…` → exit 1 · **reverted** |
| 5 | `pnpm test` returns to the prompt | ~1.1 s, no watcher |
| 5 | `pnpm --filter @quorum/core test` | `Test Files 1 passed (1)` |
| 6 | `pnpm test && pnpm test` | second run `Cached: 7 cached, 7 total · 9ms >>> FULL TURBO` |
| 6 | `.turbo` ignored | `git status --ignored --short` lists every `.turbo/` as `!!` |
| 6 | `grep -c '"build"' turbo.json` | `0` |
| 7 | `grep -c 'secrets\.' .github/workflows/ci.yml` | `0` |
| 7 | `grep -n "env:" .github/workflows/ci.yml` | nothing — no environment variable is defined at all |
| 7 | `grep -iE '(KEY\|TOKEN)'` | **2 lines** — `actions/cache`'s `key:`/`restore-keys:`; see §2 |
| 8 | `git diff --name-only main...HEAD -- spike/` | nothing |
| 9 | `head -5 docs/04-architecture.md` | status line bumped, dated 2026-08-24 |
| 9 | `git diff main...HEAD -- README.md CLAUDE.md docs/DECISIONS.md` | nothing |
| 10 | `git diff --name-only main...HEAD` | 47 paths, all within the permitted set |

### Two checks I could not run here, stated rather than glossed

- **`npm test --prefix spike`.** `spike/node_modules` does not exist in this worktree and installing it needs the network, which this sandbox denies. The spike is nonetheless **provably untouched** — `git diff main...HEAD -- spike/` is empty — so its result is whatever it is on `main`, and CI's `spike` job installs and runs it. This is also where the spike's `engines: ">=20"` first meets Node 22; per the requirement, surfacing that is the correct outcome and fixing it is not this ticket's business.
- **`gh run list --branch harness/Q-0008/integration`.** The branch is unpushed, so no run exists. Criterion 7 anticipates this: the reviewer runs each `run:` line locally instead and the gate records that it did. The `workspace` job's four commands are the four rows above; the `spike` job's are the two blocked here.

---

## 7. For the owner, at the gate

Criterion 9 routes two edits to you because my role covers neither.

**(a) CLAUDE.md.** *"Until M2 lands, the runnable code is the spike in `spike/`"* is now false. It should say the workspace exists and is empty; that the spike remains the regression suite until Q-0009; and that **the repository now has two commands called "lint"** — `pnpm lint` lints TypeScript in `packages/**` and `apps/**`, while flows are still linted by `node spike/bin/harness.js lint`. That collision is worth one sentence before it costs someone an afternoon. `CLAUDE.md` is not in `developer-generalist`'s path list, so I have not touched it.

**(b) A `docs/DECISIONS.md` entry.** *The spike stays outside the workspace, on npm, run as its own CI job and its own half of the repository's test command, until Q-0009 retires it.* Alternatives: make it a workspace package (its runner is not Vitest, its `lint` script is the flow linter, and `--frozen-lockfile` would then govern a lockfile npm wrote) or leave it out of CI entirely (a green badge over seven placeholder assertions, while the only real suite goes unrun). My role forbids appending to DECISIONS.md.

**(c) The Node floor — the decision that unblocks this gate.** §1 in one line: amend criterion 1's `engines` to `">=22.13.0"`, or accept a deprecated ESLint that does not fix it anyway.

**(d) Criterion 7's verify command.** §2 — narrow it, or the mechanical check reports red on a clean workflow.

Open questions 1, 2, 4 and 5 in the merged requirement were decided there and I followed them as written: `@quorum/*` private scope, both suites in `commands.test`, no correction of the plan's stale "30-check" figure, and `packages/templates` as a TypeScript package for now.

---

## 8. Deliberately left alone

No `build` task, no emitted output. No publish, release, changesets, versioning or `CHANGELOG.md`. No Dockerfile, renovate, dependabot, husky or lint-staged. No `verify:scaffold` or any other bespoke script — a check this ticket writes cannot be the evidence this ticket is right. No Node or OS matrix, no coverage thresholds, no type-aware lint, no remote turbo cache, no Playwright, no adapter probe in CI. No React, Tailwind, router or state management in `apps/web`. No harness assets moved into `packages/templates`. Not one function, schema or test ported from `spike/**`. No inter-package dependency, no shared type, no event format. No `README.md` rewrite. No flow, role, context file, ticket, glossary term or development-plan entry touched. No `backlog/` file written and nothing appended to `docs/DECISIONS.md`. Nothing committed — the harness commits this worktree.
