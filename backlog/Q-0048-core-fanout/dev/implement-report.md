# Q-0048 — implementation report

`core/fanout`: tasks, waves, worktrees and branches. Chore route, **iteration 5 — a revision
round**. `review/chore-iter-4.md` returned one major and no blocker. It is correct, it is fixed in
full, and it is not argued with.

**One file changed this round**, 32 insertions and 3 deletions:

| File | Change |
| --- | --- |
| `packages/core/src/fanout/fanout.test.ts` | +32 −3 — AC-11's exclusion narrowed, and one test that holds it there |

`fanout.ts`, `command.ts`, `fanout.source.test.ts` and `command.test.ts` are **untouched this
round**. That is worth stating plainly: no source file changed, so no preserved defect could have
been fixed in passing, and every AC-12 pin is exactly where iteration 4 left it.

---

## The finding

### AC-11's snapshot filtered out all of `.harness/`, not just the worktree root (fixed)

> *The snapshot helper removes every path beneath `.harness/`, while AC-11 permits changes only
> beneath `.harness/worktrees/` and `.git/`. A regression writing elsewhere under `.harness/` would
> therefore pass this safety test. Narrow the exclusion to `.harness/worktrees/` so other `.harness`
> changes remain visible in the before/after comparison.*

**Correct, and it is the most valuable kind of finding in this ticket** — a safety test that was
weaker than the criterion it claimed to prove. AC-11 is this ticket's clause of register row 19, the
one that says a flow never writes to the user's working tree. The helper read:

```ts
const outside = (entries: string[]): string[] =>
  entries.filter((e) => !['.harness', '.git'].includes(e.split(path.sep)[0]));
```

It splits on the **first segment only**, so `.harness/notes.txt`, `.harness/runs/x` and every other
sibling of `worktrees/` were filtered away before the comparison ever saw them. The test would have
reported green over a module that wrote them. That is *"a check that skips its subject must not
report success"* (`docs/DECISIONS.md`, 2026-08-25) arriving inside the very test written to enforce
the criterion — the fourth time that entry has caught something in this ticket, and the second time
in a test rather than in the code.

**The fix.** The predicate now names what it permits instead of which top-level directory to ignore:

```ts
/** The worktree root as `walk` spells it: below the repository, separated by this platform's `sep`. */
const WORKTREE_ROOT = path.join(...REPO_WORKTREE_ROOT.split('/'));

const permitted = (entry: string): boolean =>
  entry === '.git' || entry.startsWith(`.git${path.sep}`)
  || entry === WORKTREE_ROOT || entry.startsWith(`${WORKTREE_ROOT}${path.sep}`)
  || WORKTREE_ROOT.startsWith(`${entry}${path.sep}`);
```

Three notes on the shape, each deliberate:

- **The root comes from `REPO_WORKTREE_ROOT`, not from a second spelling of the literal.** The file
  already carries the one spelling AC-9 permits, in `spikeWorktreeDir`, whose comment says it is
  *"the ONE spelling of the literal permitted anywhere in this ticket, and it is in a test"*. Writing
  `.harness/worktrees` again here would have contradicted that, and reaching for the shared constant
  is what AC-9 asks the source to do anyway. `@quorum/shared` is already a declared dependency of
  `packages/core`; no dependency was added.
- **The third disjunct is the ancestor rule**, and it is the one judgement call — section A below.
- **`path.join(...split('/'))` matches how `walk` spells its entries.** `walk` returns
  `fs.readdirSync(…, {recursive: true})` keys, which use `path.sep`, while `REPO_WORKTREE_ROOT` is
  written with a forward slash. On POSIX — which this workspace is — these are identical; the join is
  there so the predicate is about paths rather than about a string that happens to match.

### The assertion that holds it there, verified red before green

The fix as literally requested is three lines and leaves nothing behind to stop it regressing, so I
added one test beside it that asks the helper the reviewer's own question directly:

```ts
test('the comparison keeps a write anywhere else under .harness visible', () => { … })
```

It asserts both directions — that the root, its ancestors and `.git/` are permitted, and that
`.harness/notes.txt`, `.harness/runs/x`, `.quorum/runs` and a plain `f.txt` all survive the filter
into the comparison.

