# Q-0099 — CLI `board` and `adapters`, the two commands that always exit 0

*Requirement, run 1, candidate: claude. Written against the tree at `f7d0c43`, 2026-09-04.*

---

## 0. What was measured, and what it changes

The ticket body is Appendix A of Q-0091's merged requirement, transcribed on **2026-09-03**. Since
then **four tickets have landed on this ticket's subject** — Q-0091 (`lint`, `validate`), Q-0092
(`runs`), Q-0093 (`init`, `ticket`) and Q-0094 (`run`) — so every claim below was re-derived rather
than inherited. That is not ceremony: **five of the thirteen findings change the work**, and two of
them are shipped tests that go red the moment this ticket registers a name.

### The five that change the work

**M-1 — Two guards use `board` as their negative fixture, and both fail when it is registered.**
This is the single most important measurement in this document, because it is invisible until an
implement round runs the suite and then looks like a mystery.

- `packages/cli/src/commands.test.ts:106–110`, *"the extraction has a subject"*, appends a synthetic
  `  quorum board …` line to `HELP` and asserts
  `mentioned(withStray).filter((name) => !isCommand(name))` is `['board']`. Once `board` is a
  command, `isCommand('board')` is `true`, the filter yields `[]`, and the assertion fails.
- `packages/cli/src/frame.source.test.ts:457–465`, *"AC-10 — an unregistered command module fails"*,
  uses `const unregistered: [string, string][] = [['board.ts', 'containment();']]` and asserts the
  offender list contains `board.ts: a command module with no entry saying which domain symbols it
  may name`. Once `COMMAND_DOMAIN` has a `board.ts` row — which AC-10 of this document requires —
  the message is not produced and the assertion fails.

Neither may be repaired by weakening. Both are *demonstrations that a guard discriminates*, which is
what `"A check is not established by reading it"` (2026-08-29) exists to require, so each must be
**re-aimed at a name that is not a command and shown still to fire**. AC-2 is that criterion.

**M-2 — AC-8 names the wrong register.** The body says *"`main.test.ts`'s `INVOCATIONS` gains
`board` and `adapters`"*. Q-0091 **split** that list in two (`main.test.ts:23–46`):

- `INVOCATIONS` is AC-6's subject — the four shapes that must **print the help** and leave the
  status at 0. Adding `board` there asserts that `quorum board` prints `HELP`, which is false, and
  turns AC-6 red.
- `READ_ONLY` is `INVOCATIONS` plus one real invocation of each read-only command, and is what
  drives the byte-identical tree-and-refs snapshot. That is the list AC-8's *claim* belongs to.

The register's own JSDoc says *"the list grows with each read-only command as it lands"* — and
**`runs` is not in it**, so the promise is already false one ticket old. This ticket either makes it
true again or records why not; AC-9 rules it.

**M-3 — `board.ts` may not import `node:fs`, so the spike's `existsSync` guard cannot be
reproduced.** `frame.source.test.ts:496` asserts
`production().filter(([, text]) => IO_MODULE.test(text))` is `[]`, and `IO_MODULE` (`:186`) covers
`node:fs`. The spike guards with `fs.existsSync(path.join(harnessDir, 'flows'))`
(`spike/bin/harness.js:355`), and `lintFlowDirectory` documents the alternative in its own header:
*"a missing directory throws a raw `ENOENT` rather than a `FlowError` … preserved defect"*
(`packages/core/src/lint/lint.ts:277–279`). So the mechanism is **forced** to change while the
behaviour is preserved: a narrow catch on `ENOENT`. Stated here rather than left to a review round,
because the obvious wide `catch {}` would also swallow a lint crash and an `ENOTDIR` the spike
propagates.

**M-4 — AC-3's negative claim is false, and it is false about the file AC-4 orders translated in
full.** The body says the form `owner=qa cost=$0.00 iter={}` *"exists nowhere under
`spike/test/`"*. `grep -rn "owner=qa cost" spike/ packages/` returns exactly one line:

```
spike/test/q0036-board-containment.js:126:
  assert.match(output(r), /T-0001[^\n]*owner=qa cost=\$0\.00 iter=\{\}/, 'the row keeps its exact current shape')
```

That is scenario **C3**, in the file AC-4 says to translate C1–C10 of. The remedy the body proposes
— assert a zero-cost, empty-iterations row in full — is right; its justification is not. Recorded
because a next reader re-deriving against a stated negative would stop looking.

**M-5 — the inherited risk is obsolete: `init` and `ticket new` both exist.** The body's *"Risks it
inherits"* says the board fixtures *"cannot use `quorum init` or `quorum ticket new` … both are
Q-0093's"*. Q-0093 shipped **2026-09-04** and both are in `HANDLERS` (`main.ts:56–62`). So the
fixture strategy is no longer a workaround: `q0036-board-containment.js`'s own approach — build the
project through the CLI so the frontmatter is *"exactly what the product writes"* (`:46–47`) —
translates **directly**, through `test/invoke.ts`'s in-process `invoke`. The body's fallback
(hand-write `harness.yaml`, call `Backlog.create()`) is now the *worse* option and is registered as
rejected.

### The eight that confirm rather than change

**M-6 — the `lintFlowDirectory` substitution is behaviour-identical, measured rather than assumed.**
The body prescribes reaching the flow set through `lintFlowDirectory` instead of the spike's
`readdirSync` + `loadFlow` + `catch`. The obvious worry is that `lintFlowDirectory` *lints* where
`loadFlow` merely loads, so a flow that parses but fails lint would be dropped here and kept there.
It is not: `loadFlow` **already calls `lintFlow`** (`packages/core/src/engine/loaders.ts:17–21`, and
`spike/src/engine.js:39–44`), and `lintFlowDirectory`'s per-file body is the same three steps —
parse, assign `file`, `lintFlow` — pushing a record **without** `flow` on any throw
(`lint/lint.ts:284–297`). The cross-flow pass afterwards only pushes `problems` and never removes
`flow`. So `records.filter((r) => r.flow !== undefined).map((r) => r.flow)` is the spike's `flows`
array exactly, modulo:

