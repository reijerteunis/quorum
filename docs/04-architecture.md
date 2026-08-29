# Quorum — Technical Architecture (v1)

*Status: proposed 2026-08-22; scaffold created 2026-08-24 (Q-0008) — the pnpm + Turborepo workspace, the single strict `tsconfig.base.json`, Vitest, ESLint and CI now exist, and the seven package boundaries drawn below are real directories, empty on purpose until Q-0009 ports the spike into them. 2026-08-25 docs review: worktrees are under `.harness/worktrees/`, and budget caps are specified rather than enforced. 2026-08-25 (Q-0009): `packages/core` states that it imports `shared`'s zod schemas rather than declaring its own, settling a contradiction with the development plan, and the `core` → `shared` dependency direction is written down. 2026-08-25 (Q-0041): `shared` is populated — zod schemas for flow, ticket, role and step output, the trace/event union and the cross-package constants — and principle 2 is corrected to the events that exist rather than the six it had named since it was written. 2026-08-26 (Q-0064): `core/src` is organised into one folder per module and `shared` stays flat, with the asymmetry explained. 2026-08-27 (Q-0047): the per-adapter `capabilities.ts` exists, and the version probe the same sentence asks for is recorded as deferred to Q-0067 so nobody reads it as shipped. 2026-08-27 (Q-0071): the testing strategy says what CI's `workspace` job executes and that it is forced, and separates the pnpm download cache from a task-result cache. 2026-08-28 (Q-0072): the testing strategy says what a *cache hit* claims, now that each suite's out-of-package reads are declared and `core`'s checks depend on `shared`'s. Changes go through DECISIONS.md. Principle 2 was rewritten 2026-08-29 (Q-0050): `runFlow` is a lazy, single-consumer `AsyncIterable<Event>` whose cancellation belongs to the caller's `AbortSignal`, and the public-API line names it — see *What a run's event stream carries, and how a gate answer travels back* (2026-08-28) and its 2026-08-29 erratum.*

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
6. **Safety by construction.** Worktrees under `.harness/worktrees/` (git-excluded), integration branch per ticket, human-locked gates — enforced in `core`, not in the UI. Budget caps are specified in `harness.yaml` but not yet enforced anywhere.

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

- `core`: Vitest unit tests + the mock end-to-end (the 30-check smoke test, ported) run in CI on every push.
- CI's `workspace` job runs `lint`, `typecheck` and `test` over the whole workspace **forced** — `pnpm turbo run <task> --force` — so a green tick means those three tasks were executed against that commit rather than served from a cached conclusion. The two caches in play are not the same thing and only one of them can make a tick a lie: `actions/setup-node`'s `cache: pnpm` replays a *download* and stays; no turbo result cache is restored, because that would replay a *verdict*. `integrate` reaches the same property by an independent route, since it runs `harness/harness.yaml`'s `commands.test` rather than `package.json`'s and that command carries its own `--force` (Q-0065). A developer's local `pnpm test` is unforced and keeps its cache, which is where a cache earns its keep.
- **What a cache hit claims, since Q-0072.** A hit means *no file this task reads, and no same-kind task in a package it depends on, has changed since the cached result*. Before Q-0072 it meant only *nothing inside this package has changed*, which was a materially weaker thing to believe: turbo's default input set is package-scoped, while both real suites assert over `docs/`, `harness/`, `spike/`, `contracts/`, `backlog/` and each other. `packages/core/turbo.json` and `packages/shared/turbo.json` declare those out-of-package reads as `inputs` beside `$TURBO_DEFAULT$`, and the root `test`, `lint` and `typecheck` tasks each depend on their own kind in a package's dependencies (`^test`, `^lint`, `^typecheck`), so a change in `shared` invalidates all three of `core`'s. `packages/core/src/turbo-inputs.test.ts` is what fails when a read stops being covered. **CI's claim is different and stronger:** it forces, so its tick says these tasks *executed* against this commit, which no hit can say however well its inputs are declared.
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
