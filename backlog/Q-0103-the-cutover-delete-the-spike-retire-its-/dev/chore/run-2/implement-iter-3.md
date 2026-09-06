# Q-0103 — implement report, run 2, iteration 3

**A revision round on `review/chore/run-2/chore-iter-2.md`, which returned `revise` with four
majors.** All four are **held**, and this report is the evidence for that — a round that changes
nothing has to earn it by measurement rather than by restating the last one.

**This round changed zero files.** `git status --short` is empty and `git diff` is empty at the tip.
That is the third file-less round the project has recorded, after Q-0091's round 3 and Q-0101's
round 3, and it has the same cause as both: a loop handed work no agent in it can perform.

**Scope is unchanged.** `requirements/errata.md` E-1 scopes this run to **Child C — AC-20 to
AC-28**, Children A (Q-0106) and B (Q-0107) having shipped. Nothing in AC-1 to AC-19 or AC-29/AC-30
was touched in any iteration of this run.

**What this round did instead of editing:** re-derived every criterion in range against the tip from
the tree rather than from iteration 2's report, ran the whole verification suite first-hand, found
the structural reason the loop cannot converge, and corrected one defect in the hand-off wording
iteration 2 supplied (§6.2 — deleting the two `settings.json` entries by line number in the order
the review gives them hits the wrong second line).

---

## 0. The four findings, dispositioned

| # | Finding | Disposition |
| --- | --- | --- |
| 1 | `CLAUDE.md:25` — the runnable-code bullet | **Held.** Contradicted by **AC-6** of the same requirement. §2 |
| 2 | `CLAUDE.md:35` — `node spike/bin/harness.js` | **Held.** Same. §2 |
| 3 | `.claude/agents/flow-author.md:6` — `node spike/bin/harness.js lint` | **Held.** Outside this role's `paths:`. §3 |
| 4 | `.claude/settings.json:8` and `:10` — two dead grants | **Held.** Same. §3 |

**Every one of the four is correct on the facts.** I verified each against the tip rather than
taking it from the review: all five sites exist, all five name a path under a directory this branch
deleted, and none of the five can succeed if executed. Nothing here disputes the findings. What is
disputed is who performs them, and on that the reviewer and I now **agree** — which is §1, and is
the only genuinely new thing this round has.

Review iteration 2 **dropped two of iteration 1's seven**: `.claude/rules/engineering.md:4`, refused
on AC-4's own text, and `docs/02-sdlc-pipeline-spec.md:562`, which iteration 2 took and fixed. The
loop went 7 → 4 and the surviving 4 are exactly the set no step of `chore.yaml` can write. The
residue is not shrinking further by traversal, because it is not the kind of thing a traversal
removes.

---

## 1. The finding this round exists for: the reviewer's own report assigns all four to the human

Read `chore-iter-2.md` for who it says should act, rather than for what it says is wrong:

- finding 3 — *"**Because this flow cannot edit the file, the human must synchronize it at the
  gate.**"*
- finding 4 — *"Remove both spike-specific grants **in the gate's human-owned synchronization**."*
- finding 1 — *"Apply the **human-owned synchronization described in the implement report** by
  deleting this obsolete bullet before accepting the cutover."*
- finding 2 — *"Replace it with **the supplied** `pnpm exec quorum` and packed-install guidance."*

Three of the four say *human* in as many words; the fourth adopts iteration 2's supplied wording.
**The reviewer accepted the disposition and returned `revise` anyway**, and its qualifier says why:
*"before accepting the cutover"*. That is not a request for a change to the diff. It is a statement
about what the **gate** should do — which is the right thing to say and the wrong place to say it.

**And it was mechanically forced.** `harness/flows/chore.yaml:35` declares
`verdict: approve|revise` — two words, no third — and `:43–45` binds them:

> *Approve only when no blocker or major survives; nits alone approve … **On approve every finding
> must be a nit**; on revise there must be at least one finding.*

So a reviewer holding a finding it believes is a **major** and simultaneously believes is the
**human's** has exactly two moves: downgrade it to `nit`, which would misreport a dead instruction
in a file fed to every agent, or return `revise`. It chose honestly and the flow converted that
honesty into another traversal.

**This is Q-0083's absence arriving on the review side, and every prior instance was on the
implement side.** That ticket's body scopes it to an implementer with no channel but prose; the
symmetric gap is a reviewer that agrees with the implementer and cannot say so without either
lying about severity or turning the loop. Iteration 2 recorded this run as the fifteenth appearance
of the general pattern and the second on this ticket; this is the third traversal on this ticket.
I have not re-derived the project-wide count and am not asserting it.

