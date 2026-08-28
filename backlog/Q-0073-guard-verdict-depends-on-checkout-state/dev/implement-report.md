# Q-0073 — implementation report

*`developer-generalist` · chore · iteration 1 · one file changed, 323 insertions, 43 deletions*

The guard's verdict is now a function of what git reports and of nothing else. One file changed:
`packages/core/src/turbo-inputs.test.ts`. No product source, no configuration, no documentation, no
`turbo.json`, no `.github/`, no `harness/` file, no `backlog/` file.

---

## 1. What I measured before writing code

The ticket says to re-run its table rather than inherit it, so I did. Everything below is from this
worktree at `65cb6b4`, and it reproduces the record exactly.

### The census, both ways

Scanning both suites' `src` and `test` trees, excluding the guard file itself (which is what
reproduces the record's numbers — the guard quotes every register key and is excluded from clause
B's own scan):

| | raw | per-file-distinct | distinct |
| --- | --- | --- | --- |
| candidates passing the syntactic filters | 578 | 461 | 307 |
| collected by `fs.existsSync`, directories **present** | 79 | 67 | 37 |
| collected by `fs.existsSync`, directories **absent** | 73 | 61 | 35 |
| **collected by the git inventory, either way** | **72** | **60** | **34** |
| classified a directory by `existsSync`, present / absent | 18 / 12 | 16 / 10 | 10 / 8 |
| **classified a directory by the inventory, either way** | **12** | **10** | **8** |
| filesystem and inventory disagree, directories present | 7 | 7 | **3** |

The three divergent literals are exactly `.harness/worktrees`, `.quorum/runs` and
`node_modules/.bin/turbo`. The record's 37/67 less those three is 34/60, which is what the inventory
gives — so AC-5's arithmetic closes with nothing unexplained.

**Tracked-only and the hashable set agree on all 578 literal occurrences**, in both directory
states, confirming E-1's measurement.

### Causation, isolated

In this worktree, at one commit, with identical file bytes: `mkdir -p .harness/worktrees
.quorum/runs` — two empty directories — moves the filesystem rule's answer by 7 occurrences and
moves the inventory's answer by none.

### The question E-1 turns on, re-measured

I re-ran the turbo probe rather than trusting it. With an untracked, unignored
`backlog/zz-q0073-probe/ticket.md` present, `turbo run test --dry=json` reports it as a hashed input
of **both** `@quorum/core#test` (135 inputs) and `@quorum/shared#test` (110), through the backlog
glob each package configuration declares. So turbo hashes untracked-unignored files, the tracked set
alone would have dropped paths turbo genuinely hashes, and `--others --exclude-standard` is the
right inventory. This also **answers OQ-3**: `filesBelow('backlog')` collecting an untracked ticket
is not a second instance of the defect, because the walk and turbo's enumeration move together.

### Baseline

`main` at this commit, in this worktree: guard 51/51, workspace forced `7 successful, 0 cached`,
`npm test --prefix spike` 12/12.

---

## 2. The change, file by file

### `packages/core/src/turbo-inputs.test.ts`

**Added — the inventory (AC-1, AC-9).** Four new declarations before `typescriptFiles`:

- `interface Inventory` with two members, `holds` (is this literal a repository path?) and
  `isDirectory` (does the set hold anything below it?). Those are the two classifying decisions AC-1
  names, and they are the only two.
- `inventoryOf(entries)` — builds the file set and the derived directory-prefix set. Pure, so a test
  can construct one.
- `listing(root = repoRoot)` — `git ls-files --cached --others --exclude-standard -z`, split on NUL.
  `-z` because a path holding a quote or a newline is otherwise returned quoted and escaped, and a
  listing that renames its own entries is the wrong foundation for a membership test. A git that
  cannot answer throws a named error rather than yielding an empty inventory, which would classify
  every literal as data and report a pass over nothing. `root` is a parameter so the AC-3 sandbox
  runs *this* function rather than a reimplementation of it.
- `repositoryInventory()` → `const INVENTORY`, obtained once at module level beside
  `const turbo = reported()`, with a floor: fewer than 200 paths is a wrong working directory or a
  sparse checkout, not a small repository, and it throws. Same guard `reported()` puts under turbo's
  input set, for the same reason.

**Changed — the two classifying decisions.**

- `pathLiterals(text, inventory = INVENTORY)`: `if (!fs.existsSync(path.join(repoRoot, value)))` →
  `if (!inventory.holds(normalised))`. The syntactic filters (separator required, no trailing
  separator, no leading `/` or `..`) are untouched; normalisation now happens before the lookup
  rather than after it, which is the same value in every case the corpus contains.
- Clause B's directory test: `fs.statSync(path.join(repoRoot, literal)).isDirectory()` →
  `inventory.isDirectory(literal)`.

