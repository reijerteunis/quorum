# Architecture context

Read by the architect and the architecture reviewer. Everything here becomes a contract
downstream, so state only what is true in this repository; mark anything unverified.

## Shape of the repository

A pnpm + Turborepo workspace. TypeScript strict throughout, Node `>=22.13.0`, pnpm 10.31.0,
Vitest for tests, ESLint for lint. The workspace globs are `packages/*` and `apps/*`.

| package | what it is for |
| --- | --- |
| `@quorum/shared` | zod schemas (flow, ticket, role, step output), the trace/event union, cross-package constants. Depends on no workspace package. |
| `@quorum/core` | the engine: run loop, backlog, fan-out, git, adapters, lint, contracts, run history. Imports `shared`'s schemas and declares none of its own. |
| `@quorum/cli` | the `quorum` binary — a presentation layer over `core`'s public API. |
| `@quorum/server` | the daemon: the in-process run host, and a Hono HTTP + WebSocket surface over it. |
| `@quorum/web` | the browser app. `src/` is what a browser gets and may import no Node capability. |
| `@quorum/compiler` | M5's harness compiler. A stub today. |
| `@quorum/templates` | a scaffold holding no assets — the shipped templates are `packages/cli/templates/`. |

Four top-level directories are not packages and are read by the flows rather than compiled:
`harness/` (this file, `rules.md`, `product-context.md`, `flows/`, `roles/`), `backlog/` (one folder
per ticket), `contracts/` (one folder per ticket that emitted any), and `docs/`.

Three packages emit — `shared`, `core` and `cli` — and they are also what a `pnpm pack` produces.
`apps/web` declares no `build` script today; whether a served bundle is an emitted artifact at all
is Q-0122's to rule.

## Boundaries the architect must respect

1. **The dependency direction is one-way: `core` → `shared`, never the reverse.** Nothing in
   `shared` may import `core`, `cli`, `server`, `compiler`, `templates` or `apps/web`. No cycle
   between workspace packages is permitted.
2. **`core` has no I/O it does not own.** It spawns CLIs, reads and writes the project folder and
   git. It never touches the network, never stores secrets, never reads an API key. Everything else
   is a thin shell around it — so a design that asks `core` to call an HTTP service is refused
   before preference enters.
3. **Domain logic belongs in `core`.** `packages/cli` and `packages/server` present it. A command
   that needs a new behaviour needs a new `core` symbol, not a local copy.
4. **`apps/web/src` may import no `node:` specifier, no bare Node builtin and no `@quorum/core`**,
   checked over every file in it, tests included. A suite that must read the repository lives in
   `apps/web/test/` beside it.
5. **No API key, on any code path, including tests and examples.** Every agent runs on the vendor
   CLI's own subscription login, and `check()` refuses if `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or
   `CODEX_API_KEY` is set.
6. **Files are the database.** Anything persistent is a file under `backlog/`, `harness/` or
   `.quorum/`. No hidden state in the daemon, and no client-side persistence in the browser beyond
   UI preferences.
7. **Nothing writes to the user's working tree from a flow.** Work happens in worktrees under
   `.harness/worktrees/`, on `harness/<id>/integration` and its sibling branches.
8. **A `core` error names the condition; the remedy belongs to the surface.** `core` does not tell
   a user what to type — it has no way to know whether they have a shell.
9. **Errors are explicit and nothing defaults silently.** Invalid structured output is saved beside
   the ticket and stops the run.
10. **The daemon binds `127.0.0.1` and that is not configurable.** It is unauthenticated and it
    starts agent runs; a flag whose only use is to make it reachable is not a feature.

## Contract conventions (what solutioning must emit)

