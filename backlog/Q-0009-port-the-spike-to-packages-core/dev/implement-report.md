# Q-0009 — implementation report, revision round 3

*Iteration 3. `chore.yaml`'s `implement` step, `developer-generalist`, worktree on
`harness/Q-0009/implement`.*

## The short version

Round 2 left two majors. **Both are correct, and neither can be closed by this flow step.** They
are not the same kind of finding as rounds 1's guard defects — those were mistakes I could fix.
These are a collision between what the requirement specifies and what the route Q-0009 was given
can write.

So this round does not attempt a third workaround. It does three things: it stops on the
undeliverable criteria and says so without hedging, it makes the human act that *can* close them
as cheap as possible, and it surfaces one new fact that makes deferring the decision more
expensive than it was yesterday.

**One file changed: `harness/port-charter.md`.** Nothing else in the tree was touched.

---

## The blocking fact, stated once

`chore.yaml`'s `implement` step runs with `worktree: true`, so `runAgentStep` calls `commitAll`
(`spike/src/engine.js:292`). `commitAll` is `spike/src/fanout.js:80–93`:

```
git status --porcelain -- backlog     # anything dirty under backlog/?
git checkout -- backlog               # revert tracked edits
git clean  -qfd -- backlog            # delete files the agent added
```

Both halves, unconditionally, before `git add -A`. A file I write under `backlog/` is reverted if
it exists and deleted if it does not. There is no diff for the reviewer to read — only
`discarded N edit(s) under backlog/` in the run log.

That guard is right and I am not asking for it to change. It was added because an agent once
rewrote a ticket's frontmatter on its branch, resetting `iterations` and deleting three history
entries with their costs. The engine owns ticket state.

It does mean **`backlog/` is not a writable surface for this step**, while three of Q-0009's
criteria name `backlog/` as their surface. That is a collision between the requirement and the
route chosen for it — the requirement was merged before the routing entry of 2026-08-25 sent
Q-0009 down the chore flow — and it is not a defect in either document.

Per my instructions, I stopped rather than improvised. Rounds 1 and 2 improvised (relocate to
`harness/`, explain in prose); the reviewer held both times that an explanation does not amend a
requirement, and that is right.

---

## Findings, one by one

### From `review/chore-iter-2.md` — the two live ones

**major: `harness/port-charter.md:9` — the charter is under `harness/`, the requirement puts it
under `backlog/Q-0009-…/`. "Move it in an authorized backlog-writing commit … or obtain an
explicit requirement amendment before approval."**

**Not fixed. Cannot be fixed here — see above.** What I changed is how the charter presents the
gap, because the previous framing was the reviewer's actual complaint: the section was titled
*"Why this file is here, and where the requirement says it belongs"*, ran an argument, and closed
with *"Whichever way it goes…"*, which reads as a settled choice. It now opens:

> ## This file is in the wrong place, and the implementer could not put it in the right one
>
> **Q-0009's requirement puts the charter under `backlog/Q-0009-port-the-spike-to-packages-core/`.
> That is where it belongs, and this copy does not satisfy the criterion.** Nothing below is an
> argument that `harness/` is better; there is no such argument…

The phrases `no functional argument for harness/`, `a small, deliberate act` and
`Whichever way it goes` are gone. The two remedies the reviewer named are stated as the only two.

**And one new fact for the gate.** The earlier draft told whoever performs the move to *"update
the two places that name its path"*. I checked, and that was an undercount. The charter path is
cited in nine places across six files, one of which is append-only:

| Where | References | Editable? |
| --- | --- | --- |
| `port-freeze-guard.sh:39` | the `CHARTER` default | yes |
| `port-freeze-guard.test.mjs:21,33,55,140` | scratch-repo path | yes |
| `harness/architecture.md:70` | the pointer a child's prompt carries | yes |
| `developer-backend.md:18`, `developer-tooling.md:19` | pointer in each role body | yes |
| `ci.yml:32`, `port-freeze-guard.sh:4` | prose citing `§3` | yes |
| **`docs/DECISIONS.md:793, 826, 838`** | three citations in the two entries Q-0009 landed | **append-only** |