| | spike `board` | `lintFlowDirectory` |
| --- | --- | --- |
| order | `readdirSync`, unspecified | `.sort()` |
| missing directory | guarded by `existsSync` | raw `ENOENT` — M-3 |
| work done | parse + lint per file | the same, plus one cross-flow walk |

**M-7 — the order divergence is latent and no rendered byte moves.** `chore.yaml` and
`solutioning.yaml` **both** `consume: requirements` (verified in both files), so `flows.find()`
picks by array order. On this machine `readdirSync('harness/flows')` already returns
`chore development qa-red requirements review solutioning` — sorted — so `chore` wins under both.
What the change removes is a non-determinism, not a hint.

**M-8 — this is the first command child that needs no new `@quorum/core` symbol.** All five domain
symbols are already exported and already in `DOMAIN` (`frame.source.test.ts:339–345`): `loadProject`,
`containment`, `lintFlowDirectory` for `board`; `loadProject`, `getAdapter`, `probeAdapter` for
`adapters`. `package.test.ts:334` derives the expected barrel surface *from that block by regex*, so
the barrel does not move either. Q-0091 added three names, Q-0092 six, Q-0093 two; this ticket adds
none, which is ground rule 4 satisfied for the first time rather than merely asserted.

**M-9 — the citations.** `case 'board':` is `spike/bin/harness.js:353` and its `return;` is `:398`;
`case 'adapters':` is `:406` and its `return;` is **`:424`**, with `:425` the closing brace. The body
says *"`adapters` (`:425`) end in `return;`"* in its header and *"`harness.js:424` `return`s"* in
AC-7(c); **AC-7(c) is right**. `currentBranch` is defined at `:287` and called only at `:326` inside
`init` — the body's claim, confirmed. `board` reaches `loadFlow` at `:355`.

**M-10 — `owner=` is the account unless it is supplied.**
`Backlog.create({ owner = process.env.USER ?? 'unknown', … })` (`backlog/backlog.ts:190`), which is
the preserved `owner` defect ground rule 3 forbids closing here. `q0036`'s `makeTicket` passes
`--owner qa` (`:49`); `q0033`'s does not. A translated fixture asserting `owner=` **must** supply
one, or its verdict is a property of the account — refused by *"A test's verdict is a property of
the commit, not of the checkout or the account"* (2026-08-30).

**M-11 — a column with no consuming flow emits an empty dim span.** `c.dim(next ? … : '')` produces
`\x1b[2m\x1b[0m`, not nothing:

```
"[1mdraft         [0m[2m[0m"
```

Invisible to every translated assertion, because they all read through `plain()`. Preserved anyway,
because it costs one ternary and a port preserves behaviour; noted so the choice is deliberate.

**M-12 — the help's description column is 42, and both new lines fit it.** Measured prefix widths:
`  quorum board` is 14, `  quorum adapters [--probe] [--json]` is 36, against the widest existing
prefix `  quorum validate <schema.json> <file…>` at 39 + 3 = **42**. So no existing help line
reflows. `commands.test.ts:245` pins `columns.length` at **7**; it becomes **9**.

**M-13 — turbo needs no new input, and the spike-parity pins are identifiable.**
`../../harness/flows/*.yaml` is already declared for `@quorum/cli#test` (`packages/cli/turbo.json`),
so a board test reading the six shipped flows adds no declaration. In
`packages/core/src/spike-parity.test.ts`, `q0036-board-containment.js` (`:236`) is `verdict: 'cli'`
with **no** `binaryCarriedBy`; `q0033-surface.js` (`:173`) carries four counterparts and its
`binaryHalf` note **already names this ticket** — *"and S11's board compatibility — Q-0099"*. The
identity pins that must move are at `:1543`, `:1566` and `:1591`. The four totals — 220 / 2739 /
2469 / 5428 and 55% — are pinned at `:1202–1207`; `wc -l spike/test/*.js` is 5465, less `run.js`'s 37,
which is 5428. Adding a field moves none of them.

---

## 1. Problem

`quorum` dispatches seven commands. Two of the spike's eight are missing, and they are the two a
stranger reaches **first**.

For the **adopter**, `quorum init` prints `next: harness adapters · …` and the command it names does
not exist. `adapters` is the one command that de-risks a paid run before it is paid for — it says
whether the vendor CLIs are installed and, with `--probe`, whether the subscription actually answers
— and without it the first thing a cold-clone user is told to do fails. `board` is the third step of
the same path: the kanban that says which tickets exist, what stage each is at, and — since Q-0036 —
where the code actually is relative to the base branch.

For the **maintainer**, `board` is the only surface that renders **containment**, the git-derived
fact that a stage cannot carry. `stage: reviewed` says a review happened; `main:not-contained(+12)`
says the code is not in the base branch, and the two are routinely different. Nothing else in the
product answers that question, so until `board` is ported it is unanswerable from the binary.

Both commands are also structurally the *simplest* remaining, and that is why they are one ticket:
each ends in `return;` and can only exit 0 (`spike/bin/harness.js:398`, `:424`), where every other
ported command carries an exit-code contract. What they cost is not control flow but **rendering
fidelity** — 220 lines of board scenarios pin the containment vocabulary token by token, and the
`adapters` surface has **no inherited coverage at all**.

The risk this ticket actually carries is different from its predecessors'. It is not *"can the
presentation layer be built"* — the domain logic is entirely in `core` and this is the first child
needing no new barrel symbol (M-8). It is that **registering these two names breaks two shipped
guards that use them as negative fixtures** (M-1), and that the criterion naming the register to
extend names the wrong one (M-2).

