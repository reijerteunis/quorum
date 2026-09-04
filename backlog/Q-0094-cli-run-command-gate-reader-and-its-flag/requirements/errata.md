# Errata — Q-0094

Corrections and rulings against `requirements/merged.md`, dated, written during the loop as soon as
the contradiction is provable rather than at the exhaustion gate — *"An erratum is the last repair,
not the first"* (2026-08-30). An erratum states what was **run**, not what was reasoned.

## E-1 — AC-6's angle brackets are placeholder notation, not text to emit — 2026-09-04

**Ruled: the diagnostic prints `pass --gate-answer advance|retry|abort` with no angle brackets, as
the spike does. Review iteration 1's second major is refused, and the implement step's refusal is
upheld.**

Written **during the loop** rather than at the exhaustion gate, and landed while review iteration 2
was already in flight — it cannot reach that review, but it reaches implement iteration 3, which is
the round that would otherwise refuse the same finding a third time. That timing is the synthesis of
two earlier lessons: Q-0097 lost two errata by landing one while a round in flight built past it,
and Q-0091 spent **$14.28** on two rounds that could not succeed because the ruling came too late.

### The measurement

AC-6's line in `merged.md` reads:

> `gate (<kind>) "<reason>" needs an answer and stdin closed without one — pass --gate-answer`
> `<advance|retry|abort or advance|abort> (repeatable, consumed in order), or run interactively`

`<kind>` and `<reason>` are placeholders — nobody proposes printing the literal string `<kind>`. The
third bracket pair is the same notation, and **its contents prove it**: no implementation would ever
emit the words *"advance|retry|abort **or** advance|abort"*. The brackets say *one of these two
alternatives goes here*, exactly as the first two say *the kind goes here*.

`spike/bin/harness.js:97` prints no brackets, and ground rule 3 preserves behaviour. Adding them
would be a behaviour change on a port ticket, made to satisfy a reading of prose the prose does not
carry.

### Why this is worth an entry rather than a note

It is the **third time in this stretch** that a criterion's prose has been read as a literal
contract — after Q-0091's E-3, where a phrase quoted from a frozen contract was not in the shipped
string and following it would have reverted Q-0037, and Q-0098's E-1, where a pack count was read as
a target rather than an environment-dependent measurement. The pattern is stable enough to name: **a
requirement describes what must be conveyed; only a test fixture or a frozen contract's own file
pins bytes.** A reviewer that cannot tell the two apart will keep raising this, and an implementer
with no `blocked` verdict (Q-0083) can only refuse in prose.

### What this does not do

It does not touch review iteration 1's **first** major, which was real and is fixed: the readline
interface was closed only after `rl.question()` resolved, while `SIGTERM` — which readline has no
event for — rejected the abort promise without settling it, so the process could survive with input
listeners attached. That defect was **introduced by the port** rather than inherited: the spike's
`engine.js:113–114` registered `SIGTERM` and exited, so a reader left open never mattered, and
Q-0050 ruled that `core` installs no signal handler. Ground rule 3 protected nothing there, and the
fix stands.

## E-2 — §8's documentation row is false; both doc edits are correct and stay — 2026-09-04

**Ruled: review iteration 2's first two majors are refused. `docs/04-architecture.md` and
`docs/06-development-plan.md` are correctly changed by this ticket, and reverting them would ship
two false sentences. §8's cross-cutting row is the thing that moves.**

### The measurement

§8 asserts *"No numbered doc claims anything this changes."* Measured on `main` at the tip this
branch was cut from, two do:

- `docs/04-architecture.md` says **"Since Q-0093 it dispatches five commands"**. This ticket lands
  the sixth. The sentence is false the moment the branch merges.
- `docs/06-development-plan.md`'s Q-0094 bullet says the gate reader has **"three meaning nobody was
  there"**. This ticket's own requirements run measured five sites as **two** undecided and **three**
  operator errors, and `spike-parity.test.ts:249` has stated that split since before the ticket was
  written. The sentence is already false and this ticket is what makes it visible.

So the row is not a scope boundary the implementer crossed; it is a claim about the tree that does
not hold. `.claude/rules/docs-and-decisions.md` is explicit about the consequence: *"When code and
docs disagree, the docs are wrong until a DECISIONS.md entry says otherwise — **fix the docs in the
same PR**."*

### Why ground rule 3 does not apply here

