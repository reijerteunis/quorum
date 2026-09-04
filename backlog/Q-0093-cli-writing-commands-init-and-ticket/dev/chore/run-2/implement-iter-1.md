# Q-0093 — implement report, chore run 2, iteration 1

*Every criterion of `requirements/merged.md` is implemented. No file under `spike/` changed. Five
findings are reported and not fixed; three gate obligations are the human's.*

---

## 1. Verification, run before anything below is claimed

| what | result |
| --- | --- |
| `pnpm install --frozen-lockfile` | exit 0, *"Already up to date"* — the manifest change is `files`, which the lockfile does not record |
| `npm install --prefix spike --no-audit --no-fund` | exit 0, 7 packages |
| `pnpm turbo run lint typecheck test --force` | **21/21 tasks, 0 cached** — `@quorum/cli` 336 tests / 16 files, `@quorum/core` 1320 tests / 59 files, all packages green |
| `npm test --prefix spike` | **19/19 test files passed**, `q0080-allocation.js` A1–A9 included |
| `node spike/bin/harness.js lint` | 6/6 flows clean |
| `pnpm sweep:git-identity` | *"both suites executed and green with no resolvable git identity"* |
| `pnpm exec turbo run build` | 3/3, and `pnpm exec quorum help` prints six commands |

**Hand checks through the built binary**, because the review step is read-only and `integrate` is
otherwise the first execution (Q-0098's lesson). `pnpm exec quorum init <dir>` scaffolded a project
and printed both lines; `quorum ticket new` twice gave `T-0001` then `T-0002`; a second `init` on the
same directory exited **1** with `✗ <abs>/harness already exists`; `quorum lint --project <dir>`
reported 6/6 clean over the scaffolded flows; and the scaffolded `chore.yaml` carries
`review/chore/run-{run}/chore-iter-{iter}.md` and `dev/chore/run-{run}/implement-iter-{iter}.md` —
which is the whole point of reading the templates rather than duplicating them, demonstrated end to
end rather than argued. The scratch directory was removed afterwards.

---

## 2. What changed, file by file

### `packages/core` — the scaffolding that was genuinely absent (AC-9, M-1)

**`src/backlog/scaffold.ts` (new).** `initProject(dir, templates)` and `ProjectExistsError`. Copies
the template tree to `<dir>/harness`, creates `<dir>/backlog`, refuses when `<dir>/harness` exists,
and edits `repo.base_branch` with `parseDocument` + `setIn` + `toString`. It **throws rather than
exiting**, carrying the spike's sentence byte for byte (`` `${dst} already exists` ``, the absolute
path). The ordering and the asymmetry AC-6(b) names are preserved and documented in place: the
`harness/` check precedes the `backlog/` creation, and only `harness/` is tested. `templates` is
typed `string | URL`, which is what keeps `node:url` out of `packages/cli`.

**`src/git/git.ts`.** `currentBranch(dir)` — `git branch --show-current`, empty string to `null`, a
failure to `null`, stderr piped and discarded. It is in this module and not in `scaffold.ts` because
every git call in `core` goes through one runner; a probe spelled inside `backlog/` would be a
second. **Not on the barrel**: no command asks git for a branch name (AC-9(b), the rule Q-0092
applied when it withheld `manifestShapeError`).

**`src/index.ts`.** `initProject` and `ProjectExistsError`. Twenty-four value symbols → **26**, and
the header's arithmetic sentence moves with them.

**`src/backlog/scaffold.test.ts` (new).** Fifteen assertions over a template tree the fixture builds
— deliberately **not** the shipped one, which is `packages/cli`'s subject and whose read this
package's turbo inputs do not declare. It carries the mechanism's own red demonstration: a
`YAML.parse` / `YAML.stringify` round trip keeps `base_branch` and loses **every** comment, so
preserving them is a claim with a discriminator behind it. It also runs `initProject` twice over one
tree — once with a path, once with a `file:` URL — and requires the two copies to be identical.

**`src/git/git.source.test.ts`.** The export identity moves nine → ten, with the superseded list
refused beside it rather than the assertion being widened to a `toContain`.