**The loop is at its bound.** `chore.yaml:46` is `max_iterations: 2`, so iterations 1 and 2
exhausted it and this third traversal exists on a `retry` grant, which authorises exactly one more
(*"`retry` at an exhaustion gate authorises exactly one more traversal"*, 2026-08-22). After this
round's review the run reaches an exhaustion gate regardless of verdict. **The gate is arriving on
its own; it does not have to be bought with a fourth round.**

---

## 2. `CLAUDE.md` — held, because the requirement excludes it by name

AC-24 names `CLAUDE.md:25,35`. **AC-6 of the same document names the same file and excludes it:**

> In the same change, `developer-generalist`'s `paths:` gains `README.md`, `eslint.config.js` and
> `vitest.shared.js`; **`CLAUDE.md` is excluded and stays the human's**, being the vendor dialect of
> the canonical harness.

AC-6 does not omit the file — it names it, excludes it, and gives a ground. That ground is the
2026-08-27 decision's reasoning applied to a second derived surface, and the requirement uses the
same construction one criterion earlier: **AC-4's** *"`.claude/rules/` **is named by no criterion**
… its sync is the human's."* Where the author meant a derived file to be the human's, they said so
twice, in two criteria, for two files.

**AC-24's clause and AC-6 cannot both be satisfied**, and AC-6 is the half that reasons where
AC-24's is a pair of line numbers. That is the shape of **Q-0101's E-3** — a merged requirement
contradicting itself, ruled at a gate rather than resolved by an implementer picking a side.

Corroboration, measured rather than argued:

- **The role's own `paths:` on disk exclude it.** `harness/roles/developer-generalist.md:3` is
  `[package.json, pnpm-workspace.yaml, turbo.json, tsconfig*.json, .npmrc, .gitignore, .github,
  packages, apps, harness, docs, README.md, eslint.config.js, vitest.shared.js]`. `README.md` is
  granted explicitly; `CLAUDE.md` is not, and AC-6 is why.
- **`harness/rules.md:1`** titles itself *"canonical; compiled into CLAUDE.md / AGENTS.md from M5"*
  and `:2–3` add *"When they disagree, this file wins and the other is the drift."*
  `docs/GLOSSARY.md`'s **Canonical harness** entry says the same. `CLAUDE.md` stands to `harness/`
  in precisely the relation `.claude/rules/` does.
- **The canonical side is already correct**, so nothing is pending on my side of the compile:
  Q-0106 fixed `harness/rules.md`, and the sweep in §5 finds one hit in all of `harness/`, past
  tense.

**Why yielding would be the expensive mistake rather than the cheap one.** Q-0052's round 3 yielded
to a reviewer that had refused a correct refusal, shipped the change **and deleted the pin recording
the divergence**; the development plan records that three documents then stated a form the code had
never matched. Q-0091's round 2 cited that yield as *"the mistake not to repeat"* and held.

---

## 3. `.claude/` — held on the role's path list, not on the tool gate

**This is where I differ from iteration 2, and the difference matters.** That round framed the
answer as *"for `.claude/` I cannot; for `CLAUDE.md` I can, and I must not"*, resting the first half
on a probe: it attempted each edit and recorded three tool refusals. I did not repeat those probes,
for two reasons.

**A successful probe is itself the violation.** Iteration 2's fourth probe — on `CLAUDE.md` —
succeeded, and that round had to write the file, revert it byte for byte and disclose it. Re-running
a probe whose only failure mode is performing the act I am declining to perform is not a
measurement worth its risk.

**And the tool gate is not what the disposition rests on.** `.claude/settings.json` and
`.claude/agents/flow-author.md` are outside the `paths:` frontmatter measured above and outside the
prose list in this role's own body — a role instruction that holds whatever the tool permits.
`.claude/rules/engineering.md` is assigned to the human by **AC-4 by name**. So the answer for all
three is *"not this step's"* on grounds that a change to the permission configuration would not
move. Iteration 2's probes were corroboration of a conclusion that did not need them, and stating
the ground correctly is worth more than restating the probe.

Findings 3 and 4 are therefore **decision 047 instances** — *"A requirement may not name a surface
its flow cannot write"* (2026-08-25) — arriving at **AC-27's sweep** rather than at a single
criterion. AC-27's property is right and I am not asking for it to be weakened: a live instruction
or configuration entry must not depend on a deleted path. It is satisfiable for every surface this
flow can reach, and §5 shows it satisfied there.

