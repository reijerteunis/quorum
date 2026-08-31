# Q-0058 — `harness.yaml` documents a retry key nothing reads

*Merged requirement, head of product, 2026-08-31. Both candidates were judged against the working
tree rather than against each other. Every measurement below was re-taken at this gate; where this
document, a candidate, and the ticket body disagree, this document is the later measurement and
says which claim it replaces.*

---

## Ruling at this gate

The ticket body offers three shapes, its 2026-08-31 re-derivation adds a fourth, and the two
candidates recommend **opposite** ones. That is the ticket's single design question, and it is
settled here rather than deferred, because both answers turned out to be measurable rather than
tasteful.

**Ruled: shape 1 — correct both shipped files to the spelling the code reads — plus the parity
guard that gives shape 3's benefit without shape 3's cost, plus the convention stated where a
reader of the config looks.** No code changes in either tree; no `spike/src/` file is touched.

Why, in the order the evidence arrived:

1. **The census settles it, once it is counted by the right unit.** The ticket body reports "five
   snake_case to one camelCase" over the whole file and concludes that correcting the example makes
   the retry block "mismatch its five neighbours". Split by subtree, there is no mismatch to make.
   Verified at this gate, every multi-word key Quorum reads from a `harness.yaml`:

   | Key path | Spelling | Read at |
   | --- | --- | --- |
   | `adapters.<v>.extraArgs` | camelCase | `claude.js:28`, `codex.js:48`, `claude.ts:114`, `codex.ts:112` |
   | `adapters.mock.delayMs` | camelCase | `mock.js:67`, `mock.ts:106` |
   | `adapters.<v>.retry.baseDelayMs` | camelCase | `index.js:68`, `adapters.ts:345` |
   | `adapters.<v>.retry.maxDelayMs` | camelCase | `index.js:68`, `adapters.ts:345` |
   | `repo.base_branch` | snake_case | `engine.js:57`, `diff.ts:266` |
   | `repo.max_diff_bytes` | snake_case | `engine.js:928`, `diff.ts:314` |
   | `commands.timeout_ms` | snake_case | `engine.js:529`, `steps.ts:78` |
   | `budget.per_run_usd` | snake_case | typed only |
   | `budget.per_ticket_usd` | snake_case | typed only |

   Five and five, and **`base_delay_ms` is the only counterexample in the repository — the one
   spelling nothing reads.**

2. **The split is mechanical, not stylistic, which is what makes it statable.** `getAdapter` selects
   `config[name] ?? {}` and hands the whole object through **unread** to the factory and to
   `withRetry` (`spike/src/adapters/index.js:31`, `packages/core/src/adapters/adapters.ts:275`),
   which destructure JavaScript identifiers. Everything outside `adapters.<vendor>` is read key by
   key by Quorum's own code, which chose snake_case. The rule that predicts all ten: *inside
   `adapters.<vendor>` a key is a JavaScript property name an adapter destructures; outside it a key
   is Quorum's own vocabulary.*

3. **Shapes 2 and 4 cannot deliver what they promise, and the codex candidate concedes it.**
   Renaming the code's two fields to `base_delay_ms`/`max_delay_ms` leaves `extraArgs` and `delayMs`
   camelCase in the same `adapters.<vendor>` block, so the file still carries two conventions — now
   with the split running *through* the adapters subtree instead of around it. Delivering one
   convention means renaming `extraArgs`, a live key an adopter may already have uncommented, and
   giving up the pass-through property: every key a contributor's adapter invents would need a
   mapping entry in `packages/shared` before it could be configured. The codex candidate's own
   criterion 2 calls `extraArgs` "retained compatibility, not precedent", which is the concession
   stated out loud. Under **every** shape the file keeps camelCase under `adapters.`; shape 1 is the
   only one that leaves a rule you can write down.

4. **Shape 3's stated advantage is delivered by AC-4 without shape 3's cost.** The class is *"a
   shipped `harness.yaml` names a key spelling nothing reads"*. A test that uncomments every example
   line and checks it against the schema is aimed exactly at that, needs no schema call on a load
   path, moves neither landed pin, and changes no exit code. Decisively: a strict
   `retryPolicySchema` **has no subject today** — the example is commented and
   `project.test.ts:24–31` parses only live YAML — while the AC-4 guard has one **now**, since both
   shipped files fail it before the fix. That is this project's own recurring lesson (*"A check is
   not established by reading it"*, 2026-08-29) pointing at one of the two options.

Shape 3 is deferred with its reasons in Non-goals, not omitted.

---

## Problem