**It was verified non-vacuous, not assumed.** I restored the old broad predicate and re-ran the file:

```
$ pnpm --filter @quorum/core exec vitest run src/fanout/fanout.test.ts
 FAIL  AC-11 … > the comparison keeps a write anywhere else under .harness visible
AssertionError: everything else stays visible to the comparison:
  expected [ '.quorum/runs', 'f.txt' ] to strictly equal [ '.harness/notes.txt', …(3) ]

- ".harness/notes.txt",
- ".harness/runs/x",

      Tests  1 failed | 46 passed (47)
```

It fails naming `.harness/notes.txt` and `.harness/runs/x` — precisely the class the reviewer said
would slip through, by hand, one round earlier. The fix was then restored and the file is green. A
test written to close a finding that has never been seen to fail is a test whose value is unmeasured;
this one has its red phase on the record.

**Where this goes one test beyond the finding, and why.** The finding asks only for the exclusion to
be narrowed. The added assertion is my judgement and I name it so it can be disagreed with cheaply:
without it, the helper is three lines of filtering logic whose correctness is invisible in a diff, and
the failure mode is silent — the surrounding snapshot test keeps passing either way, which is how the
gap survived four rounds. It adds no runtime code, no dependency and no behaviour, and it lives in a
test file this ticket created.

---

## A. The one judgement call: the root's own creation

**AC-11 says the snapshot must differ *"only under `.harness/worktrees/` and `.git/`"*, and taken
literally that cannot be satisfied.** `ensureWorktree` calls `fs.mkdirSync(root, {recursive: true})`,
which creates `.harness` and `.harness/worktrees` themselves. Those two entries are the worktree root
and its parent — not something *under* the root. A predicate that permitted only strict descendants
would fail the snapshot test on the module doing exactly what the criterion authorises it to do.

So `permitted` also allows an entry that is a **proper ancestor path of** the root
(`WORKTREE_ROOT.startsWith(`${entry}${path.sep}`)`), which matches `.harness` and nothing else. It
does **not** match `.harness/notes`, `.harness/runs` or any sibling, which is the whole point of the
finding and is asserted in both directions by the new test.

I am reporting this rather than deciding it quietly, because it is the one place where the
implementation reads the criterion more permissively than its literal words. The alternative —
snapshotting only `.harness/worktrees/**` and comparing the two `.harness` entries separately — is
more words for the same guarantee. If the reviewer prefers the stricter reading, the change is one
disjunct and I will make it; nothing else depends on it.

---

## What shipped, file by file

Carried forward from iterations 1–4 and unchanged except where marked. The change remains purely
additive: five files under `packages/core/src/fanout/`, and **no pre-existing file in the repository
is modified**.

### `packages/core/src/fanout/fanout.test.ts` — 574 → 603 lines — **the only file changed this round**

AC-2 through AC-9, AC-11 and AC-12 against real git repositories built by `packages/core/test/repo.ts`.
Every fixture builds the topology it asserts; no case asserts the branch or containment state of this
repository. Reuses `repo()`, `tempDir`, `write`, `commit`, `commitAll`, `walk`, `installGitShim` and
`git` rather than duplicating them, and `afterAll(removeTempDirs)` removes every worktree the suite
cuts (AC-11 — Q-0062 already has four on disk and a suite must not make an open ticket worse).

**This round:** the AC-11 `describe` block gained `WORKTREE_ROOT`, a documented `permitted`
predicate, and one test. `outside` keeps its name and signature, so the two snapshot tests below it
are unchanged. 46 tests → 47. One import added: `REPO_WORKTREE_ROOT` from `@quorum/shared`. Nothing
else in the file was touched — the AC-2 through AC-9 and AC-12 blocks are as iteration 1 wrote them.

### `packages/core/src/fanout/fanout.ts` — 330 lines (AC-1) — *unchanged since iteration 4*

`spike/src/fanout.js` less `:124–134`, in TypeScript strict. Twelve runtime exports —
`IntegrationError`, `loadTasks`, `scopeToFailing`, `waves`, `taskVars`, `taskPromptSection`,
`branchExists`, `branchHead`, `resetBranchTo`, `commitAll`, `mergeInto`, `ticketWorktree` — and four
structural types (`TaskNode`, `Task`, `TicketFolder`, `MergeResult`).

