# Q-0013 — implement report, run 2, iteration 1

*The run host. Thirteen criteria, AC-1 to AC-14 less the struck AC-15. Verdict: `proceed`.*

---

## 1. What is here, file by file

### New — `packages/server/src` (four production modules, 733 lines)

**`broadcast.ts` (189)** — one run's fan-out. The host consumes `runFlow` once and publishes to every
subscriber registered when it publishes. Each subscriber holds its own FIFO and its own pending pull,
so publishing neither awaits nor inspects them: a subscriber that stops reading cannot make another
miss, duplicate or reorder an event, and cannot stall the one consumer. Retention is a **count** of
events, chosen by the caller; zero is live-tail-only. The replay is snapshotted **at registration**
rather than at the first pull, which is what makes the boundary between replay and live tail exactly
one statement wide. A replay eviction made incomplete is reported as `Subscription.missed` — a
number **beside** the stream, never an item of it, because the event union is closed and `.strict()`.

**`gates.ts` (122)** — the pending-gate registry, keyed by run and then by gate id, because
`nextGateId` spells `<run number>:<n>` and two tickets on their first run both ask `1:1`. The
envelope is validated against `@quorum/shared`'s own `gateAnswerEnvelopeSchema` before `core` sees
it; an unknown gate, a foreign gate, one already answered and a word outside the closed three are
each refused here, leaving the waiting gate untouched. The delete and the settle are one step with no
`await` between them, which is what makes *exactly one wins* a property rather than a hope. No
default answer, no timeout. `release` deliberately settles nothing.

**`refusal.ts` (78)** — the boundary where a `core` failure becomes a value a surface can render, and
the **one** site composing a remedy. `Refusal` is `{ condition, remedy }`: `core`'s sentence
unaltered, plus what this surface has to add, which is `null` for everything except
`ProjectNotFoundError`. `openProject(dir?)` answers a result rather than throwing, because the
transport above has to answer a request either way.

**`host.ts` (344)** — `createRunHost({ project, retain })` with `start`, `view`, `subscribe`,
`answer`, `stop`, `shutdown`. The load-bearing decisions:

- **`start` awaits the first pull before it answers.** `runFlow` is lazy, so the stage precondition
  and the run lock are evaluated there. A host that stored the iterable and reported success would
  report two concurrent starts on one ticket as two started runs — §9 risk 1, and the failure every
  test that starts *one* run passes.
- **Identity is the host's.** A module-level counter mints `run-N`; `core`'s `runId` is read off the
  **terminal event's typed field** and never before. No event's `message` is parsed, no `gateId` is
  taken apart, nothing names the run-number allocator. §1.2's measurement is why: both pre-stream
  refusals happen where `core` has no run number to give, so a refused start reports **none**.
- **Consumption is one loop.** A rejection after the terminal event is recorded on the run and never
  published; subscribers are released normally either way.
- **`stop` aborts with a non-empty string**, because `interruptionNote` reads `signal.reason` only
  when it is one and silently substitutes the thrown message otherwise.
- **`shutdown` awaits `iterator.return()` *and* the loop**, because they finish independently: the
  abandonment path detaches the in-flight pull before finalisation emits.

**`index.ts`** — a named-export barrel, one name at a time.

### New — tests (1,278 lines across four suites) and `test/fixture.ts` (193)

`test/fixture.ts` builds a repository, a harness, a flow file and a ticket under `os.tmpdir()`, with
the git identity passed per invocation. Nothing in this package reads this repository, the machine's
git config, an existing `.harness/worktrees` or `.quorum/runs`, or a network.

- `broadcast.test.ts` (12 tests) — AC-6, AC-7 over events the file makes.
- `gates.test.ts` (9) — AC-9, AC-10 arithmetic.
- `host.test.ts` (28) — AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13, AC-14
  over **real runs**.
- `package.test.ts` (24) — AC-1, AC-2, and the source-level halves of AC-3, AC-5, AC-6, AC-12, AC-13,
  AC-14. One file, because a scan that quotes what it forbids must exclude itself and two such files
  would each be a hole in the other's corpus.
- `index.test.ts` — rewritten. It asserted `name === '@quorum/server'` over a placeholder export whose
  subject this ticket removed; it is a register of the seven published names now, both directions
  (*"A check outlives its subject only if it can still fail"*, 2026-09-05).

### Changed

**`packages/core/src/index.ts`** — three type exports and a docblock paragraph. `AnswerGate` was
undeniable; `Project` and `TicketRecord` join it because a host holds both in a registry field for
the lifetime of the process, where the CLI's `ReturnType<typeof loadProject>` reaches a local
variable and no further. **`RunFlowOptions` and `RunStatus` are withheld with their reasons** — the
first because a caller composing options is checked structurally and never has to name the type, the
second because `RunTerminalEvent` already carries a typed `status`. No value moved; the surface
`packages/cli/src/package.test.ts` counts is unchanged and green.

