# Q-0048 — `core/fanout`: tasks, waves, worktrees and branches

*Requirement candidate, product-manager role, 2026-08-27. Route: **chore** (`requirements → chore →
human gate`). Parent Q-0009; charter `harness/port-charter.md`, §6 row `Q-0048`. Depends on Q-0041
and Q-0042, both verified `main:contained` at the time of writing. Depended on by Q-0053.*

Every citation below was read against the working tree, not inferred from a ticket body. Where this
document and `harness/port-charter.md` §6 differ, **the charter is right**. No erratum is proposed:
the one register row this ticket inherits already names three owners, and §"Register row 19" below
states which clause is whose rather than asking the charter to change.

---

## Problem

`spike/src/fanout.js` is 139 lines and thirteen exports, and it is the only module in the port whose
subject is *what happens to the user's repository*. Every branch a run creates, every worktree it
cuts, every commit it authors and every merge it attempts passes through this file. `packages/core`
today has `git/` — worktrees, ancestry, containment — and nothing that uses them: `ensureWorktree`
has exactly one declared dependent in the port, and it is this ticket.

The file reads like plumbing and is not. Four of its behaviours were paid for in failed runs, and
none of them is visible in the shape of the code:

- **`commitAll` reverts every agent edit under `backlog/` before it stages anything.** That single
  guard is why an agent cannot advance its own stage, mark its own run complete or refund its own
  counters. Q-0011's architect rewrote a ticket's frontmatter on a branch, resetting `iterations` to
  `{}` and deleting three history entries with their costs; a merge conflict caught it, which is
  luck. It is also, incidentally, the reason three of Q-0009's own criteria could never be
  delivered by a flow (`harness/port-charter.md` §11) — the guard is load-bearing in both
  directions.
- **`scopeToFailing` drops a `depends_on` naming a task outside the retry's scope.** Q-0006's run 11
  crashed on exactly that: a conflict narrowed a retry to one task whose dependency had already
  merged, and `waves` correctly reported an unresolvable graph for work that was already done.
- **`runCommand`'s timeout is a safety property, not a nicety.** Q-0011's integrate sat on a blocked
  suite for 24 minutes and would still be sitting there. A hung test command is one of the four
  recorded instances of *"a loop spending its budget on work no agent in it can perform"*.
- **`resetBranchTo` is the mechanism a failed run uses to leave the ticket branch as it found it.**
  Without it, an exhausted or aborted run leaves its merges behind and the next stage measures its
  red phase against a tree that already contains the implementation.

All four are one plausible simplification away from being lost, and — this is what makes this a
requirement rather than a translation — **losing any of them would not turn either suite red.** The
spike stays green because the spike still has the old behaviour; the ported suite stays green
because it would be written from the tree that has the new one. That is charter §2's standing
hazard, and this module is where it costs the most.

Three things are unresolved today and this document settles them rather than handing them to a
revise loop:

1. **Register row 19 has three owners and nobody has said which clause is whose.** Its third clause
   — *"`finish()` rolls the ticket branch back on failure"* — is `spike/src/engine.js:640–645`,
   which charter §6 gives to **Q-0050**. This ticket ports the *mechanism* that clause names
   (`branchHead`, `resetBranchTo`) and owns none of the policy. A criterion asking this ticket to
   assert `finish()`'s behaviour would name a file this ticket may not write.
2. **One line changes and its output must not.** `resetBranchTo` derives its worktree directory
   inline (`fanout.js:103`); `packages/shared` landed that derivation as `REPO_WORKTREE_ROOT` and
   `worktreeDirName` in Q-0041, and `git.ts:86` already imports both. Reaching for them is internal
   layout, which charter §2 does not preserve, and duplicating the literal is what would be the
   defect. The **path produced** is externally observable and must survive byte for byte.
3. **This ticket inherits a hazard by name and must not close it.** Q-0042's implement report,
   finding 4, hands `ensureWorktree`'s missing branch-name guard forward to this ticket because
   `taskVars` is what lifts an agent-authored `task.id` out of `tasks.yaml` into the namespace a
   branch name is built from. The interpolation itself is `engine.js:211`, which is Q-0053's. The
   criterion is to **preserve and report**, and charter §2 makes that binding in both directions:
   an implementer may not fix it in passing, and a reviewer may not treat its absence as a blocker.

---

## User stories

**`maintainer` — the solo maintainer.** *"When a fan-out retries, I want it to retry the tasks that
failed and nothing else, and I want the finished ones to say 'no changes' rather than invent work.
When a run dies, I want my ticket branch where I left it. And I never want an agent's edit to a
ticket file to be the thing that decides whether my run succeeded."*

**`contributor` — the adapter contributor.** *"I want to read one module and know exactly which
branches a run creates, where its worktrees land and what a task's prompt actually contains. If the
answer is spread across the engine, I cannot check it."*

**`adopter` — the cold-clone adopter.** *"Nothing in a run may touch my working tree. I want the
worktrees somewhere I can delete, excluded from my `git status`, and I want a hung test command to
stop rather than run until I notice."*

**Surfaces:** `packages/core` — the library and its Vitest suite. **Not** the CLI (`quorum` is
Q-0010), **not** the engine's step types (Q-0053), **not** `backlog/`, `harness/` or `docs/`: no
document in the repository disagrees with this port, verified below.

