---
id: Q-0112
title: What a ticket's owner may be, and where it comes from
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0112/integration
priority: p2
created: 2026-09-07
iterations: {}
history: []
---
`create()` takes `owner` from `process.env.USER` and accepts whatever `--owner` hands it. So the
product stamps an owner that is guaranteed not to identify anyone on a shared or CI machine, and it
can write an owner **its own schema refuses**. Rule the field once, at `create`, so every caller
inherits the answer rather than each surface guarding it.

**Opened 2026-09-07.** `packages/cli/src/ticket.ts:20` has said since Q-0093 that *"whether the
product should default an owner at all is product behaviour and is its successor's"* — naming a
successor and no id, which is the third obligation this week found recorded in prose rather than as
a ticket, after Q-0110's and Q-0111's. It was opened at the end of a triage in which **the defect
fired twice on the tickets being created to close the other two**.

## Two halves of one field, and a fix to either alone leaves the hole

**(a) The default identifies nobody.** `packages/core/src/backlog/backlog.ts:190`:

    create({ title, intent, owner = process.env.USER ?? 'unknown', repos = [], id: given }: NewTicket)

`$USER` is the operating-system account of whoever ran the command — on a shared machine, in CI, in
a container, and in every worktree-based step this repository's own flows create. Pinned at
`packages/cli/src/ticket.test.ts:239–266`, which controls and restores `$USER` rather than reading
the ambient account, because a verdict taken from it would be a property of the machine.

**(b) The flag can write a boolean.** `packages/cli/src/argv.ts:54` gives a flag the value `true`
when the next token is another flag or absent, and `create`'s destructuring default fires only on
`undefined` — so `--owner` with nothing after it lands `owner: true` in the frontmatter. Pinned at
`ticket.test.ts:193–200`.

**Measured end to end on 2026-09-07 rather than read**, through the built binary in a throwaway
project:

    $ quorum ticket new "Probe" --intent "i" --owner
    ✓ T-0001 created at backlog/T-0001-probe (stage: draft)
    $ grep '^owner:' backlog/T-0001-probe/ticket.md
    owner: true

**And `ticketSchema` refuses exactly that value.** `packages/shared/src/ticket.ts:59` declares
`owner: z.string()`; parsing the same record with `owner: true` returns *"Invalid input: expected
string, received boolean"*. **So `quorum ticket new` can write a ticket the product's own schema
rejects** — and `quorum board` then renders it as `owner=true` without noticing, because
`Backlog.read` asserts rather than parses (Q-0043 AC-4, deliberately, so a read cannot reorder a
frontmatter it did not write).

That is the finding that makes this more than a cosmetic default: **the one module the product calls
its database can be made to hold a value its schema forbids, by the product's own command, silently.**

## Where the fix belongs, which is the design question

**At `create`, not at `argv`.** `argv.ts:54`'s `true` is the frame's rule for every valueless flag —
`--intent` and `--id` reach the same coercion, which is defects 3 and 4 of the four `ticket.ts`
records — so narrowing it there is an argv change with four consumers and its own blast radius. A
guard in `create` covers **every caller**: the CLI flag today, and M3's server tomorrow, which will
take an owner over HTTP from a request body that can carry any JSON type at all. The same argument
that puts the rule in `core` rather than in a surface is the one Q-0111 is arguing about from the
other side, and the two should be read together even though they are separate tickets.

## What has to be decided

1. **Is there a default at all?** Refusing without `--owner` is the honest reading of *"errors are
   explicit; never default silently"* and it is a breaking change to a command a stranger meets in
   the first thirty minutes. Keeping a default means choosing one that means something.
2. **If there is one, what is it?** `$USER` identifies the account, not the person. `git config
   user.name` identifies the person and is already the identity the engine commits with
   (`fanout.ts` passes `-c` at both commit sites), so it is available without a new dependency — but
   it can be absent, which is the whole subject of *"A test's verdict is a property of the commit,
   not of the checkout or the account"* (2026-08-30), and a default that is sometimes absent is a
   default that needs a fallback anyway. `'unknown'` is honest and useless. **Measure what each
   answers on a bare CI runner before choosing.**
3. **What does a non-string owner do?** Refuse and name what it got, per `create`'s existing
   refusals for a taken id and an occupied folder (`backlog.ts:198–207`), which are the worked
   precedent in the same function. Coercing with `String()` would spell it `'true'`, which is
   Q-0093's defect 4 pattern and stores a lie rather than refusing one.

## What it must not do

**Fix (a) and leave (b).** They are one field. A default that identifies somebody, still reachable
by a flag that writes a boolean, is the same ticket unclosed.

**Reach `argv.ts`'s coercion.** Defects 3 and 4 in `ticket.ts:23–29` share it — `--intent` with no
value reaches `intent.trim()` on a boolean and `die`s with *"intent.trim is not a function"*, a
JavaScript message on a user-facing path, which is worth its own ticket and is **not** folded in
here. Narrowing argv would close all three at once and is exactly the kind of change that should be
chosen deliberately rather than acquired.

**Silently normalise the 87 tickets in this backlog.** They all read `owner: ruud` as of 2026-09-07,
by hand. Whatever this ticket rules, an existing corpus is not migrated by a default.

## Correction history, derived rather than inherited

`ticket.ts:18` and `ticket.test.ts:244` both say the defect has been *"corrected by hand in this
backlog three times"*. **It is four**: the fourth was 2026-09-07, covering Q-0110 and Q-0111, both of
which `quorum ticket new` stamped `ruudvanengelenhoven` on creation — so the defect reproduced on the
two tickets opened to close two other obligations, which is as good a demonstration as the ticket
needs. Those two sentences are stale by one and are **this ticket's to correct**, in the change that
makes them false; they are deliberately not touched here, on the reasoning Q-0103's AC-19 applies to
production-source citations.

## Non-goals

`argv.ts`'s valueless-flag coercion and the two defects that share it; the `--id` coercion, which
`ticket.ts:27–29` records as deliberate; migrating the existing backlog; anything about `repos`,
which takes the same destructuring shape and has no reported defect; and Q-0111's question about
where user-facing advice lives, which is adjacent and separate.
