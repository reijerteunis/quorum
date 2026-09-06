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
