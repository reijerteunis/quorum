# Q-0124 — errata to `requirements/merged.md`

Amendments decided at or after the gate and binding on the implementer and the reviewer alike. Each
names the clause it supersedes. The rest of `merged.md` stands.

## E-1 — GO-1 and GO-2 are discharged; the entry is landed and the import is static — 2026-09-15

**Supersedes** GO-1's and GO-2's status as work owed, and every clause of §3 describing the decision
entry as absent. `merged.md` is otherwise unamended and all its criteria stand.

### The entry is landed

**It is *"The distribution set is five, and rejoins the emitting set"* (2026-09-15)**,
`docs/decisions/096-the-distribution-set-is-five-and-rejoins-the-emitting-set.md`, indexed in
`docs/DECISIONS.md` under `## 2026-09-15`. Cite it by **title and date**, never by number or file
name. What it rules, which the criteria now implement rather than decide:

1. **Five packed, and the two sets coincide again.** Decisions 092 and 093 are **named and not
   edited**; their *resolved* / *served* distinction is a fact about shape and survives. What changed
   is only that both shapes ship, and the sets coinciding is a property of the moment rather than a
   rule restored.
2. **`private: true` stays on all five and 078(d) is untouched.** Measured: the three packed today
   are all private and pack, because `pnpm pack` does not refuse a private package — only
   `npm publish` does. *Distribution* here means **a tarball this repository packs and installs**,
   never publication. **No criterion may be read as moving registry-resolved `npx quorum`**, which is
   still Q-0029's in M6.
3. **`files` and a `license` are owed; `engines` is not.** Neither new member declares a `license`
   today while all three packed ones carry `Apache-2.0`.
4. **The daemon import becomes STATIC and the clause-D register is deleted**, `isDaemonUnresolved`
   with it. This is the ruling the gate made: `deferredOffenders` reports in both directions, so the
   exemption cannot be deleted while the import stays dynamic, and 094's *"may become static"* was
   loose. **The trap, named in advance because its failure reads as unrelated to its cause**:
   `namedAsWritten` scans the file as written, so `packages/cli/src/open.ts` must end with **zero**
   occurrences of `import(` — comments included, and including the `typeof import('@quorum/server')`
   type query at `:213`, which a static import makes unnecessary anyway.
5. **`react`, `react-dom` and `@quorum/shared` move to `devDependencies` in `apps/web`**, inverting a
   landed division on the evidence that the bundle is self-contained — measured, 7.94 MB of React a
   100 K tarball already contains.

**The implementer is therefore NOT blocked on GO-1 or GO-2.** `blocked` remains correct for anything
else outside `developer-generalist`'s authority.

### What iteration 2 found that the criteria must carry

Recorded here because it is measured and a round should not rediscover it:

- **`packages/core/src/test-discovery.test.ts`'s `namesTheDaemon` actively forbids this change.** It
  returns `packages/cli/package.json requires @quorum/server, which kills the packed install` for a
  required edge, with a `hostile`/`permitted` fixture pair asserting both sentences by identity. It
  was written by hand at Q-0126's GO-2 and inverts here.
- **`build.test.ts`'s offline mirror cannot walk the daemon's closure.** `collect` resolves
  `<name>/package.json`, and `hono`, `@hono/node-server` and `@hono/node-ws` all fail
  `ERR_PACKAGE_PATH_NOT_EXPORTED` — verified — while `ajv`, `ajv-formats`, `yaml`, `zod`, `react`
  and `react-dom` all resolve from their own packages. That criterion is **design work**, not a
  register extension.
- **`packages/<name>` is assumed at three sites**, including `versionOf` reached with a name from
  `workspaceDepsOf`, so a path column does not fix it — only a name-to-directory map spanning both
  workspace roots does. **`README.md:74` encodes the same assumption on a user-facing surface.**
- **Three assertion groups in the packed fixture invert, not one**, and the damaged-daemon block
  deletes the installed daemon and asserts it stays deleted — which under a required edge must
  become save-and-restore or every later assertion runs against an installation the fixture broke.

### The ticket body's figures are wrong and are the human's to correct

Do not transcribe them. Byte-exact, re-derived: the daemon closure is **4 packages / 652 files /
1.72 MB**; `apps/web`'s is **3 / 85 / 7.94 MB**; the distributed emit goes **889,298 B to
1,340,507 B, +451,209 B**. The body's figures came from `du`, which reports block sizes, and its
closure walk did not resolve through `realpath`, so transitive dependencies — `ws` and `scheduler` —
were invisible to it. Two line citations in it are also wrong: the packed refusal is
`build.test.ts:2461–2462`, `:2482` is the damaged-daemon case, and the workspace assertion is
`:2134`.

## E-2 — the lockfile half is landed by hand; the branch starts with two tests red — 2026-09-15

**Supersedes** nothing in `merged.md`; it adds a gate obligation the document does not carry.
Every criterion stands.

### Why this is prep and not a criterion