| kind | format | where it goes | example |
| --- | --- | --- | --- |
| typed stub | a `.ts` module exporting the real names, bodies throwing `not implemented` | **its final path, inside the package that will own it** | `packages/shared/src/wire.ts` |
| prose contract | Markdown, the frozen sentences a later step may not restate loosely | `contracts/<ID>/` | `contracts/Q-0011/runs-cli.contract.md` |
| data shape | JSON Schema draft 2020-12, executable by `quorum validate` | `contracts/<ID>/` | `contracts/Q-0011/run-manifest.schema.json` |
| fixture | JSON | `contracts/<ID>/` | `contracts/Q-0050/run-messages.fixture.json` |
| flow or config shape | YAML | `contracts/<ID>/` | `contracts/Q-0006/review-flow.contract.yaml` |

**The stub is the one that does not live under `contracts/`, and the reason is mechanical rather
than stylistic.** `contracts/` is outside every package, so it has no `node_modules` and no
workspace link: a `.ts` file there that imports a workspace package does not typecheck, and a red
test importing it fails to compile rather than failing on an assertion. Measured —
`TS2307: Cannot find module '@quorum/shared'`, raised inside `contracts/Q-0050/run-flow-api.contract.ts`
itself. See *"A typed stub lives at its final path; `contracts/` holds what is not code"*
(2026-09-11). Never write the stub twice: a copy under `contracts/` beside the real file is a second
definition free to drift.

**A red test compiles against the stub and fails on an assertion.** If it fails on a missing symbol
the contract was not concrete enough, which is `prove-red`'s job to catch and the architecture
reviewer's to prevent.

## Roles for task fan-out

This table is the repository's current fan-out write contract. The engine does not read
`paths` frontmatter; enforcement reaches an agent through the allowed-path prose in the
role body. Frontmatter and prose must nevertheless agree so tooling can validate them.

| role | vendor | directories it may write | typical contracts |
| --- | --- | --- | --- |
| generalist | claude | `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig*.json`, `.npmrc`, `.gitignore`, `.github/`, `packages/`, `apps/`, `harness/`, `docs/`, `README.md`, `eslint.config.js`, `vitest.shared.js` | scaffolds, CI, tool and workspace configuration |
| backend | codex | `packages/core/`, `packages/shared/`, `packages/server/`, `harness/`, `docs/`, `backlog/` | engine behaviour, YAML flows and roles, Markdown documentation |
| tooling | claude | `packages/core/`, `packages/shared/`, `packages/cli/` | argument parsing, terminal output, exit codes, the regression suite |
| frontend | claude | `apps/*`, `packages/ui`, `packages/i18n` | component props, view states, user-facing strings |
| data | codex | `packages/database` | persistence schemas and migrations |

`generalist` is not a fan-out role: `chore.yaml`'s `implement` step runs it alone, on a whole
ticket rather than on one task from a solution. It is listed here because it is fed this table
as context on every chore run, and a role reading a table that omits it — and that grants no
role the directories it is being sent to write — is being told two different things at once.
Its wide paths are deliberate: repository configuration lives at the root, and a chore ticket
usually touches several unrelated corners of it.

`backend` and `tooling` are the two live **fan-out** roles, and they are deliberately on
**different vendors** — that is what makes a fan-out multi-vendor rather than merely parallel.
Both may write `packages/core/` and `packages/shared/`: which of them owns a given file is a
statement each solution's `tasks.yaml` makes explicitly, and the two directories appearing in two
rows is a grant, never a shared claim.

`frontend` is active for `apps/web`; `data` remains inert. `packages/ui`, `packages/i18n` and
`packages/database` do not exist and are not planned before M3 — the rows are kept so the write
contract still describes the roles that exist, and the non-existence is stated here so nobody
solutions a task against a directory that is not there.

**The third column is read by a machine, so it holds paths and nothing else.**
`packages/shared/src/role.test.ts` parses each cell as a comma-separated path list and asserts it
equals the role's `paths` frontmatter, that the vendor matches the role's `adapter:`, and that the
role's prose names every directory it is granted — that assertion is why `developer-tooling` stopped
being invisible to the architect. Annotating a cell (*"— does not exist yet"*) parses as a path and
breaks it. Caveats go in this prose, where a reader still finds them and the parser does not.