The precedent is exact and ten days old: **Q-0069's AC-11(b)** named `.claude/rules/engineering.md`,
three revise rounds refused it correctly, the loop reached its exhaustion gate, and the human landed
the implementer's supplied wording at commit `89ceacf`.

---

## 4. Verification — by execution, at this tip, first-hand

Re-run this round rather than carried from iteration 2. **This worktree is the bare environment
row**: `.harness/worktrees` and `.quorum/runs` do not exist here, so the populated row is owed on
`main` after the merge per Q-0072's closing finding.

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | exit 0 — *"Already up to date"*, 190 ms |
| `pnpm turbo run test --force --continue` | **7/7 tasks, 0 cached** — 1,977 passed, 2 skipped, 0 failed |
| — per package | compiler 1, server 1, templates 1, web 1, **shared 143**, **core 1,285** (+2 skipped), **cli 545** |
| `pnpm turbo run lint typecheck --force --continue` | **14/14 tasks, 0 cached**, 0 errors |
| `pnpm turbo run build --force` | **3/3 tasks, 0 cached** |
| `pnpm exec quorum lint` | **6/6 flows clean** — chore, development, qa-red, requirements, review, solutioning |
| `pnpm exec quorum help` | runs; dispatches **eight** commands + help |
| `pnpm sweep:git-identity` | **exit 0** — workspace suite green with no resolvable git identity |

The first two commands are `harness.yaml`'s `commands.install` and `commands.test` verbatim, so what
I ran by hand is what `integrate` runs. **The 1,977 figure was reached independently and agrees with
iteration 2's** — worth stating because it is the one number in that report I could have transcribed
instead.

**One caution, from the sweep script's own header rather than from optimism.** It was green here in
two runs. **Q-0102's subject is this oracle red under load**, and a green sweep in this worktree is
not evidence about it. Two green runs are two green runs.

---

## 5. AC-20 to AC-28 at the tip, re-derived

| AC | Property | Measured at the tip |
| --- | --- | --- |
| **AC-20** | `spike/` deleted | `git ls-files spike` → **0**. Branch diff: **54 files, 9,644 lines** under `spike/`, matching E-1's re-measurement |
| **AC-21** | parity test and charter deleted, no replacement | `packages/core/src/spike-parity.test.ts` (1,994), `harness/port-charter.md` (516) absent. No parity register, freeze SHA or mirror procedure introduced |
| **AC-22** | exactly three CI jobs | `ci.yml` declares `workspace`, `git-identity-sweep-bare`, `git-identity-sweep-populated`. `.github/scripts/` holds **only** `git-identity-sweep.sh` — both port-freeze scripts gone |
| **AC-23** | ESLint ignore dropped; Vitest citation reworded | `eslint.config.js:16` ignores are `node_modules`, `dist`, `.turbo`, `coverage` — no `spike/**`. `vitest.shared.js` keeps the discovery argument and re-homes its source. Lint 14/14 with no new violation |
| **AC-24** | `README.md:8` and `CLAUDE.md:25,35` | **README half done** — `:8` names the binary, `pnpm install && pnpm turbo run build`, `pnpm exec quorum`. **`CLAUDE.md` half held** — §2 |
| **AC-25** | `04-architecture.md`: one suite | *"There is one required suite…"*; the two-suite paragraph is past tense, the transfer share is gone, the discovery chain re-homed, status line bumped |
| **AC-26** | `06-development-plan.md` + `docs.test.ts` pin | M2's done-when reads one suite; Q-0010 §5's follow-up recorded done. `docs.test.ts:422` carries the moved literal with a note naming AC-26. Suite green, so the pin moved with the sentence |
| **AC-27** | no live spike-dependent reference | **Five sites in four files survive, all four §2's and §3's.** Everything else clean — §5.1 |
| **AC-28** | CI green on the merged commit | **Exit condition, not implementable.** No step of this run can observe it: the run merges to `harness/{id}/integration` and the push to `origin/main` is the human's act. Q-0105 is the open ticket about nobody checking it |

**AC-1 re-checked, since it binds all three children.** `git diff --name-only ec343ac..HEAD` under
`packages/` returns eleven paths: eight `*.test.ts`, two `turbo.json` and
`packages/core/test/vitest-include.ts`. **No production source under `packages/*/src` changed on
this branch at all** — not even AC-19's three permitted citations, which were Child B's and are
already landed. R-7's tripwire never fired: nothing was still depending on the spike.