- **`git()` and `safe()` are declared here, not imported.** `git/git.ts` keeps both module-private
  and exports neither; widening that module's surface to save four lines would be this ticket
  spending another ticket's budget.
- **`resetBranchTo` reaches for `REPO_WORKTREE_ROOT` and `worktreeDirName`** (AC-9). Neither
  `.harness/worktrees` nor `replace(/\//g` appears in either source file, asserted at source level;
  the *path produced* is asserted equal to the spike's inline expression evaluated on the same
  inputs, which is the only honest way to change a derivation while promising identical output.
- **The YAML boundary is one named cast with a `Why:` line** (`parsedTasks`), following `lint.ts`'s
  `loose` precedent. Reading `.tasks` through it still throws the raw `TypeError` an empty file
  throws today — defect 1 below, and the cast is shaped to preserve it rather than to smooth it over.
  No `any`, no `@ts-ignore`.
- **`waves` and `scopeToFailing` are generic over `TaskNode`** — they are given tasks and hand the
  same objects back, which is what lets AC-4 transcribe the spike's `{id, depends_on}` fixtures
  unchanged while `loadTasks(…)` still flows through as `Task[]`.
- **`loadTasks`'s parameter is `{ dir: string }`**, not `TicketRecord` — `backlog/` is Q-0043's
  module and not a declared dependency of this one. A compile-time assertion in the test file shows
  `TicketRecord` is assignable to it.
- **`taskPromptSection` forwards `description` and nothing else the task holds.** Its JSDoc names the
  ownership decision as the reason, because widening it moves the ownership channel rather than
  improving a prompt.

### `packages/core/src/fanout/command.ts` — 73 lines (AC-1, AC-10) — *unchanged since iteration 1*

`runCommand` alone, plus `RunCommandOptions` and `CommandResult`. Split from `fanout.ts` for the
reason AC-1 gives and no other: *"the shell appears in exactly one file in `core`"* is a rule a source
test can enforce over the whole package, where *"`execSync` appears once inside `runCommand`"* is not.
Measured before and after: `execSync` occurs in this file and in no other non-test source under
`packages/core/src`.

The default is written as the expression `15 * 60_000`, not a named constant — a named export would
have broken AC-1's exact export list, and a module-private constant would have hidden the literal the
criterion asks to be readable. `stdio: ['ignore', 'pipe', 'pipe']`, `killSignal: 'SIGKILL'` and all
three timeout disjuncts are pinned at source level as well as behaviourally, because dropping one is
invisible until a timeout is banked as proof of red.

### `packages/core/src/fanout/fanout.source.test.ts` — 230 lines — *unchanged since iteration 4*

AC-1 and AC-13, plus the source-level halves of AC-6, AC-9 and AC-12. Reads through
`coreSourceFiles()` keyed by full path (`fanout/fanout.ts`, never a bare filename), so a same-named
file elsewhere never answers for these. E-1's citation line on the import allowlist is intact, and no
branch-state assertion has returned.

### `packages/core/src/fanout/command.test.ts` — 60 lines — *unchanged since iteration 1*

AC-10. No case waits for the default timeout: the timeout cases supply a short `timeoutMs` and then
bound the elapsed time well inside what the command was asked to do.

---

## Two places where a criterion could not be met as written

### AC-8's *"`error` … non-empty"* is unreachable on a content conflict *(unchanged, still open)*

**Measured, not inferred.** `git merge` writes `Auto-merging …` and `CONFLICT (content): …` to
**stdout** and leaves **stderr empty**. `mergeInto` builds its message as `String(e.stderr ?? e.message)`,
and `??` does not fall back on an empty string — so on the most common failure this function has,
`error` is `''`. Making it non-empty means changing that expression, which charter §2 forbids.

What I did instead: pinned `result.error === ''` for the conflict case, with the stdout/stderr split
asserted beside it so the reason is in the test rather than in a reviewer's head (defect 6 below); and
satisfied AC-8's structural clause — non-empty, at most 500 characters, equal to the tail of what the
failure carried — on a merge failure git **does** report on stderr, which also has an empty
`conflicts` list and so is the case where `error` is the only information there is.

