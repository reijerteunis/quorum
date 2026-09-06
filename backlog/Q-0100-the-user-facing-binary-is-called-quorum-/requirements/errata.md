# Errata — Q-0100

Rulings on `requirements/merged.md`, written at a gate. **The window for an erratum is a gate** — one
landed between a review returning and the next implement starting reaches neither (Q-0094 E-3(a),
Q-0097 E-1/E-2).

## E-1 — the literal scanner fails closed; it does not become a parser. 2026-09-06, at the exhaustion gate of run 2.

**Ruling: take the second of the reviewer's two remedies.** `packages/cli/src/binary-name.test.ts`'s
scanner **detects syntax it cannot lex and refuses**, naming the file and the position. It does
**not** grow TypeScript-aware parsing, and it does not gain a fourth special case.

**Why, and it is this repository's own rule rather than a preference.** A scanner that meets a
construct it cannot lex and carries on **silently skips its subject and reports success** — *"a
check that skips its subject must not report success"* (2026-08-25), inside the guard written to
stop exactly that class. Failing closed makes the unexamined case **loud**, which is the property
that matters; being able to lex every construct is not.

**And the alternative is unbounded, which the run measured rather than argued.** Three implement
rounds produced three findings in this one file — `:100` (a backslash skipped without its escaped
character), `:121`, `:207` (a regex literal containing a quote) — all the same class, all found by
inspection, at a cost of **$43.79**. Nothing bounds that list: template literals with nested
expressions, regex-versus-division ambiguity, and unicode escapes are all still unhandled, and a
fourth round would close one and leave the rest. **A criterion satisfied only by enumerating an
infinite class is not satisfiable**, and the loop had no way to say so.

**What "fails closed" requires, so round 4 has a finish line.**

1. The scanner recognises the constructs it *can* lex, and on anything else **throws**, naming the
   file and the offset. A skipped construct is never silently tolerated.
2. **The refusal is demonstrated**, not asserted: a fixture carrying an unsupported construct makes
   the guard red with a message identifying it. Per *"A check is not established by reading it"*
   (2026-08-29), and shown red **against a construct the scanner does not claim to handle**, not one
   it already rejects for a different reason.
3. The corpus it scans is unchanged, and the criterion it serves — that no source file prints the
   old binary name — is unchanged. **This rules the guard's failure mode, nothing about AC-1 to
   AC-14.**

**The rest of the ticket is done and is not re-opened.** All eight printed sites name `quorum`;
`project.ts:43` keeps `harness/harness.yaml` as the **folder** while its command reads `quorum
init`, which is the dual-sense line AC-4 exists for; the scope violation round 1 introduced at
`backlog.ts:155` was fixed in round 2 and no round since has disputed the conversion. Rounds 2 and 3
found **nothing outside this one file**.

**Sixteenth appearance of a loop that cannot finish**, and a new variant worth naming: the earlier
fifteen were work no agent on the route was *permitted* to do. This one was work no agent could
*complete*, because the criterion as read had no last case. Q-0083's `blocked` verdict would not
have helped here — the implementer was not refusing, it was converging on something with no end.

## E-2 — E-1 named the goal imprecisely; the invariant is EOF in any non-default lexer state. 2026-09-06, at the second exhaustion gate of run 2.

**Ruling, and it amends E-1 rather than adding to it.** The scanner throws when it reaches **end of
input while in any non-default lexer state** — in a string, in a template literal, in a block
comment, in a regex. One invariant, checked once at EOF.

**Why E-1 was not enough, which is my error rather than the round's.** E-1 said the scanner
*"detects syntax it cannot lex and refuses"*. Round 4 read that as **constructs** — reasonably, since
rounds 1 to 3 had all been constructs — implemented refusal for those, and left the *unterminated*
case silently ending the scan. The reviewer was right to flag it: E-1 condition 1 says *"on anything
else throws"*, and this does not throw. **Round 4 did not satisfy the ruling because the ruling did
not name the class.**

**Why this formulation terminates and E-1's did not.** A lexer has **finitely many states**, and
"unterminated X" is not a list of constructs but a single predicate over the state at EOF. There is
no fifth case to find after the fourth: whatever state the scan ends in, if it is not the default
one, the input was not lexable and the scan is refused. Enumerating constructs has no last member —
that is what E-1 was written to escape, and it escaped only half of it.

**What round 5 must do, and nothing else.**

1. At EOF, if the lexer state is not the default, **throw**, naming the file, the state, and the
   offset where that state was entered.
2. **Demonstrate it red once per state** — unterminated string, template, block comment and regex —
   each showing the state named in the message. Four fixtures, not four code paths.
3. Change nothing else. AC-1 to AC-14 are satisfied and no round since round 2 has disputed them.

**The gap being closed is real but shallow, and that is recorded so the cost is legible.** The
corpus is `packages/cli/src/**/*.ts` plus `packages/core/src/backlog/project.ts`, all covered by
`pnpm typecheck` — so an unterminated construct makes the tree red for a louder reason first, and
the silent path is only reachable in a tree already failing. It is fixed anyway because **a guard
with a known silent path is the defect this guard exists to prevent**, and because shipping one
would contradict E-1 two rounds after E-1 was written to prevent exactly that.

**Cost to this point: $60.56 across four rounds**, against $11.55 for the requirement. The conversion
itself — eight sites, four dual-sense lines, ten test files — was correct after round 2. Everything
since has been the guard.