---

## 2. User stories

**Adopter.** *As a cold-clone adopter, I run `quorum adapters` because `quorum init` just told me to,
and I am told which of my vendor CLIs Quorum can see — in one line each, with a version — so I know
before I spend anything whether the two subscriptions I already pay for are visible. When I add
`--probe`, I am told whether each login actually answers, with the round-trip and what it cost.*

**Adopter.** *As a cold-clone adopter, `quorum board` shows me my one ticket under `draft` with the
command that moves it forward, so I do not have to read the flow files to learn what to run next.*

**Maintainer.** *As a solo maintainer with fifty-odd tickets, `quorum board` tells me both facts at
once: the stage each ticket claims, and whether its branch is actually in `main`. When git cannot
answer — a shallow clone, a base ref that is not there, a branch nobody created — it tells me that in
those words and never guesses `not-contained`, because a false negative would send me looking for
work that is already landed.*

**Contributor.** *As an adapter contributor, `quorum adapters --probe --json` gives me a machine-
readable report of what my adapter's `check()` and a real round-trip returned, so the contract I am
implementing has an observable surface.*

---

## 3. Acceptance criteria

Twelve, each independently testable. Every test runs through `main` via `packages/cli/test/invoke.ts`
(Q-0091 AC-2: the dispatch boundary is part of the claim), and every fixture is pointed with
`--project <dir>` rather than `process.chdir`, which exercises the flag the spike reads inside its
own `loadProject` and avoids a working-directory race between test files.

---

### AC-1 — `board` and `adapters` are registered, in the spike header's order, and their help lines fit the column

`COMMANDS` (`commands.ts:35`) becomes, exactly:

```ts
['help', 'init', 'ticket', 'board', 'run', 'lint', 'adapters', 'validate', 'runs']
```

`board` between `ticket` and `run`, `adapters` between `lint` and `validate`, because
`spike/bin/harness.js:5` sits between `:4` and `:6` and `:8` between `:7` and `:9` — the ordering
rule Q-0092, Q-0093 and Q-0094 each applied. `HANDLERS` (`main.ts:52`) gains the two matching
entries; the `Record<Command, CommandHandler>` type makes a name without a handler, or a handler
without a name, a compile error.

`HELP` gains two lines carrying the **information** of the spike header's counterparts, rewritten
rather than transcribed:

- `board` — that it is a kanban of tickets by stage.
- `adapters` — its two flags `[--probe] [--json]`, that it reports which vendor CLIs are installed,
  and that `--probe` also proves the login. **The spike's `CLIs installed + no API keys` may not
  survive**: `product-boundaries.md` says the word is **subscription**, and `commands.ts`'s own
  header already commits to rewriting each line for exactly this reason.

*Test:* `commands.test.ts` gains a Q-0099 block in the shape its four predecessors wrote.
(a) Both pins — `[...COMMANDS]` and `mentioned(HELP)` — move to the nine-name list and are shown
`not.toStrictEqual` the seven-name value they held, so neither was widened to a `toContain` that
accepts either. (b) `isCommand('board')` and `isCommand('adapters')` are `true`. (c) The `adapters`
line contains `[--probe] [--json]` and says what `--probe` adds; the `board` line says what it shows.
(d) Order: `indexOf('ticket') < indexOf('board') < indexOf('run')` and
`indexOf('lint') < indexOf('adapters') < indexOf('validate')`. (e) The existing alignment test's
`columns.length` register moves **7 → 9** and the single-column assertion still holds — measured at
42, which both new prefixes clear (M-12), so no existing line reflows.

---

### AC-2 — the two guards that use `board` as their negative fixture are re-aimed, and shown still to discriminate

Both are demonstrations that a guard fires, so neither may be deleted or weakened.