**How this was found is itself worth recording.** My first draft asserted only
`raw.endsWith(result.error)`, which passes vacuously over `''`, and it did pass. Adding
`expect(raw.length).toBeGreaterThan(0)` first is what turned a green tick into the finding.

### AC-13's `spike/` bullet is evidence, not an assertion *(settled by E-1; closed)*

`requirements/errata.md` E-1 settled it as evidence and iteration 3 removed the assertion. Nothing is
left to the gate.

**The evidence E-1 asks for, re-performed on this branch after this round's change.** Four commands,
output verbatim:

```
$ git rev-parse --is-shallow-repository
false

$ git diff --name-only main...HEAD
packages/core/src/fanout/command.test.ts
packages/core/src/fanout/command.ts
packages/core/src/fanout/fanout.source.test.ts
packages/core/src/fanout/fanout.test.ts
packages/core/src/fanout/fanout.ts

$ git status --porcelain
 M packages/core/src/fanout/fanout.test.ts

$ git status --porcelain -- spike
(no output)
```

The shallow probe is first for the reason `.github/scripts/port-freeze-guard.sh` has it: a diff
computed over history that is not present comes back empty for the wrong reason.
`--is-shallow-repository` answers `false`, so the diff below it is evidence rather than an artefact.
The committed diff names five paths, all under `packages/core/src/fanout/`; the uncommitted state
names the one file this round changed, in the same folder; and `git status --porcelain -- spike` is
empty, covering what committed history cannot see. **No path under `spike/` appears in any of them.**

CI's `port freeze (branch scope)` job remains the enforcement, and it is the only thing that can be —
it reads the charter's `children:` list and honours the exemption trailer, the discrimination E-1
notes a Vitest assertion cannot make and which four scheduled tickets (Q-0038, Q-0040, Q-0066,
Q-0068) need.

---

## Findings: noticed while reading, reported and not acted on (AC-12, charter §2)

None of these is a defect I introduced, and **none is fixed**. Items 1–4 are the four the requirement
names; 5 and 6 were found while porting. Each preserved behaviour carries a one-line
`Why: preserved defect, see Q-0048 AC-n.` in the source, per `harness/rules.md`.

**The Home column is `requirements/errata.md` E-2's table, transcribed.** It is not my recommendation:
E-2 decided five of the six and left one open on purpose.

| # | Defect | Home | Recorded |
| --- | --- | --- | --- |
| 1 | `loadTasks` throws a raw `TypeError` on an empty `tasks.yaml` | **none yet — open** | **not discharged; a gate decision** |
| 2 | `runCommand` inherits a 1 MiB `maxBuffer` | **Q-0065** | landed, `80bc290` |
| 3 | `branchExists`/`branchHead` cannot tell absent from failed | **Q-0050** | landed, `80bc290` |
| 4 | `commitAll` reports a discard when the revert failed | **Q-0050** | landed, `80bc290` |
| 5 | `commitAll`'s first discarded path loses its first character | **Q-0050** | landed, `939c75f` |
| 6 | `mergeInto` returns `error: ''` on a content conflict | **Q-0050** | landed, `939c75f` |

1. **`loadTasks` throws a raw `TypeError` on an empty `solution/tasks.yaml`.** `YAML.parse('')` is
   `null`, and `null.tasks` throws *"Cannot read properties of null (reading 'tasks')"*, which the
   CLI's `catch` does not recognise — so the user gets a stack trace instead of a sentence.
   `spike/src/fanout.js:15`; ported at `fanout/fanout.ts:107` and `:113`. Pinned by a test asserting
   it is a `TypeError` and **not** an `IntegrationError`, so the ticket that eventually fixes it
   changes a red test rather than a silent behaviour.
   **This one has no destination.** E-2: *"Defect 1 has no home yet and the obligation is **not**
   discharged for it. That is a decision for the chore gate, not for the implementer."* The candidates
   E-2 names are **Q-0060** — whose subject is a malformed file under the module the product calls its
   database — and **a new ticket**. I am not choosing between them and I am not proposing a third.
   Until the gate takes it, this row is open and the ticket cannot close on it.