**`src/spike-parity.test.ts`** — AC-11. `q0080-allocation.js` gains
`binaryCarriedBy: ['packages/cli/src/ticket.test.ts']` and its `binaryHalf` prose stops saying the
work is owed; the comment explaining why the field was *deliberately* absent is **replaced by what
happened rather than deleted**. `q0033-surface.js` goes to two files —
`init.test.ts` beside Q-0091's `lint.test.ts` — and loses the *"What remains is `harness init` …
Q-0093"* clause while keeping the Q-0094 one. Clause (i)'s identity gains a fifth row; new clauses
(l) and (m) show the register red against its pre-Q-0093 value and re-derive the totals.

**`src/turbo-inputs.test.ts`.** Q-0072's guard refused the new module and the new suite until each
read base was registered with its reason — four ticket-earned registrations, the machinery working
as designed. `pathToFileURL` is registered in `ROOT_DERIVATIONS` and the key is **quoted**, because
that file is inside its own scan and an unquoted key is code (the trick `createRequire` above it
already uses; found by running it, not by reading it).

### `packages/cli` — the two commands

**`src/init.ts` (new).** `path.resolve(rest[0] ?? '.')`, `initProject`, the `ProjectExistsError`
catch through `die`, and the two-line success message. `TEMPLATES` is
`new URL('../templates/harness/', import.meta.url)` — the one self-location this package permits.

**`src/ticket.ts` (new).** `backlogOf(flags.project)` through `loadProject` (six lines duplicated
from `lint.ts` and `runs.ts` **by force**, since a shared helper would be a frame module naming a
domain symbol), the usage line verbatim, `title required`, the four argument expressions unchanged,
`create`'s throw through `die`, and the success line. The `console.log` sits **outside** the `try`,
where the spike puts it, so a throw from the printing stays a defect rather than being reported as a
refusal the backlog made.

**`templates/harness/**` (new, 20 files).** Byte-identical copies of `spike/templates/harness/**`,
verified with `diff -r` at creation and guarded thereafter.

**`src/commands.ts` / `src/main.ts`.** `COMMANDS`, `HELP` and `HANDLERS` 4 → 6, with `init` and
`ticket` inserted **above** `lint` per the spike header's own order (`:3`, `:4` before `:7`).

**`src/index.ts`.** OQ-4 resolved: the barrel now exports every command module, `runs.js` included —
it was absent by omission rather than by decision — and `frame.source.test.ts` derives the check from
`COMMANDS` so the next command cannot be forgotten the same way.

**`src/init.test.ts` (new, 19 tests).** `q0033-surface.js`'s `initFixture` and S5.1–S5.7/E5, all six
rows of AC-7's table plus the target/refusal/ordering/asymmetry/no-write-outside clauses of AC-6 and
the source half of AC-8.

**`src/ticket.test.ts` (new, 16 tests).** `q0080-allocation.js` A7 and A8 translated whole, AC-2's
usage/title/project routes, and AC-3's four preserved defects. Every fixture is built by running
`init`, which is the composition A7's own title claims.

**`src/templates.test.ts` (new, 7 tests).** AC-4's parity guard, both directions, over bytes. Its
comment carries the three-link chain in full and **link 2 is read rather than cited** — the guard
itself compares `spike/templates/harness/flows` with `harness/flows`, so if that link stops holding
the sufficiency argument fails loudly instead of silently (R-10).

**`src/frame.source.test.ts`.** `DOMAIN` 20 → 21, `COMMAND_DOMAIN` gains `init.ts` (one name) and
`ticket.ts` (two), the partition assertion goes to five with the superseded value **added rather than
replaced**, the `node:path` list goes to four with the same treatment, and the new AC-10 clauses land
(below).

**`src/package.test.ts`.** `domain()` 20 → 21, `ERRORS` four → five, the barrel identity 24 → 26 by
derivation; `OUTSIDE` and `DECLARED` gain the spike template read with its reason.

**`src/build.test.ts`.** AC-5's per-package `files` register, the tarball-versus-git identity, the
packed install running `quorum init`, and AC-8's emit-side proofs.

**`package.json` / `turbo.json`.** `files: ["dist", "templates"]`; `test.inputs` 11 → 12.

### `docs/04-architecture.md` — AC-13(b)

