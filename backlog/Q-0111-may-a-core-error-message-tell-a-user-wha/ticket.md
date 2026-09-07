---
id: Q-0111
title: May a core error message tell a user what to type
stage: draft
owner: ruud
repos: []
branch: harness/Q-0111/integration
priority: p3
created: 2026-09-07
iterations: {}
history: []
---
`ProjectNotFoundError` carries an imperative — *"run `quorum init` in your repo"* — which six CLI
catch sites render unaltered and which M3's server will surface over HTTP to somebody who may not
have a shell. Decide where advice lives before the second surface exists, rather than after.

**Opened 2026-09-07, and how it was found is part of it.** Q-0100 shipped on 2026-09-06 and left
this question written into `packages/core/src/backlog/project.ts`'s JSDoc — *"moving it is a separate
ticket rather than a deferral … What that ticket owes first is a decision entry"* — **and into no
ticket**. It is the second obligation found this week living only inside a closed ticket, the other
being Q-0090's GA-4, now Q-0110. Nothing was broken while it waited, which is exactly why nothing
noticed.

## The site, and why it is one sentence rather than a class

`packages/core/src/backlog/project.ts:33`:

    'no harness/harness.yaml found — run `quorum init` in your repo'

**Q-0100 already moved the half that was wrong.** That sentence carries both senses of the word:
`harness/harness.yaml` is the **folder**, which `product-boundaries.md` requires be kept, and the
command was `harness init`, which had to become `quorum init`. Q-0100 changed the command and kept
the folder, and recorded that the *imperative itself* is a different question. This ticket is that
question and nothing else — **the wording is settled; whether the sentence should end there is not.**

## What makes it a design question rather than an edit

**Six catch sites render `error.message` unaltered**, verified 2026-09-07 and matching `project.ts`'s
own count: `adapters.ts:52`, `board.ts:48`, `lint.ts:55`, `runs.ts:74`, `run.ts:232`, `ticket.ts:62`.
So the imperative is composed **once** and reaches the terminal six ways. Splitting it — a bare
condition in `core`, the advice in the surface — means **six sites each composing an instruction**,
which is precisely the drift Q-0100 closed by ruling the class once instead of per command. The cheap
fix reintroduces the problem the sibling ticket exists to have solved.

**M3 is the forcing function and the reason this is opened before it is urgent.** `packages/server`
will surface this same error over HTTP. *"Run `quorum init` in your repo"* is advice to someone at a
shell; over a WebSocket to a browser it is advice to someone who may not have one. Today there is one
surface and the sentence is right for it. The moment there are two, it is right for one of them.

**It owes a decision entry before code, against principle 1.** `docs/04-architecture.md:44` says
*"`core` has no I/O it doesn't own … Everything else is a thin shell around it."* A thin shell that
composes its own remediation advice is not thin; a `core` that composes advice for a surface it
cannot see is not core. The entry has to say which reading holds, and it is the human's to write —
which is why this is its own ticket rather than a criterion inside one whose implement step could
never satisfy it.

## RULED 2026-09-07 — the entry this ticket owed has landed

See *"A `core` error names the condition; the remedy belongs to the surface"* (2026-09-07). **Shape 2
wins, and shape 1 is refused as correct-by-accident**: the sentence is right for the only surface
that exists, and the moment a second renders it there is no rule saying which of the two it is right
for. Shape 3 is *"what this becomes if a third surface arrives"*, not premature work now.

**What remains for this ticket is the code**, and the entry measured that it is smaller than this
body claimed. All six catch sites are byte-identical — `if (!(error instanceof
ProjectNotFoundError)) throw error; return die(error.message);` — so **the CLI composes nothing, it
transports**, and the remedy lands at one mapping site rather than six. The paragraph below arguing
that a split *"means six sites each composing an instruction"* is the cost this entry disproved; it
is left standing as the record of what was assumed.

`ProjectNotFoundError`'s message becomes `no harness/harness.yaml found` — the folder stays, per
Q-0100 — and `packages/cli` maps the class to ``run `quorum init` in your repo`` so the terminal
output is unchanged. The criterion that matters is that the rendered sentence a stranger sees does
not move.

## Three shapes, none decided here

1. **Leave it.** The sentence is correct for every surface that exists, and M3 can strip or replace
   it when it has a reason. Costs nothing now; pays later, in a package that will have its own
   opinions.
2. **Split condition from advice.** `core` raises *"no `harness/harness.yaml` found"* and each
   surface composes its own next step. Correct by layering, and it is the six-sites problem above
   unless the advice is composed once per surface rather than once per command.
3. **Make the advice structured rather than prose.** The error carries what is missing and what would
   fix it as data; a surface renders it. Most work, and the only shape where a browser and a terminal
   can differ without either duplicating the other.

Shape 3 is the one M3 would want and the one worth costing before M3 is written, which is the whole
argument for opening this now rather than at the daemon.

## Non-goals

The word "harness" anywhere — ruled by Q-0100 and by `product-boundaries.md`, and the folder stays.
Q-0068's BYOS refusal, which is a different sentence on a different surface for a different reason.
Every other `core` error message: this ticket rules the class **by** deciding this one, and a sweep
of the rest belongs to whatever the entry says, not to this body.
