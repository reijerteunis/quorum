# Quorum — Technical Architecture (v1)

*Status: proposed 2026-08-22; scaffold created 2026-08-24 (Q-0008) — the pnpm + Turborepo workspace, the single strict `tsconfig.base.json`, Vitest, ESLint and CI now exist, and the seven package boundaries drawn below are real directories, empty on purpose until Q-0009 ports the spike into them. 2026-08-25 docs review: worktrees are under `.harness/worktrees/`, and budget caps are specified rather than enforced. 2026-08-25 (Q-0009): `packages/core` states that it imports `shared`'s zod schemas rather than declaring its own, settling a contradiction with the development plan, and the `core` → `shared` dependency direction is written down. 2026-08-25 (Q-0041): `shared` is populated — zod schemas for flow, ticket, role and step output, the trace/event union and the cross-package constants — and principle 2 is corrected to the events that exist rather than the six it had named since it was written. 2026-08-26 (Q-0064): `core/src` is organised into one folder per module and `shared` stays flat, with the asymmetry explained. 2026-08-27 (Q-0047): the per-adapter `capabilities.ts` exists, and the version probe the same sentence asks for is recorded as deferred to Q-0067 so nobody reads it as shipped. 2026-08-27 (Q-0071): the testing strategy says what CI's `workspace` job executes and that it is forced, and separates the pnpm download cache from a task-result cache. 2026-08-28 (Q-0072): the testing strategy says what a *cache hit* claims, now that each suite's out-of-package reads are declared and `core`'s checks depend on `shared`'s. 2026-08-30 (Q-0079): the testing strategy names what a green tick does *not* claim — no suite ran where git resolves no identity until the sweep — and points at the oracle, the tripwire and the measured table separating them. 2026-08-31 (Q-0054): the testing strategy states that two required suites exist until the cutover and what each proves — the parenthesis calling the mock end-to-end "the 30-check smoke test, ported" described a port that had not happened, and its half of the suite transfers at Q-0010 — and adds the four-link chain from a new failing file to a red `pnpm test`. Changes go through DECISIONS.md. 2026-08-31 (Q-0062): principle 6 states the worktree lifecycle — a finished run gives back the worktrees it obtained, a run that did not finish keeps them, a worktree that is not clean is kept and says so, and no ref is ever deleted; and the testing strategy's entangled share is 49% rather than 53%, re-derived by `spike-parity.test.ts` after that ticket added a library-only test file, with the earlier figure kept beside it so the movement is visible rather than silent. Principle 2 was rewritten 2026-08-29 (Q-0050): `runFlow` is a lazy, single-consumer `AsyncIterable<Event>` whose cancellation belongs to the caller's `AbortSignal`, and the public-API line names it — see *What a run's event stream carries, and how a gate answer travels back* (2026-08-28) and its 2026-08-29 erratum.*

## Shape

A pnpm + Turborepo monorepo, TypeScript strict everywhere, Node ≥ 22. One command (`npx quorum`) starts a local daemon and opens the browser UI; the same daemon serves the CLI.

```
quorum/
  apps/
    web/            Vite + React UI (mission control, gate screen, backlog board, editors)
  packages/
    core/           engine, backlog, lint, contracts, git/worktrees, adapters, fanout, run-history
      src/          one folder per module, named as Q-0009's children are (Q-0064):
                      adapters/ backlog/ contracts/ engine/ fanout/ git/ lint/ run-history/
                    index.ts stays at src/ root; tests are colocated with the code they test
    server/         Hono HTTP + WebSocket daemon: runs flows, streams traces, serves web/
    cli/            `quorum` binary: init · ticket · board · run · lint · adapters · open
    compiler/       canonical harness/ → CLAUDE.md / AGENTS.md / GEMINI.md (thin, linked)
    templates/      shipped harness/ (flows, roles, context files) + project scaffolds
    shared/         types, schemas (zod), event/trace format, constants  ← declarations only
                    deliberately flat: ten leaf modules, and index.test.ts pins index.ts to
                    `export * from './<name>.js';` lines, which a folder path cannot satisfy
  docs/             these documents
  harness/          Quorum's own harness — it is developed with itself from M2 onwards
  backlog/          Quorum's own backlog (files in git, like every other project)
```