The package map said `templates/  shipped harness/ (flows, roles, context files) + project
scaffolds`, describing `packages/templates`, while line 66 and decision 078(e) put the assets under
`packages/cli` — two sentences of one document disagreeing. Corrected to say `packages/templates` is
a three-file scaffold holding no assets and naming where they are. The `packages/cli` section's
*"three commands"* is now five, with a paragraph on where `init`'s division falls. Status line
bumped. `docs/02-sdlc-pipeline-spec.md:607`'s `--template` / `template diff` is **registered and not
fixed** (§7 OQ-3): inventing a flag to make a document true is the defect this repository keeps
finding.

---

## 3. The IO clause, which is the criterion most worth reading the diff for (AC-10)

`IO_MODULE` matches an **import**, and `import.meta.url` imports nothing — `URL` and `import.meta`
are ambient — so the guard's own doc comment promised to forbid a mechanism it could not see. This
ticket is the first module with a reason to resolve its own location, so the guard had to gain a
subject in the same change that gave it one.

What shipped: `codeOf(text)` strips block comments and whole-line `//` remarks;
`resolvesOwnLocation` tests `import.meta.(url|dirname|filename)` over the result; `SELF_LOCATING`
names exactly one module with its reason; `locationOffenders` reports four distinct failures. All
four are **shown red by mutation** rather than observed passing:

- a frame module resolving its own location fails;
- a second command module doing it fails;
- an entry permitting a self-location its module does not perform fails, so the register cannot rot;
- an entry for a module that is no command's fails.

And the discrimination Q-0079's round 1 asked for is asserted in both directions: the shipped
expression matches, `// … import.meta.url` does not, a JSDoc block quoting it does not, `import.meta`
alone does not, and `import.meta.dirname` — the spelling a narrower regex would have missed — does.
The stripping is shown to have a subject over the real modules, so the two negatives are not vacuous.

Its stated limit: a trailing `//` after code on the same line is **not** stripped, because doing that
needs a string-literal parser (`'https://…'`). That is written into the function rather than left to
be found.

---

## 4. Findings — reported, not fixed

**F1 — `Backlog.create` leaves an empty ticket folder behind when `intent` is not a string. New, and
found by executing AC-3(b) rather than by reading it.** The method performs its three checks before
creating anything and then does `fs.mkdirSync(dir)` **before** evaluating `intent.trim()`
(`packages/core/src/backlog/backlog.ts:206–209`, and `spike/src/backlog.js:128–131` identically), so
`quorum ticket new "X" --intent` allocates the directory and throws on the next expression. The
consequence is the one that matters: the orphan is not a ticket to `list()` and **is** a taken id to
`create()`, so the next allocation refuses `T-0001` with `ticket folder already exists`, and a
`ticket new` with a good intent cannot use the id its own failed predecessor consumed. The method's
doc comment says a refusal leaves the backlog byte for byte as it was — true of its three *checks*,
false of an argument of the wrong type. It is in both trees and it is `core`'s, so ground rule 3
makes it a report; it is **pinned** in `ticket.test.ts` with the whole sequence executed, so a repair
is a deliberate act. It belongs with Q-0101 (Appendix A) or its own successor — the human's call.

**F2 — `init` reflows exactly one inline comment's alignment.** `toString()` re-renders the
document, so `  test: npm test          # used by integrate steps with run_tests: true` comes back
single-spaced. The comment's **text** survives; its **column** does not. Preserved — it is the
spike's mechanism byte for byte — and pinned as the second row of an identity assertion whose whole
point is that exactly two lines of the shipped template differ after `init`. A reader comparing an
adopter's first `harness.yaml` with the template will see it, so it is written down rather than
smoothed.

**F3 — `build.test.ts`'s isolated copy took its verdict from the index.** `trackedUnder` used
`git ls-files` (tracked paths only) while `copy()` reads the **working tree**, so the copy was never
"the commit" — it was *paths in the index, with current contents*. The difference appears the moment
a change adds a source file: a modified `index.ts` arrives and the new module it imports does not, so
the isolated build fails to compile a tree that exists nowhere. Four tests went red for a reason that
is a property of whether anyone has run `git add`. **This is the one change I made that no criterion
names**, and it is stated plainly rather than folded in: the flags are now
`--cached --others --exclude-standard`, the same oracle `gitVisible` uses one function up and the one
*"Membership is a git question, not a filesystem one"* (2026-08-28) settles. Every guarantee the
audit rests on is unchanged — what it must not receive is a build output, and a build output is
ignored — and that is now **asserted** rather than argued: the isolated audit requires no path with a
`dist` segment to have arrived.

