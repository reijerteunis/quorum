# Q-0044 — implementation report

*Round 4 (revision). Route: chore. Branch: `harness/Q-0044/implement`.*

## 1. What this round was for

Rounds 1, 2 and 3 each returned **one blocker, the same blocker**, and each asked for the same
remedy: an accepted requirements erratum settling whether the diff range grammar refuses trailing
whitespace on a ticket-prefixed endpoint. Each round was right to refuse to close it in the
implementation — AC-12's stop-and-report forbids the implementer picking a side, and
`docs/DECISIONS.md` 2026-08-25 ("A requirement may not name a surface its flow cannot write")
records that no agent step may write under `backlog/`, so the implementer could draft the erratum
and could not commit it.

**That erratum now exists.** `backlog/Q-0044-core-flow-lint/requirements/errata.md`, entry **E-1**,
dated 2026-08-26, committed to `main` as `99e885b`. It supersedes the words "leading or trailing
whitespace" in AC-4's *Test* clause, to the extent they cover a ticket-prefixed endpoint, and rules
for the spike's grammar.

E-1 confirms the port was already correct. **No implementation byte changed this round.** The
blocker lived in a test's framing, not in its behaviour.

## 2. Review findings, each addressed

| Round | Finding | Status |
| --- | --- | --- |
| 1 | **blocker** `lint.test.ts:332` — test accepts trailing whitespace, AC-4 lists it as refused; obtain an authoritative correction | **Closed.** E-1 obtained and committed. Test re-pointed at it. |
| 1 | **major** `dev/implement-report.md:1` — report is only `PLACEHOLDER — testing serialisation.` | **Closed.** That was run 1's serialisation test artifact. This document is the report; §6 names all nine defects. |
| 2 | **blocker** `lint.test.ts:331` — reporting the conflict does not satisfy both requirements or close the prior blocker | **Closed.** Same erratum. Reporting is no longer the remedy; the accepted correction is. |
| 3 | **blocker** `lint.test.ts:331` — obtain and commit the proposed erratum, or change the implementation | **Closed.** The erratum was committed, not the implementation changed — E-1 chose the preserved spike grammar. |

All three blockers are one finding across three rounds, and all three are closed by the same commit.

## 3. Changes, file by file

### `packages/core/src/lint/lint.test.ts` — the only file touched

17 insertions, 21 deletions, all inside the single test at `:331`.

**Retitled.** `UNRESOLVED — trailing whitespace on a TICKET endpoint is accepted, against AC-4's
test clause` → `trailing whitespace on a TICKET endpoint is accepted — requirements/errata.md E-1`.
The old title asserted an open contradiction; there is no longer one to assert.

**Comment rewritten.** It previously argued *why the implementer declined to choose* and pointed at
a draft erratum in this report. It now opens with the `Why:` line `harness/rules.md` asks for where
behaviour is deliberately counterintuitive — naming E-1 as the authority — and explains the rule by
the axis that actually governs it:

> Which way a placement goes depends on the endpoint's **kind**, not on its position in the range.
> Leading whitespace breaks both `=== '{base}'` and `^harness/`, so it is refused on either
> endpoint; trailing whitespace breaks `=== '{base}'` but is matched by `.+`, so it is refused on a
> `{base}` endpoint and accepted on a ticket-prefixed one.

That is four refused *forms* — leading whitespace in both positions, trailing-on-`{base}` in both —
which is E-1's own count, against one accepted *kind*. My first draft of this comment said "three",
counting categories rather than forms; corrected before running anything, so that the comment and
E-1 cannot be read as disagreeing.

It also carries forward what E-1 explicitly does **not** settle: whether the grammar *should* refuse
trailing whitespace. E-1 calls it a real rough edge belonging to its own ticket beside Q-0055 and
Q-0056, and the comment says so, so a later reader does not mistake "preserved" for "endorsed".

**One assertion added.** E-1's words are "a trailing space **or tab** on a ticket-prefixed endpoint
is **accepted**". Only the space was pinned. The tab is now pinned too:

```ts
expect(lintFlow(flowOf(step({ input: { diff: '{base}...harness/{id}/integration\t' } })))).toBe(true);
```

**Nothing else in the test moved.** E-1 cites `packages/core/src/lint/lint.test.ts:287–290` as where
the four refused forms are pinned. My edit is entirely below line 290, so that citation is still
accurate — verified after editing:

```
287    ['leading whitespace', ' {base}...harness/{id}/integration'],
288    ['whitespace after the base endpoint', '{base} ...harness/{id}/integration'],
289    ['whitespace before a ticket endpoint', '{base}... harness/{id}/integration'],
290    ['whitespace after the base endpoint, on the right', 'harness/{id}/integration...{base} '],
```

## 4. What I deliberately left alone

- **`packages/core/src/lint/lint.ts` — not one byte.** E-1 ruled that the implementation was
  already right. Round 3's blocker offered two remedies ("commit the erratum, **or** change the
  implementation and tests to reject"); E-1 took the first, so changing the implementation would
  now be the behaviour change the port does not authorise.
- **`packages/core/src/lint/lint.source.test.ts`** — unchanged. Its twelve assertions are about the
  module's surface, imports, absence of zod and the empty `FlowError` body; none touches AC-4.
- **The `REFUSED` and `ACCEPTED` tables at `:270–294`** — unchanged, both because they are correct
  and because E-1 cites four of their lines by number.
- **`spike/**`** — byte-unchanged (charter §3). Confirmed with `git diff HEAD -- spike/`, empty.
- **`backlog/**`** — nothing written. `commitAll` reverts it and E-1 exists precisely because that
  is enforced rather than advisory.
- **The six shipped flows and their six template copies** — unchanged; AC-11 asserts all twelve
  still lint clean through the ported code.
- **`packages/core/src/index.ts`** — untouched, keeping Q-0041's byte pin
  (`packages/shared/src/index.test.ts:52–53`) green.
- **Q-0055, Q-0056, Q-0038** — no rule added for an id-less step, no decision about `route`, no
  check on the chore flow's step order. All three live in this ticket's file and all three are
  somebody else's.
- **The trailing-whitespace rough edge itself** — left as the spike has it, per E-1.

## 5. Verification — re-derived by running, not by reading

The merged requirement's own precedence note is *"every verbatim message … was verified by running
`spike/src/lint.js`, not by reading it"*, and it records that its base candidate corrupted message
12 while transcribing by eye. So I re-derived rather than trusted the existing transcription.

**How.** `lintFlow` imports `yaml` only for `lintFlowDirectory`, which these checks never call.
`spike/node_modules` does not exist in this worktree and installing needs network, so I wrote a
two-file stub at `spike/node_modules/yaml/` — a git-ignored path (`.gitignore:1` is `node_modules/`,
unanchored, so it matches at any depth), nowhere near `spike/src/**` — ran the checks, and removed
it. `git status` is clean apart from the one test file, and `git diff HEAD -- spike/` is empty.

**What came back.**

*The seven whitespace placements, against the spike:*

| placement | spike |
| --- | --- |
| `" {base}...harness/{id}/integration"` | refused |
| `"{base} ...harness/{id}/integration"` | refused |
| `"{base}... harness/{id}/integration"` | refused |
| `"harness/{id}/integration...{base} "` | refused |
| `"{base}...harness/{id}/integration "` | **accepted** |
| `"harness/{id}/integration ...{base}"` | **accepted** |
| `"{base}...harness/{id}/integration\t"` | **accepted** |

E-1's table reproduced exactly, and the tab confirmed — which is what justifies the assertion I
added rather than assuming it followed from the space.

*The rest:*

- **All 20 AC-4 cases** (4 accepted, 16 refused) — spike agrees with the port, message text
  included, checked against the full interpolated string rather than a prefix.
- **All 16 messages** — character-for-character identical between spike and port, run over the same
  fixtures AC-2's tests use. Message 12's absent colon and message 11's U+2026 both survive.
- **The all-at-once ordering fixture** — the spike's fourteen bullets are line-for-line what
  `lint.test.ts:186–202` asserts, in order.
- **The AC-5 short-circuit** — a flow carrying both a single-vendor panel and a same-vendor judge
  reports the panel message alone; `/written by its own vendor/i` returns false.
- **AC-3's negative** — a `fan_out` template carrying a duplicate id, a dead `goto` and a routeless
  verdict lints **CLEAN** on the spike, as on the port.