`harness/harness.yaml:11` and `spike/templates/harness/harness.yaml:11` both carry, byte for byte:

```yaml
    # retry: { attempts: 5, base_delay_ms: 5000 }   # transient network/5xx only; never auth or model errors
```

`withRetry` destructures `{ attempts = 5, baseDelayMs = 5000, maxDelayMs = 60000 }` —
`spike/src/adapters/index.js:68` and `packages/core/src/adapters/adapters.ts:345`, identically in
both trees, with the arithmetic at `:108` and `:385`. `attempts` is honoured. `base_delay_ms` is
read by nothing. `maxDelayMs` is documented in no file at all.

The failure is silent and **self-concealing**: an adopter who uncomments the line gets exactly the
behaviour they asked for, because the discarded value and the default are both `5000`. Any *other*
value is discarded without a word, and the first evidence is a retry storm or a run that gives up
early against a flaky connection — the failure `withRetry` exists for. `harness init` copies the
template into every adopter's repository (`spike/bin/harness.js:397`, `fs.cpSync`), so this is on
the cold-clone path.

Underneath the typo is the class: **nothing in this repository can tell that a shipped
`harness.yaml` names a key spelling no code reads.** `harness lint` lints flows only.
`projectConfigSchema` (`packages/shared/src/project.ts:56`) declares the shape and is called by no
production file in either tree. `packages/shared/src/project.test.ts:24–31` does parse both shipped
files and assert no key is added or removed — but it parses the *live* YAML, and the defect has
lived in a **comment** since the file was written. A guard that cannot see the shape the defect
takes is not coverage for it.

---

## Measurements taken at this gate, and where they correct the candidates

Four claims re-checked and holding: both line-11 references are byte-identical in the two files;
both trees destructure camelCase; `retryPolicySchema` is module-private at
`packages/shared/src/project.ts:36` and `adapterConfigSchema` at `:50`; `git branch --list
'harness/*'` returns **nothing at all**, so charter §8's first item is live for the *chore* run.

Three corrections are this gate's own. The first would have failed on the unmodified repository.

**Correction 1 — the restoration rule in the recommended candidate selects prose, and four of the
lines it selects throw.** Its AC-6 restores "only lines matching a comment whose body is a `key:`
mapping" and pins the count at 3 per file. Executed against both files with the repository's own
`yaml` 2.9.0 rather than reasoned about:

| File | Whole-line comments whose body parses as a mapping **or throws** | Of which are examples |
| --- | --- | --- |
| `harness/harness.yaml` | **10** (`:8 :11 :12 :27 :31 :39 :41 :42 :43 :44`; `:39 :41 :43 :44` throw) | 3 |
| `spike/templates/harness/harness.yaml` | **6** (`:8 :11 :12 :29 :31 :38`; `:31` throws) | 3 |

Prose is full of colons: `# Used by integrate steps with run_tests: true. …` (`:27`) is a valid
YAML mapping, and ``# describe. Turbo still exits non-zero, so no `expect: pass` or `expect: fail`
verdict changes —`` (`:44`) has two colon-spaces and throws. Under the candidate's own clause *"a
restored line that does not parse as YAML fails the test"*, the guard is **red on `main` before
anyone fixes anything**. The discriminator that works is narrower and was measured to give exactly
**3 and 3**: the body must begin with a *plain YAML identifier* immediately followed by a colon —
`/^[A-Za-z_][A-Za-z0-9_]*:/`. Every prose "key" contains spaces; `extraArgs` and `retry` do not.
AC-5 is written to that rule.

**Correction 2 — a stated convention needs a scope, or it is false on day one.** Neither candidate
mentions `adapterOverride`: a **top-level camelCase key Quorum reads** (`spike/src/engine.js:236`,
`packages/core/src/engine/steps.ts:161`), set by the CLI on the *loaded* config
(`spike/bin/harness.js:619`) and declared nowhere in `projectConfigSchema`. It has never existed in
a file — see *"What a run's event stream carries"* (2026-08-28) — so it does not falsify the census,
which counts file keys. But the recommended candidate's "ten spellings, five and five, and not one
exception in either direction" is stated about keys Quorum *reads*, and under that phrasing it is
wrong. AC-8 states the rule over **keys written in a `harness.yaml` file** and names the runtime-only
key it excludes, so the next reader does not find the counterexample for us.