2. **`runCommand` inherits `execSync`'s 1 MiB `maxBuffer`.** Home: **Q-0065**, per `80bc290`, which
   measured it and corrected the requirement's sample. Preserved unchanged. The source comment names
   Q-0065 and does not describe the symptom, because a transcription would have gone stale immediately.
   *One observation for Q-0065, read from the code and **not** measured here:* `timedOut` includes
   `e.killed === true`, and Node sets `killed` when it kills a child for `maxBuffer`. If that holds, an
   overflow reports `timedOut: true` — the buffer defect wearing the timeout's clothes. Offered as a
   thing to check, not as a finding: I did not run it.

3. **`branchExists` and `branchHead` cannot tell "no such branch" from "git failed".** Both wrap
   `safe()`. Home: **Q-0050**, per `80bc290`. Pinned with a test that makes `rev-parse` exit non-zero
   through `installGitShim` and asserts `false` / `null` rather than a throw. The source cites AC-6 and
   names `ancestry()` — in the same package, forbidding exactly this inference — as the reason the
   behaviour is deliberately strange.

4. **`commitAll` reports a discard even when the revert itself failed.** Both halves are wrapped in
   `safe()`, and `onDiscard` fires on the dirty list rather than on the outcome. Home: **Q-0050**, per
   `80bc290`. Pinned: with `checkout` forced to fail, `onDiscard` still fires, the agent's edit is still
   there, and it is committed.

5. **`commitAll`'s first discarded path loses its first character.** `git()` trims the whole of
   `status --porcelain`, so a file that is modified-but-unstaged (`" M path"`) has its leading space
   stripped on **line one only**, and the `.slice(3)` that removes the status columns then eats a
   character of the path. Measured: `['acklog/T-0001/ticket.md', 'backlog/T-0001/sneaked.md']` — the
   untracked entry (`"?? path"`, no leading space) and every later line are unaffected.
   `spike/src/fanout.js:68` and `:81–82`; ported at `fanout/fanout.ts:280–281`. Pinned with the real
   values. It has survived because the list is a report to a human and never a path anything opens, and
   because `spike/test/smoke.js:400` asserts only `dropped.length >= 2`. Home: **Q-0050**, `939c75f`.

6. **`mergeInto` returns `error: ''` on a content conflict.** Section above. `spike/src/fanout.js:116`;
   ported at `fanout/fanout.ts:317`. Home: **Q-0050**, `939c75f`.

Also preserved, from Q-0042's report and named by the ticket body:

- **Q-0042 finding 4 — option injection through a branch name.** `taskVars` lifts an agent-authored
  `task.id` into the namespace branch names are built from, and validates, normalises and escapes
  nothing. Pinned: a hostile id (`--upload-pack=…`) comes back unchanged.
- **Q-0042 finding 5 — a hand-deleted worktree directory wedges the branch.** `resetBranchTo` decides
  from `fs.existsSync(dir)` alone while git still holds the administrative entry, so the `branch -f`
  route is taken and git refuses. Pinned: the registration is asserted still present, and
  `resetBranchTo` is asserted to throw.

**A reviewer may not treat any of the above as a blocker** (charter §2); a reviewer *may* block if one
has been fixed. None has — and this round touched no source file at all, which is the strongest form
of that claim this ticket has been able to make.

---

## What I deliberately left alone

- **Every source file.** `fanout.ts` and `command.ts` are byte-identical to iteration 4. The finding
  is about a test's filtering logic, and a revision round is not a licence to revisit code no finding
  names.
- **`outside`'s name, signature and both callers.** The two snapshot tests below the helper are
  unchanged; only what the helper permits changed. Keeping the seam meant the fix could be verified by
  swapping one predicate, which is how the red phase above was produced.
- **`walk` and everything else in `packages/core/test/repo.ts`.** It is shared by every module's suite
  and belongs to Q-0064; its `isGitLock` narrowing is deliberately not `.git/**` for the same reason
  this round narrowed `.harness/`, and I did not touch it.
- **`fanout.source.test.ts`.** No source-level rule needed changing: the literal `.harness/worktrees`
  still appears in no source file, and the new spelling is a shared-constant import in a test.