Per the ticket's correction 1, the load-bearing check was the **collection** one — a fix aimed only
at the `statSync` site would have moved the message and left the dependence. Both moved.

**Extracted — `scanFiles(directory)` and `undeclaredPaths(taskId, directory, inventory)`.** Clause
B's scan body moved out of its test verbatim, so the same code can be run against two inventories.
The failure strings are unchanged, so AC-11's "names the source file and the literal" and the
directory-specific variant both survive; directory-ness is now deterministic, so keeping the variant
is safe.

**Removed — three `NOT_READ` entries (AC-6, AC-7).**

- `.harness/worktrees` and `.quorum/runs`, added by hand after Q-0072's gate. The classifier no
  longer collects them, so the register no longer has to excuse them. If the mechanism had needed
  those entries the criterion would be unmet; it does not.
- `node_modules/.bin/turbo`, which under the inventory becomes uncollectable — git ignores
  `node_modules/`. AC-7 offered "kept collectable, or removed with both citations": removed. Both
  `READ_BASES` citations that named `NOT_READ` as its answer — `test-command.test.ts`'s `bin` and
  the guard's own `bin` — are reworded to state the real reason (the installed toolchain is
  unhashable, so no declaration could cover it and its absence fails loudly at `reported()`), and a
  focused test pins that treatment.

**Removed — two `INDIRECT_ROUTES` entries for this file:** `repoRoot → value` and
`repoRoot → literal`, which were the two deleted probes. The clause C1 stale-entry test would have
failed on them otherwise — and did, in the demonstration below. `repoRoot → (bare)` is reworded to
cover the git subprocess and `listing`'s default root.

**Added — prose (AC-2).** A new paragraph in the module header states the distinction that is the
spine of this ticket: *existence used to **classify** is the defect; existence used to **refuse to
run over a missing subject** is the rule.* The full audit lives in a doc block on
`repositoryInventory`, beside the registers rather than in this report, and enumerates:

- the four surviving loud refusals, unchanged and byte-identical: `typescriptFiles`, `filesBelow`,
  `reported()`'s missing-turbo check, and clause A's missing-manifested-file check;
- `filesBelow`'s five walks — benign because turbo hashes untracked-unignored files too (measured),
  **with the residual stated**: a file git *ignores* that a walk's selector matched would be
  required to be a hashed input and could never be one. None is reachable today, and it is written
  down rather than left to be discovered, because it is this ticket's own class seen from the walk
  side;
- `typescriptFiles`' two walks, which have no such residual;
- `reported()`, which is clause A's other side rather than an independent reader;
- clause B's subject demonstration, which asserts a tracked file exists before showing it is
  undeclared;
- the inventory's own failure modes, including the sparse-checkout case from OQ-2 — a tracked path
  absent from disk is *collected*, which asks more of a declaration rather than less.

**Added — ten tests**, in one `describe` after clause B. 51 → 61.

**Imports:** `afterAll` from vitest; `commitAll, git, removeTempDirs, tempDir, write` from
`../test/repo.js` — existing test support, already a hard requirement of this suite, no new
dependency (AC-9), and `pnpm-lock.yaml` is untouched.

---

## 3. Criterion by criterion

| | how |
| --- | --- |
| **AC-1** | Both decisions read `Inventory`; no `existsSync`, `statSync` or equivalent decides membership. The rule is one sentence and lives in one place. |
| **AC-2** | The four refusals are byte-identical — `git diff` shows exactly two probe lines removed and none of the four touched. The audit is in the guard, on `repositoryInventory`. |
| **AC-3** | Three tests; see §4, which is where I depart from the wording. |
| **AC-4** | Two tests. (a) five exclusions asserted individually — import specifier, lint message, shell fragment, argv with a temporary path, prose. (b) `docs/GLOSSARY.md` collected and classified a file, `harness/flows` collected and classified a directory. A rule that promoted every slash-bearing string fails (a); one that stopped consulting the inventory fails (b). |
| **AC-5** | Floors at the measured baseline — 60 per-file-distinct occurrences, 34 distinct — plus each of the eight directory-classified literals asserted still classified. Floors rather than equalities on purpose: a later ticket naming a new path is an addition clause B already judges on its merits, and an exact count would also make the verdict depend on a developer's untracked scratch source, which is the dependence this ticket removes. |
| **AC-6** | Both entries gone; a test asserts they are absent from `NOT_READ`, that `constants.ts` still names both strings, and that the classifier collects neither. |
| **AC-7** | `dead` = every `NOT_READ` key the classifier would no longer collect; must be empty, and the message names the key. `node_modules/.bin/turbo` removed, both `READ_BASES` citations corrected, its treatment covered by its own test. The guard's self-audit (*"this file is audited by its own lists"*) stays green: its 21 non-`packages/` literals are all manifested, walked or registered. |
| **AC-8** | The only fixture that builds checkout states does it in `tempDir(…)` under `os.tmpdir`, cleaned by `afterAll(removeTempDirs)`. Nothing creates `.harness/worktrees`, `.quorum/runs` or anything else in the reader's checkout. |
| **AC-9** | Runs from a git worktree, where `.git` is a file — this entire verification ran in one, which is where `integrate` runs. `git` is already spawned by `packages/core/test/repo.ts`; no package added. Failure is a named error. Fresh clone: see §6. |
| **AC-10** | §5. |
| **AC-11** | Messages unchanged and still name file and literal. The decision entry is named here and not written — `harness/roles/developer-generalist.md:23` forbids me to append to `docs/DECISIONS.md`. See §7. |