**Correction 3 — exporting the two schemas invalidates two more doc comments than AC-8 covers.**
`packages/core/src/adapters/adapters.ts:192–194` says `RetryPolicy` is declared locally *because*
"`retryPolicySchema` is a module-private const … and adding an export to a landed,
declarations-only package is a non-goal of this ticket (AC-2)", and `:204–206` says the same of
`AdapterConfig`. AC-3 makes both reasons stale. The interfaces must **stay** locally declared —
`backlog.source.test.ts:117–120` forbids any file in `packages/core` from importing zod — so only
the stated reason moves. Three comments, two packages, one criterion (AC-9).

Two further facts, both from the claude candidate and both confirmed. The core-side pin is **wider
than the ticket body reports**: `backlog.source.test.ts` forbids `.parse(`/`.safeParse(` in
`project.ts` (`:115–116`) *and* forbids `z.object(` and `from 'zod'` in **every** file returned by
`coreSourceFiles()` (`:117–120`). And `packages/shared/turbo.json`'s `test.inputs` declares
`../../spike/src/**` but **not** `../core/src/adapters/adapters.ts`, so AC-2's oracle needs a
declaration; that is a criterion clause here, not an open question.

---

## User story

**`adopter` (cold-clone), CLI + `harness/`.** I ran `harness init`, opened `harness/harness.yaml`,
and uncommented the retry example because my connection drops. I set the base delay to 30 seconds. I
want that number to take effect, or to be told it will not — not to find out from a retry storm three
weeks later that the harness has been backing off from five seconds the whole time.

**`maintainer`, `harness/`.** I read `harness.yaml` to learn what I can configure. I want the file to
name every field of a policy it invites me to write, at the spelling that works, and I want a key the
file names but nothing reads to fail a suite rather than sit there for months.

**`contributor`, `harness/` + `packages/shared`.** I am adding an adapter. I want to know what to call
my configuration keys without reverse-engineering four existing ones, and I want the declaration in
`packages/shared` to be true about what the shipped files contain.

---

## Acceptance criteria

Eleven, numbered, each independently testable. Surfaces: `harness/` (both shipped `harness.yaml`
files, `harness/port-charter.md`), `packages/shared`, `packages/core` (doc comments and one turbo
registration only), `packages/shared/turbo.json`. No CLI, daemon, flow or role surface. No
`spike/src/` file.

**AC-1 — Both shipped files spell the retry example as the code reads it, and name all three
fields.** `harness/harness.yaml:11` and `spike/templates/harness/harness.yaml:11` become

```yaml
    # retry: { attempts: 5, baseDelayMs: 5000, maxDelayMs: 60000 }   # transient network/5xx only; never auth or model errors
```

The trailing sentence is preserved unchanged; the example stays commented; its indentation and its
position under `adapters.codex` are unchanged.
*Test:* for each file, the text contains `baseDelayMs` and `maxDelayMs` and does **not** contain
`base_delay_ms`. Read via `repoFile` and `spikeSource` (`packages/shared/test/corpus.ts`), which
throw on a missing subject.

**AC-2 — Uncommenting the example is a no-op, oracled against both trees rather than asserted.** Each
value in the example equals the default the code destructures. The oracle is the **source text** of
`spike/src/adapters/index.js` and `packages/core/src/adapters/adapters.ts`, not a literal retyped
into the test, so a later change to a default turns this red instead of silently converting the
example into a trap.
*Test:* extract `{ attempts = N, baseDelayMs = N, maxDelayMs = N }` from `withRetry`'s parameter list
in each tree; assert the two trees agree; parse the example line from each shipped file and assert
every field equals the corresponding default. **The extraction throws when it matches nothing** — a
regex that has stopped matching must not report a pass over zero fields.
*And the read is declared:* `../core/src/adapters/adapters.ts` is added to
`packages/shared/turbo.json`'s `test.inputs`, and the read is registered in
`packages/core/src/turbo-inputs.test.ts` in **both** places that file requires — the per-file reason
map (beside `:155`, `'packages/core/src/backlog/project.ts': 'project.test.ts — …'`) and the flat
identity register (beside `:1726`, `'packages/shared/src/project.test.ts: packages/core/src/backlog/project.ts'`).
Without it the guard can pass from a cache hit taken over a changed default — *"A cache hit names
what the task reads"* (2026-08-28).

**AC-3 — `retryPolicySchema` and `adapterConfigSchema` are exported from `packages/shared`.** Both
are currently module-private (`packages/shared/src/project.ts:36`, `:50`).
`packages/shared/src/index.ts` re-exports `./project.js` with `export *`, so no index edit is needed.
No new dependency: `packages/shared/package.json`'s `dependencies` stays exactly `["zod"]`, which
`backlog.source.test.ts:129–130` already pins.
*Test:* `import { retryPolicySchema, adapterConfigSchema } from './project.js'` resolves and both
expose `.shape`. *Why an export rather than a reflective walk:* reaching the retry schema from
`projectConfigSchema` alone costs three wrapper hops (`.shape.adapters` → `.valueType` →
`.shape.retry` → `.unwrap()`), which makes the guard's subject zod's wrapper internals rather than
the config — and Q-0069 is the cost of coupling to a zod API nobody was watching.

