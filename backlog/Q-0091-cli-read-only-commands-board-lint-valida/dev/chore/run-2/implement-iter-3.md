# Q-0091 — implement, run 2, iteration 3

*A third revision round on the same two majors. **No files changed this round** — `git status` is
empty and the tree is byte-identical to iteration 2's commit `14a934e`. Both findings are held for
the third time, and the round was spent re-verifying them by execution rather than re-arguing them,
and on the audit no review round has yet done: R-1, the ticket's own top risk.*

---

## 1. Why I changed nothing, stated plainly

The reviewer offers two routes in each finding — *"Add a gate erratum limiting AC-4 to `lint`, or
change the implementation"*; *"obtain the proposed gate erratum correcting AC-2, or change the
handler"*. **Both are closed to me.**

- **The erratum.** `requirements/errata.md` is under `backlog/`, which is not an agent-writable
  surface: my role forbids writing a ticket file and the engine discards one if I do. I drafted both
  errata in iteration 2 §5 and re-draft them in §6 below, which is the whole of what I can do.
- **Implementing as written.** AC-4 requires `validate` to open a project and exit 1 where none is
  found; AC-2's aside requires `lint` to read no flags. Each is a **behaviour change**, not a
  stylistic divergence, and ground rule 3 (*"Behaviour is preserved"*) and §6 non-goal 15 both forbid
  it. `validate` is the one command in this ticket with a *machine* consumer — a `qa-red`
  `type: script` step reads its exit code — so making it refuse outside a checkout breaks the surface
  the criterion set exists to protect.

The reviewer is right that I may not resolve a contradiction between two binding documents by
picking one. I am not disputing that, and I am not asking for a fourth round. My role's own
instruction is to *"stop and say so rather than improvising a decision it does not authorise"*, and
the standing ruling is *"A refused finding is a gate, not another round"* (2026-08-31). **Q-0083 —
an implement step that can return `blocked` — is the mechanism this round would have used if it
existed.** This is its eleventh appearance.

Yielding was considered and rejected on this repository's written record, not on preference.
Q-0052's round 3 yielded to a reviewer that had never been asked *which of the two documents should
move*; the development plan records that yield as the mistake, says the preserved-defect pin was
deleted with it, and instructs that the round-3 draft not be adopted. The repair was made by hand
after the gate.

---

## 2. The contradiction, re-measured live rather than inherited

Iteration 2's probes are a *document*. I re-ran both against the spike in this worktree rather than
transcribing them — *"a measurement copied from a document is not a measurement"*. Both hold.

**Structural, before either probe.** `grep -n loadProject spike/bin/harness.js` gives call sites at
`:341`, `:354`, `:401`, `:407`, `:463`, `:542`. The `validate` case is `:426–461`, and **no call site
falls inside it** — `:401` is `lint`, `:463` is the next command after `validate` ends.

| probe | command | measured result |
| --- | --- | --- |
| **A** | `harness validate <schema> <good.json> --project /tmp/q91/empty` | prints the notice, `✓ … matches schema.json`, **exit 0** — the flag is ignored, no project opened |
| **B** | `harness lint --project /tmp/q91/empty` | **exit 1**, `ENOENT … /tmp/q91/empty/harness/harness.yaml`, stack naming `loadProject (harness.js:58)` then `main (harness.js:401)` |

Probe B's stack is an independent oracle for the numbering: `loadProject` (`:54`) reads
`flags.project` at `:55` as a closure over the module-level `flags`, and `lint` calls it at `:401`
**with no argument**. So the `lint` case block names no flag while the command honours it — which is
exactly the reading AC-2's aside encodes, and it is wrong about the behaviour.

**Conclusion, unchanged and now twice-measured:** AC-4's *"Both commands call `loadProject()` first"*
is true of `lint` and was never true of `validate`; AC-2's *"`lint` reads neither"* describes the
case block rather than the behaviour.

---

## 3. Both guards fire — re-run, and one correction to iteration 2's own count

Each mutation was applied, measured, and reverted; `git status` at the end of §5 confirms neither
survives.

| mutation | measured this round |
| --- | --- |
| `validate` calls `loadProject()` first — **AC-4 literal** | **2 failed**, 224 passed |
| `lint` ignores `flags.project` — **AC-2 aside literal** | **3 failed**, 223 passed |