**F4 — `commands.test.ts`'s product-boundary filter refused the folder's own canonical spelling.**
It removed `harness/\S+` before checking for the word, which admits `harness/harness.yaml` and
refuses `harness/` — the spelling `product-boundaries.md` itself uses for the folder, and the one
`quorum init` has to print, because what it creates is that directory and not a file inside it.
Widened by one quantifier to `harness/\S*`, with both existing demonstrations still passing and a new
one showing that a mention with no slash — *"runs the harness"*, *"a harness, compiled"* — is still
refused, and that the pre-Q-0093 spelling is what could not admit the new line.

**F5 — `--project` at a directory that is no project raises `ENOENT`, not `ProjectNotFoundError`.**
`loadProject(dir)` consults `findProject` only when `dir` is absent. Preserved — it is the spike's
`flags.project ? path.resolve(…) : findProject()` — and pinned in `ticket.test.ts` exactly as
`lint.test.ts` already pins it for Q-0091's command. My first draft of that test had the wrong
premise and the run corrected it.

**F6 — one pre-existing ESLint warning, untouched.** `packages/core/src/backlog/backlog.ts:276`:
*"Unused eslint-disable directive (no problems were reported from 'no-control-regex')"*. Not in a
file this ticket changes; `lint` is 14/14 with 0 errors.

**F7 — AC-13(a)'s `owner` default reproduced live, and it is the tenth instance.** The hand check
above wrote `owner: ruudvanengelenhoven` into a fresh ticket while all 76 tickets in this
repository's backlog read `owner: ruud`. Nothing about three hand normalisations reaches the code.
Pinned in `ticket.test.ts` with a `Why:` line naming Q-0093, and the test **controls and restores**
`process.env.USER` rather than reading the ambient account — `$USER` set to a known value writes that
value, `$USER` deleted writes `unknown`, and an explicit `--owner` still wins, which is the
discriminating half. Not fixed: whether the product should default an owner at all is product
behaviour, and Appendix A is its successor's body.

---

## 5. Measurements, and where the requirement's own worksheet was off

**AC-12(c), demonstrated by hand rather than asserted, and the first probe was not discriminating.**
Editing `spike/templates/harness/flows/chore.yaml` moved `@quorum/cli#test` — but it moved
`@quorum/core#test` too, because `packages/core/turbo.json` already declares
`../../spike/templates/harness/flows/*.yaml` and `cli` depends on `core` through `^test`. So the
probe was re-run against a **role** file, which neither `core` nor `shared` declares:

| state | `@quorum/cli#test` | `@quorum/core#test` |
| --- | --- | --- |
| baseline | `76b6ab619ddb2d64` | `fe45372294ead9db` |
| `roles/automation-qa.md` edited, declaration present | **`97db62f1c128be73`** | `fe45372294ead9db` |
| same edit, declaration removed | `f33092085759f7b4` | `fe45372294ead9db` |
| edit reverted, declaration still removed | `f33092085759f7b4` | `fe45372294ead9db` |
| declaration restored, tree clean | `76b6ab619ddb2d64` | `fe45372294ead9db` |

Rows 3 and 4 are the finding: without the declaration the edit is **invisible**, which is a cache hit
reporting byte identity from a comparison it never made. And the negative half holds — a file nothing
reads (`harness/q0093-hash-probe.txt`, created and deleted) left the hash at baseline. Both probed
files were restored from the `packages/cli` mirror and `git status spike/` is clean.

**`OUTSIDE` was 19, not 18.** §M-6 recorded that the recommended candidate's worksheet said 19 and
corrected it to 18. Counted at implement time it is **19 before this ticket and 20 after** — so the
candidate was right and the correction was wrong, in the other direction. `DECLARED` 10 → 11 and the
turbo inputs 11 → 12 are exactly as the worksheet says. This is the fifth consecutive figure
correction in the Q-0010 cut and the second inside a requirement rather than inherited from a ticket
body; it is recorded because a worksheet that is wrong reads as having been measured.