**AC-4 — The parity guard: every key path in the two shipped configs is declared in the schema.** A
new test in `packages/shared/src/project.test.ts` builds, for each shipped file, the **uncommented**
document — the live YAML plus every restored example line — walks every key path in it to any depth,
and asserts each path is declared in `projectConfigSchema` or in the nested schema reached along that
path (`adapters` being a `z.record` whose value schema is `adapterConfigSchema`). A `looseObject`
`safeParse` cannot serve as the oracle: it accepts `base_delay_ms` today. The walk must be over
declared `.shape` keys.
The guard applies to **these two files only**. It does not constrain an adopter's config: the top
level stays loose, per *"Unknown keys are refused where Quorum owns the key set, and preserved where
it does not"* (2026-08-25). What Quorum *ships* naming a key Quorum does not read is a different
question from what an adopter may write.
*Test:* the assertion passes over both files after AC-1, and the failure message names the file, the
full key path, and the nearest declared sibling spellings.

**AC-5 — The restoration rule selects examples and not prose, and its per-file count is pinned.** A
line is restored only when it is a **whole-line** comment (the trimmed line begins with `#`) whose
body matches `/^[A-Za-z_][A-Za-z0-9_]*:/` — a plain YAML identifier immediately followed by a colon —
and which parses as a YAML mapping. The restored-line count is pinned per file and **the pin is 3 and
3** (`adapters.claude.extraArgs`, `adapters.codex.retry`, `adapters.codex.extraArgs` in each). A
restored line that does not parse fails the test rather than being dropped.
*Test:* three assertions. (a) The restored count per file equals its pin. (b) Deleting one example
line from a fixture moves the count and fails. (c) **The weaker rule is shown to be insufficient**: a
"body parses as a YAML mapping" rule, run over `harness/harness.yaml`, selects 10 lines and not 3 —
measured at this gate, four of them throwing (`:39 :41 :43 :44`) — so the discriminator is
demonstrated to be load-bearing rather than described as one.
*Accepted and loud:* a future prose comment beginning `# Note: …` would move the count and fail this
test. That is the correct failure — it is visible, and *"No silent caps"* forbids the alternative,
where a guard quietly reads two examples of three and reports coverage it does not have.

**AC-6 — The guard has a subject today, demonstrated rather than claimed.** The uncommenting step is
the load-bearing half: a guard reading only live YAML passes over a defect that has existed since the
file was written.
*Test:* two assertions, both required. (a) A fixture equal to the current shipped text — retry example
commented, spelled `base_delay_ms` — **fails** the AC-4 check, with the failure naming
`adapters.codex.retry.base_delay_ms`. (b) The same fixture with that line's `#` removed also fails, so
the guard is not accidentally dependent on the comment marker. A guard whose only evidence is a green
run has not been shown to have a subject (Q-0069, Q-0071).