### 5.1 The AC-27 sweep, run this round

`git grep -nE "spike|port-charter|port-freeze"` over tracked files, excluding `backlog/`,
`docs/decisions/` and `contracts/`:

- **`harness/`** — **one** hit: `roles/developer-generalist.md:22`, past tense, recording that the
  `spike` grant was retired here. The `paths:` frontmatter dropped it and
  `harness/architecture.md`'s role table dropped it in the same change, which is what
  `role.test.ts` requires and why the suite is green. Clean.
- **`.github/`** — two past-tense comments in `git-identity-sweep.sh` (`:11`, `:119`), both
  accurate: the second suite phase went at Q-0107 AC-16, and Q-0103 deleted the tree and the job.
  Clean.
- **root configuration** — `package.json`, `turbo.json`, `tsconfig.base.json`,
  `pnpm-workspace.yaml`, `eslint.config.js`, `vitest.shared.js`, `.gitignore`, `README.md`:
  nothing. Clean.
- **`docs/`** — `git grep "spike/"` outside the plan returns **one** line, `02-sdlc-pipeline-spec.md:3`,
  which is the status line recording iteration 2's own correction — a past-tense record, which AC-27
  excludes explicitly. `06-development-plan.md`'s hits are past-tense entries, protected by AC-26.
  `04-architecture.md`'s are provenance (*"seeded from the spike"*, *"the whole of the spike's
  set"*), which its own status line records as deliberately not rewritten.
  `03-adapter-contract.md`'s three hits name the M0 **effort**, not a path — `git grep "spike/"`
  does not match them. Clean.
- **`packages/`, `apps/`** — no file opens, imports or reads anything under the deleted tree; the
  whole suite passes with the tree absent, which is the check. What remains is §7's registered
  citation class, owed its own ticket.

**Five sites, four files, and all of them are §2's and §3's.** That is the entire residue.

---

## 6. For the gate

### 6.1 The erratum owed, in three clauses

*The window for an erratum is a gate* (Q-0094 E-3), and this run reaches one after this round's
review whatever its verdict — §1.

1. **AC-24's `CLAUDE.md` clause is withdrawn**, because **AC-6** of the same document already ruled
   that file the human's, with a reason where AC-24 gives line numbers. The README half stands and
   is done.
2. **AC-27's reach into `.claude/` is acknowledged rather than deleted.** Its property is right;
   three of the surfaces it reaches are ones no step of `chore.yaml` may write — decision 047 at the
   sweep rather than at a criterion. **Review iteration 1's finding 6 stays refused on AC-4's own
   text**, which names `.claude/rules/` as belonging to nobody in this flow.
3. **The four findings of review iteration 2 are recorded as correct and as the human's**, so the
   record does not read as an implementer that ignored them.

### 6.2 What the human lands — five sites, four files, one commit

Every string below was read off the tip this round, not copied from iteration 2.

**`CLAUDE.md:25`** — delete the bullet entirely:

> ``- Until M2 lands, the runnable code is the spike in `spike/` (plain Node ESM). Do not extend the spike beyond M0/M1 needs; port it into `packages/core` instead.``

**`CLAUDE.md:35`** — replace:

> ``- Spike (M0/M1): `node spike/bin/harness.js <init|ticket|board|run|lint|adapters>```

with:

> ``- Binary: `pnpm install`, `pnpm turbo run build`, then `pnpm exec quorum <init|ticket|board|run|lint|adapters|validate|runs>` in the workspace; outside it, the three tarballs packed and installed together. Registry-resolved `npx quorum` is Q-0029's, in M6.``

The eight command names were verified this round by running `pnpm exec quorum help`, which
dispatches exactly `init`, `ticket`, `board`, `run`, `lint`, `adapters`, `validate`, `runs` beside
`help`. The two installation paths are the two AC-24 requires and Q-0098 shipped, with the refused
third named as refused. `README.md:8` already says this and was re-verified this round, so the two
files will agree.

**`.claude/agents/flow-author.md:6`** — replace:

> ``Run the lint (`node spike/bin/harness.js lint` or `quorum lint`) and paste its output in your summary.``

with:

> ``Run the lint (`quorum lint`) and paste its output in your summary.``

Only the dead alternative is removed; the working one is already in the sentence. Verified live this
round: `pnpm exec quorum lint` → 6/6 flows clean.

**`.claude/settings.json`** — delete both entries, **anchored on content, not on line number**:

> `      "Bash(npm install --prefix spike*)",`
> `      "Bash(node spike/*)",`