## Principles that shape the code

1. **`core` has no I/O it doesn't own.** It spawns CLIs, reads/writes the project folder and git. It never touches the network, never stores secrets, never reads API keys. Everything else is a thin shell around it.
2. **One trace format.** Every adapter maps its CLI's output to `shared`'s event schema, and nothing above the adapter layer branches on which vendor produced an event. Two shapes, because two interfaces exist. An **adapter** emits `spawn` and `stdout` and knows nothing about the run around it; the contract layer's retry wrapper adds `retry`. A **run** emits those three with the step id the engine supplies, plus `step`, `done`, `info`, `warn`, the correlated gate question and one final `terminal` event. Vendor identity survives as one neutral, open `vendor` label — per-vendor cost roll-ups require it and a blended number is forbidden — but no field is one a single vendor could populate. `tool` and `text` are named nowhere in this list on purpose: they were documented here before anything emitted them, and they arrive when an adapter normalises vendor JSONL into them (Q-0041, 2026-08-25). `runFlow` exposes a lazy, single-consumer `AsyncIterable<Event>` over a lossless FIFO: order is stable within one step, while parallel members have no global ordering or interleaving promise. A gate is emitted before the out-of-band `answerGate` callback is invoked. Cancellation belongs to the caller through an `AbortSignal`; core installs no process signal handler. Events deliberately carry no timestamp or sequence number, and only the terminal event carries run identity. The UI, the CLI and run history all consume the same stream; nothing persists it in v1. These boundaries follow *What a run's event stream carries, and how a gate answer travels back* (2026-08-28) and its 2026-08-29 erratum.
3. **Files are the database.** Tickets, flows, roles, run logs and traces live in the project folder (`backlog/`, `harness/`, `.quorum/runs/`). The daemon keeps an in-memory index and rebuilds it from disk on start. No SQLite in v1.
4. **The daemon is stateless across restarts.** A run that was interrupted is resumable from its last completed step because every step's result is on disk.
5. **UI is a view, never the source of truth.** Editing a flow in the UI writes the YAML file; the form is generated from the flow schema in `shared`.
6. **Safety by construction.** Worktrees under `.harness/worktrees/` (git-excluded), integration branch per ticket, human-locked gates — enforced in `core`, not in the UI. Budget caps are specified in `harness.yaml` but not yet enforced anywhere. **A worktree is not permanent.** A run that finished — `completed` or `regressed` — removes the worktrees it obtained, keeping any that is not clean and naming the paths that kept it; a run that did not finish keeps every one of them, because the directory it stopped in is the thing a maintainer is about to open. It is the same predicate the ticket-branch rollback reads, the other way round. **No ref is ever deleted** — not a task branch, not a step branch, not the integration branch — so a removed directory is always re-creatable from its branch, and a review after the run still has something to read. Cleanup is registration and never enumeration: a run removes what it obtained and nothing else, whoever created it. See *"A run removes the worktrees it made, and never the refs"* (2026-08-31).

## Packages in detail

### `packages/core`
Seeded from the spike (`engine`, `backlog`, `fanout`, `git`, `adapters/*`), converted to TypeScript and validated against the zod schemas for flows, tickets, roles and step outputs that `shared` defines — `core` imports them and declares none of its own. Public API: `loadProject(dir)`, `runFlow(opts): AsyncIterable<Event>`, `lintFlow`, `Backlog`, `Adapter` interface. The mock adapter stays in the package for tests and demos.

Laid out as one folder per module (`adapters/`, `backlog/`, `contracts/`, `engine/`, `fanout/`, `git/`, `lint/`, `run-history/`), the names Q-0009's fourteen children already carry, with `index.ts` at `src/` root and tests colocated. `shared` stays flat, for the reason given above. See the 2026-08-26 DECISIONS entry.

**The dependency direction is one-way: `core` → `shared`, never the reverse.** `shared` depends on no other workspace package, and nothing in it may import from `core`, `cli`, `server`, `compiler`, `templates` or `apps/web`. No cycle between workspace packages is permitted.