**Iteration 2 reported the first as "1 failed, 22 passed". That is understated, and the difference is
material rather than cosmetic.** The AC-4-literal mutation fires *two independent guards*:

1. `validate.test.ts` — *"and it opens no project, so a script step outside a checkout still runs"*:
   `expected 1 to be +0`. The exit code.
2. `frame.source.test.ts` — **AC-10**: `AC-10: expected [ Array(1) ] to strictly equal []`.
   `validate.ts` would then name `loadProject`, which is not in its `COMMAND_DOMAIN` row
   `['validateArtifact', 'readData']`.

That second one is the register working as designed, and it carries a consequence for the gate:
**if the ruling goes the other way, `COMMAND_DOMAIN['validate.ts']` must gain `loadProject` in the
same change.** The register makes the disputed change visible rather than silent, which is what
AC-10's inverse clause was added for — and it is stronger evidence than the mutated-copy
demonstrations, because it fired on the real tree.

The AC-2 mutation's three failures reproduce iteration 2's report exactly, and show `--project` is
load-bearing on two AC-4 error paths as well as the AC-2 test:
`expected '✓ in-the-cwd.yaml\n' to be '✓ over-there.yaml\n'`.

---

## 4. The audit no review round has done — R-1, the ticket's top risk

Two rounds have now been spent on two sentences, while the requirement's **R-1** — *"five guards move
in one ticket, and a weakened guard reports green … the repository's most-recorded defect class"* —
has had no review attention at all. Round 1 raised only the two majors above. I audited it.

**AC-10 — the `DOMAIN` scan.** `domainOffenders` is a function over its inputs rather than assertions
over three constants, so each clause is demonstrated on a mutated copy (`:292–319`): a domain symbol
in the frame, a symbol in the wrong command, an unregistered command module, an entry naming no
module, and an entry permitting a symbol its module does not name. The frame/command split is
**derived from `COMMANDS`** rather than hand-listed, which closes the `q0050.source.test.ts`
fail-open shape Q-0051 found — a module named after an unregistered command falls to the frame half
and inherits the *full* prohibition, so the derivation fails closed in both directions. The partition
is itself asserted non-empty on both sides (`:192–202`).

**AC-11 — the I/O split.** `IO_MODULE` shrank by exactly `node:path`, which moved to `FRAME_ONLY_IO`;
the frame keeps the whole prohibition and only command modules gained one import. Both halves are
shown discriminating over text (`:339–346`), including that a *mention in prose* does not satisfy
it — the Q-0079 round-1 failure, a guard that can be talked out of firing by text it does not
execute.

**AC-9 — the single-copy scan, and the defect class it could have had.** The notice now lives in one
production file. `packages/cli/dist/validate.js` carries it too, which is the shape that made
Q-0096's round 2 red everywhere the moment a build ran — *"A test's verdict is a property of the
commit, not of the checkout"* (2026-08-30). **Checked rather than assumed:** `packageSources()`
walks only `src` and prunes `['node_modules', '.turbo', 'dist']` at `:336`, so the verdict is stable
across built and unbuilt checkouts. Verified with `dist/` present.

**AC-13 — the register schema.** All four of the mutation demonstrations E-2's ruling requires are
present and distinct: a `binaryCarriedBy` naming a file that does not exist (`:1490`), one naming a
file no include collects (`:1498`), one on a `ported` entry (`:1509`), and an empty list (`:1511`) —
existence and collection failing separately, as the audit's own `node_modules/.bin/turbo` comment
requires.

**Verdict of the audit: I found nothing weakened.** Stated as a measurement rather than as
reassurance — this is the risk the requirement itself ranked first, and it now has an examination on
the record.

---

## 5. Verification

All forced, after both mutations were reverted.

| check | result |
| --- | --- |
| `pnpm turbo run test --force` | **7/7 tasks, 0 cached** — shared 150, core 1290 (+2 skipped), **cli 226**, four scaffolds 1 each |
| `npm test --prefix spike` | **19/19 files passed** |
| `git diff --stat HEAD -- spike/` | **empty — 0 edits under `spike/`** (ground rules 1 and 2) |
| `pnpm turbo run lint typecheck --force` | **14/14 tasks, 0 cached**, 0 errors |
| `pnpm sweep:git-identity` | green — *"both suites executed and green with no resolvable git identity"* |
| `pnpm turbo run build --force` | **3/3** |
| `git status --short` | **empty** — no file changed this round |