**`packages/server/package.json`** — the two workspace dependencies at `workspace:*`, no external
one, no `build`, no `exports`, no `files`, no `bin`. `pnpm-lock.yaml` moved with it (+8 lines).

**`docs/04-architecture.md`** — §`packages/server` rewritten (GO-3), the package-map line corrected,
the status line bumped with 2026-09-11 and Q-0013.

**`packages/shared/src/docs.test.ts`** — a new `Q-0013 GO-3` block, +81 lines, holding the document to
what shipped: one assertion per *claim* rather than per noun, over a slice of the section rather than
the page, with an anti-vacuity clause. The gate-answer vocabulary is read out of `gateAnswerSchema`
rather than from a literal, so a widened envelope makes that clause the place the two are reconciled.

---

## 2. Criterion by criterion

| | what proves it |
| --- | --- |
| **AC-1** | manifest register in both directions; `runFlow` and `eventSchema` resolve, and `import.meta.resolve` lands in `packages/*/src/index.ts` under `quorum-source`; no build script, exports map, files list or bin; the lockfile carries the package and its links. |
| **AC-2** | the type set is **derived** from the package's own imports and compared with the barrel's **export statements** (not its whole text — the docblock names both withheld types, and a scan that could not tell prose from an export would refuse the record of a decision for repeating the word it decided about); no `Parameters<typeof runFlow>` or `ReturnType<typeof loadProject>`; no deep-path import; the type half is the compiler's, and the three are *used* as types in that file so an elided import cannot satisfy it. |
| **AC-3** | a completed run's view carries `runId: 1` after the terminal event and `null` before it; two runs take two handles; scans for `.message` receivers, `gateId.`, `parseInt` and the allocator; the `record.runId` assignment register is `['event.runId']` exactly. |
| **AC-4** | two starts on one ticket, the second after the first answered: one started, one refused, carrying `run lock refused: ticket T-0001 is held by run #1` and matching `(flow probe, pid \d+ on .+, started <ISO>)`; the refusal has no run number, no stream to watch, and wrote no second manifest. |
| **AC-5** | the stage refusal's sentence is compared against the **same refusal driven directly through `runFlow`**, so it is taken from `core` rather than transcribed; a refused start wrote no run history; a missing flow and an unknown ticket refuse the same way; `refusalFor(ProjectNotFoundError)` carries condition + remedy and a look-alike by name does not; the remedy lives in exactly one production module. |
| **AC-6** | two simultaneous subscribers receive identical sequences ending in exactly one terminal event; a `parallel:` group is covered by asserting both members spoke and both subscribers agreed, never an order `core` does not promise; the hazard is demonstrated (`already iterated`) on a stream the test owns; and `host.ts` takes an iterator at exactly one site, with `subscribe` shown not to. |
| **AC-7** | replay-then-tail with no gap or duplicate at both a real run and synthetic events; capacity zero is live-tail-only and reports what was missed; partial eviction reports the evicted count; `eventSchema.safeParse(missed).success === false` beside a positive control; the bound is refused at construction **and** in the broadcast, through one shared predicate. |
| **AC-8** | a `MOCK_FAIL_WRITE` run delivers exactly one terminal event, last; the post-terminal rejection is recorded as the run's `failure` and appears nowhere as a second terminal event; subscribers released normally. |
| **AC-9** | a real run at a gate: `advance` continues it to `completed`/`requirements`; `abort` ends it `aborted`/`draft`; unknown run, unknown gate, **foreign gate** (two runs, gate ids forced apart by seeding the second ticket's `runs.log`), a bad word and a missing word are each refused with the run left running; a second answer finds nothing; two answers in one turn settle once. |
| **AC-10** | a gate reached with **no subscriber attached**, answered through `view().gates`, ends `completed` and `runs.log` carries no `undecided`. |
| **AC-11** | a stopped run records `interrupted stage=draft→draft` and `error="stopped for the test"` in `runs.log`, and **keeps the worktree it obtained** — asserted non-empty *before* the stop so "keeps it" claims something. Blank reason, unknown handle and a finished run each refused. |
| **AC-12** | the manifest reads `running` before shutdown and `interrupted` with a non-null `ended_at` **read straight after the await**; a second shutdown is harmless; source scans for sockets, signal handlers and `process.exit`, each demonstrated firing on a hostile string; the listener count is compared before and after importing the package, and that comparison is shown to fire against a stray listener. |
| **AC-13** | `../../etc` is refused by `core`'s own token check through this host with no second check here; a run with no `auto` reaches its gate and one with `auto: true` does not; a `dry` run completes, consults the gate registry not at all, emits no gate question, writes no `runs.log`, no manifest and **no change to `ticket.md`** (Q-0116 holding through this host) — with a real run through the same host immediately after, so the three absences are a property of `dry` rather than of a fixture that writes nothing; a dry walk runs **beside** a run holding the lock; no API-key spelling anywhere in the package. |
| **AC-14** | the fixture's repo is outside this package; no file sets `testTimeout`; `vitest.config.js` is byte-checked as the one-line re-export; `pnpm sweep:git-identity` green (below). |

---

## 3. Shown red before green

Five mutations, each reverted:

1. **`start` does not await the first pull** (§9 risk 1) → **three** tests red: the lock refusal, the
   one-run-exists clause, and the stage refusal. This is the criterion earning its existence.
2. **`record.runId = Number(event.message)`** → the `.message`-receiver scan and the assignment
   register both red, naming the receiver and the expression.
3. **`controller.abort()` with no reason** → AC-11 red on the missing `error="stopped for the test"`.
4. **`subscribe` touching the run's iterator** → the one-iteration clause red.
5. **The route clause restored to `(advance/retry/override with reason)`**, and separately **the
   identity sentence weakened** → the two new `docs.test.ts` clauses red, each by name.

---

## 4. Verification

- `pnpm turbo run lint typecheck test --force --continue` → **21/21 tasks, 0 cached**, green. Run
  four times during the change and once at the end.
- `packages/server` alone: **75 tests, 5 files**, ~2.1 s.
- `pnpm sweep:git-identity` → **green**, which is itself the both-environment-rows run: *"the
  workspace suite executed and green with no resolvable git identity"*.
- `pnpm exec quorum lint` → **6/6**.
- `git status` is the intended set and nothing else: seven modified files, nine new.

---

## 5. What I deliberately left alone

- **`docs/06-development-plan.md`.** Its M3 gate-screen line carries the same *"override with reason"*
  promise `04-architecture.md:63` did. Q-0094's erratum E-3(a) rules that this page's bullets are
  rewritten by hand at each plan pass, so an implement step editing it turns a harmless revert into a
  review finding. `04-architecture.md` now names that line and its owner so it cannot expire.
- **`CLAUDE.md` and `docs/GLOSSARY.md`.** No glossary term was added — see the observation below.
- **`harness/architecture.md` and the role files.** GO-1 ruled the chore route; `developer-generalist`
  already carries `packages`. Granting `packages/server` to a fan-out role was the recommendation the
  gate **declined**, so nothing moved.
- **`packages/core` beyond three type exports.** Non-goal 11: the host consumes, it does not
  negotiate. No change to `runFlow`, the channel, the event union, the gate mechanism, lock policy or
  cancellation ownership.
- **No `packages/server/turbo.json`.** The one out-of-package read the suite performs is
  `packages/core/src/index.ts`, and `@quorum/core` is a workspace dependency, so the root `test`
  task's `^test` edge already hashes it — the same reason `packages/cli/turbo.json` omits the two
  manifests its own suite reads. Stated in the test's own comment rather than left to be re-derived.
- **AC-15** was struck by the requirement (§1.8); `plan-backlog.test.ts`'s `UNCREATED` register
  already holds no `Q-0013` row, verified.
- **No per-subscriber backpressure ceiling.** AC-6's claim — a slow subscriber isolates — is met by
  per-subscriber queues. A measurable ceiling with an explicit outcome is named in Q-0118's body as
  that child's, and it needs a socket to apply it to.

---

## 6. Gate obligations

- **GO-1** — ruled at the gate; taken as read. The chore route, no role grant, no round spent on a
  correct refusal.
- **GO-2** — routed to Q-0016 and *not required here*. I did the cheapest thing that stops it
  expiring: the section I was required to rewrite (GO-3) contained the false clause, so it is
  corrected **and the contradiction, its authority and its owner are recorded in place**, with the
  development plan's twin named. I ruled nothing — the answer set is `core`'s already. Flagged here
  because it is the one place I went past the literal criteria, and it was that or silently preserve
  a false promise in a paragraph I was rewriting around.
- **GO-3** — done. `04-architecture.md` describes the host, names Q-0118 and Q-0119, carries AC-3's
  minted id so successor A and Q-0014 inherit an answer, and the status line records the change.
  **No glossary term is owed** — see the observation below.
- **GO-4** — the human's at the gate. I verified forced in this worktree only; CI on the merged
  commit is what Q-0105's GO-3 requires and is not something an implement step can produce.
- **GO-5** — already discharged: `backlog/Q-0118-…` and `backlog/Q-0119-…` exist with both
  appendices transcribed in full.

**No decision entry is owed**, which is what the requirement said and what the implementation found.
