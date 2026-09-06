# Errata — Q-0103

Rulings on `requirements/merged.md`, written at a gate. **The window for an erratum is a gate** — one
landed between a review returning and the next implement starting reaches neither (Q-0094 E-3(a),
Q-0097 E-1/E-2).

## E-1 — this run implements Child C only, and four of its figures moved. 2026-09-06, before the chore run.

**Scope. `requirements/merged.md` specifies all three children; A and B have since shipped.**

- **Child A is `Q-0106`** — `reviewed` and `main:contained` 2026-09-05. AC-1 to AC-7 and AC-29 are
  **done**. `harness.yaml` already reads `pnpm install --frozen-lockfile` and
  `pnpm turbo run test --force --continue`.
- **Child B is `Q-0107`** — `reviewed` and `main:contained` 2026-09-06. AC-8 to AC-19 and AC-30 are
  **done**, including the executable register at `packages/cli/src/spike-dependencies.test.ts`.
- **This run implements AC-20 to AC-28, and nothing else.** A criterion outside that range is
  already satisfied; re-implementing one is scope this ticket does not authorise. If one appears
  unsatisfied, that is a finding for the gate, not work to do.

**GO-3 is discharged.** Q-0107's `integrate` was the first to run Child A's new commands — install
exit 0, `pnpm turbo run test --force --continue` 7/7 tasks 0 cached, re-verified on `main` with the
sweep exit 0. This ticket was blocked on that and is not blocked now.

**Four figures are re-measured at `ec343ac` and supersede the document's.** They moved because A and
B landed after it was written, which is the ordinary reason a figure goes stale here — and the
document's §12 already forbids re-deriving from prose, so these are stated with their commands.

| | document | measured at `ec343ac` |
| --- | --- | --- |
| `spike/` tracked files (AC-20) | 55 | **54** — `git ls-files spike \| wc -l`; AC-8 moved `q0080-allocation.json` to `packages/core/src/backlog/` |
| `spike/` lines | 9,732 | **9,644** |
| `spike-parity.test.ts` (AC-21) | 1,957 | **1,994** — Q-0107 edited it |
| `harness/port-charter.md` (AC-21) | 516 | **516**, confirmed unmoved |

**Confirmed and safe to reuse:** `ci.yml` holds **seven** jobs — `workspace`, `port-freeze-policy`,
`port-freeze-branch-scope`, `port-freeze-sha`, `spike`, and the two `git-identity-sweep` cells —
parsed from the file rather than grepped, so AC-22's *"exactly three retained"* stands as written.

**AC-28 is an exit condition, not an implement-step criterion.** It requires CI green on the merged
commit, which no step of this run can observe: the run merges to `harness/{id}/integration`, and the
push to `origin/main` is the human's act afterwards. It is discharged at the gate, and Q-0105 is the
open ticket about nobody checking that.

## E-2 — AC-6 governs `CLAUDE.md`, not AC-24, and the four surviving majors are the human's. 2026-09-06, at the exhaustion gate of run 2.

**Ruling: AC-6 wins.** `CLAUDE.md` is not written by this ticket's implement step, and AC-24's
clause naming `CLAUDE.md:25,35` is **struck**. Its `README.md:8` half stands and is satisfied.

**The requirement contradicts itself, and the implementer found it rather than picking a side.**
AC-6 names the file and excludes it — *"`CLAUDE.md` is excluded and stays the human's, being the
vendor dialect of the canonical harness"* — while AC-24 lists two of its line numbers as work. AC-6
is the half that **reasons**; AC-24's is a pair of line numbers written before Q-0106 settled the
role's `paths:`. Same construction as AC-4's *"`.claude/rules/` is named by no criterion … its sync
is the human's"*: where the author meant a derived surface to be the human's, they said so.
Corroborated on disk — `harness/roles/developer-generalist.md:3` lists `README.md` and **not**
`CLAUDE.md`. This is Q-0101 E-3's shape: a merged requirement contradicting itself, ruled at a gate
rather than resolved by an implementer choosing.

**A requirement may not name a surface its flow cannot write** (2026-08-25). AC-24 did, and this is
the fourth instance in this repository. Q-0106's AC-6 widened the role by three paths for exactly
this reason and stopped one file short of the one AC-24 would need.

**All four surviving majors are closed by human commit, never by iteration**, and the implement step
refused each of them three times **correctly**, with a ground each time:

| finding | surface | why no round could close it |
| --- | --- | --- |
| `CLAUDE.md:25`, `:35` | not in the role's `paths:` | excluded by AC-6 by name |
| `.claude/agents/flow-author.md:6` | `.claude` is not in the role's `paths:` | outside the role entirely |
| `.claude/settings.json:8`, `:10` | the same | the same |

Round 3 changed no product file and the reviewer wrote *"during the gate-owned synchronization"* — so
both steps knew. **Fifteenth appearance of a loop handed work no agent in it can perform**, and the
second on this ticket's own cut after Q-0101's. Q-0083 remains the mechanism owed.

**Sequencing, recorded because it is not obvious.** The four are fixed **after** the merge, not
before: they describe a repository with no `spike/`, and until `harness/Q-0103/integration` lands on
`main` that tree still exists. Fixing them first would make `CLAUDE.md` false about the tree it sits
in — which is precisely the defect Q-0106's spine names, *a description that runs ahead of its
subject*.

**AC-28 stays an exit condition** (E-1): CI green on the merged commit is observed after the push,
which is the human's act.