The last row is a cost this ticket created rather than found: the two DECISIONS entries were
written while the charter sat in `harness/`, so they now cite that path in a file the rules forbid
editing silently. Relocating after they landed costs an amending entry — and every child that
cites the old path adds to the bill.

I want to be careful about how that reads: **it is not an argument for leaving the charter here.**
It is an argument for settling the location *at this gate*, in either direction, because the cost
only grows. The table is now in the charter so whoever performs the move has the full list.

**major: `harness/port-charter.md:391` — AC-1 and AC-8 remain outstanding; the fourteen child
bodies lack the routing citation and the five items, and Q-0009's body still claims the cutover.
"A normative table and pointer in the charter do not satisfy criteria that explicitly require
those facts in each ticket body."**

**Not fixed. Cannot be fixed here — same mechanism, `backlog/Q-00NN-…/ticket.md` is fourteen
files under `backlog/`.** I agree with the reviewer's reasoning and have stopped restating §6 as
though it were a substitute.

What I did instead is reduce the authorised commit from *authoring fourteen ticket-body edits* to
*pasting fourteen blocks*. §11 now carries the exact markdown block, with the five items keyed to
§6's columns, plus a worked example filled in from Q-0045's row, plus the one line that differs
for Q-0050 (full SDLC, not chore), plus the reverse edit Q-0009's own body needs. Every word of it
is derived from §6 and §2, which the requirement already mandates — no new decision is embedded in
it.

I also corrected a miscount of my own: §11 previously said *two* criteria, folding the charter's
location into AC-1. It is three — Scope item 1, AC-1's second half, and AC-8 — and it now says so
in a table.

### From `review/chore-iter-1.md` — the three that round 2 closed

I re-verified each rather than assuming, since the reviewer dropped them in round 2 without
comment. All three hold; I changed nothing.

**major: DECISIONS entry for behaviour preservation missing.** Closed. `docs/DECISIONS.md:773`,
*"The port preserves behaviour; one exception is authorised and everything else stops the child —
2026-08-25"*, with Decision / Alternatives considered / Why. The routing entry is at `:670`.

**major: `port-freeze-guard.sh:87` — inert guard still exits 0, so GitHub renders green; and a
recorded SHA is printed rather than verified.** Closed, in both halves. The freeze is now three CI
jobs. `port-freeze-sha` carries `if: needs.port-freeze-policy.outputs.freeze_sha !=
'not-yet-recorded'`, so with no SHA the job is **skipped** — grey, not green — and the script
refuses to exit 0 if invoked in that state anyway (`:148–153`). Once a SHA exists, `:155–181`
verifies it: the commit must exist, must be an ancestor of the base (three-valued, per invariant
8), and the base must hold no `spike/src` change since it, naming the files if it does.

**major: `port-freeze-guard.sh:71` — any commit message beginning `Port-freeze-exemption:`
bypasses the freeze.** Closed. The pattern is now
`^<trailer>:[[:space:]]+<this-branch's-ticket>[[:space:]]+[^[:space:]]` — trailer at column 0, the
branch's own ticket id, and a non-empty reason. Malformed candidates are quoted back and the guard
still fails. The `exemption-trailer` key is itself validated as a plain token (`:57–58`) so a
charter edit cannot widen it to `.*`. Five directions are covered by the test file: bare trailer,
ticket-without-reason, wrong ticket, trailer mentioned in prose, and the complete form.

---

## File by file

### `harness/port-charter.md` — the only file changed (+111 / −56)

1. **Status block (`:8–11`, new).** A callout at the top: three criteria outstanding, all needing
   a `backlog/` write, §11 is the open list and not a record of work done elsewhere. A reader who
   opens this file now learns Q-0009 is incomplete before reading a word of the ground rules.
2. **Opening section (`:13–68`), retitled and rewritten.** As above: the concession first, the
   mechanical obstruction second, the nine-reference path audit third, the two remedies last. The
   correct rebuttal of the earlier draft's second reason — that a child could not *read* a charter
   in the ticket folder — is kept, because it is still true and still needs not to be relied on.