---

## Context the implementer should not re-derive

Read once; every line was verified against the tree on 2026-08-27.

### What is already there

`packages/core/src/git/git.ts` exports eight functions, `ensureWorktree` among them, and takes
`REPO_WORKTREE_ROOT` and `worktreeDirName` from `@quorum/shared`. Its source test
(`git/git.source.test.ts:47–51`) states in a comment that it adds no public re-export because *"its
only declared dependent (Q-0048) is in the same package and imports `./git.js` directly"* — that is
this ticket, and the import path is decided.

`packages/core/package.json` already declares `yaml@^2.9.0`, `ajv`, `ajv-formats` and
`@quorum/shared`. **This ticket adds no dependency.** `packages/core/src/index.ts` is byte-pinned by
`packages/shared/src/index.test.ts:52` to `export const name = '@quorum/core';\n` and is not touched.

`packages/core/test/` holds the fixture helpers this ticket's tests need and must not duplicate:
`repo()`, `tempDir`, `write`, `commit`, `commitAll`, `walk` (a snapshot that ignores only `.git/**/*.lock`),
`installGitShim(body)` / `counting(fn, body)` (a `git` first on PATH that counts invocations and can
make a chosen subcommand exit non-zero), and `coreSourceFiles()` / `repoFile()` for source-level rules.
`coreSourceFiles()` is recursive since Q-0064 and keys every entry by its path below `src` —
`fanout/fanout.ts`, never a bare filename.

**No file under `packages/core/src` contains `execSync`, `spawnSync` or `shell:` today.** `runCommand`
will be the first and only place in `core` that hands a string to a shell, which makes that a
checkable rule rather than an intention (AC-13).

### The module, function by function

| Export | Spike | What must survive |
| --- | --- | --- |
| `IntegrationError` | `:9` | `export class IntegrationError extends Error {}` — nothing more. The CLI prints `e.message` and no stack (`bin/harness.js:605`). |
| `loadTasks(ticket)` | `:13–23` | Three routes, two exact messages, and the `tasks.yaml` it writes on the fallback route. |
| `scopeToFailing(tasks, failing)` | `:28–32` | Keeps only failing ids; drops out-of-scope `depends_on`; returns new objects. |
| `waves(tasks)` | `:35–45` | Waves by `depends_on`; one exact message on a cycle or unknown id. |
| `taskVars(task)` | `:47–49` | Exactly four keys: `task.id`, `task.role`, `task.title`, `role`. |
| `taskPromptSection(task, worktreeDir)` | `:51–60` | `description` and nothing else from the task; contracts inlined from the worktree; two exact sentences. |
| `branchExists(repo, b)` | `:71` | `rev-parse --verify --quiet refs/heads/<b>` through `safe()` → boolean. |
| `branchHead(repo, branch)` | `:100` | `rev-parse <branch>` through `safe()` → sha or `null`. |
| `resetBranchTo(repo, branch, sha)` | `:102–106` | Worktree present → `reset --hard` + `clean -qfd`; absent → `branch -f` in the repository. |
| `commitAll(dir, message, onDiscard)` | `:80–93` | The `backlog/` revert, the report, the identity, the return value. |
| `mergeInto(dir, branch)` | `:109–118` | `--no-ff --no-edit`; conflicts; `merge --abort`; a 500-character error tail. |
| `runCommand(cmd, cwd, {timeoutMs})` | `:124–134` | A shell on purpose; 15-minute default; SIGKILL; three ways to spot a timeout. |
| `ticketWorktree(repoDir, ticketBranch)` | `:137–139` | `ensureWorktree(repoDir, ticketBranch, null)` — the `null` is deliberate and already pinned by `git.test.ts:451`. |

`git()` and `safe()` are module-private in the spike and stay module-private: `git.ts` exports
neither, so the port declares its own argv-only runner rather than reaching for one that is not
there.

### The boundary with Q-0053, stated so a reviewer does not have to derive it

The engine's fan-out and integrate steps are **not** this ticket. What they do with this module —
and therefore what must not move here — is:

- `engine.js:211` builds a step branch and `:953` a task branch from the interpolated variables
  `taskVars` supplies. **The interpolation is Q-0053's.**
- `engine.js:931–938` chooses `scopeToFailing` and `waves` per `step.fan_out.scope` / `.respect`.
  **Reading the flow file is Q-0053's.**
- `engine.js:497` is `cmdTimeout(ctx)` — `ctx.config.commands?.timeout_ms ?? 15 * 60_000`. **The
  configuration read is Q-0052/Q-0053's**; this ticket owns the identical default inside
  `runCommand` and the option that lets a caller override it.
- `engine.js:640–645` is `finish()`'s rollback, which calls `branchHead` and `resetBranchTo`.
  **The policy is Q-0050's** (register rows 19 and 20).
- `engine.js:292` passes `commitAll` the message and the `onDiscard` callback that renders the
  warning. **The message text and the warning are Q-0052's**; the discard mechanism is this ticket's.

### Register row 19, and which clause is whose

Row 19 reads: *"A flow never writes to the user's working tree; worktrees live under
`.harness/worktrees/`, run history under `.quorum/`; `finish()` rolls the ticket branch back on
failure"*, and the register assigns it to **Q-0042, Q-0048, Q-0050** together.