- **Sibling modules' snapshot helpers.** Whether `git/`, `adapters/` or `run-history/` have the same
  over-broad exclusion is not a fact I verified and not a claim I am making — their suites belong to
  their own tickets. If the reviewer wants it swept, that is a ticket, not this round.
- **`backlog/`** — including defect 1's routing. E-2 closes the recording half by human commit and
  leaves defect 1's destination to the gate; writing a ticket body from here would be reverted by
  `commitAll` and would be authoring a decision that is not mine.
- **Register row 20 is untouched.** No task-branch rollback, deletion, rewind or discovery helper in
  any form. `resetBranchTo` stays an explicit primitive for its caller and never enumerates sibling
  branches. Asserted at source level: no `for-each-ref`, no `branch -d`/`-D`, and **`removeWorktree`
  is not imported** — Q-0062 stays open and unchanged.
- **No branch-name, task-id or ref-name validation, normalisation, escaping or option guard**, in
  either file.
- **No zod schema, and `packages/shared` gains no export** (OQ-3, settled). `packages/shared` is
  untouched — this round imports a constant *from* it and adds nothing *to* it.
- **No public re-export from `packages/core/src/index.ts`** (OQ-4, settled) — asserted byte-identical,
  so Q-0041's pin stays green.
- **No dependency added.** `packages/core/package.json` is untouched; its four dependencies are
  asserted, and `@quorum/shared` was already among them.
- **No `harness.yaml` read.** `commands.timeout_ms` is the engine's to read (Q-0052/Q-0053); this
  module owns the identical default and the option that overrides it.
- **No documentation edited.** Confirmed rather than assumed: `docs/04-architecture.md:14, 16, 42, 44`
  already name `fanout` and the per-module folder layout, and `spike/README.md` describes the spike,
  which is unchanged. No document in the repository disagrees with this port.