- **AC-4's template site** — a malformed `step.input.diff` gives `developers.step: input.diff must
  be …` on the spike, as on the port. Register row 12, the rule with no corpus behind it, confirmed
  live on both sides.

**Gates.** `pnpm test` 240/240 across 10 files — `src/lint/lint.test.ts` 92, `src/lint/lint.source.test.ts` 12.
`pnpm lint` and `pnpm typecheck` clean. Tests re-run with `pnpm turbo run test --force` (`0 cached, 7 total`),
because the first run replayed 6 of 7 tasks from cache — Q-0065's hazard, and worth doing on a round
whose whole content is a test change.

**What I could not run: the spike's own suite.** `npm test --prefix spike` needs `spike/node_modules`,
and installing needs network access this environment does not have. That is a pre-existing condition
of the worktree, not something this round introduced. `harness.yaml`'s `commands.test` runs it as the
first half of `integrate`, which is where it gets covered.

## 6. The nine preserved defects — all carried unfixed, all pinned

Per AC-12 and charter §2. Each is asserted in `lint.test.ts` so a later "cleanup" that fixes one
without a decision turns the suite red rather than passing silently.

| # | Defect | Preserved | Pinned at |
| --- | --- | --- | --- |
| 1 | `lintFlowDirectory` on a missing directory throws a raw `ENOENT` `Error`, not a `FlowError` | yes | `:912` — asserts `instanceof Error`, `not.toBeInstanceOf(FlowError)`, `code === 'ENOENT'` |
| 2 | An empty `.yaml` surfaces the `TypeError` from `flow.file = file` on `YAML.parse`'s `null` as a user-facing problem string | yes | `:925` — message `"Cannot set properties of null (setting 'file')"`, obtained by running the spike |
| 3 | `.yml` files are skipped without being reported as unread | yes | `:932` — records `toEqual([])` |
| 4 | `flattenSteps(null)` and `flattenSteps([null])` throw raw `TypeError`s | yes | `:937` |
| 5 | Lint requires an `id` on no step kind, so an id-less step lints clean and the engine builds `harness/<ticket>/undefined` | yes — **Q-0055 owns the fix and lands after this ticket** | `:950` — six id-less step kinds lint clean, and `undefined: integrate needs branches` names the literal |
| 6 | `diff: null` is exempt from the range grammar while `diff: ''` is refused | yes | `:969`, and again at `:358` |
| 7 | A flow with neither `name` nor `file` throws `flow undefined invalid:` | yes | `:974` |
| 8 | Cross-flow messages name the **source** by `name:` and the **target** by filename stem | yes | `:979` — a flow whose `name:` differs from its filename |
| 9 | A non-`Error` throw inside the per-file `try` would store `undefined`; narrowed by assertion, **not** stringified | yes | `:985` — stringifying would be a diagnostic behaviour change |

`FlowError` itself: extends `Error`, overrides nothing, `.name` reads `'Error'` — pinned at `:897`,
because `spike/bin/harness.js:605` routes on `instanceof` and a TypeScript rewrite setting
`this.name = 'FlowError'` would change what a stranger reads at the top of an error.

## 7. Stop-and-report

**Nothing new to report.** The one item this ticket ever raised under AC-12's stop-and-report was
the AC-4 whitespace contradiction, and it is now closed by E-1 rather than carried. No further
spike defect, inconsistency, or behaviour the requirement does not cover surfaced this round — and
this round read more of the spike's actual output than any previous one, since §5 ran it rather
than reading it.

Two neighbours seen and deliberately not acted on, both already ticketed: defect 5 is Q-0055's, and
E-1's own open question (whether the grammar *should* refuse trailing whitespace) belongs to a
ticket beside Q-0055 and Q-0056, not to the port.

## 8. For the reviewer

- **The diff is one test.** `git diff --stat` reads `1 file changed, 17 insertions(+), 21 deletions(-)`.
  If anything outside `packages/core/src/lint/` appears, it is unrequested — that is the requirement's
  own instruction, and it holds.
- **Read `lint.test.ts:309` before the implementation.** Register row 12 — the fan-out template's
  diff site — has no corpus behind it: none of the twelve shipped flow files puts an `input.diff`
  inside a `fan_out` template, so that test is the only thing standing between the port and a
  silently narrowed static check, on the site most expensive to fail at run time. §5 confirms both
  linters read it.
- **`lint.test.ts:331`'s title now names its authority.** If E-1 is ever reversed, that test is
  where the reversal lands, and its comment already says which ticket would own it.
