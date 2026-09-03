---
id: Q-0100
title: The user-facing binary is called quorum, not harness
stage: draft
owner: ruud
repos: []
branch: harness/Q-0100/integration
priority: p2
created: 2026-09-03
iterations: {}
history: []
---
**Opened at Q-0091's requirements gate on 2026-09-03**, from finding 3 of a head-of-product loop
that exhausted rather than shipping a document naming a surface it could not write. `backlog/` is
not an agent-writable surface, so the obligation would have expired silently had it not been
allocated at the gate — which is the tenth appearance in this repository of a loop handed work no
step in it can perform, **named in advance rather than discovered at an exhaustion gate**.

## The subject

**Three user-facing sentences tell an adopter to run a binary named `harness`, and the binary is
called `quorum`.** Measured at Q-0091's gate:

| where | what it says |
| --- | --- |
| the board's per-column hint | `→ harness run <flow> <id>` |
| `ProjectNotFoundError` (`packages/core/src/backlog/project.ts:31`) | ``run `harness init` in your repo`` |
| `validate`'s usage line (`spike/bin/harness.js`) | `usage: harness validate <schema.json> <file…>` |

`project.ts:31` already records itself as *"Carried, not fixed (charter §2)"*, so the divergence is
registered rather than newly discovered. **Q-0093's `init` next-steps line will be a fourth** the
moment it is written, which is the argument for ruling the whole class once rather than per command.

## Why it is not Q-0068, and not any command child

**Not Q-0068.** That ticket's subject is the *adapter refusal string* — `"Harness runs on
subscription OAuth only"` in `claude.ts:95`, `codex.ts:89`, pinned at `adapters.test.ts:314` and
`smoke.js:464`. Different sentences, different files, a different reason (a product-boundaries rule
about what the product is called, against an adopter being told to run a command that does not
exist), and Q-0068 lands in both trees together while this one need not. The two are neighbours and
neither closes the other.

**Not a command child's.** Each of Q-0091 to Q-0094 meets one or two of these sentences and none
meets all of them, so a per-command fix would rule the same question three times and leave the
fourth for Q-0093 to rediscover. Every command child preserves the wording verbatim and reports it;
this ticket is where the class is decided.

## What is actually undecided

Not *"should it say `quorum`"* — it should. The open questions are which the ticket must answer:

1. **Does the spike change too?** Ground rule 1 forbids editing `spike/src/`, and the third sentence
   is in `spike/bin/harness.js`. Either the spike keeps `harness` until the cutover deletes it — the
   two trees then disagreeing deliberately, which is what the port freeze exists to expose — or this
   takes §3's mirror-and-re-record path. **The first is recommended**: `spike/bin/harness.js` is
   deleted wholesale at the cutover, so a rename there is work with a known expiry.
2. **What replaces the hint's verb.** `→ harness run <flow> <id>` becomes `→ quorum run <flow> <id>`,
   but the board renders that hint per column and Q-0099's AC-2 pins it, so the two must move
   together or one goes red.
3. **Whether `ProjectNotFoundError`'s message is `core`'s to own at all.** It is thrown by a library
   that does not know whether a CLI, a daemon or a test is calling it — M3's server will surface the
   same error over HTTP, where *"run `quorum init` in your repo"* is advice to a browser. That is the
   one part of this that is a design question rather than a rename.

## What must not happen

A blanket `sed` for the word `harness`. The **folder** is `harness/`, the **concept** is a harness,
and `.claude/rules/product-boundaries.md` requires exactly that distinction: *"Never call the product
a harness, never call the folder quorum."* Only sentences instructing a human to **execute a
command** are in scope. `harness/harness.yaml`, `harness/flows/`, every DECISIONS entry and every
ticket body that says "the harness" are all correct as they stand.

## Ground rules — Q-0010's, repeated here because a child cannot read its parent

1. **Do not modify `spike/src/`** — see open question 1, which is this ticket's to rule.
2. **The spike's own tests are not deleted or edited to make room.**
3. **Behaviour is preserved, and a known defect is reported rather than fixed in passing.**
4. **`packages/core` already holds the logic** — look there before porting anything.
5. **`packages/core/src/spike-parity.test.ts` is updated in the same change**, line totals
   re-derived rather than adjusted.

## Gate obligations

**GO-1 — it owes a decision entry before code only if open question 3 is answered "no".** Moving a
user-facing instruction out of a library's error message is an architecture question against
`04-architecture.md`'s statement of what `core` is responsible for. If the message stays in `core`
and only its words change, no entry is owed and this is machinery.

**GO-2 — sequencing is deliberate and cheap either way.** Running before Q-0093 saves that ticket
from writing a fourth instance; running after it means fixing four sentences instead of three. Both
are acceptable; what is refused is running *concurrently* with any command child, because Q-0039 is
unfixed.

**GO-3 — `harness/Q-0100/integration` must exist before the first chore run** (§5.8).

## Non-goals

- The adapter BYOS refusal string — **Q-0068's**.
- Renaming the `harness/` folder, the concept, or any prose that uses the word correctly.
- Publishing, or anything about what `npx quorum` may claim — Q-0029's, in M6.

Belongs to M2 in `docs/06-development-plan.md`. Opened from **Q-0091**'s requirements gate.