3. **§11 (`:401–457`), retitled and rewritten.** From *"Outstanding: the two criteria a chore
   `implement` step cannot satisfy"* to *"Not delivered: three criteria that need a backlog
   write"*, marked **Status: outstanding**, with the three-row table, the paste-ready block, the
   Q-0045 worked example, Q-0050's one-line difference, and the note that
   `harness/architecture.md`'s pointer is load-bearing until the bodies are reconciled.

The machine-readable `port-freeze` block (`:238–244`) is **byte-unchanged**, and both edits fall
entirely outside its `begin`/`end` markers. §§1–10 are untouched.

### Verified and deliberately not touched

Each of these closes a criterion or an iter-1 finding. I read them this round to confirm they
still hold and left them exactly as round 2 committed them:

- `.github/workflows/ci.yml` — four jobs; `spike (regression suite)` and `workspace` both retained
  beside the three freeze jobs (AC-6, AC-7).
- `.github/scripts/port-freeze-guard.sh` and `.test.mjs` (AC-6).
- `docs/DECISIONS.md` — the two entries at `:670` and `:773` (AC-1 first half, AC-2).
- `docs/04-architecture.md`, `docs/06-development-plan.md` — schema location and the one-way
  `core → shared` dependency; I grepped both for `zod` and no contradiction survives (AC-3).
- `harness/architecture.md`, `harness/roles/developer-backend.md`,
  `harness/roles/developer-tooling.md` — role table, `paths` frontmatter and prose agree, and the
  freeze is named with a pointer to the charter (AC-4).
- `harness/harness.yaml` — already chains both installs and both suites; the criterion says
  *keeps*, so the correct change was none (AC-7).

### Not touched anywhere in this ticket

`spike/**` (§3's freeze applies to Q-0009 by its own non-goal), `packages/**`, `apps/**`,
`backlog/**`.

---

## Verification I could not perform

**`node .github/scripts/port-freeze-guard.test.mjs` — the sandbox denied execution**, on both a
plain invocation and a retry. I could not re-run the suite this round.

What I can say instead: my edits are confined to prose outside the `port-freeze:begin`/`end`
markers, and I confirmed by grep that the three keys — `children`, `freeze-sha`,
`exemption-trailer` — are still at column 0 inside the markers and byte-identical. The parse the
guard performs cannot have changed. But that is an argument, not a run, and I would rather name
the gap than let a green report imply a suite I did not execute. It should be run before the gate.

---

## Stop-and-report

Four things I did not decide for the requirement.

**1. The route and the criteria disagree, and only the gate can settle it.** Q-0009's requirement
names `backlog/` as the surface for three criteria; the chore flow cannot write there. One of
three things has to happen: a human commit applying §11's material, an amendment blessing
`harness/`, or a different route for Q-0009. I have no authority over any of them, and the cost of
option two rises with every child that cites the current path.

**2. The revise loop is at or past its bound.** `chore.yaml`'s `review` step declares
`max_iterations: 2`. This is implement iteration 3, so the next review verdict either exhausts the
loop or has already. If it returns `revise` on the same two majors, the run lands on an exhaustion
gate — and per the 2026-08-25 rule, a `retry` there authorises exactly one more traversal, which
would be spent on a finding no implementer can close. Worth knowing before answering that gate.

**3. "Port freeze" is now used in six files and is not in `docs/GLOSSARY.md`.** The charter,
`harness/architecture.md`, `ci.yml`, the guard and both role files all use it.
`.claude/rules/docs-and-decisions.md` says a term goes in the glossary before its second file. No
criterion asks for the entry, and the term retires at the cutover, so adding it would be a
decision taken on the requirement's behalf — which is what the last two rounds were marked down
for. **Flagging, not fixing.** If the gate wants it, it is a four-line entry.

**4. §3's deliberate gap, restated because it has survived two rounds unremarked.** The guard's
`children` list holds the fourteen and not Q-0009 itself, because that is what AC-6 specifies.
Q-0009's own compliance with the freeze therefore rests on its stated non-goal rather than on the
guard. It is narrow — this ticket writes no code — but the ticket that wrote the freeze is not
policed by it, and adding `Q-0009` to the list would close it. That is a one-token change and a
decision I have not taken.