**§10's manual proof — the shipped binary against the spike**, including the two disputed paths:

| case | agreement |
| --- | --- |
| `lint` over the six shipped flows | **identical**, six green ticks, exit 0 |
| **`lint --project <no-config dir>`** | **identical** — same `ENOENT` on the same path, as in probe B |
| **`validate … --project <same dir>`** | **identical** — notice, `✓ … matches`, exit 0, as in probe A |

The last two rows are the disputed behaviours themselves, reproduced by `pnpm exec quorum` through
the built artifact.

**One pre-existing warning, reported and not fixed.** `packages/core/src/backlog/backlog.ts:276`
raises *"Unused eslint-disable directive (no problems were reported from 'no-control-regex')"*. It is
a warning, not an error — `pnpm lint` is 14/14 — and it belongs to **Q-0080**, which last touched
that file; `git diff HEAD~3` shows this ticket never touched it. Not traceable to any criterion here,
so out of scope.

---

## 6. What the gate is being asked to rule

Both rulings are one line each, and **under both the code on this branch is already correct**, so
`advance` needs no further implement round. Neither is mine to write.

**E-5 — AC-4 governs `lint` alone; `validate` opens no project.** Measured twice, by two rounds:
`spike/bin/harness.js`'s `validate` case (`:426–461`) contains no `loadProject` call site, and running
it with `--project` aimed at a directory holding no `harness/harness.yaml` validates normally and
exits 0. AC-4's *"Both commands"* is true of `lint` and was never true of `validate`. Requiring a
project would be a behaviour change on the command's machine-facing surface, refused by ground rule 3
and §6 non-goal 15. AC-4's headline, its sentence and its no-stack-trace clause are unchanged for
`lint`.

**E-6 — AC-2's aside is wrong about `lint`; its normative half stands.** `spike/bin/harness.js:55`
reads `flags.project` *inside* `loadProject`, which `lint` calls at `:401` with no argument, so
`harness lint --project <dir>` lints that project. The clause *"`validate` reads `rest`, `lint` reads
neither"* describes the case block rather than the behaviour. What binds is the headline — *no
command re-parses the command line* — which the shipped `lint` satisfies: it reads the value the
frame parsed, calls no `parseArgv`, touches no `process.argv`, and defines no second flag table.
AC-2's own *Test:* clause is fully met.

**If the gate rules the other way** — that the criteria stand and the code moves — then §3's second
finding is the thing to carry into that change: `COMMAND_DOMAIN['validate.ts']` must gain
`loadProject`, or AC-10 goes red. That is the register doing its job, and it is why the change cannot
land silently.

---

## 7. Deliberately left alone

- **Everything under `spike/`** — untouched, and measured as untouched (ground rules 1 and 2).
  Nothing this round needed a spike change.
- **Everything under `backlog/`**, including `requirements/errata.md` — not an agent-writable surface.
- **`docs/decisions/`** — a decision is the human's to record. Neither erratum above rises to one.
- **The `harness`-named sentences** — `usage: harness validate …` and ``run `harness init` in your
  repo`` are preserved verbatim: **Q-0100's**, per E-1 and OQ-2, not this child's.
- **Q-0068's *"Harness runs on subscription OAuth only"*** — this ticket renders no adapter output.
- **`path.resolve(true)` on a valueless `--project`** — preserved defect, already pinned.
- **`backlog.ts:276`'s lint warning** — Q-0080's, pre-existing, not traceable to a criterion here.
- **The eleven criteria the review did not raise** (AC-1, AC-3, AC-5 to AC-13) — approved in round 1.
  I re-ran them rather than re-read them, and additionally *audited* the five guard migrations among
  them (§4), which is the one thing this round adds beyond verification.
- **Any re-argument of the two findings.** Iteration 2 made the case; repeating it a third time is
  the round the 2026-08-31 decision exists to prevent. What is here instead is measurement.