- **Q-0042** shipped the worktree location and the `info/exclude` line, with `git status --porcelain`
  proved empty after a worktree is created.
- **Q-0048 (here)** owns everything in this module that writes: every write is into a worktree
  under `REPO_WORKTREE_ROOT` or into a ref, never into `repoDir`'s working tree — AC-11.
- **Q-0050** owns `finish()`. Row 20 — *"`finish()` does **not** roll back task branches"* — is
  Q-0050's too, and this ticket must not close it by adding a task-branch rollback helper nobody
  asked for. AC-12 makes that explicit.

Run history under `.quorum/` appears in no line of this module and is Q-0049's.

### Three defects found while reading, all preserved

Each was verified by running it, not inferred. None is fixed here (charter §2); each is reported in
the implement report under AC-12, and OQ-3/OQ-4 propose where they go.

1. **An empty `solution/tasks.yaml` throws a raw `TypeError`, not an `IntegrationError`.**
   `YAML.parse('')` returns `null`, and `null.tasks` throws *"Cannot read properties of null
   (reading 'tasks')"* — which the CLI's `catch` at `bin/harness.js:605` does not recognise, so it
   rethrows and the user gets a stack trace. `tasks:` with no value parses to `{tasks: null}` and
   yields `[]` correctly; a file with unrelated keys yields `[]` too. Only the empty file crashes.
2. **`runCommand` inherits `execSync`'s 1 MiB `maxBuffer`.** A command whose output exceeds it is
   reported as `{code: 1, timedOut: false}` with the output lost — measured on this machine: a child
   writing 2 MiB gave `status=1, signal=null, stdout length 0`. `integrate` runs the repository's
   whole suite through this function, and `expect: fail` would bank that as a red phase for a reason
   that has nothing to do with the tests. It is the same shape as the exit-code conflation Q-0004
   found, one layer down.
3. **`branchExists` and `branchHead` cannot tell "no such branch" from "git failed".** Both wrap
   `safe()`, which swallows every error. This is precisely the conflation `ancestry()` was rewritten
   to forbid — *"the state is selected from git's own exit codes and from nothing else"* — living in
   the same package as the primitive that forbids it. Latent today because a run that reached this
   code has already spawned git successfully several times.

A fourth, smaller: `commitAll` wraps its `checkout`/`clean` in `safe()`, so a revert that **fails**
still reports through `onDiscard` as though it had discarded. Preserved.

---

## Acceptance criteria

Every criterion is testable with Vitest, against throwaway git repositories built by
`packages/core/test/repo.ts`, with no adapter, no vendor CLI, no network and no cost.

### AC-1 — The module lands as two files in `fanout/`, adds no dependency, and prints nothing

`packages/core/src/fanout/` gains exactly:

| File | Exports | Ported from |
| --- | --- | --- |
| `fanout.ts` | `IntegrationError`, `loadTasks`, `scopeToFailing`, `waves`, `taskVars`, `taskPromptSection`, `branchExists`, `branchHead`, `resetBranchTo`, `commitAll`, `mergeInto`, `ticketWorktree` | `spike/src/fanout.js` less `:124–134` |
| `command.ts` | `runCommand` | `spike/src/fanout.js:124–134` |

`runCommand` is separated for one reason, and it is the same reason `ancestry` lives in one file: it
is the only function in `packages/core` that hands a string to a shell, and a rule stated as
*"the shell appears in exactly one file"* is checkable, where *"be careful with `execSync`"* is not.
It stays in the `fanout/` folder because charter §6 assigns `fanout.js` whole to this ticket.

`packages/core/package.json` gains no dependency. Neither file writes to stdout or stderr or
contains an ANSI escape — rendering belongs to the CLI (charter §7), and the one library-level
`console.warn` in `core` is `ensureExcluded`'s, which Q-0042 preserved and this ticket does not
join. `packages/core/src/index.ts` is unchanged, byte for byte. Every exported symbol, interface
field and non-obvious parameter carries JSDoc; no `any`; no `@ts-ignore` without a same-line reason.

*Test:* a source-level test in the style of `git/git.source.test.ts`, reading through
`coreSourceFiles()`, asserting the exact file list under `fanout/`, the exact export list per file,
the absence of `console.` and of `\x1b[`, and `repoFile('packages/core/src/index.ts')` verbatim.

### AC-2 — `loadTasks` keeps its three routes, its two messages and its side effect

1. `solution/tasks.yaml` present → its `tasks` key, or `[]` when the key is absent or null.
2. Absent, but `solution/solution.md` holds a fenced block matching ```` /```ya?ml\n([\s\S]*?)```/ ````
   whose text matches `/^tasks:/m` → **the first such block is written to `solution/tasks.yaml`
   verbatim** (the raw block text, not a re-serialisation) and then parsed. The write is a real side
   effect into the ticket folder and is preserved: it is the engine writing, not an agent, and the
   next run reads the file rather than the document.
3. Neither → `IntegrationError('no solution/tasks.yaml and no solution/solution.md')`.
   `solution.md` present with no matching block →
   ``IntegrationError('solution.md has no ```yaml block with tasks:')``.