**AC-7 — A configured retry policy reaches the delay arithmetic, at non-default values.** The
property that makes this defect invisible is that the discarded value equalled the default, so a test
using `5000` cannot distinguish a working config path from a broken one. Coverage exists for
`attempts` and for `baseDelayMs: 0` through `getAdapter`
(`packages/core/src/adapters/adapters.test.ts:127`); `maxDelayMs` reaches the arithmetic only in tests
that call `withRetry` directly, bypassing the config path this ticket is about.
*Test:* in `packages/core`, drive `getAdapter(name, config)` with an `adapters.<vendor>.retry` block
carrying **non-default** values for all three fields and assert each reaches behaviour: `attempts`
bounds the attempt count, the base delay sets the first `retry` event's `delayMs`, and the maximum
caps a later exponential one. Values are chosen small enough that no test waits on a real delay, per
`adapters.test.ts:9`. Core only — the spike's config path is byte-identical and its suite transfers to
Q-0010 (Q-0054's classification), so adding a spike test here adds work to a file set that is already
routed elsewhere.

**AC-8 — The convention is stated where a reader of the config looks, and it is enforced with the
scope the census supports.** Both shipped files gain one short comment stating the rule: keys under
`adapters.<vendor>` are camelCase because that block is passed through to the adapter verbatim
(`getAdapter`, `spike/src/adapters/index.js:31`, `packages/core/src/adapters/adapters.ts:275`); every
other key **written in the file** is snake_case. Prose, two lines at most — this is the cold-clone
path.
*Test:* over the uncommented documents from AC-4, every multi-word key path under `adapters.` is
camelCase and every multi-word key path outside it is snake_case, with **both halves demonstrated to
have a subject** — a fixture carrying `repo.baseBranch` fails, and one carrying
`adapters.codex.retry.base_delay_ms` fails.
*Scope, stated in the comment and in the test's header:* the rule governs keys written in a
`harness.yaml`. `adapterOverride` is camelCase, top-level and read by both engines
(`spike/src/engine.js:236`, `packages/core/src/engine/steps.ts:161`), and is **not** a counterexample
because the CLI sets it on the loaded config and it has never existed in a file
(`spike/bin/harness.js:619`; *"What a run's event stream carries"*, 2026-08-28). A rule stated without
that scope is false on the day it lands.

**AC-9 — Three doc comments stop reporting a defect that is fixed.** Each currently states, as present
fact, something AC-1 or AC-3 makes false.
(a) `packages/shared/src/project.ts:31–34` says both shipped files show `base_delay_ms` "which nothing
reads; that mismatch is reported rather than repaired". Replaced by a sentence naming where the three
fields are read in **both** trees, citing this ticket.
(b) `packages/core/src/adapters/adapters.ts:192–194` and (c) `:204–206` explain that `RetryPolicy` and
`AdapterConfig` are declared locally *because* their zod counterparts are module-private. After AC-3
that reason is stale. **The interfaces stay where they are** — `backlog.source.test.ts:117–120` forbids
any `packages/core` file from importing zod — so only the reason moves, to that ban.
*Test:* `packages/shared/src/project.ts` does not contain `base_delay_ms` and carries a `Q-0058`
authority reference; neither `adapters.ts` comment claims the schemas are module-private. A false
promise left in a comment is the nit class Q-0053 repaired by hand after its gate.

**AC-10 — Nothing is validated on any load path, and the two landed pins are untouched.** This ticket
does not call `projectConfigSchema` from production code in either tree.
`packages/core/src/backlog/project.ts` keeps its type-only import; `backlog.source.test.ts:115–120` and
`project.test.ts:108–114` are unedited and still pass; no file in `packages/core` gains an import of
zod or a `z.object(`. `projectConfigSchema`'s only callers remain tests.
*Test:* the two existing pin tests pass **unmodified** — verified by their absence from the diff and by
a green suite. Q-0080's requirements run already refused to drag this pin in as a side effect of
another ticket; that refusal stands here.

**AC-11 — The port charter stops pointing the cutover at this ticket's id.**
`harness/port-charter.md:430` and `:493` propose **Q-0058** as the id for the cutover follow-up. That id
is this ticket, opened 2026-08-26. The charter is reached from `harness/architecture.md`, which
`chore.yaml` injects, so the wrong pointer sits in a document *this ticket's own implement step reads*,
telling it that it is the cutover. Both sentences are corrected to say the cutover follow-up is
unopened and has no id. The historical note at `:4` — recording that the proposed id shifted from
`Q-0055` to `Q-0058` — is a record of what happened and is **left alone**, on the same reasoning that
keeps a landed decision entry unedited. The machine-readable block at `:264–265` and every enforcement
clause are untouched.
*Verification: by reading the two sentences at review, with no automated assertion, deliberately.*
`harness/port-charter.md` is entered in `turbo-inputs.test.ts`'s `NOT_READ` at `:280` as "named in doc
comments in both packages, opened by neither", and a live guard at `:1874` keeps that register honest.
Asserting over the charter's text means removing that entry, declaring a new turbo input and
registering a new read — machinery out of proportion to a two-sentence prose correction, and a
`NOT_READ` entry spent on a doc edit rather than on a real read. The ticket body calls this a
"neighbour, not this ticket's work"; it is kept because the fix is two sentences in a writable file and
the confusion it removes is aimed at this run's own implementer — *fix it at the gate when it changes
no verdict*.

---

## Non-goals

- **No validation on a load path (shape 3), and no strict schema.** Deferred with three reasons, so
  this is a decision rather than an omission: it reverses *"declared and validated nowhere"*
  (Q-0043 AC-11) and therefore owes a decision entry no step in this flow may write; it moves two
  landed pins, one of which forbids zod in `packages/core` **entirely** and not merely in
  `project.ts`; and a strict `retryPolicySchema` **has no subject today**, because the example is
  commented and `project.test.ts:24–31` parses only live YAML. AC-4 delivers the benefit shape 3 was
  wanted for, on the two files Quorum ships, with a subject that exists now.
- **No second accepted spelling (shape 2), and no rename of the code's fields (shape 4).** Refuted by
  the census and by the pass-through property, not by preference. See the ruling.
- **No rename of `extraArgs` or `delayMs`.** Both are read, both are camelCase, both are correct under
  AC-8's rule. `extraArgs` is additionally a live key an adopter may have uncommented.
- **`adapters.mock.delayMs` stays undeclared in `adapterConfigSchema`.** It is read (`mock.js:67`,
  `mock.ts:106`) and appears in neither shipped file, so AC-4 never sees it and nothing is wrong today.
  Declaring it is one line, but it is the mock's key rather than an adopter's, and adding a key no
  criterion asked for is what the implementer's role forbids. Recorded so a reviewer reads it as a
  decision rather than an oversight.
- **No code change in either tree.** `withRetry` already reads what AC-1 writes. Nothing under
  `spike/src/` is touched, so the freeze-SHA half of the port guard stays green and no re-record is
  owed (`harness/port-charter.md` §3, `freeze-sha: 7b6bc70…` at `:265`).
- **No change to the retry defaults, the backoff arithmetic, or the transient-error list.**
  `5 / 5000 / 60000` and the `TRANSIENT` table are out of scope; AC-2 pins the defaults so they cannot
  move in passing.
- **`budget.per_run_usd`, `budget.per_ticket_usd` and `backlog.layout` stay unenforced.** They are typed
  and read by nothing — an unread **value**, which `packages/shared/src/project.ts:22–25` already states
  out loud, against an unread **spelling**, which nothing states anywhere. Different class, different
  ticket.
- **No `harness lint` rule and no new CLI command for `harness.yaml`.** The guard is a Vitest assertion,
  not a product surface. Giving the config a linter is a product decision with a cold-clone cost.
- **No notice to adopters whose copied `harness.yaml` already carries the wrong spelling.** No mechanism
  exists; see OQ-3.
- **No `docs/decisions/` entry written by any step, and no criterion names one.**
  `harness/roles/developer-generalist.md` forbids it in as many words. Naming an unwritable surface in a
  criterion is the failure Q-0069's AC-11(b) recorded and *"A requirement may not name a surface its
  flow cannot write"* (2026-08-25) rules on. See the gate obligation below.
- **No rewrite of `docs/06-development-plan.md`'s Q-0058 entry by any step.** `docs/` is inside the
  implementer's paths, so it *could*; every port child's plan entry has instead been rewritten by hand at
  close (Q-0052, Q-0053, Q-0054, Q-0057, Q-0080). Keeping that avoids a collision with the human's
  closing act.
- **Not the cutover ticket.** AC-11 corrects a pointer; it does not adopt the work the pointer describes.

---

## Open questions

None blocking. Each is ruled here, with the evidence, so that solutioning starts on an answer.

**OQ-1 — Which shape? RULED: shape 1 plus the AC-4 guard.** On the census, the pass-through mechanism,
shape 4's inability to deliver one convention, and shape 3's guard having no subject today. Ruled at this
gate rather than deferred because both answers were measurable — the head of product picks when candidates
disagree, and deferring a question the tree answers would cost a second requirements run to re-derive it.
Owner: settled. If the human overturns it, AC-1, AC-2, AC-8 and AC-9 invert and the ruling must also say
what happens to `extraArgs` and `delayMs`; that would be an erratum during the loop, per *"An erratum is
the last repair, not the first"* (2026-08-30).

**OQ-2 — Does the convention need a decision entry? RULED non-blocking, routed to a gate obligation.**
No criterion names `docs/decisions/`; AC-8 puts the convention in a writable surface and enforces it in a
test, so the criteria are identical whether or not an entry is written. This is the Q-0052 R-6 shape — a
decision-entry need routed to a gate obligation rather than to a criterion. The obligation and its
required scope are below.

**OQ-3 — What tells an adopter whose copy is already wrong? RULED: accept, and record it.** `harness init`
copies once and never revisits; nothing here reaches a copy on disk. The wrong spelling is a silent no-op
rather than a failure, and the population of adopters is currently zero — the product is unpublished until
M6. A `harness init --check` belongs to M6's cold-clone work if anyone wants one. Owner: human / M6.

**OQ-4 — Should `adapters.mock.delayMs` be declared? RULED: no.** Recorded as a non-goal with its reason
above, so a reviewer reads it as a decision.

**OQ-5 — Who creates `harness/Q-0058/integration`? Repository setup, not product behaviour.** Raised by
both candidates. It is a precondition of the **chore** run and not of this requirements run. See R-4.

---

## Gate obligations

Two, both the human's, neither blocking this document.

**GO-1 — The convention's decision entry, if it is wanted, is the human's to write, before or after the
chore run.** AC-8 states a rule that predicts every key spelling in the product's config, which is
exactly what gets re-litigated by the next person to add a key. If it is written, its scope must be the
one AC-8 carries and not a sentence wider: the rule governs **keys written in a `harness.yaml` file**,
because `adapterOverride` is a top-level camelCase key both engines read off the *loaded* config and has
never existed in a file. An entry stating "every key outside `adapters.` is snake_case" without that
clause is false the day it lands, in the index that outranks the numbered docs.

**GO-2 — `harness/Q-0058/integration` must exist before the chore run.** `git branch --list 'harness/*'`
returns nothing in this repository today. Charter §8's first checklist item.

---

## Risks

**R-1 — The restoration step mis-parses prose as configuration.** Both files are more comment than
config, and this is measured rather than feared: a naive "parses as a YAML mapping" rule selects 10 lines
in `harness/harness.yaml` and 6 in the template, four and one of which throw. Mitigated by AC-5's
identifier-colon rule, its pinned per-file count, and its clause (c), which demonstrates the weaker rule
failing rather than asserting that the stronger one is needed.

**R-2 — AC-4's guard loses its subject after the fix.** Before AC-1 both shipped files fail it; afterwards
its only subject is a fixture. Mitigated by AC-6 requiring the pre-fix text to be retained as a fixture and
demonstrated red, rather than the red being observed once and discarded. This is the failure mode Q-0069
and Q-0071 each cost a round to.

**R-3 — AC-2's oracle silently matches nothing.** A regex over `withRetry`'s parameter list that stops
matching after a refactor would extract zero defaults and compare zero fields, passing. Mitigated by AC-2
requiring the extraction to throw on no match — the `corpus.ts` house rule that a reader fails loudly
rather than reporting a pass over nothing.

**R-4 — `harness/Q-0058/integration` does not exist.** `chore.yaml`'s `review` step diffs
`harness/{id}/integration...harness/{id}/implement` and only `integrate`, which runs later, creates the
left endpoint. Since Q-0038 a first-pass run refuses in the preflight rather than billing the implementer
first — so this costs a restart rather than the $13.86 it cost Q-0035 — but it still costs a restart. See
GO-2.

**R-5 — The change looks trivial and will be reviewed as a typo fix.** Ten of the eleven criteria are the
guard, the behavioural check, the convention and the stale pointer; only AC-1 is the typo. A reviewer
reading the diff for "did they fix the spelling" will approve a change that has silently dropped AC-5's
count pin or AC-6's demonstration, both of which are invisible unless run. Stated here so the review has
been warned in writing, which is the cheapest available mitigation.

**R-6 — AC-11 edits a governance document.** `harness/port-charter.md` is live and its §3 is enforced by
CI. AC-11 touches §10's prose only — a proposal about an id, not a rule — and leaves `:4`, the
machine-readable block at `:264–265` and every enforcement clause untouched.

**R-7 — AC-3 widens a landed package's public API.** `packages/shared` is declarations-only and Q-0046
recorded these two exports as *its* non-goal. The widening is deliberate here and AC-9 repairs the two
comments that recorded the old reason, so the tree does not carry a stale explanation of a decision that
has since been taken.

---

## Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a — no code path, test, fixture or example accepts or mentions a key. The example's trailing sentence (*"never auth or model errors"*) is preserved unchanged. |
| **Worktree safety** | n/a — nothing here writes to a working tree. The chore run's implementer writes in its own worktree as always. |
| **Gate behaviour** | Unchanged. No flow, role or gate is edited. OQ-1 to OQ-5 are answered at *this* gate; GO-1 and GO-2 are the human's. |
| **File format and its schema** | The ticket's subject. Key spellings change in a **comment** only; `projectConfigSchema`'s declared shape is unchanged and two of its constituents become exported (AC-3). Nothing writes `harness.yaml` back, which `project.test.ts:33–41` already records. |
| **Lint rules** | No `harness lint` rule is added or changed; `lintFlow` reads no `harness.yaml` in either tree. The new guards are Vitest assertions, visible at `integrate` because they run in `commands.test`. |
| **Turbo inputs** | One new declared input and one new registration, both named in AC-2, because a guard whose read is undeclared can pass from a cache hit — *"A cache hit names what the task reads"* (2026-08-28). AC-11 deliberately adds none; see its verification note. |
| **Cold-clone impact** | Net positive and bounded. The example gains one field and the file gains at most two lines of prose. An `adopter` who uncomments the line now gets the behaviour the line describes — the first 30 minutes getting more trustworthy rather than longer. |
| **Port freeze** | No `spike/src/` file is touched, so no freeze-SHA re-record is owed. Q-0058 is absent from `children:` (`harness/port-charter.md:264`), so the branch-scope job reports this branch out of scope rather than passing silently — the Q-0038 / Q-0057 precedent. |
| **Both trees** | Does not apply. The Q-0066 / Q-0068 / Q-0070 constraint governs a *behaviour* change that would leave the port and its witness disagreeing; here both trees already read camelCase and neither's behaviour changes. AC-9 edits comments in both, which is bookkeeping, not behaviour. |
| **Size** | Eleven criteria, inside the ten-to-fifteen band. The codex candidate's fifteen expand to roughly twenty testable units and are not merged; see Provenance. |

---

## Provenance

**Base: the claude candidate**, which is correctly sized (10 criteria), recommends the shape the
measurements support, and is written so that no criterion names a surface its flow cannot write. Its
AC-1 to AC-5 and AC-8 to AC-10 survive as AC-1, AC-2, AC-3, AC-4, AC-6, AC-9, AC-10 and AC-11. Its
Correction 1 — that the ticket body's convention census counts the wrong unit and the answer inverts
when split by subtree — is the finding that decides the ticket, and it was re-derived here rather than
inherited. Its OQ-3 (the undeclared turbo input for a shared test reading a core file) is promoted out
of the open questions into AC-2, because Q-0072 and Q-0073 both showed an undeclared read is how a
guard reports green having executed nothing.

**From the codex candidate: one criterion, and it is the best single idea in either document.** Its
criterion 7 — *"A test using `5000` alone is insufficient because it cannot distinguish successful
mapping from the default"* — is the only place either candidate proposes to test the config path
**behaviourally**, and it names exactly the property that has kept this defect invisible. It is merged
as AC-7, re-aimed at shape 1 (no mapping layer exists to test, but the path from
`adapters.<vendor>.retry` to the delay arithmetic does). Its risk *"a template-only assertion can pass
while runtime mapping remains broken"* is the same insight and is why AC-7 exists beside AC-1's text
assertions. Its criterion 12's instinct — that a previously *shipped* spelling deserves an explicit
answer rather than silence — is honoured by AC-1 naming all three fields and by OQ-3 recording the
accept.

**Rejected as the base, for three reasons stated so this is a judgement rather than a preference.**
(1) **Size.** Fifteen criteria that expand to roughly twenty independently testable units: production
validation, a strict schema, a mapping layer, both trees, non-default timing tests, a freeze re-record,
a decision entry, template regression coverage and a full-suite criterion. That is past the band where
reviewers find blockers faster than they can be closed, and it arrives at the gate reading as
thoroughness.
(2) **It names a surface its flow cannot write.** Its criterion 2 requires "a new append-only decision
entry, indexed from `docs/DECISIONS.md`". `harness/roles/developer-generalist.md` says *"You do not add
to docs/decisions/ or its index; a decision is the human's to record"*. That is the failure Q-0069's
AC-11(b) recorded and *"A requirement may not name a surface its flow cannot write"* (2026-08-25) rules
on — a criterion no round of the loop can satisfy, which is the seventh appearance of a loop handed work
no agent on its route can perform. Routed here to GO-1 instead.
(3) **Its premise is refuted by the census.** It opens by asserting "multi-word keys written in
`harness.yaml` are canonical snake_case" and then concedes `extraArgs` as "retained compatibility, not
precedent" — which is the exception that shows the rule is the subtree split, not the case convention.
Its criterion 4 additionally moves two landed pins on purpose, one of which forbids zod anywhere in
`packages/core`, and Q-0080's requirements run has already refused that as a side effect of another
ticket.

**This gate's own corrections, none of which is in either candidate.** The restoration rule and its
count, measured by executing it (Correction 1 — the recommended AC-6 would have been red on `main`
before any fix); `adapterOverride` as the scope a stated convention must carry (Correction 2); and the
two further doc comments in `packages/core/src/adapters/adapters.ts` that AC-3 makes false
(Correction 3). AC-5's clause (c), AC-8's scope sentence, AC-9's parts (b) and (c), AC-11's deliberate
absence of an automated assertion, and the rulings on OQ-1 to OQ-5 are also this gate's.