---

## 4. Where I read AC-3 rather than followed it — the reviewer should look here

AC-3 asks for the classification to be run **twice over two inventories differing only in what an
untracked working tree can add — at minimum `.harness/worktrees`, `.quorum/runs` and
`node_modules/.bin/turbo` — and requires the verdict and the occurrence list to be identical.**

After erratum E-1 those two halves pull apart, and I could not satisfy both literally:

- The inventory is what git reports. All three of those paths are **gitignored**, so they can never
  enter it. Two inventories built from git in the two checkout states are therefore the *same set*,
  and comparing them is true but empty.
- An inventory with those three injected is a claim git never makes. Under it,
  `.harness/worktrees` and `.quorum/runs` are collected and reported — so requiring the two lists to
  be *identical* would require the fix to be absent.

So I implemented the property AC-3 states in its last sentence — *the guard returns the same verdict
on a clean checkout and on one that has run flows* — as three tests, and made the difference visible
rather than asserting an identity that only holds vacuously:

1. **`git`'s answer does not move when a working tree gains the directories the product creates.**
   A sandbox repository whose `.gitignore` mirrors this one's three roots: `listing(dir)` before and
   after `.harness/worktrees/…`, `.quorum/runs/…` and `node_modules/.bin/turbo` appear returns the
   identical set. It runs the guard's own `listing`, not a copy. It is not a straw man, because the
   same test then asserts over **this repository's** real inventory that it holds none of the three,
   whatever the checkout has done.
2. **Identical verdict and occurrence list, over both suites' real sources, under two inventories**
   that differ by what an untracked working tree can genuinely add to the inventory — a stray file
   git does *not* ignore (`docs/zz-scratch.md`, `packages/core/src/zz-scratch.ts`). Lists compared,
   not pass/fail, so two runs cannot agree by having skipped the same subject.
3. **The clause has a subject.** A working-tree-shaped inventory produces the exact six-occurrence
   list in four files that stood on `main` while every gate reported green, asserted verbatim, while
   the git inventory produces none. This is the one AC-3 most cares about: it is *constructed*, so it
   is meaningful in an `integrate` worktree and on CI — the environments structurally blind to the
   defect — and it needs neither directory to exist.

A fourth test closes both directions of "nothing is decided by the working tree": a path the
inventory holds but the checkout does not have is still collected (the sparse-checkout case, OQ-2),
and a path the checkout has but the inventory does not hold is dropped. That pair fails the moment
anything here consults the filesystem again, in **any** environment — see §5.

If the reviewer reads AC-3 as binding to the letter, this is the finding to raise, and the remedy
would be an erratum rather than another implement round: the letter and E-1 cannot both be honoured.

---

## 5. Verification (AC-10), forced, in two real environments

Both rows in this git worktree, `.git` a file, `pnpm install --frozen-lockfile` and
`npm ci --prefix spike` performed first.

| | `pnpm turbo run test --force` | `npm test --prefix spike` |
| --- | --- | --- |
| **(a) `.harness/worktrees` and `.quorum/runs` present** | `7 successful, 0 cached` — core 718 passed / 2 skipped (31 files passed, 1 skipped), shared 99 passed, five scaffolds 1 each | all 12 test files passed |
| **(b) both absent** — the `integrate`/CI shape | `7 successful, 0 cached` — identical counts | all 12 test files passed |

`pnpm turbo run lint typecheck test --force` over the whole workspace: `21 successful, 0 cached`,
28.6 s. The guard alone: **61 passed** in both states, where it was 51 before.

### The guard was demonstrated to have a subject before it was trusted

A green run is not evidence (Q-0069), and a demonstration that a guard fires is not evidence that
each of its clauses does (Q-0071). Three demonstrations, each reverted afterwards:

1. **Classifier reverted to `fs.existsSync`, both directories absent — the blind environment where
   the old code was green: 7 failed, 54 passed.** Among them three of the new Q-0073 tests and the
   C1 stale-register test. This is the whole point of the ticket: the guard now fires where every
   gate runs.
2. **Same revert, both directories present: 9 failed, 52 passed.** The two extra failures are
   clause B on `shared` and the constants test — exactly the checkout-dependence, reproduced.
3. **A bogus `NOT_READ` key added:** the dead-entry check fails and names it —
   `expected [ 'docs/zz-demonstration.md' ] to deeply equal []`.

---

## 6. What I could not run, stated rather than claimed

**The fresh-clone row of AC-9 was not executed here.** `git clone` is not permitted to write outside
this session's allowed directories, and the change is uncommitted, so a clone would have tested
`HEAD` rather than this branch. What I have instead is a derivation with its evidence: a fresh clone
has no untracked-unignored files, so its `--cached --others --exclude-standard` equals its tracked
set — and I measured the tracked set and the hashable set to classify **all 578 literals
identically**, in both directory states. The fresh-clone verdict is therefore the same one this
worktree produced. That is a derivation and is labelled as one; if the reviewer wants it observed,
the run to make is `pnpm turbo run test --force` on a clone of the integration branch.

**`spike`'s dependencies are absent in a fresh worktree.** `npm test --prefix spike` fails 11 of 12
files with `ERR_MODULE_NOT_FOUND: yaml` until `npm ci --prefix spike` is run. Nothing to do with
this change — `integrate` performs both installs — but worth knowing before reading a bare failure.

---

## 7. The decision this implies (AC-11) — named, not written

The guard's claim about a literal moved from *"it names something on disk"* to *"it names something
git will hand turbo"*. That is a change of claim, so AC-11 requires a `docs/DECISIONS.md` entry as a
**human commit at or before the gate**; my role forbids me to append to that file, so naming it is
the whole of my obligation. Suggested title and substance:

> **A guard asks git what is hashable, never the filesystem — 2026-08-28.** Membership in
> `turbo-inputs.test.ts`'s subject set is decided from `git ls-files --cached --others
> --exclude-standard`. `--others` is deliberate and the tracked set alone would be wrong: turbo
> hashes untracked-unignored files (measured). The alternative — deciding path-ness from the
> literal's role in the code — was refused by the census: existence answers *is this a path?* for
> 307 distinct literals and drops 270 of them, and re-deriving that without a syntax tree is the
> dataflow analysis Q-0072's E-1 already declined to buy. Existence used to classify is the defect;
> existence used to refuse to run over a missing subject is the rule.

`docs/04-architecture.md:68` still reads correctly (*"`packages/core/src/turbo-inputs.test.ts` is
what fails when a read stops being covered"*), so no numbered document contradicts the code and none
was edited — §3 of the requirement names no documentation surface.

---

## 8. Deliberately left alone

- **Clauses C1–C4 and their registers.** `INDIRECT_ROUTES`, `ROOT_DERIVATIONS`, `ESCAPING_LITERALS`,
  `READ_APIS`, `READ_BASES` are unchanged except for the entries that were about the two deleted
  probes and the two `NOT_READ` citations AC-7 required corrected.
- **What the guard covers.** No new manifest entry, walk or read. 307 syntactically path-shaped
  literals are still not audited as filesystem inputs.
- **Shape (1)** — classify by role rather than by existence. Refused in §4 of the requirement, and
  the census says why: it is a 307-literal problem where shape (2) is a 3-literal one.
- **Shape (3)** — auto-registering `constants.ts`'s exports. **Shape (4)** — having the suite
  `mkdir` its own subject, refused by AC-8.
- **`constants.ts` and `constants.test.ts`.** The constants are right; the guard was wrong.
- **E-1's residual limits 1 and 5** (the subprocess-read gap, the finite `READ_APIS` list) stay open
  and registered exactly as they were.
- **`turbo.json`, both package configurations, `.github/workflows/ci.yml`, `package.json`,
  `harness/harness.yaml`** — untouched. No claim is made that CI ever observed the original defect;
  the ticket's correction 2 is right that it never ran this code.
- **Q-0072's successors A and B** — not started.
- **The walk-side residual** (an ignored file matching a walk's selector) is registered in the
  guard's audit and **not fixed**: closing it means filtering the walks through the inventory, which
  changes clause A's subject and is a non-goal here. If the reviewer judges it a genuine second
  instance, it wants its own ticket, as OQ-3 instructs for the backlog walk.

## 9. Housekeeping

Three scratch measurement scripts and one probe ticket folder were created during §1 and **deleted**;
`git status` shows one modified file and nothing else. The two directories created for row (a) were
removed, so the worktree is in the state I found it.