(a) `commands.test.ts:106–110` builds `withStray` by appending a `board` line to `HELP` and asserts
the unregistered set is `['board']`. Re-aim the synthetic line at a name the frame does not dispatch
and will not (it is not one of the spike's eight), and keep both halves: the extraction finds it,
**and** `isCommand` rejects it.

(b) `frame.source.test.ts:457–465`'s `unregistered` fixture is `[['board.ts', 'containment();']]`.
Re-aim the module name the same way. Its sibling clause — `domainOffenders([], [], COMMAND_DOMAIN)`
containing `lint.ts: an entry for a module that is no command's` — is unaffected and stays.

*Test:* each re-aimed fixture produces the same offender message it produced before, over the
post-change `COMMAND_DOMAIN` and `COMMANDS`; and the **old** fixture value is shown, in a comment or
an assertion, to no longer discriminate — so a later reader cannot restore it thinking it was
arbitrary. This criterion is what stops the change arriving as two unexplained red tests in an
implement round.

---

### AC-3 — the board's columns and its hint, over the flow set `core` already computes

`quorum board` iterates `@quorum/shared`'s `STAGES` in order. For each stage:

1. Its tickets are those whose `meta.stage` equals it.
2. An **empty** column is skipped **except** `draft`, `requirements` and `solutioned`, which always
   render.
3. The header is `c.bold(stage.padEnd(14))` followed by `c.dim(hint)`, where `hint` is
   `→ harness run <flow-name> <id>` for the **first** flow whose `consumes` is that stage, and the
   empty string otherwise — which emits an empty dim span, preserved (M-11).
4. **The binary in that hint stays `harness`.** Ground rule 3 and Q-0100, which owns all four such
   sentences at once; a fix here would be that ticket done badly, one command at a time.

The flow set comes from `lintFlowDirectory(path.join(harnessDir, 'flows'))`, keeping the records
whose `flow` is present. This is measured behaviour-identical to the spike's `readdirSync` +
`loadFlow` + `catch` (M-6), with one ruled divergence — the records are **sorted**, which removes a
latent non-determinism between `chore.yaml` and `solutioning.yaml`, both of which `consume:
requirements`, and moves no rendered byte today (M-7).

**A missing `harness/flows` directory yields no hint and exits 0.** `board.ts` may not import
`node:fs` (M-3), so this is a **narrow catch on `ENOENT`** rather than an `existsSync` guard, with
`ENOTDIR` and every other error rethrown as the spike propagates them.

*Test:* (a) over a fixture with tickets at two stages only, the rendered column set is those two plus
`draft`, `requirements` and `solutioned`, in `STAGES` order, and no other stage appears. (b) Over a
**two-flow fixture** whose flows both `consume: requirements`, the hint names the alphabetically
first — the rule, not today's answer. (c) Over the **six shipped flows** copied into a fixture, the
`requirements` hint is `chore`, with the reason carried in the assertion message; this reads
`harness/flows`, already a declared turbo input (M-13). (d) A project whose `harness/` holds no
`flows/` renders every column, prints no hint, and exits 0 — and the same fixture with `flows` as a
**file** rather than a directory is shown to throw, so the catch is narrow rather than blanket.
(e) `padEnd(14)` is asserted on a stage name shorter than 14 and on `requirements`, which is 12.

---

### AC-4 — the ticket row, byte for byte

Each ticket in a column renders as one line:

```
  <c.teal(id)> <title>  <c.dim(`owner=${owner} cost=$${cost} iter=${iter}${token}`)>
```

with two leading spaces, two spaces before the dim span, `cost` the sum of `history[].cost` treating
a missing `cost` as 0 and formatted `toFixed(2)`, and `iter`
`JSON.stringify(meta.iterations ?? {})`. `token` is AC-5's, inside the same dim span.

*Test:* the two assertions `q0033-surface.js:342` actually makes, translated — `/iter=.*review.*2/`
and `/cost=\$1\.25/` after `plain()` — over a fixture that rewrites `iterations` to `review: 2` and
appends the two history rows of `q0033-surface.js:341`, one of which has `cost: 0` and one `cost:
1.25`, so the sum is exercised rather than a single value echoed. Plus **C3's full-row form**,
`/T-0001[^\n]*owner=qa cost=\$0\.00 iter=\{\}/` (`q0036-board-containment.js:126`), which is where
the empty-iterations and zero-cost ends of both formats are pinned — the assertion the body said did
not exist (M-4). The fixture supplies `--owner qa` explicitly, because the default is the account
(M-10).

---

### AC-5 — containment is rendered in the glossary's vocabulary and nothing else

One token per row, appended inside the dim span, with a leading space:

| result | token |
| --- | --- |
| contained | ` <base>:contained` |
| not contained | ` <base>:not-contained(+<n>)` |
| indeterminate | ` <base>:indeterminate(<reason>)` |
| suppressed / no question | *(nothing)* |

`<base>` is `config.repo?.base_branch ?? 'main'`, defaulted at the reading site and **never**
substituted for a configured value. The four reasons are `missing ref`, `shallow clone`,
`git failed`, `no branch`, and no fifth spelling is introduced. The board says **contained**, never
"merged", "landed" or "shipped".

A `no branch` result renders **only** at `solutioned`, `red`, `green`, `reviewed`, `qa-passed`,
`deployed`, and is suppressed at every other stage; a `stateOf` returning `null` renders nothing.
The branch value goes through `containment().stateOf(branch)` and `board.ts` constructs no git
argument itself — `stateOf` takes `unknown` and matches as a plain string against a set that came out
of git, which is what keeps a hostile name off a command line.

*Test:* `q0036-board-containment.js` C1–C10 translated in full, each keeping its own discriminating
assertion:

| | claim |
| --- | --- |
| C1 | contained, **and** nothing written: `ticket.md` byte-identical, `for-each-ref` unchanged, no file appears or vanishes |
| C2 | `not-contained(+2)` counts `base..branch`; `(+3)` — the symmetric difference — is refused |
| C3 | an unresolvable branch and an absent `branch:` key both render unannotated, **not** indeterminate; and an empty backlog renders with no `fatal:` |
| C4 | a missing base ref is `trunk:indeterminate(missing ref)`, never a containment claim, and no raw `fatal:` reaches the user |
| C5 | a **genuinely shallow** clone is `indeterminate(shallow clone)` with no ahead count and never `not-contained` — absent history cannot disprove ancestry |
| C6 | a non-git project renders every row and exits 0, saying nothing about containment |
| C7 | a `master`-based project prints `master:contained` and the string `main` appears **nowhere** |
| C8 | `branch: "--upload-pack=touch pwned"` adds no git option and creates no file, in the fixture or in the process's working directory |
| C9 | a tag sharing the branch name does not stop the branch being annotated |
| C10 | `no branch` at all six claiming stages and at none of the four quiet ones, plus the no-`branch:`-key case at every stage |

C5's fixture keeps the `file://` scheme and `--depth 1`, because `--depth` is silently ignored for a
plain local path, and keeps the `rev-parse --is-shallow-repository` pre-assertion that the fixture is
genuinely shallow. Every fixture commit carries `-c user.email=… -c user.name=…` **at the call
site**, per `harness/rules.md` and because `git-identity.test.ts` reads literals.

---

### AC-6 — the two legends, each printed only when a row earned it

The **cost legend** prints when any listed ticket has a non-empty `history`, and carries the
tokens-only qualification — that the figure is billed cost where the vendor reports one, and that
token-only vendors are not included. The **indeterminate legend** prints when any *rendered* row was
indeterminate, **exactly once**, naming all four reasons and saying that indeterminate does not mean
the code is missing. A row whose `no branch` was suppressed does not arm it.

*Test:* C4's `output.split('git could not answer').length - 1 === 1` — one legend line however many
rows were indeterminate. C10's `/does not exist \(no branch\)/`, which is the legend covering the
reason it just printed. Plus a no-history fixture asserting the cost legend **absent** and a
with-history one asserting it present, so both directions have a subject; and a fixture whose only
`no branch` is suppressed, asserting the indeterminate legend absent.

---

### AC-7 — `adapters`: presence, probe and JSON

For `claude` then `codex`, in that order, each resolved through
`getAdapter(name, config.adapters)`:

1. `await adapter.check()` succeeding prints `✓ <name>: <version>` (`✓` green).
2. It **throwing** prints `✗ <name>: <message>` (`✗` red), contributes
   `{ adapter, installed: false, error }` to the report, and **the loop continues** to the next
   adapter.
3. **Without `--probe`**: `probeAdapter` is not called, the report records
   `{ adapter, installed: true, version, login: 'unverified' }`, and after the loop a dim
   presence-only notice prints saying logins were not verified.
4. **With `--probe`**: each *successful* check is probed with the resolved `repoDir` as `cwd`, and an
   indented second line reads either
   `  ✓` + dim(` login verified — round-trip <ms>ms`) — with `, $<cost to 4dp>` appended when
   `cost_usd` is **non-null**, and `, <n> tokens` when `tokens` is **truthy** — or
   `  ✗ <bold>login not usable</bold>: <error>`. The report entry is
   `{ adapter, installed: true, version, login: 'verified'|'failed', ...probeResult }`, in that key
   order, the spread last.
5. **With `--json`**: `JSON.stringify({ probed: Boolean(flags.probe), adapters: report }, null, 2)`
   prints **after** the human lines. That is deliberate and not a JSON-only stream; a consumer piping
   it gets both, exactly as today.

Both flags are read with `Boolean(...)`, so `--probe` (bare, hence `true`) and `--probe x` behave as
the spike's truthiness does. `--project` is passed through to `loadProject`, per Q-0091 E-6.

*Test:* driven against a **stubbed `getAdapter` and `probeAdapter`**, so no vendor CLI is required
and the verdict is a property of the commit rather than of the machine (2026-08-30) — see R-2. Eight
rows, all new, since this command has no inherited coverage: both present; one absent and the second
still reported; probe ok; probe failed; `cost_usd: null`, asserted **not** to render `$0.0000`;
`tokens: 0`, asserted not to render `, 0 tokens`; `--json` alone; `--probe --json` together, with the
JSON parsed and its `probed` and per-adapter keys asserted, and the human lines asserted to precede
it. Every case asserts **exit 0**.

---

### AC-8 — BYOS, and the four defects reported rather than fixed

(a) **No file anywhere in `packages/cli` matches any pattern in `frame.source.test.ts:788`'s
`CREDENTIAL` list.** That scan already covers the whole package including `commands.ts` and therefore
`HELP`, and asserts the *only* matching file is the guard itself. So the new `adapters` help line
must not carry the spike's `no API keys`, and **the test proving the refusal is rendered may not
spell a key**: it makes the stubbed `check()` reject with a sentence the test does not have to know,
and asserts the CLI reproduces whatever the adapter threw, verbatim.

(b) **The refusal still says `Harness runs on subscription OAuth only`.** That string is `core`'s
(`adapters/claude.ts:95`, `codex.ts:89`) and Q-0068's. The CLI's only job is to render
`e.message` unaltered; a test pins that it reaches the terminal unchanged — asserted through the
adapter-threw-it property of (a) rather than by quoting the sentence.

(c) **`adapters` exits 0 even when both CLIs are absent** (`spike/bin/harness.js:424` `return`s).
Preserved, with an authority line at the site: an adopter's CI step running `quorum adapters` reports
success on a machine with no vendor CLI at all. Registered rather than carried silently.

(d) **Q-0066's crash is preserved.** `probeAdapter` dereferences `res.usage!` unguarded
(`adapters/adapters.ts:490`), so an adapter whose login is perfect and which reports no usage answers
`✗ login not usable: Cannot read properties of null (reading 'cost_usd')`. Not caught in passing:
Q-0066 lands in both trees together, and a fix here would leave the spike disagreeing.

*Test:* a case asserting **exit 0** with both adapters' `check()` rejecting, whose test name and
comment say the zero is preserved and name Q-0090's GA-4 successor; and a case where the stub's
`probeAdapter` returns the Q-0066 shape, asserting the CLI renders it as a login failure — the defect
made visible rather than repaired.

---

### AC-9 — neither command writes, and the read-only register is made honest

Neither `board` nor `adapters` creates, modifies or deletes any file, and neither moves a ref.

**`board` joins `main.test.ts`'s `READ_ONLY`** — not `INVOCATIONS`, which is AC-6's list of shapes
that must print the help (M-2) — so the byte-identical tree-and-refs snapshot covers it, and the
companion assertion showing it *really ran inside the fixture* gains a `board` row.

**`adapters` does not join `READ_ONLY`**, and the reason is recorded rather than left as a silence:
it would require `main.test.ts` to mock `@quorum/core`, which would run `lint` and `validate`'s
snapshot against a partly-mocked core in the same file. It gets the **same snapshot property in its
own file**, around a file-local stub — which is the shape Q-0092 chose for `runs`. In the same
change, `READ_ONLY`'s JSDoc claim that *"the list grows with each read-only command as it lands"* is
corrected to the rule the tree actually follows, since `runs` is already a counter-example.

*Test:* the existing `every invocation shape leaves the working tree and the ref namespace as it
found them` covers `board` once it is in `READ_ONLY`, and the existing "shown to fail against a
handler that writes" clause already proves that loop has a subject. `adapters.test.ts` takes the same
two-half snapshot — every path with its bytes, plus `for-each-ref` — around a probing invocation,
with the fixture's non-emptiness asserted first.

---

### AC-10 — `COMMAND_DOMAIN` gains two rows, and the barrel does not move

`frame.source.test.ts`'s `COMMAND_DOMAIN` (`:370`) gains exactly:

```ts
'board.ts':    ['loadProject', 'containment', 'lintFlowDirectory'],
'adapters.ts': ['loadProject', 'getAdapter', 'probeAdapter'],
```

The register fails in both directions already — a module naming a symbol its row omits, and a row
permitting a symbol its module does not name — so each row is a claim rather than a permission. Its
own JSDoc anticipates this ticket by name: *"Q-0094 added `run.ts`, and Q-0099 adds two more the same
way."*

**`DOMAIN` does not grow, and therefore neither does `@quorum/core`'s barrel** (M-8) —
`package.test.ts:334` extracts the `DOMAIN` block by regex and asserts the barrel equals it plus the
five error classes, so an unnecessary export would fail there. This is the first command child to
need none, which is worth asserting rather than merely observing.

`FRAME_ONLY_IO` (`node:path`) covers `board.ts`, which joins `lint.ts` and `runs.ts` as a command
module importing it; `adapters.ts` imports neither `node:path` nor anything else from Node. Neither
module opens a terminal (`TERMINAL_OWNER` stays one entry) nor resolves its own location
(`SELF_LOCATING` stays one entry), and both are asserted to keep those registers at their current
size.

*Test:* both new rows shown discriminating over **mutated copies** — an extra symbol and a missing
one each producing their own offender sentence — which is the demonstration Q-0092's row wrote for
itself (`frame.source.test.ts:470–481`). Plus: the barrel's key set is asserted unchanged against its
pre-change value, and `TERMINAL_OWNER` and `SELF_LOCATING` are each asserted to have one entry after
two production modules were added.

---

### AC-11 — `spike-parity.test.ts` records the translated binary half, and the four totals are re-derived unmoved

Per ground rule 5 and GO-2, using `Entry.binaryCarriedBy` — Q-0091's E-2 field — and **not** a fourth
verdict:

1. `q0036-board-containment.js` keeps `verdict: 'cli'` and gains
   `binaryCarriedBy: ['packages/cli/src/board.test.ts']`. Its `binaryHalf` note moves from
   *"— Q-0010"* to naming what has been carried and that nothing of it is owed.
2. `q0033-surface.js` appends `packages/cli/src/board.test.ts` to its four counterparts, and its
   `binaryHalf` note's remaining-work sentence loses *"and S11's board compatibility — Q-0099"*,
   leaving `S3.2`/`S3.3` for Q-0095 alone.
3. **`adapters` moves no register entry**, and that is stated in the entry rather than left as a
   silence: no `spike/test/` file outside `smoke.js` exercises the command. The one occurrence of the
   string in `q0033-surface.js` is `:249`, a flow-lint scenario about a review panel spanning two
   adapters. `smoke.js:126–132` is Q-0095's.
4. The identity pins at `:1543`, `:1566` and `:1591` move to the eight-row value and are shown
   `not.toStrictEqual` the seven-row one they held.
5. The four totals — **220 / 2739 / 2469 / 5428**, and **55%** — are **re-derived and shown
   unmoved**, because this ticket adds a field and touches no `spike/test/` file (ground rule 2).

*Test:* the register's existing `audit()` covers existence and collection of the new counterpart, and
`board.test.ts` must therefore exist and be collected by the configured include. The identity clause
is shown red against the superseded list.

---

### AC-12 — the forced divergences are ruled in place, each with an authority line and a test that fails if it is quietly undone

Three, and only three. Each carries a one-line `Why:` naming its authority — never a transcription of
this document — per `harness/rules.md`.

| | divergence | authority |
| --- | --- | --- |
| 1 | the flow set comes from `lintFlowDirectory`, so records are **sorted** where `readdirSync` was unspecified | AC-3; behaviour-identical by M-6, non-determinism removed by M-7 |
| 2 | a missing `flows/` is a narrow **`ENOENT` catch**, not `fs.existsSync` | AC-3; `node:fs` is refused to production modules by `frame.source.test.ts` AC-11 |
| 3 | the `loadProject`-and-`die` block is a **fifth copy**, not a shared helper | Q-0091 E-6 and `runs.ts`'s own header: a frame module holding it would name `loadProject`, which the AC-10 partition forbids |

*Test:* (1) a two-flow fixture in which filename order and an unsorted order would give different
hints, asserting the sorted answer. (2) The `flows`-is-a-file fixture of AC-3(d), asserting the catch
does **not** swallow it. (3) An assertion that no *frame* module names `loadProject` — which the
existing `domainOffenders` scan already makes — plus a comment at each of the five sites; the
duplication is registered rather than defended.

---

## 4. Non-goals

1. **`lint` and `validate`** — Q-0091's, shipped.
2. **`runs`** — Q-0092's · **`init` and `ticket`** — Q-0093's · **`run` and the gate reader** —
   Q-0094's. All shipped; none is touched beyond the two re-aimed fixtures of AC-2.
3. **The three user-facing sentences naming a binary called `harness`** — **Q-0100's**. The board's
   own hint `→ harness run <flow> <id>` is one of them and is **preserved verbatim**.
   `ProjectNotFoundError`'s sentence is another and reaches both new commands unchanged.
4. **The BYOS refusal's product name** — Q-0068's, distinct from Q-0100 and in `core` rather than
   here.
5. **Q-0066's probe crash** — preserved by AC-8(d), fixed in both trees by its own ticket.
6. **`adapters` exiting 0 with no CLI present** — preserved by AC-8(c); routed to Q-0090's GA-4 with
   the unknown-command zero, which is the same class.
7. **The `owner` defect** (`backlog.ts:190` defaults to `process.env.USER`) — nine recorded
   instances, preserved again here; fixtures supply an owner rather than the code acquiring one.
8. **Any change to `spike/`** — ground rules 1 and 2. No `spike/src/` edit, no `spike/test/` edit, so
   no charter §3 freeze re-record is owed.
9. **Colour policy.** No TTY test, no `NO_COLOR`, no `FORCE_COLOR` — Q-0090 AC-3's preserved limits
   reach these two commands unchanged.
10. **A new `@quorum/core` symbol or a widened barrel.** If something appears to need porting, look in
    `core` first and say so (ground rule 4); measured, nothing does.
11. **Any exit code other than 0.** Both commands `return`. `die` is reachable only through
    `ProjectNotFoundError`, exactly as in `lint` and `runs`.
12. **A `verdict`/`blocked` channel for the implement step** — Q-0083's, and GO-4 says it does not
    exist yet.

---

## 5. Open questions

None is a blocker: no answer changes a file format or the adapter contract, and each has a
recommendation that can be ruled at the gate.

**OQ-1 — does `adapters` belong in `main.test.ts`'s `READ_ONLY`?** *Recommended: no.* Adding it
forces `vi.mock('@quorum/core')` in a file whose whole claim is a snapshot around **unmocked**
commands, which would weaken `lint` and `validate` to strengthen nothing — the guard would then be
proving that a stub writes no files. AC-9 gives it the same property in its own file, which is the
`runs` precedent. *Owner: the gate.*

**OQ-2 — should the empty dim span be preserved?** A column with no consuming flow emits
`\x1b[2m\x1b[0m` (M-11), which every translated assertion strips through `plain()` and no human sees.
*Recommended: preserve*, with one authority line. It costs a ternary, a port preserves behaviour, and
M3's web UI may yet read the raw stream. *Owner: the gate.*

**OQ-3 — should the `requirements` hint be asserted over the six shipped flows, or over a fixture?**
*Recommended: both*, as AC-3(b) and (c). The fixture proves the **rule** — first in sorted order wins
— and is stable; the shipped directory proves **today's answer** is `chore` and would go red if a
seventh flow were added that sorted ahead of it, which is a change worth noticing. The read is
already a declared turbo input (M-13), so it costs nothing in cache correctness. The `OUTSIDE`
register's note for `harness/flows` in `package.test.ts:155` names only `lint.test.ts`; extending it
is hygiene, not enforcement, since only existence is asserted.

**OQ-4 — how narrow should the missing-`flows` catch be?** *Recommended:* catch, test
`(error as NodeJS.ErrnoException).code === 'ENOENT'`, rethrow otherwise. The spike's `existsSync`
guard returns `true` for a *file* named `flows` and then crashes in `readdirSync` with `ENOTDIR`, so a
blanket catch would be a behaviour change wearing a port's clothes. AC-3(d)'s second fixture is what
makes the choice observable. *Owner: the implementer, ruled here.*

**OQ-5 — is five copies of the `loadProject`-and-`die` block still the right answer?**
`lint.ts` and `runs.ts` carry it, and AC-12(3) adds two more. The rule that forces it — a domain
symbol may be named by a command module and by nothing else — is Q-0091 E-6's and `runs.ts`'s, and is
**inherited, not re-litigated** here. Registered so that the count is visible when someone eventually
does ask: at five, a `core`-side `loadProjectOrThrowWithMessage` or a change to the AC-10 partition
becomes worth a ticket. *Owner: a successor, not this ticket.*

**OQ-6 — should `board.test.ts` spawn the built binary for any criterion?** *Recommended: no.*
`q0036-board-containment.js` spawns because the spike has no other entry point; `packages/cli` runs
through `main` in process, which is the dispatch-boundary claim Q-0091 AC-2 makes, and `build.test.ts`
already owns the one spawned-binary property (Q-0098 AC-15(c)). Ten scenarios each spawning a Node
process would cost seconds for a claim `invoke` already makes. *Owner: the gate.*

---

## 6. Risks

**R-1 — the two negative fixtures (M-1).** Measured, not predicted: `commands.test.ts:107` and
`frame.source.test.ts:459` both fail the moment `board` is registered. AC-2 exists so this arrives as
a criterion rather than as two red tests an implement round diagnoses from scratch. *Mitigation: AC-2,
which also requires the old fixture value be shown non-discriminating.*

**R-2 — an `adapters` test that spawns a real vendor CLI has a machine-dependent verdict.**
`adapter.check()` runs `claude --version` / `codex --version`; `withRetry` wraps only `run`, so
`check()` is the raw adapter's and fails fast — but fast is not the issue. On a developer's machine
with both CLIs installed the test passes; on CI's `ubuntu-latest` it fails, or vice versa. That is
exactly *"A test's verdict is a property of the commit, not of the checkout or the account"*
(2026-08-30). *Mitigation: AC-7 requires a stubbed `getAdapter`/`probeAdapter`, and the stub is
asserted to be in force — a test that accidentally reached the real registry must fail loudly rather
than pass on a machine that happens to have the CLI.*

**R-3 — a `--probe` that reaches `probeAdapter` for real spends money and writes.** `probeAdapter`
is invoked with `cwd: repoDir`, and a real round-trip bills a subscription. Q-0001 measured that
probing *inside the project* turned a hello-world round-trip into $0.39. *Mitigation: same stub; and
AC-9's `adapters` snapshot would see any directory `probeAdapter` created.*

**R-4 — a missing ref or a shallow clone reported as `not-contained`.** Turning missing evidence into
a negative claim is the failure the glossary's three-state vocabulary exists to prevent, and it is
the one a maintainer would act on wrongly — they would go looking for work that is already landed.
*Mitigation: AC-5's C4 and C5 assert the **reason token**, not merely the absence of `contained`, and
C5 pre-asserts its fixture is genuinely shallow before drawing any conclusion from it.*

**R-5 — C5's shallow fixture is easy to build wrong.** `git clone --depth 1` is **silently ignored**
for a plain local path; only the `file://` scheme makes it real, and a fixture that silently was not
shallow would assert `indeterminate(shallow clone)` over a repository that could answer — passing for
the wrong reason. *Mitigation: translate `q0036`'s `file://` and its
`rev-parse --is-shallow-repository === 'true'` pre-assertion verbatim.*

**R-6 — C8's injection assertion must be made where a stray write would land.** The spike asserts no
`pwned` file in the fixture **and** in `process.cwd()`. Under Vitest the working directory is the
package root, and a test using `--project` never chdirs — so the second assertion is about a different
directory than the spike's and must be kept, not dropped as redundant. *Mitigation: AC-5 C8 names
both.*

**R-7 — fixture commits without an explicit identity.** Every `git commit` in a board fixture needs
`-c user.email=… -c user.name=…` **spelled at the call site**, because `git-identity.test.ts` reads
literals and a helper supplying them invisibly looks like a violation to the guard written to find
one. `main.test.ts:257–259` is the shape to copy, comment included. *Mitigation: AC-5's closing
sentence.*

**R-8 — a wide catch around `lintFlowDirectory` would swallow a real lint crash.** The tempting
one-liner is `try { … } catch { return []; }`, which turns any failure — a corrupt `harness/`, a
permissions error — into "no hint" and reports success. *"A check that skips its subject must not
report success"* (2026-08-25) applied to a command. *Mitigation: OQ-4's narrow catch, and AC-3(d)'s
second fixture, which is the subject that proves it narrow.*

**R-9 — `binaryCarriedBy` recorded on the wrong row.** `q0036-board-containment.js` is the **only**
`binary-only` file in the register (`spike-parity.test.ts:1107`) and its 220 lines are exactly the
`binary-only` total, so a mis-edit there is arithmetically visible; `q0033-surface.js`'s row is not,
and dropping one of its four existing counterparts while appending the fifth would pass every clause
except the identity pin. *Mitigation: AC-11's identity pins, which name every counterpart rather than
counting them — the correction Q-0094 already made to that clause.*

---

## 7. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | AC-8(a). The `CREDENTIAL` scan already covers `HELP`, so the `adapters` help line is rewritten with **subscription**; the refusal-rendering test never spells a key, and the refusal itself stays `core`'s, verbatim. **No API-key path is added in code, test, fixture or help text.** |
| **Worktree safety** | AC-9. Both commands are reads. Neither creates a worktree, moves a ref, or writes under `.harness/` or `.quorum/`. The `board` snapshot covers both halves — tree and `for-each-ref`. |
| **Gate behaviour** | n/a. Neither command runs a flow, reaches a gate, or advances a stage. |
| **File format and its schema** | n/a. `board` reads ticket frontmatter through `Backlog.list()` and `harness.yaml` through `loadProject`; neither is validated here, and `projectConfigSchema` stays *"declared and validated nowhere"* (Q-0043 AC-11). `--json`'s shape is the spike's report object, preserved key for key including the spread order. |
| **Lint rules** | No flow file changes. `harness lint` is unaffected. `board` *consumes* `lintFlowDirectory`'s records and adds no lint rule. |
| **Cold-clone impact** | **Both commands are on the 30-minute path** — `init` names `adapters` in its next-steps line, and `board` is what a stranger runs to see their first ticket. This ticket *shortens* the path by making the command `init` recommends exist. The help wording is what a stranger reads, which is why AC-1 spends a clause on it. Registry-resolved `npx quorum` stays refused (Q-0029, M6); nothing here claims otherwise. |
| **Turbo inputs** | Unchanged. `../../harness/flows/*.yaml` is already declared for `@quorum/cli#test`; `package.test.ts`'s `DECLARED` list needs no entry, and its `OUTSIDE` note may gain a reader (OQ-3). |
| **Port charter** | No `spike/src/` or `spike/test/` change, so no freeze re-record is owed. Q-0010's children are outside `port-charter.md`'s `children:` list; the rule is ground rule 1's, not the guard's. |

---

## 8. What this ticket does *not* resolve, stated rather than implied

- `adapters` reporting **exit 0 with no vendor CLI installed** is preserved and now has an authority
  line; an adopter's CI step still reads success on a machine with nothing installed. Q-0090's GA-4.
- The board's hint, `ProjectNotFoundError`'s sentence and the `init` next-steps line all still name a
  binary called `harness`. **Four instances, one ticket: Q-0100.** Q-0093 confirmed the fourth on the
  packed-install path rather than merely predicting it.
- Q-0066's probe crash renders as an unusable login for a perfect one.
- Q-0068's `Harness runs on subscription OAuth only` reaches the terminal unaltered.
- `owner=` is still the OS account unless supplied.
- The `loadProject`-and-`die` block is a fifth copy (OQ-5).
- The `READ_ONLY` register's JSDoc promise is corrected to what the tree does; making the register
  itself complete for `runs` is not this ticket's, and is named rather than silently left.

---

## 9. Sizing

Twelve criteria, against the ~ten-to-fifteen the 2026-08-22 sizing decision puts on a ticket, and
against Q-0091's measured ceiling of fifteen. The distribution is honest about where the work is:
**AC-5 alone is 220 lines of translated scenarios** and AC-7 is eight cases with no inherited
coverage at all, while AC-1, AC-2, AC-10, AC-11 and AC-12 are register and guard work measured in
tens of lines. Two criteria — AC-2 and AC-12 — exist because a measurement found something the ticket
body could not have known, which is the argument for the requirements run rather than for going
straight to an implement step.

**Estimated new test files: two** (`board.test.ts`, `adapters.test.ts`). **Modified: four**
(`commands.ts`, `commands.test.ts`, `main.ts`, `main.test.ts`), **plus two registers**
(`frame.source.test.ts`, `spike-parity.test.ts`). **New production modules: two.** **New barrel
symbols: none** — the first command child of which that is true.