Both messages are asserted as string equality, not `toContain`. The parameter is typed structurally
as `{ dir: string }` — **not** imported from `backlog/`, which is Q-0043's module and not a declared
dependency of this ticket — and a type-level assertion shows `TicketRecord` is assignable to it.

*Test:* all three routes over temp ticket folders; the written `tasks.yaml` compared byte for byte
with the block's text; a `tasks.yaml` holding `tasks:` with no value yielding `[]`.

### AC-3 — `waves` groups by `depends_on`, in order, without mutating, and says exactly one thing when it cannot

A task enters a wave once every id in its `depends_on` is in an earlier wave. Order within a wave is
the order the tasks were given. A task with no `depends_on` is treated as `[]`. When no task is
ready and tasks remain, it throws
`` `dependency cycle or unknown depends_on among: ${remaining.map((t) => t.id).join(', ')}` `` —
asserted as string equality including the `, ` separator and the ids in remaining-order. The input
array and its task objects are not mutated.

*Test:* two-wave and one-wave graphs; a self-cycle; a `depends_on` naming an id not in the set;
`waves([{id:'b',depends_on:['a']}])` throwing, which is the spike's own case at `smoke.js:678`.

### AC-4 — `scopeToFailing` narrows a retry without inheriting dependencies it is not running

Given all tasks and a `Set` of failing ids: keep only the failing tasks, and filter each kept task's
`depends_on` down to ids that are also in scope. A dependency on a task outside the scope is
**dropped**, because that task succeeded and its branch is merged. Returns new objects; the input
tasks are unchanged. `scopeToFailing(all, new Set(['a','b']))` preserves an in-scope dependency, so
`waves` still returns two waves.

This is `spike/test/smoke.js:673–690` transcribed, and charter §1 requires it to land here rather
than wait for Q-0054 — it is a library-level test of this ticket's module.

*Test:* the six assertions of that block, plus `waves(scoped)` returning one wave where
`waves([failingTask])` alone throws.

### AC-5 — A task's prompt carries its `description` and nothing else the task holds

`taskVars(task)` returns exactly `{'task.id', 'task.role', 'task.title', 'role'}` — four keys,
with `role` deliberately duplicating `task.role`. Asserted with `Object.keys(...).sort()`, so a
fifth key fails.

`taskPromptSection(task, worktreeDir)` produces, joined by `\n`:

- `` `\n# Task ${task.id} (${task.role}): ${task.title}` ``;
- `task.description` verbatim, when present, and no other task field;
- for each entry of `task.contracts ?? []`, `` `\n## Contract: ${c}\n\n` `` followed by the file's
  trimmed text inside a triple-backtick fence when it exists **in the worktree**, and otherwise
  exactly `(file not found in worktree — treat as a blocker and say so in summary)`;
- when `depends_on` is non-empty,
  `` `\nDepends on: ${task.depends_on.join(', ')} (already merged into your base branch).` ``.

The ownership decision of 2026-08-23 rests on `description` being the only field the fan-out
forwards, so a task carrying extra keys (`files:`, `acceptance:`, `owner:`) must produce a prompt
section in which none of their values appear. That is the criterion, not a note.

*Test:* a task with every field populated plus two unknown ones, compared against the exact expected
string; a contract that exists and one that does not; `depends_on: []` producing no line.

### AC-6 — The branch helpers keep their exact git invocations, and their conflation is preserved and named

`branchExists(repo, b)` runs `rev-parse --verify --quiet refs/heads/<b>` and returns a boolean.
`branchHead(repo, branch)` runs `rev-parse <branch>` — no `--verify`, no `--quiet`, the branch name
as given — and returns the sha or `null`.

Both return their negative when **git itself fails**, not only when the branch is absent. That is
preserved, and it is pinned with a test that makes git exit non-zero through `installGitShim`, so
the day someone changes it a test says so. The source carries one line naming the authority — the
behaviour is deliberately counterintuitive beside `ancestry()` in the same package, which forbids
exactly this inference (`harness/rules.md`: *"one line naming the authority"*, never a transcription
of the argument).

*Test:* existing and absent branches; `branchHead` on a branch and on `HEAD~1`; both under a shim
that fails `rev-parse`, asserting `false` / `null` rather than a throw.

### AC-7 — `commitAll` reverts `backlog/` before it stages, reports what it dropped, and commits as the harness

In order: read `git status --porcelain -- backlog`, take each line's `.slice(3).trim()`, drop empties;
if any, run `git checkout -- backlog` then `git clean -qfd -- backlog`, each tolerant of failure, and
call `onDiscard(dropped)` with that list; then `git add -A`; then read `git diff --cached --name-only`;
return `null` when it is empty; otherwise commit with
`git -c user.email=harness@local -c user.name=harness commit -q -m <message>` and return the staged
paths as an array.

Three properties beyond the sequence, each its own assertion:

- **A tracked edit under `backlog/` is reverted and an untracked addition is deleted**, and neither
  reaches the commit — the Q-0011 case, `spike/test/smoke.js:370–395`, transcribed.
- **Work outside `backlog/` in the same worktree is committed normally** in that same call. The
  guard is not "refuse the commit".