`harness/roles/developer-generalist.md`'s `paths:` do not reach the tracked root-level
`pnpm-lock.yaml`, while `harness/harness.yaml:34` runs `pnpm install --frozen-lockfile` in the
integration worktree **before the suite**. The two dependency-kind moves this ticket requires both
change the lockfile, because pnpm records a dependency's *kind* per importer. **Measured rather than
assumed**: with the manifests moved and the lockfile untouched, the frozen install fails naming the
exact mismatch — *"`dependencies` in the lockfile … doesn't match the same field in package.json"*.

So an implement step that made those moves would write manifests it may write, be unable to write the
lockfile they require, and `integrate` would die `ERR_PNPM_OUTDATED_LOCKFILE` **after implement and
review had been paid for**. Q-0103's shape, and Q-0126's measured reason for the same prep.

### What is already on `harness/Q-0124/integration` — verify, do not redo

Commit `4ffa5d7`:

- **`apps/web`**: `react`, `react-dom` and `@quorum/shared` moved to `devDependencies`.
- **`packages/cli`**: `@quorum/server` moved from `optionalDependencies` to `dependencies`.
- **`pnpm-lock.yaml`** regenerated, and `pnpm install --frozen-lockfile` clean.
- **Four guards inverted rather than deleted**, each the mechanical consequence of those two moves:
  `test-discovery.test.ts`'s `namesTheDaemon` (an *optional* edge is now the defect, still keyed on
  the key and never the count), `apps/web/test/package.test.ts`'s dependency division, and
  `packages/cli/src/package.test.ts`'s two manifest assertions — the second of which Q-0126's own
  comment called *"provisional against Q-0124"*. Both inversions were shown red by mutation.

### The branch starts RED, deliberately, and on exactly this ticket's subject

`pnpm turbo run test --force` on that commit is **679 passed, 2 failed**, and both failures are the
packed fixture in `build.test.ts` — *"the packed set installs outside the workspace with the registry
dead, and runs"* and its pnpm/npm packer-agreement sibling. They fail because the fixture packs
**three** tarballs against a CLI that now requires a fourth.

**That is the ticket's headline criterion and it is the run's to turn green, not prep to be done for
it.** Nothing else is red: everything the manifest moves mechanically inverted is already green, so a
red suite during this run means the remaining work, and not an inherited breakage. Do not read the two
failures as a defect on the branch — they are the subject.

## E-3 — E-2 was false: the prep never landed, and the operator adopts the lockfile — 2026-09-15

**Supersedes E-2 entirely.** Everything E-2 asserted about the state of
`harness/Q-0124/integration` is wrong, and the implement round was right to say so.

### What happened, plainly

E-2 said the lockfile half was on the integration branch at commit `4ffa5d7` and instructed
*"verify, do not redo"*. **It was not on any branch.** The operator created the preparation worktree
with `git worktree add --detach`, which checks out a **detached HEAD** rather than the branch, so the
commit was made on no branch and `harness/Q-0124/integration` never moved from `9582b0c`. The same
prep for Q-0126 was done **without** `--detach` and did land, which is the difference.

**The verification that should have caught it did not, and the reason is this repository's own most
recorded defect class.** The operator ran `git log --oneline -1` *inside the detached worktree* and
read its own commit back. That proves the commit **exists**; it says nothing about whether a branch
points at it. `git branch --contains` is the check that answers the question that was actually being
asked, and it was not run. *A check is not established by reading it* (2026-08-29), committed inside a
gate obligation written to discharge a blocker.

**The cost is $92.76**, the most expensive implement round in this project, spent re-deriving work
that had already been done and then stopping on the one file the role may not write. E-2's second
prediction — that the branch would start red on two failures — was false for the same reason: it
started **green on the old rules**, because none of the guards had been inverted.

### The resolution, and why it is `advance` rather than `retry`

**Verified on `harness/Q-0124/implement` at `57ca37f` rather than taken from the report:**
`pnpm install --frozen-lockfile` is clean, `pnpm turbo run test lint typecheck --force --continue` is
**21/21 tasks, 0 cached**, and the packed fixture — the two tests E-2 predicted would be red — passes.
`DISTRIBUTION` is five with the name-to-directory map spanning both workspace roots, and both new
members carry `files: ["dist"]`, `license: "Apache-2.0"` and **retain `private: true`**, which is
entry 096 clause 2 held.

**The lockfile on that branch is correct and the operator adopts it.** The role's `paths:` do not
reach `pnpm-lock.yaml` and the implement step said so; what it wrote is nonetheless right, and a
generated file's correctness is mechanically checkable rather than a matter of authority — the frozen
install is the check and it passes. **Ownership is taken here rather than left implicit**: the file is
the human's, it has been verified, and no future round should read this as the role having gained that
path.

**So there is nothing for a `retry` to do.** Every criterion is implemented and the tree is green; the
step stopped on a false statement in an erratum rather than on missing work. The gate answers
`advance`, and `review` sees the change.