### `packages/server`
Hono app: REST for project/backlog/flows/history, WebSocket for live run events and gate prompts. Serves the built `apps/web`. Exposes `POST /runs` (start), `POST /runs/:id/gate` (advance/retry/override with reason), `POST /runs/:id/stop`. Single-user, localhost-only by default.

### `packages/cli`
Same commands as the spike plus `quorum open` (start daemon + open browser), `quorum compile` (harness → vendor files), `quorum history`. Gates in the CLI are terminal prompts; gates in the UI are the gate screen; both call the same `core` API.

### `packages/compiler`
The second headline feature. Reads `harness/rules.md`, `architecture.md`, `product-context.md`, `commands/*.md` and emits `CLAUDE.md` (with `@harness/...` imports), `AGENTS.md` and `GEMINI.md` (inlined where the vendor can't reference), plus a marked native pass-through section for `.claude/agents`, skills and commands. Drift detection: hash of sources vs generated header.

### `apps/web`
React + Vite, Tailwind, dark "ground control" theme from the design prompt. Screens: projects home, backlog board, ticket page, harness editor, flow editor (form + YAML preview), mission control (live traces, parallel columns, per-vendor cost tickers), gate screen, step chat, run history. State from the WebSocket stream; no client-side persistence beyond UI preferences.

## Adapters

`Adapter` interface per `03-adapter-contract.md`. v1 ships `claude` and `codex`; `gemini` is the first community milestone and is designed as a copy-and-edit of `codex`. Adapter behaviour that is CLI-version-specific (flag names, JSONL fields) lives in a per-adapter `capabilities.ts` with a version probe, so a CLI update breaks one file. Q-0047 shipped the first half of that sentence and not the second: `claude-capabilities.ts` and `codex-capabilities.ts` exist and hold every flag, enumerated value and vendor field name, but **the version probe is deferred to Q-0067** — a probe adds a CLI invocation, a supported range that goes stale and a policy for an unsupported version, all of which are behaviour rather than layout. Each module carries the version-probe argv as inert data so that ticket is a small one; nothing reads a version back today.

## Testing strategy

- **Until the cutover there are two required suites, and they have different reach.** The
  `workspace` job runs Vitest over `packages/**` and `apps/**` and proves the port at library level:
  every module the thirteen port children wrote, checked against its own ported source. The `spike`
  job runs `spike/test/run.js` and proves the harness the port is being developed with, including
  the mock end-to-end *through the binary* — 151 assertions in `spike/test/smoke.js`, which is what
  M2's done-when calls "the 30-check smoke test" and what the 2026-08-21 decision *"`integrate` is
  one generic step type used by three stages"* counted when the figure was 30. Neither suite is a
  subset of the other. 49% of `spike/test/`, by line, spawns `spike/bin/harness.js`, and **that half
  transfers at Q-0010** rather than at Q-0054 — the CLI does not exist in `packages/` yet, so there
  is nothing for it to be aimed at. The share was 53% when Q-0054 measured it and falls with every
  library-only file added since; it is re-derived on each run rather than transcribed, which is why
  this sentence can be trusted to be current. `packages/core/src/spike-parity.test.ts` is the file-by-file
  record of which spike scenario the workspace suite carries, which transfers, and which is carried
  by nobody; it is deleted at the cutover with `spike/test/**`.
- **What makes a new failing test file fail `pnpm test`**, since Q-0054, link by link. The include
  is Vitest's own default (`vitest.shared.js`), so a `*.test.ts` written anywhere below a package is
  **collected** — until this ticket it was `src/**` only, and a red test written to
  `packages/core/test/`, to a package root, or as `*.test.js` was collected by nothing at all. Every
  package declares a `test` script, so turbo **runs** it rather than skipping the package in silence.
  `$TURBO_DEFAULT$` puts the new file in that package's `test` hash, so a cached pass **cannot stand
  over it**. And CI **forces** regardless. `packages/core/src/test-discovery.test.ts` holds the first
  two links; the third is `turbo-inputs.test.ts`'s and the fourth `test-command.test.ts`'s. This is
  the property `spike/test/run.js` has always had by discovering its directory, and the reason it
  matters is qa-red: a red phase is proved by writing a new failing file, and a runner blind to it
  reports green while `integrate --expect fail` loops to a gate having proved nothing.
- CI's `workspace` job runs `lint`, `typecheck` and `test` over the whole workspace **forced** — `pnpm turbo run <task> --force` — so a green tick means those three tasks were executed against that commit rather than served from a cached conclusion. The two caches in play are not the same thing and only one of them can make a tick a lie: `actions/setup-node`'s `cache: pnpm` replays a *download* and stays; no turbo result cache is restored, because that would replay a *verdict*. `integrate` reaches the same property by an independent route, since it runs `harness/harness.yaml`'s `commands.test` rather than `package.json`'s and that command carries its own `--force` (Q-0065). A developer's local `pnpm test` is unforced and keeps its cache, which is where a cache earns its keep.
- **What a cache hit claims, since Q-0072.** A hit means *no file this task reads, and no same-kind task in a package it depends on, has changed since the cached result*. Before Q-0072 it meant only *nothing inside this package has changed*, which was a materially weaker thing to believe: turbo's default input set is package-scoped, while both real suites assert over `docs/`, `harness/`, `spike/`, `contracts/`, `backlog/` and each other. `packages/core/turbo.json` and `packages/shared/turbo.json` declare those out-of-package reads as `inputs` beside `$TURBO_DEFAULT$`, and the root `test`, `lint` and `typecheck` tasks each depend on their own kind in a package's dependencies (`^test`, `^lint`, `^typecheck`), so a change in `shared` invalidates all three of `core`'s. `packages/core/src/turbo-inputs.test.ts` is what fails when a read stops being covered. **CI's claim is different and stronger:** it forces, so its tick says these tasks *executed* against this commit, which no hit can say however well its inputs are declared.
- **What a green tick does not claim, since Q-0079.** Both suites run on a machine whose git can
  resolve an identity, so a test that depends on the *account* it runs as is green everywhere it is
  looked at. Three merged changes did exactly that — the two directories a working checkout has and
  a fresh clone does not (Q-0072), `fs.existsSync` used to classify (Q-0073), and `git merge
  --no-ff` resolving a committer identity (Q-0051's merge, which turned CI red). The rule is *A
  test's verdict is a property of the commit, not of the checkout or the account* (2026-08-30), and
  it has two enforcers with different reach. The **oracle** is
  `.github/scripts/git-identity-sweep.sh`: it runs both suites with no resolvable identity, in a
  bare checkout and again in one carrying `.harness/worktrees` and `.quorum/runs`, and it proves its
  own environment discriminates before trusting it — a permissive sweep is green over everything.
  `pnpm sweep:git-identity` is byte-identically what CI runs. The **tripwire** is
  `packages/core/src/git-identity.test.ts`, inside the ordinary suite and therefore visible at
  `integrate`, which sees literals only and is not coverage for the checkout-shaped instances. The
  measured table of what does and does not discriminate — including the two environments that look
  hostile and are not — is in the sweep script's header, because that is where the next person
  editing it will look.
- Adapters: a nightly "real CLI" job is **not** feasible in CI (subscription auth); instead a `quorum adapters --probe` command runs the four contract checks locally and writes `.quorum/adapter-probe.json`; contributors attach it to PRs that touch adapters.
- `web`: Playwright against the daemon with the mock adapter.
- Quorum develops itself with itself from M2: every feature ticket goes through the backlog and the flows.

## Run history on disk

The spike persists every non-dry run beneath `.quorum/runs/<ticket-id>-<n>/`. Its atomically
replaced `manifest.json` is the source of truth for lifecycle, adapter/script/integrate
occurrences, vendor-neutral usage, errors, and per-vendor roll-ups. Adapter occurrences retain
their exact `prompt.txt` and final or raw-invalid `output.txt`; script and integrate occurrences
retain `output.txt`. Gates and fan-out parents do not allocate occurrences. There is no persisted
event stream in this version, and incomplete `running` manifests are reported rather than repaired.

## Non-goals for v1 (so nobody builds them by accident)

Multi-user, remote daemon, cloud sync, any API-key path, a plugin marketplace, visual node canvas, eval suites, Windows support beyond WSL.