**AC-11(c) — the spike-parity totals, re-derived and unmoved**, which is the expected answer since
this ticket edits no file under `spike/test/`: `binary-only` **220**, `both` **2739**, `library-only`
**2469**, total **5428**, transfer share **55%**. Measured by the pin rather than assumed; a new
clause `(m)` asserts them independently of Q-0092's `(k)` so the two fail separately.

**OQ-1, re-confirmed rather than inherited.** `fs.cpSync` accepts a `file:` URL as its source — every
one of the nineteen `init.test.ts` cases goes through that expression, and `scaffold.test.ts` runs
both spellings over one tree and requires identical results. **The caveat, stated rather than
hidden:** the Node here is **v24.15.0**, while `.nvmrc` says 22 and `engines.node` is `>=22.13.0`. I
could not run a Node 22 in this environment. `src` has been typed `string | URL` since `cpSync` was
added (v16.7.0), so the claim holds by signature on 22 as well, but it was **executed** only on 24.

---

## 6. Judgement calls a reviewer should check

**The help's `ticket` line is compressed, and that is forced rather than chosen.**
`commands.test.ts`'s alignment guard requires every `  quorum …` line to share one description column
and to *have* a description; the column is 42, and the spike's own spelling —
`ticket new "<title>" [--intent "..."] [--owner name] [--id Q-0081]` — is 70 characters of argument
before any description could start. The spike's header is not column-aligned and does not describe
`ticket` at all. Rather than widen the block to ~130 characters or leave the line undescribed (which
fails the guard), the flags moved into the description: `create a ticket at the backlog's next id
[--intent --owner --id]`. All three flag names and what the command does survive; the `"..."`
placeholders and `Q-0081` example do not. `commands.test.ts` asserts each of those clauses by name.

**AC-7's sixth row needed a discriminator.** *"default `main` → `main`"* is also passed by an
implementation that never opens the file, so that test asserts the rewrite happened — the reflowed
`commands.test` comment of F2 — and asserts the shipped template does **not** already carry the
collapsed spelling, so the discriminator discriminates.

**The comment-preservation claim is stated twice, at two layers, deliberately.** `packages/cli` owns
the shipped-template behaviour and has no `yaml` dependency (non-goal 12), so it compares the written
file with the template line by line and pins the exact two-line difference. `packages/core` owns the
mechanism and has `yaml`, so it runs the round trip that destroys every comment. Neither is a copy of
the other.

---

## 7. Deliberately left alone

`spike/**` in full — `src/`, `bin/`, `test/` and `templates/`, the last **read** by the new parity
guard and never written, so no freeze re-record is owed. `README.md` (AC-13(d)). `packages/templates`
(non-goal 6) — left byte-unchanged, with `04-architecture.md` now saying it holds no assets.
`docs/02-sdlc-pipeline-spec.md`'s non-existent flags. `board`, `adapters`, `run` and the gate reader.
Q-0059's traversing `dirOf`, Q-0060's silent frontmatter, Q-0066's probe crash, Q-0068's BYOS product
name, Q-0078's diff cache. `node:readline`. No locking, retry or atomic rollback (non-goal 11): a
partial `cpSync` can still leave a partial `harness/`, and parallel `ticket new` can still race after
allocation. No new dependency. No decision entry — §7's check that none is owed was re-read and
holds; the two candidates that could have needed one, the tracked-versus-built-time template copy and
the `files` second entry, are both settled by 078(e) and 078's silence respectively.

---

## 8. Gate obligations — the human's, because no step may write `backlog/`

- **GO-1.** Transcribe Appendix A into `backlog/Q-0101-…/ticket.md`. The next free id is **Q-0101**,
  re-checked here: the highest folder on disk is `Q-0100`. F1 above belongs in that body or in a
  successor beside it, and it is new evidence the requirement did not have.
- **GO-2.** Add `init`'s next-steps line to Q-0100's body as the fourth instance. It ships preserved,
  with a `Why:` line routing to that ticket, and `init.test.ts` pins its exact text so the successor
  has an executable subject.
- **GO-3.** Q-0093's own `ticket.md` says *"217 lines"* and *"nine scenarios"*; both are wrong (§M-5,
  measured 216 and ten).