- **The message is argv, never a shell.** A message containing backticks and `$(id)` is committed
  literally — a step summary written by an agent becomes a commit message, backticks in one crashed
  a real run, and `$(…)` would have been executed rather than committed (Q-0011).

*Test:* a worktree with a tracked ticket edit, a stray added file under `backlog/`, and a legitimate
source change; assert the commit's `--name-only`, the reverted file's content, the deleted file's
absence, `onDiscard`'s argument, the commit's author and committer name/email, and the hostile
message committed verbatim.

### AC-8 — `mergeInto` reports conflicts and always leaves the worktree clean

Merges with `git -c user.email=harness@local -c user.name=harness merge --no-ff --no-edit <branch>`.
On success returns `{ok: true, conflicts: []}`. On failure it collects
`git diff --name-only --diff-filter=U`, runs `git merge --abort` (tolerantly), and returns
`{ok: false, conflicts: [...], error}` where `error` is `String(e.stderr ?? e.message).slice(-500)` —
the **last** 500 characters, because git's own reason is at the end.

The shape asymmetry is preserved: `error` is present only on failure. After a conflicting merge the
worktree has no merge in progress and `git status --porcelain` is empty.

*Test:* a clean merge, including that `--no-ff` produced a merge commit; a conflicting merge
asserting the conflict list, the aborted state, and `error` being at most 500 characters and
non-empty.

### AC-9 — `resetBranchTo` and `ticketWorktree` take their path from `shared` and produce the same bytes

`resetBranchTo(repo, branch, sha)` computes its directory as
`path.join(repo, REPO_WORKTREE_ROOT, worktreeDirName(branch))`. **The literal `.harness/worktrees`
and the `replace(/\//g, '__')` expression do not appear in either file** — that is a source-level
assertion, mirroring `git.source.test.ts:65–71` — **and the resulting absolute path is asserted equal
to the spike's expression evaluated on the same inputs.**

When that directory exists: `git reset --hard <sha>` inside it, then `git clean -qfd` tolerantly.
When it does not: `git branch -f <branch> <sha>` in the repository. The decision is made from
`fs.existsSync(dir)` alone, which is Q-0042's finding 5 and stays (AC-12).

`ticketWorktree(repoDir, ticketBranch)` is `ensureWorktree(repoDir, ticketBranch, null)`, imported
from `../git/git.js`. The `null` base is deliberate — `git.test.ts:451` already pins that
`fanout.js:138` passes it — so the ticket branch is created from `HEAD` on first use.

*Test:* both routes of `resetBranchTo`, asserting the branch tip and, in the worktree case, that
uncommitted files are gone; the path equality; `ticketWorktree` creating a worktree at the expected
directory and returning it unchanged on a second call.

### AC-10 — `runCommand` keeps its shell, its 15-minute default and its three ways to spot a kill

`runCommand(cmd, cwd, {timeoutMs = 15 * 60_000} = {})` runs
`execSync(cmd, {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: process.env, timeout: timeoutMs, killSignal: 'SIGKILL'})`.

Preserved exactly, each as its own assertion:

- **The default is `15 * 60_000`**, written as that expression, and a caller's `timeoutMs` overrides it.
- **stdin is `ignore`**, so a command that prompts fails fast instead of waiting forever.
- **A string through a shell is deliberate** — `commands.test` is a user-configured command line
  (`npm test --prefix spike && pnpm turbo run test`), and turning it into argv would break every
  adopter's configuration. One line names the authority; the shell-isolation rule is AC-13.
- **Success returns `{code: 0, out, timedOut: false}`** where `out` is stdout only.
- **Failure returns `{code: e.status ?? 1, out: (e.stdout ?? '') + (e.stderr ?? ''), timedOut, timeoutMs}`**
  — stdout and stderr concatenated in that order, and `timeoutMs` present **only** on this path.
- **`timedOut` is `e.killed === true || e.signal === 'SIGKILL' || e.code === 'ETIMEDOUT'`.** All three
  disjuncts stay: `execSync` reports a timeout as a kill rather than a status, and without this a
  timeout looks like an ordinary non-zero exit — which `expect: fail` would bank as proof of red.

*Test:* exit 0 with output; exit 3; a `sleep` against `timeoutMs: 200` asserting `timedOut === true`
and that the call returns in well under the sleep; a command reading stdin returning promptly; a
command emitting on both streams asserting the concatenation order; the default read from the source.

### AC-11 — Nothing in this module writes to the user's working tree *(register row 19, this ticket's clause)*

