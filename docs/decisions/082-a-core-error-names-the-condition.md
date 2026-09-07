# A `core` error names the condition; the remedy belongs to the surface — 2026-09-07

**Decision:** an error raised by `packages/core` states **what is wrong** and not **what to type**.
The remedy is composed by the surface that renders it, once at that surface's boundary rather than
once per command. `ProjectNotFoundError`'s message becomes
`no harness/harness.yaml found`, and `packages/cli` maps the error's identity to
``run `quorum init` in your repo`` so the terminal output a stranger sees is unchanged. Q-0111
implements it; this entry is what that ticket said it owed first.

**The measurement that decides it, and it inverts the cost the ticket assumed.** Q-0111's body — and
the JSDoc at `packages/core/src/backlog/project.ts` that Q-0100 left it in — both argue that
splitting condition from advice means *"six sites each composing an instruction, which is the drift
this ticket closed."* Measured on 2026-09-07, all six catch sites are byte-identical:

    if (!(error instanceof ProjectNotFoundError)) throw error;
    return die(error.message);

`adapters.ts:52`, `board.ts:48`, `lint.ts:55`, `runs.ts:74`, `run.ts:232`, `ticket.ts:62`. **The CLI
composes nothing; it transports.** So the advice does not have to be written six times — the surface
has a single exit-with-message point (`fail.ts`'s `die`) and a single error class to discriminate on,
which is one mapping site. The objection that made this look expensive was measured and is false.

**Why the condition and the remedy separate at all.** `docs/04-architecture.md:44`, verbatim:
*"**`core` has no I/O it doesn't own.** … Everything else is a thin shell around it."* A shell that
only forwards is thin; a shell that forwards advice it did not choose is a pipe. The imperative
presumes a shell — and M3's `packages/server` will surface this same error over HTTP, where *"run
`quorum init` in your repo"* is advice to somebody who may not have one. `core` cannot know which
surface it is speaking to, and it does not have to: `ProjectNotFoundError` is a **class**, so
everything a surface needs to compose a remedy is already in the type. Nothing is lost by dropping
the sentence and nothing new is needed to restore it.

**The message keeps `harness/harness.yaml` and that is deliberate.** Q-0100 ruled the one sentence in
the product carrying both senses of the word: `harness/harness.yaml` is the **folder**, which
`.claude/rules/product-boundaries.md` requires be kept, and `harness init` was the **command**, which
that ticket moved to `quorum init`. The folder stays in the condition; the command moves out with
the remedy. That is the same split by a second route, which is why this entry does not reopen it.

**Alternatives considered.** *Leave it.* The sentence is correct for the only surface that exists,
and it costs nothing today — rejected because it is correct by accident: it is right for one surface
and there will be two, and the moment a second renders it the sentence is wrong for one of them with
no rule to say which. *Make the advice structured data on the error — what is missing, what would fix
it — and let each surface render it.* The shape M3 would want, and rejected as premature rather than
wrong: with one surface it is a schema serving a single consumer, and `ProjectNotFoundError`'s
identity already carries the discrimination a second surface needs. If a third arrives and the
mapping stops being one line, this is what it becomes. *Sweep every `core` error message in the same
change* — rejected: this entry rules the class by deciding one instance, and a sweep needs a census
of what else composes advice, which is the implementing ticket's to run and not this entry's to
assume.

**Why now, when nothing is broken.** Because a rule stated after the code is written is a rule the
code has already contradicted. Q-0081 is this project's own record of the alternative: three
documents state a form `resolveModel` has never matched, and nobody caught it because the coverage
could not tell the two readings apart. Deciding at M3 means deciding while the server is being
written, which is when the pressure is to make the error convenient rather than correct. Q-0111 is
`p3` and it may wait; **what it may not do is wait undecided**, which is the state Q-0100 left it in
— an obligation recorded in a JSDoc and in no ticket, found only because a triage went looking.