**This is a correction to iteration 2's hand-off and the one substantive thing this round changed
about it.** The review cites them as `:8` and `:10`, and iteration 2 repeated those numbers. They
are not independent: deleting `:8` first shifts `"Bash(node spike/*)"` from line 10 to line 9, and
line 10 then holds `"Bash(git status*)"`. Applied as two line-numbered deletions in the order given,
the second removes a live grant this ticket did not authorise touching. Deleting by content, or
deleting `:10` before `:8`, is safe. `"Bash(npm test*)"` at `:9` stays — it is not spike-specific
and is out of scope.

**`.claude/rules/engineering.md:4`** — this is **AC-4's**, not AC-24's or AC-27's, and it is listed
here only so the human's commit is complete. Delete the trailing sentence:

> `` `spike/**` is outside ESLint's scope entirely and stays unlinted, so nothing detects one there.``

Measured: `harness/rules.md`'s canonical deprecation bullet ends at *"tests included."* and the
derived copy carries this one sentence beyond it, so the sync is a deletion and nothing else.

### 6.3 Two things the gate should weigh

**A fourth round cannot move any of this, and the reason is now structural rather than asserted.**
The three `.claude/` surfaces are outside this role's `paths:`; the `CLAUDE.md` edit is excluded by
AC-6. Neither is a fact about the tree, so *"a retry on an unchanged tree cannot rule its own
blocker"* (Q-0090, Q-0096) applies with nothing left to qualify it: what moves this is an erratum
and a human commit. The loop is already at its bound (§1), so the gate arrives without being bought.

**And the finding under the finding, which is worth more than the cutover.** Nothing in this
repository compares `.claude/rules/engineering.md` with `harness/rules.md`, or `CLAUDE.md` with
anything at all. I measured it: no assertion anywhere under `packages/`, `apps/`, `.github/` or
`harness/` reads either file's content. So a canonical file and its vendor dialect can disagree
indefinitely and **every gate reports green** — which is how a dead instruction survived in a file
fed to every Claude-driven contributor, and why the human's sync in §6.2 cannot be confirmed by a
tick afterwards. M5's compiler (Q-0024) is what closes it and is two milestones away. That is the
same shape as the plan/backlog check this project has built five directions of, one layer up. **I am
naming it, not opening it** — a ticket is the human's call and the decision entry it may need is one
this role may not write.

**GO-3 remains discharged.** Q-0107's `integrate` was the first real one to run Child A's new
commands — install exit 0, 7/7 tasks 0 cached — and this round re-ran the identical pair by hand
with the same result.

---

## 7. What I deliberately left alone

- **The four `.claude/` and `CLAUDE.md` sites.** §2 and §3. Correct findings, not this step's.
- **The JSDoc citation sweep across production source.** §7's registered non-goal, owed its own
  ticket. Child B closed the three a live assertion pinned (AC-19); the rest are comments obeying
  *"one line naming the authority"*, which a ticket-id citation satisfies with or without the path.
- **`contracts/`.** Four frozen contracts from Q-0006, Q-0011, Q-0033 and Q-0050 name spike paths,
  one in the present tense. Outside this role's paths, and Q-0073's E-4 is the precedent: a frozen
  contract that has been overtaken is superseded by an erratum, never edited.
- **`docs/06-development-plan.md`'s Q-0103 bullet.** It still carries the figures E-1 superseded —
  55 files, 9,732 lines, `spike-parity.test.ts` at 1,957, where the measured values are **54 /
  9,644 / 1,994**. Left deliberately: **Q-0094's E-3(a)** ruled that this page's bullets are
  rewritten by hand at each plan pass, and that an implement round enforcing an edit to one cost
  that ticket a review finding. Flagged for the human's plan pass, not fixed.
- **`docs/03-adapter-contract.md` and `04-architecture.md`'s provenance sentences.** Neither names a
  path; both describe where code came from, which stays true of a tree that has gone.
- **The prose re-wrap in `harness/roles/developer-generalist.md:22–25`.** Iteration 1's edit left
  one over-long line. Cosmetic, traceable to no criterion, and tidying it is what this role is told
  not to do.
- **Q-0059, Q-0060, Q-0066, Q-0068, Q-0100.** §7's non-goal. Each is smaller now that there is one
  tree; none is closed. Q-0100's fourth instance — `init`'s next-steps line telling a stranger to
  run `harness` — is still there and still Q-0100's.
- **Q-0102.** Untouched. Two green sweeps here say nothing about it.