**Split by surface when the work allows it.** A ticket touching both engine internals and
the command line should become at least two tasks, one per role, rather than one `backend`
task spanning both. A single-role fan-out is parallelism without a second opinion: it runs
one vendor's judgement across the whole change, which is the thing this project exists to
avoid. Where a ticket genuinely cannot be divided that way, say so in the solution rather
than defaulting to `backend`.

**Tasks are small, and their ownership is complete.** A task touches one coherent file set and
is describable in a sentence. Between them, a solution's tasks must own every file the red suite
requires changed — a file no task owns cannot be fixed by anyone, and the development loop will
spend its whole iteration budget discovering that. Ownership reaches an agent only through the
task `description`; an `owns:` list is read by nothing. Tasks that share files are a sign the cut
is wrong. Independent tasks declare `depends_on: []` and run in one wave, which is where a
two-vendor fan-out comes from.

`packages/**/*.test.ts` belongs to qa-red, and every development task is told not to modify tests. A
scenario that can only be satisfied by editing a test file is therefore unsatisfiable, and is a
finding for the scenario gate rather than a red test.

Template sharing is explicit, not directory-wide. All files under `harness/flows/` and
the `harness/roles/code-reviewer.md` role are byte-shared with their paths under
`packages/cli/templates/harness/`, which is the tree `quorum init` copies.
`packages/cli/src/templates.test.ts` asserts that set byte for byte in both directions.
Repository configuration and context (`harness.yaml`,
`product-context.md`, `rules.md`, `architecture.md`) and developer roles are
repository-specific; their template counterparts describe an adopter's project and
must not acquire Quorum's dogfood paths.

## Testing and tooling

`pnpm turbo run lint`, `pnpm turbo run typecheck`, `pnpm turbo run test` — one Vitest configuration
re-exported by every package, whose `include` is Vitest's own default, so a new test file anywhere
under a package is collected. There is no separate e2e runner: the end-to-end suites spawn the built
binary from `packages/cli`.

`harness.yaml → commands.install` is `pnpm install --frozen-lockfile` and `commands.test` is
`pnpm turbo run test --force --continue`. **`--force` is deliberate** — turbo resolves a worktree's
cache to the main checkout's, so without it an `integrate` step can report `tests=ok` from a replay
it never executed. **"Green" means that command exits 0**, and nothing else: a suite passing is not a
claim that CI ran, that the branch is pushed, or that the work is contained in the base branch.

A failing install is not a failing test, and `expect: fail` cannot tell them apart — so a task that
adds a dependency must land the manifest and `pnpm-lock.yaml` in the same change, or the red phase
passes for the wrong reason.

`quorum lint` checks the flow files. `pnpm sweep:git-identity` runs the suite with no resolvable git
identity, in two checkout shapes, and is what enforces that a test's verdict is a property of the
commit.

## Things the reviewer should be suspicious of

These are this repository's recurring mistakes, each of which has cost it a ticket or more.

- **A check that cannot fail.** An assertion satisfied by any input, a guard whose regex does not
  match its own subject, a negative check that passes because the thing it looks for moved. Show a
  guard red before trusting it green.
- **A guard blind to what it is about.** A scan narrowed to "shipping files" while the defect is in
  a test; a scan keyed on a function's *name* rather than on the behaviour it is about.
- **A measurement copied from a document.** Re-derive it. Six consecutive inherited coverage figures
  here were wrong, in both directions.
- **Fixing the instance rather than the class.** A reviewer names one site; there are usually four.
- **A comment or JSDoc promising what the code beneath it does not do.**
- **A verdict that depends on the machine, the checkout or the account** rather than on the commit.
- **A failed probe read as a proven negative.** `could not tell` is a third answer and must survive
  to the surface.
- **A criterion naming a surface the flow cannot write**, which stops a run on a correct refusal.
- **A synonym for a term the glossary already has.** Containment, confinement, push lag and verified
  version are four different things and are never used for one another.
