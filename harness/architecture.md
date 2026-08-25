# Architecture context

Read by the architect and the architecture reviewer. Everything here becomes a contract
downstream, so state only what is true in this repository; mark anything unverified.

## Shape of the repository
Directory layout and what each top-level area is for (apps, services, packages…).
Framework, language, runtime, package manager.

## Boundaries the architect must respect
Numbered rules: where business logic lives, how schema changes happen, who may import
whom, how user-facing strings, analytics events and auth guards are declared.

## Contract conventions (what solutioning must emit)
A table of contract kinds → format → example path (API: OpenAPI fragment; domain:
typed interface + stub; schema: migration skeleton in your tool's format; UI: prop types
and states; …). Tests in the red phase compile against these stubs.

## Roles for task fan-out

This table is the repository's current fan-out write contract. The engine does not read
`paths` frontmatter; enforcement reaches an agent through the allowed-path prose in the
role body. Frontmatter and prose must nevertheless agree so tooling can validate them.

| role | vendor | directories it may write | typical contracts |
| --- | --- | --- | --- |
| generalist | claude | `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig*.json`, `.npmrc`, `.gitignore`, `.github/`, `packages/`, `apps/`, `spike/`, `harness/`, `docs/` | scaffolds, CI, tool and workspace configuration |
| backend | codex | `spike/src/`, `packages/core/`, `packages/shared/`, `harness/`, `docs/`, `backlog/` | engine behaviour, YAML flows and roles, Markdown documentation |
| tooling | claude | `spike/bin/`, `spike/test/`, `packages/core/`, `packages/shared/` | argument parsing, terminal output, exit codes, the regression suite |
| frontend | claude | `apps/*` — of which only `apps/web` exists; `packages/ui` and `packages/i18n`, neither of which exists yet | component props, view states, user-facing strings |
| data | codex | `packages/database` — does not exist yet | persistence schemas and migrations |

`generalist` is not a fan-out role: `chore.yaml`'s `implement` step runs it alone, on a whole
ticket rather than on one task from a solution. It is listed here because it is fed this table
as context on every chore run, and a role reading a table that omits it — and that grants no
role the directories it is being sent to write — is being told two different things at once.
Its wide paths are deliberate: repository configuration lives at the root, and a chore ticket
usually touches several unrelated corners of it.

`backend` and `tooling` are the two live **fan-out** roles, and they are deliberately on
**different vendors** — that is what makes a fan-out multi-vendor rather than merely parallel.
Both may write `packages/core/` and `packages/shared/`, on the same terms as `spike/bin/` below:
which of them owns a given file is a statement each solution's `tasks.yaml` makes explicitly, and
the two directories appearing in two rows is a grant, never a shared claim.

`frontend` and `data` remain inert. `apps/web` exists since Q-0008, but `packages/ui`,
`packages/i18n` and `packages/database` do not exist and are not planned before M3 — the rows are
kept so the write contract still describes the roles that exist, and the non-existence is stated
so nobody solutions a task against a directory that is not there.

**Split by surface when the work allows it.** A ticket touching both engine internals and
the command line should become at least two tasks, one per role, rather than one `backend`
task spanning both. A single-role fan-out is parallelism without a second opinion: it runs
one vendor's judgement across the whole change, which is the thing this project exists to
avoid. Where a ticket genuinely cannot be divided that way, say so in the solution rather
than defaulting to `backend`.

`spike/bin/` and `spike/test/` belong to `tooling` by default. A `backend` task may write
them only where its own description assigns those files explicitly and names why — tasks
solutioned before this table gained its `tooling` row do exactly that, and remain valid.
Tasks must still assign each concrete file to exactly one owner.

**The spike is frozen for Q-0009's port, and for nothing else.** Q-0041 through Q-0054 port
`spike/src` into `packages/core` and `packages/shared`, and while they do, none of them may
modify or delete any file under `spike/src/` — the spike is the harness those tickets are
themselves run on, and the port's only independent witness. Every other ticket may still write
there, which is why the freeze is enforced on branch names in CI
(`.github/scripts/port-freeze-guard.sh`) and not by narrowing anyone's paths above: Q-0038 and
Q-0040 have `spike/src` as their whole subject. **If you are working on one of the fourteen,
read `harness/port-charter.md` first** — it carries the freeze and its exemption path, the
behaviour-preservation policy, the invariant register each child inherits, the landing order and
the pre-run checklist.

**Tasks are small, and their ownership is complete.** A task touches one coherent file set and
is describable in a sentence. Between them, a solution's tasks must own every file the red suite
requires changed — a file no task owns cannot be fixed by anyone, and the development loop will
spend its whole iteration budget discovering that. Ownership reaches an agent only through the
task `description`; an `owns:` list is read by nothing. Tasks that share files are a sign the cut
is wrong. Independent tasks declare `depends_on: []` and run in one wave, which is where a
two-vendor fan-out comes from.

`spike/test/**` belongs to qa-red, and every development task is told not to modify tests. A
scenario that can only be satisfied by editing a test file is therefore unsatisfiable, and is a
finding for the scenario gate rather than a red test.

Template sharing is explicit, not directory-wide. All files under `harness/flows/` and
the `harness/roles/code-reviewer.md` role are byte-shared with their paths under
`spike/templates/harness/`. Repository configuration and context (`harness.yaml`,
`product-context.md`, `rules.md`, `architecture.md`) and developer roles are
repository-specific; their template counterparts describe an adopter's project and
must not acquire Quorum's dogfood paths.

## Testing and tooling
The exact commands: unit/integration, e2e, lint, typecheck. `harness.yaml → commands.test`
is what `integrate` runs; "green" means all of these pass.

## Things the reviewer should be suspicious of
Your project's recurring mistakes, stated bluntly.
