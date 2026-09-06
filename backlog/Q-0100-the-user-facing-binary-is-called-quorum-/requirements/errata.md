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