- **Nothing under `spike/`** (charter §3) — evidence above.
- **Nothing under `harness/`** — the merged requirement's surfaces are `packages/core` and its suite.
- **Nothing under `.quorum/`** — asserted absent after every function has run (Q-0049's surface).
- **Q-0053's boundary respected**: no branch-name interpolation, no flow-file reading, no iteration
  state, no wave orchestration, no `finish()` and no rollback policy.

---

## Verification

`pnpm turbo run lint typecheck test --force`, from the repository root — **21/21 tasks successful,
0 cached.** Run with `--force` because a cached turbo run replays a pass it never executed (Q-0065).

- `@quorum/core`: **638 passed, 2 skipped** across 30 files (29 passed, 1 skipped). Iteration 4 read
  637/2; the difference is this round's one added test. The two skips are `real-cli.probe.test.ts`,
  skipped by design because it needs `QUORUM_REAL_CLI` and a paid round-trip.
- This ticket's own three files: **76 passed** (iteration 4: 75), of which `fanout.test.ts` is **47**
  (iteration 4: 46), `fanout.source.test.ts` 22 and `command.test.ts` 7.
- `pnpm lint` and `pnpm typecheck`: clean workspace-wide, uncached.
- **The narrowed exclusion was verified red before green**, failing on `.harness/notes.txt` and
  `.harness/runs/x` under the old predicate. Transcript in "The finding" above.

**The spike half of `commands.test` was run this round and it is red for an environmental reason —
reported rather than glossed.** `harness/harness.yaml` sets
`npm test --prefix spike && pnpm turbo run test`. Running the first half here gives
`✗ 11 of 12 test file(s) failed`, and the first error is the whole story:

```
$ node spike/test/smoke.js
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'yaml' imported from
  …/harness__Q-0048__implement/spike/bin/harness.js
```

`spike/node_modules` does not exist in this worktree — a worktree is a fresh checkout, and
`node_modules/` is git-ignored, so the spike's three dependencies (`yaml`, `ajv`, `ajv-formats`) were
never installed here. Every one of the eleven failures is that same resolution error or a cascade from
it (`init` fails, so each scenario's fixture `harness.yaml` is then missing). `npm --prefix spike ci`
was not available to me in this run, so I could not clear it and I am **not** claiming the spike suite
is green.

Three reasons this is environmental rather than a finding, stated so the reviewer can check them
rather than take them: the freeze evidence above shows no file under `spike/` differs from `main` or
is dirty; this round changed one test file in another package; and `integrate` installs dependencies
in the worktree before running the test command — an engine invariant added precisely because *"a
worktree is a fresh checkout with no `node_modules`, so the test command died on a missing
dependency"* (`docs/DECISIONS.md`, 2026-08-22, *"Red for the right reason is an engine property"*).
That step is where the claim gets made, and it is the same step that will re-run the turbo half.

### Criterion coverage

| AC | Where |
| --- | --- |
| 1 | `fanout.source.test.ts` — file list, export lists, no dependency, nothing printed, no `any`, JSDoc on every export and on every interface field, import allowlist, `index.ts` byte pin |
| 2 | `fanout.test.ts` — three routes, both messages as string equality, the verbatim block write, `tasks:`/unrelated-keys → `[]`, `TicketRecord` assignability |
| 3 | `fanout.test.ts` — two-wave, one-wave in input order, empty input, self-cycle, unknown id, the spike's own case, no mutation, exact message with `, ` |
| 4 | `fanout.test.ts` — `smoke.js:673–690` transcribed, plus field survival and an empty failing set |
| 5 | `fanout.test.ts` — four keys by `Object.keys().sort()`, the exact prompt string, no extra field's value present, no dependency line |
| 6 | `fanout.test.ts` — both helpers, `HEAD~1`, the shim making git fail, and "moves nothing" |
| 7 | `fanout.test.ts` — revert + clean + report, work outside `backlog/` still committed, hostile message verbatim, identity, `null`, failed-revert pin, first-character pin |
| 8 | `fanout.test.ts` — clean merge with `--no-ff`, conflict list + abort + clean tree, `''` on a content conflict, the tail bound on a stderr failure, no `error` key on success |
| 9 | `fanout.test.ts` — both `resetBranchTo` routes, path equality against the spike's expression, `ticketWorktree` idempotence and its `null` base, the full sibling set through five functions; `fanout.source.test.ts` — no re-spelled literal |
| 10 | `command.test.ts` — success shape, cwd, exit 3 with `timeoutMs`, stream order, override + elapsed bound, stdin ignored; `fanout.source.test.ts` — the default read from source |
| 11 | `fanout.test.ts` — **the exclusion predicate asserted in both directions (this round)**, `git status` empty and a `walk()` snapshot pair over the repository root, `.quorum/` absent, `loadTasks`'s write as the only one; `fanout.source.test.ts` — exactly one `fs` write call in the folder |
| 12 | `fanout.test.ts` — the hostile task id, the wedged branch, the `TypeError`; the findings section above, with E-2's destination for each and *"open"* stated for defect 1 |
| 13 | `fanout.source.test.ts` — the shell in one file, the bare `IntegrationError`, no re-spelled literal, no schema, no lifecycle helper, one write, the citations. **Its sixth bullet is evidence per E-1**; CI's `port freeze (branch scope)` job is the enforcement |

---

## Open at the gate

No new decision is needed to accept this change. Three things are for the gate rather than for another
round, and only the first blocks the ticket closing.

1. **Defect 1 needs a home.** E-2 discharged the gate obligation for defects 2–6 and deliberately did
   not for defect 1 — *"the candidates are Q-0060 … and a new ticket. Until it is taken, this row stays
   open."* It is a `backlog/` write and a routing decision. An implement report is not a durable record
   and is not read again after the gate, which is exactly why this line is here and not left implicit.
2. **AC-11's ancestor allowance** (section A). The criterion's literal wording cannot be satisfied by
   any implementation, because creating the worktree root creates the root and its parent. I read it as
   permitting those two entries and nothing else beside them. Overrulable in one disjunct.
3. **AC-8's `error` clause** is unreachable without a behaviour change the charter forbids. Preserved,
   pinned, and reported as defect 6, whose home is Q-0050. No action needed.

Iteration 2's gate item — the scope of the freeze assertion — was withdrawn in iteration 3 and stays
withdrawn; E-1 settled it and the code matches.