Over a temp repository with a clean tree: after `ticketWorktree`, `commitAll` in that worktree,
`mergeInto`, `resetBranchTo` and `runCommand` have all run, `git status --porcelain` **in the
repository root** is empty, and a `walk()` snapshot of the repository root taken before and after
differs only under `.harness/worktrees/` and `.git/`. Every worktree this module creates is under
`REPO_WORKTREE_ROOT`; nothing is written under `.quorum/` (Q-0049's) and nothing under
`TICKET_ARTIFACT_DIR`.

The one write outside a worktree is `loadTasks`'s `tasks.yaml` materialisation, into the ticket
folder it was handed — asserted as the *only* such write, so that a later change adding another has
to argue for it.

*Test:* the snapshot pair; a repository whose `.harness/` is already excluded staying absent from
`git status`; the temp worktrees removed in `afterAll` so the suite does not leave any behind
(Q-0062 is open, and a test suite must not make it worse).

### AC-12 — The inherited hazards are preserved, pinned and reported — not fixed

The port adds **no** branch-name validation, **no** task-id validation, and **no** sanitisation
anywhere in this module. Specifically:

1. **Q-0042 finding 4 — option injection through a branch name.** `ensureWorktree` interpolates what
   it is handed into `refs/heads/${branch}` and passes it to `worktree add -b <branch>`; argv stops
   *shell* injection, not *option* injection, since git reads a leading `-` as a flag. `taskVars`
   is what lifts an agent-authored `task.id` into the namespace those names are built from, and it
   is preserved unguarded. A test pins that `taskVars` returns a hostile id unchanged, so the day a
   guard is wanted, the ticket that adds it changes a red test rather than a silent behaviour.
2. **Q-0042 finding 5 — a hand-deleted worktree directory wedges the branch**, because
   `resetBranchTo` decides from `fs.existsSync(dir)` alone while git still holds the administrative
   entry. Preserved on the same reasoning.
3. **The three defects in "Context" above** — `loadTasks`'s raw `TypeError` on an empty
   `tasks.yaml`, `runCommand`'s inherited 1 MiB `maxBuffer`, and the `branchExists`/`branchHead`
   conflation — plus `commitAll`'s discard report firing when the revert itself failed.
4. **Register row 20 is untouched.** No task-branch rollback helper is added, in any form.

`dev/implement-report.md` lists every one of these under a *"noticed while reading, reported and not
acted on"* heading, in the style of `backlog/Q-0042-core-git/dev/implement-report.md:171`, naming
what it is, why it is not fixed, and which ticket or open question it belongs to. **A reviewer may
not treat any of them as a blocker** (charter §2); a reviewer *may* block if one has been fixed.

*Test:* the pins in (1) and (2); a test asserting `loadTasks` on an empty `tasks.yaml` throws a
`TypeError` and **not** an `IntegrationError`, with a comment naming this criterion. Reporting is
checked at the gate, not by a test.

### AC-13 — The house rules are properties of the source, and the freeze holds

A `fanout/fanout.source.test.ts` in the style of `git/git.source.test.ts`, reading through
`coreSourceFiles()` keyed by full path, asserting:

- **The shell appears in exactly one file in `core`.** `execSync` occurs in `fanout/command.ts` and
  in no other non-test source under `packages/core/src`; `fanout.ts` contains `execFileSync` and
  none of `execSync`, `spawnSync`, `shell:`.
- **`IntegrationError` is declared as `export class IntegrationError extends Error {}`** and sets no
  `this.name`, no `captureStackTrace` and no `super(message)` override — the rule Q-0044 applied to
  `FlowError` (`lint/lint.source.test.ts:127–130`), because the CLI's `instanceof` check and its
  message-only rendering are what the user sees.
- **No literal is re-spelled**: `REPO_WORKTREE_ROOT` and `worktreeDirName` are imported, and neither
  `.harness/worktrees` nor `replace(/\//g` appears.
- **No zod schema is defined and `packages/shared` gains no export** (charter §4, and OQ-2): a
  `tasks.yaml` is not validated today, and validating it here would be a rule arriving through a
  type. The YAML boundary is one named cast with a `Why:` line, and there is no `any`.
- **`removeWorktree` is not imported** — Q-0062 stays open and unchanged.
- **`spike/` is untouched**: `git diff --name-only main...HEAD` contains no `spike/` path. CI's
  `port freeze (branch scope)` job covers `harness/Q-0048/*` and is the enforcement; this assertion
  is the implementer's own early warning.

Workspace-wide: `pnpm lint`, `pnpm typecheck` and `pnpm test` are green, and — because a cached
`turbo` run can replay a pass it never executed (Q-0065) — the gate's verification is run with
`--force`.

---

## Before the first run — three actions, all by hand, all costly to forget

1. **Create `harness/Q-0048/integration` from `main`.** Verified absent today:
   `git rev-parse --verify refs/heads/harness/Q-0048/integration` fails. `chore.yaml`'s `review`
   step diffs `harness/{id}/integration...harness/{id}/implement`, and only `integrate` — which runs
   later — creates the left endpoint. Forgetting it fails the run **after** the implementer has been
   paid, which is how Q-0035 lost $13.86. This is the highest-value line in this document.
2. **Pass no more `--gate-answer` values than you would authorise blind.** They are consumed in order
   by whichever gate arrives first, and an engine-presented exhaustion gate is a gate. Prefer too
   few: the run fails, which is recoverable, instead of advancing.
3. **One run per ticket at a time** (Q-0039 is open, nothing enforces it), and expect an unanswered
   final gate to fail the run and roll the ticket branch back (Q-0040) — answer it, or accept that
   proven-green work is discarded and the merge is re-performed by hand.

Charter §5 clause 5 is satisfied: `harness/Q-0041/integration` and `harness/Q-0042/integration` are
both `main:contained`, verified with `git merge-base --is-ancestor`.

---

## Non-goals

- **The fan-out and integrate step types** — `engine.js:915–1070`, Q-0053. This ticket ships the
  plumbing, not the steps that drive it.
- **`finish()`, the rollback policy, and rolling back task branches** — Q-0050, register rows 19 and
  20. Row 20's gap is carried forward unfixed.
- **Fixing anything in AC-12's list**, or adding branch-name or task-id validation.
- **Validating `tasks.yaml`** — no zod schema, no `shared` export, no refusal of a malformed file
  that is accepted today (OQ-2).
- **Calling `removeWorktree`** — Q-0062 owns the lifecycle, together with the open M1 item about
  task branches.
- **Reading `harness.yaml`** — `commands.timeout_ms` is read by the engine, not by this module.
- **Any edit under `spike/`** (charter §3), including transcribing rather than moving
  `spike/test/smoke.js`'s two blocks.
- **Documentation.** `docs/04-architecture.md:14, 42, 44` already names `fanout` and the folder
  layout, and `spike/README.md:20` describes the spike, which is unchanged. Verified: no document in
  the repository disagrees with this port, so none is edited.
- **The cutover, the `quorum` binary (Q-0010), persisting the event stream**, another child's
  module, and everything on v1's exclusion list.

---

## Open questions

**OQ-1 — Two files, or one?** · Owner: implementer, unless the gate says otherwise.
**Recommendation: two** — `fanout.ts` and `command.ts` — so that *"the shell appears in exactly one
file in `core`"* is a checkable rule (AC-1, AC-13). The alternative is one file mirroring `git.ts`,
with the same rule expressed as "`execSync` appears once, inside `runCommand`", which is weaker
because a second use inside the same file would still pass a naive check. Stated here so a reviewer
does not spend a round on it.

**OQ-2 — Does a `Task` schema belong in `packages/shared`?** · Owner: Ruud, at the requirements gate.
`shared` has `fanOutSchema` and `fanOutStepTemplateSchema` for the *flow file* and nothing for
`tasks.yaml`. **Recommendation: no, not here.** `loadTasks` validates nothing today; a zod schema
would refuse files the engine currently accepts, which is a behaviour change charter §2 forbids, and
*"Zod describes structure and types; the flow lint keeps the semantics"* (2026-08-25) is explicit
that a schema may not add a rule. If Q-0053 wants one when it reads `tasks.yaml`'s fields in anger,
it is that ticket's decision entry, not this ticket's quiet addition.

**OQ-3 — Where does `runCommand`'s 1 MiB `maxBuffer` go?** · Owner: Ruud, at the requirements gate.
Measured above: a command exceeding it is reported as an ordinary non-zero exit with its output
gone, and `integrate` runs whole suites through it. **Recommendation: preserve, report, and open a
follow-up** — proposed id **Q-0069** (Q-0068 is the highest currently open) — because the fix is a
behaviour change with a real decision inside it: raising the buffer, streaming to a file, or
reporting overflow as a third outcome beside `timedOut` are three different products, and the third
is the one that composes with *"a suite that could not start is rejected rather than counted as
red"* (register row 7, Q-0053).

**OQ-4 — Does the `branchExists`/`branchHead` conflation get its own ticket now?** · Owner: Ruud, at
the requirements gate. It is the rule `ancestry()` exists to enforce, violated in the same package.
**Recommendation: report only.** Both callers are the engine, and what a caller should *do* with
"git failed" — stop and name the work, or carry on — is a question about the run loop, so it belongs
with Q-0050 or with the follow-up that owns Q-0053's diagnostics rather than in a ticket of its own
that could only change return types nobody yet reads.

**OQ-5 — May this ticket's tests spawn the real `git`?** · Owner: implementer.
**Recommendation: yes**, exactly as `packages/core/src/git/git.test.ts` already does through
`test/repo.ts`. Every fixture builds the topology it asserts; **no test may assert the containment
or branch state of *this* repository**, which would be red until the next landing and green forever
after (`test/repo.ts`'s own opening comment, and the permanent-acceptance-test decision of
2026-08-23).

---

## Risks

**A quiet fix leaves both suites green over a wrong product.** The port's standing hazard, and this
module carries more temptation than most: four things in AC-12's list look exactly like tidy-ups, and
`safe()`-swallowing-everything looks like a bug in a package that has a three-valued primitive for
precisely this. AC-12 lists each as a report and pins two of them with tests, so a reviewer has
something to cite in either direction.

**`commitAll` is the guard three of Q-0009's criteria died on, and it is easy to soften.** An
implementer who reads *"the revert deletes files an agent wrote"* as a defect and narrows it to
tracked files, or to `ticket.md` alone, has handed an agent the ability to add files to a ticket
folder — and nothing in either suite would notice, because the spike keeps the old behaviour and the
ported test would be written from the new one. AC-7 asserts both halves, revert **and** clean, over
a tracked edit and an untracked addition.

**The path that must not change is derived differently from how it is derived today.** AC-9 is the
one place this ticket deliberately writes different code for identical output. The mitigation is an
assertion of the produced absolute path against the spike's expression, not an argument in a review.

**A test suite that leaves worktrees behind makes an open ticket worse.** Q-0062 records four
worktrees on disk from two completed, contained tickets, and this ticket's tests create more.
AC-11's cleanup is a criterion for that reason.

**Cost.** The six chore children measured so far — Q-0042 $16.87, Q-0043 $25.14, Q-0044 $37.54,
Q-0045 $29.79, Q-0046 $29.34, Q-0047 $38.49 — average **$29.53**, inside charter §9's $40 mean
threshold, with the fourteen-child projection around $450 against its $350–550 estimate. (Q-0041 at
$66.87 over three runs is the outlier the checkpoint already knows about.) Thirteen criteria over
139 ported lines puts this ticket in the middle of that range. Charter §9's third rule is the one to
watch: **more than three chore runs to reach `reviewed` means the child was cut wrong, not that it
needs a fourth.**

---

## Cross-cutting checklist

| Concern | Answer |
| --- | --- |
| **BYOS** | n/a to the module — it invokes no adapter and reads no vendor environment. No code path, test or fixture in this change accepts an API key, and none is added to `runCommand`'s `env: process.env` passthrough, which is preserved as-is. |
| **Worktree safety** | The subject. AC-11 proves it by snapshot: after every function has run, the repository's own `git status --porcelain` is empty and nothing outside `.harness/worktrees/` and `.git/` changed. Register row 19's clause for this ticket. |
| **Gate behaviour** | n/a — the module adds no gate and reads none. The chore flow's own final gate must be answered by a human, or `finish()` rolls back a proven-green merge (Q-0040). |
| **File format and schema** | One format is read (`solution/tasks.yaml`) and one is written (the same file, materialised from `solution.md`), both unchanged and unvalidated — see OQ-2. No new persisted format, no `shared` export, no change to any frozen contract. |
| **Lint rules** | No flow-lint rule changes; `lintFlow` is Q-0044's and is not touched. ESLint and `tsc --noEmit` strict pass workspace-wide, verified with `turbo … --force` (Q-0065). |
| **Cold-clone impact** | Neutral. No command changes, nothing is added to a first run's path, and `runCommand`'s timeout is what keeps an adopter's first `integrate` from hanging silently. |
| **Product-agnostic** | No SaaS product is named. The commit identity `harness@local` / `harness` is preserved as-is; the *product*-naming defect the port carries is in the adapters' BYOS refusal (Q-0068) and does not appear in this module. |
| **Freeze** | Nothing under `spike/` is touched; the two spike test blocks are transcribed, not moved. CI's `port freeze (branch scope)` job covers `harness/Q-0048/*`. |

---

## Provenance

Written against the working tree on 2026-08-27. Verified while writing: `spike/src/fanout.js` line by
line; its call sites at `spike/src/engine.js:10, 50, 213–226, 292, 497, 600, 640–645, 919–921,
931–938, 945–965, 977–1042` and `spike/bin/harness.js:21, 605`; `spike/test/smoke.js:370–395` and
`:673–690`; `packages/core/src/git/git.ts` and `git/git.source.test.ts` in full;
`packages/core/src/git/git.test.ts:451`; `packages/core/src/lint/lint.ts:29` and
`lint/lint.source.test.ts:127–131`; `packages/core/src/backlog/backlog.ts:20–52`;
`packages/core/test/corpus.ts` and `test/repo.ts` in full; `packages/core/package.json`,
`packages/core/vitest.config.js` and `vitest.shared.js`; `packages/shared/src/constants.ts`,
`index.ts` and `flow.ts:230–300`; `harness/port-charter.md` §§1–11 including register rows 19 and 20;
`harness/flows/chore.yaml`; `harness/roles/developer-generalist.md`;
`backlog/Q-0042-core-git/dev/implement-report.md:171–225`;
`backlog/Q-0047-…/requirements/candidate-claude.md` for house structure; `docs/04-architecture.md:14,
42, 44` and `spike/README.md:20`.

Measured rather than cited: `YAML.parse('')` returns `null`, so `loadTasks` on an empty `tasks.yaml`
throws a `TypeError`; a child writing 2 MiB through `execSync` with default options fails with
`status=1, signal=null` and no captured output; no non-test source under `packages/core/src`
currently contains `execSync`, `spawnSync` or `shell:`; the six measured chore children average
$29.53 from their `runs.log` terminal lines.

Git state at the time of writing: `harness/Q-0041/integration` and `harness/Q-0042/integration` are
both contained in `main`; `harness/Q-0048/integration` does not exist.

Decisions this document leans on, by title and date: *The port takes the chore route, except the one
child that has new behaviour* (2026-08-25) · *The port preserves behaviour; one exception is
authorised and everything else stops the child* (2026-08-25) · *Git worktrees are the execution
model* (2026-08-06) · *Branch layout: `harness/<id>/integration` plus sibling step/task branches*
(2026-08-21) · *Tasks are small; the fan-out is the unit of parallelism, not of scope* (2026-08-23) ·
*Every file a red test requires must be owned by exactly one task* (2026-08-23) · *Red for the right
reason is an engine property, not a role property* (2026-08-22) · *Containment is derived from git on
each board invocation, never stored* (2026-08-24) · *The erratum is closed: the sentence was true,
and it was still the wrong sentence* (2026-08-25) · *Q-0035 accepted: a check that skips its subject
must not report success* (2026-08-25) · *A requirement may not name a surface its flow cannot write*
(2026-08-25) · *Zod describes structure and types; the flow lint keeps the semantics* (2026-08-25) ·
*`core` is organised in folders named after the port's children* (2026-08-26).