Ground rule 3 — *a known defect is reported rather than fixed in passing* — governs **product**
defects that land in both trees, and names four: Q-0059's traversing `dirOf`, Q-0060's silent
frontmatter, Q-0066's probe crash, Q-0068's product name. A sentence in a numbered document that
this ticket falsifies is documentation drift, which the docs rule requires be fixed in the same
change, not carried. Reading ground rule 3 to cover prose would make every child of Q-0010 leave the
architecture document one command further out of date, which is the opposite of what the previous
three did: Q-0091, Q-0092 and Q-0093 each updated it, and their entries are in its status line.

**The precedent for the plan edit is the plan's own text**: it records that *"[Q-0090's] implement
step corrected two things in this page"* on 2026-09-01. An implement step editing
`docs/06-development-plan.md` is established practice, unlike `backlog/`, which is not
agent-writable and which this ticket correctly leaves alone.

### What this does not do

It does not touch review iteration 2's **third** major, which is real and must be fixed: AC-1(3)
requires the handler to consume `cmd`, `rest`, `flags` and `gateAnswers` from the supplied
`ParsedArgv`, and `run.ts:130` destructures only three while no source-level check enforces the
fourth. That is a criterion met in part and reported as met in full, which is the defect class this
repository records most often.

## E-3 — E-2's plan clause is withdrawn, and AC-1(3) lists what arrives rather than what must be destructured — 2026-09-04

**Ruled: both of review iteration 3's majors are refused, and the code on this branch needs no
further change. One of them is my own erratum's artifact and is corrected here.**

### (a) E-2's development-plan clause is withdrawn

E-2 ruled that **both** doc edits were correct and must stay. That was right about
`docs/04-architecture.md`, whose *"Since Q-0093 it dispatches five commands"* this ticket falsifies,
and which iteration 3 correctly kept as a two-line count fix while dropping the added paragraph.

It was **wrong about `docs/06-development-plan.md`**. That page's Q-0094 bullet is rewritten by the
human at the plan pass after every child of Q-0010 ships — five times so far — and its throw-site
clause is corrected there. Iteration 3's revert cost nothing, and E-2 turned a harmless revert into
a review finding.

**The mechanism is the lesson, and it is the second time in three tickets.** E-2 was landed while
implement iteration 3 was already starting: `E-2 — §8` appears **zero** times in that step's prompt.
So the round could not read it, reasoned to a compatible answer independently, and asked for the
*opposite* ruling — while iteration 3's **review**, whose inputs snapshot later, read E-2 and
enforced the half that should not have been written. Q-0097 lost two errata to exactly this. **An
erratum landed between a review returning and the next implement starting has no reliable window;
the window is at a gate.**

### (b) AC-1(3) names the fields that arrive, not a destructuring shape

AC-1(3) says the handler *"reads `cmd`, `rest`, `flags` and `gateAnswers` off the `ParsedArgv` it is
given and calls no parser of its own"*, citing Q-0091 AC-2 and `frame.source.test.ts:563`. **The
second clause is the criterion**; the list names what `ParsedArgv` carries.

Measured, the literal reading contradicts every shipped sibling: `lint` destructures `{ flags }`,
`validate` `{ rest }`, `runs` `{ rest, flags }`, `init` `{ rest }`, `ticket` `{ rest, flags }`.
**Not one of the five binds `cmd`**, because `main.ts` dispatches `HANDLERS[cmd](parsed)` and `cmd`
is the key the handler was reached through. Requiring `run` to bind it would make it the only
handler holding a variable it cannot use — a dead binding introduced to satisfy a reading of prose,
in the command that owns the product's most load-bearing surface.

What AC-1(3) exists to prevent is a handler re-parsing `process.argv`, which is Q-0090's measured
defect: `main` discarded `rest`, `flags` and `gateAnswers`, so all four command children would have
re-parsed. `run` is the only command that needs `gateAnswers` at all, and it takes all three fields
it uses from the supplied object and parses nothing. The criterion is met.

**The reviewer's own observation is correct and does not change this**: `main.test.ts`'s generic
dispatch assertion proves `cmd` reaches handlers, not that this one consumes it. That is precisely
the point — `cmd` reaching the handler is `main`'s contract, and it is pinned where it belongs.

### Why this keeps happening, stated once

This is the **third** prose-as-literal-contract finding on this ticket — after E-1's angle brackets
and E-2's §8 row — and the fourth in this stretch, with Q-0091's E-3 and Q-0098's E-1. The rule is
stable enough to state plainly: **a requirement describes what must be conveyed or achieved; only a
test fixture, a frozen contract's own file, or a criterion quoting bytes pins bytes.** An implement
step with no `blocked` verdict (Q-0083) can only refuse in prose, and a reviewer with no way to tell
the two readings apart will keep raising it.
