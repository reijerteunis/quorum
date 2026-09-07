# A ticket's owner is supplied, never guessed — 2026-09-08

**Decision:** `core` does not read the environment to decide who a ticket belongs to. `Backlog.create`
takes an owner from its caller, refuses one that is not a non-empty string, and writes **`unknown`**
where none was supplied. The surface decides who that is: `quorum ticket new` uses `--owner` if it
was given a name, then git's configured `user.name`, then nothing — and M3's server will use whatever
its session knows. `owner` therefore carries **a name or the sentinel `unknown`**, which
`packages/shared/src/ticket.ts` now says where it previously said only *"the human who owns the
current stage"*.

**Why this is a decision and not a repair.** Q-0112 opened on two defects in one field, and the
second is a genuine defect by any reading: `--owner` with no value after it wrote the **boolean
`true`**, because `argv.ts:54` gives a valueless flag `true` and `create`'s destructuring default
fired only on `undefined` — while `ticketSchema` declares `owner: z.string()` and refuses that value.
The product's own command could write a ticket its own schema rejects, into the module it calls its
database, and `quorum board` rendered it without noticing. Refusing it needs no entry.

The first does. `process.env.USER` is not a wrong *value* the way `true` is; it is a **policy** —
that a ticket belongs to the operating-system account of whoever ran the command. It is the wrong
policy, on a shared machine, in CI, in a container and in every worktree a flow creates, and this
backlog carried eleven tickets stamped that way with four hand corrections that never reached the
code. Replacing it means choosing a different policy, and choosing `unknown` puts a value in a field
the schema defines as *a human*. That is the conflict `.claude/rules/docs-and-decisions.md` says an
entry has to settle before the code is right.

**Where each half lives, and why the seam is there.** `core` gained `configuredUser`, which answers
what git is configured to call this user and `null` where nothing is configured. It is a **fact**;
that this fact is the owner is a **policy**, and the policy is the surface's. That is the same seam
*"A `core` error names the condition; the remedy belongs to the surface"* (2026-09-07) drew for error
text, and it is drawn here for the same reason: `core` cannot see which surface is asking. A terminal
user has a git identity; a browser session has a logged-in account; neither is knowable from
`packages/core`.

**The refusal is at the write boundary rather than at the flag.** `argv`'s coercion is unchanged and
a valueless `--owner` still arrives as `true`; what changed is that a boolean is no longer a name.
Putting the check in `create` means one guarantee covers the CLI flag today and an owner taken from
an HTTP request body tomorrow, where a surface-by-surface check would have to be remembered twice.

**Alternatives considered.** *Require an owner and let `create` refuse without one* — the strongest
form, and rejected on what it costs a stranger: a cold clone with no git identity configured would be
unable to create a ticket at all, in the first thirty minutes the README is timed against. *Keep a
default but make it `git config user.name` inside `core`* — rejected because it is the same mistake
one layer better disguised: `core` would be choosing a policy it cannot see the consequences of, and
would owe an answer for the case where git has none. *Fall back to `unknown` only after refusing
`true`, leaving `process.env.USER` in place* — rejected: it repairs the defect that is easy to see
and keeps the one that has already cost four hand corrections.

**What `unknown` claims, stated so it is not read as a name.** It is an admission that nobody said,
not an assertion about a person, and it is visible on `quorum board` beside every other owner — which
is the point. A surface that forgets to supply an owner ships tickets that say so, loudly, rather
than tickets attributed to a plausible-looking account nobody chose.
