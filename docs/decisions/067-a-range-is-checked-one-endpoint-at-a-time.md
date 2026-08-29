# A range is checked one endpoint at a time, because an endpoint is what can be absent — 2026-08-30

**Decision:** The run-level diff preflight classifies each **endpoint** of a range on its own —
step-created by an earlier group of this flow, an unresolved `{…}` template, or pre-existing — and
what happens to the range follows from its endpoints rather than the other way round. A range
holding one step-created endpoint is still deferred to step time, **and every pre-existing endpoint
it holds is resolved at run start anyway**, so a knowably absent ref costs nothing. Ruled at
Q-0038's requirements gate; Q-0038 implements it in `spike/`, and Q-0051 ports the fixed version
rather than the `.find()` its own aborted requirement had ruled preserved.

Two consequences settled with it, because they are the same modelling error in the same eighteen
lines. A deferred range that fails on its *other* endpoint names the step that was waiting and the
ref **that step** owed — never the ref that failed, which no step owed. And a not-yet-created
endpoint is described as not yet created, naming its producer, rather than as one that *"does not
resolve either"*.

This closes the hole *Q-0035 accepted: a check that skips its subject must not report success*
(2026-08-25) named and handed to Q-0038 by name. It contradicts nothing there; it is the other half
of that entry, and it is recorded because the rule generalises past this preflight and because the
paragraph stating the old model — `docs/02-sdlc-pipeline-spec.md` §5.5's *"Ranges divide into two
classes"* — is rewritten in place, so the reason it changed would otherwise survive nowhere.

**Alternatives considered:** **No entry at all**, on the argument that 044 already assigns the hole
and the new rule's prose lives in a numbered doc edited in place — rejected on both halves: the
numbered docs are living and the replaced paragraph takes its own reasoning with it, and the lesson
below is about where a check looks, not about diffs. **Amending 044** — refused by the rules; a
landed entry is never edited, and a reversal or extension is a new entry naming the old one.
**Making the entry an acceptance criterion of Q-0038** — rejected, and this is the expensive one to
get wrong: the chore role may not write `docs/decisions/` (`harness/roles/developer-generalist.md`),
so a criterion naming it is a precondition no step in the flow can satisfy, which is what exhausted
Q-0070's loop at a limit of 1 for a decision that then had to be written by hand anyway. It is
written by hand here, before the run, so the implementer has an authority to cite instead of a
prerequisite to fail. **Closing the timing half alone** and letting the diagnosis half fall out of
it — rejected on measurement rather than taste: once endpoints are classified, the range that cost
$13.86 fails in the preflight and never reaches the step-time message at all, but a range whose
pre-existing endpoint stops resolving *during* the run still does, so the diagnosis clause is
rarer and not dead.

**Why: the honesty rule could not catch this, because the preflight was honest about the wrong
subject.** *Skipped is not passed* asks whether a check reports what it declined to examine. This
preflight did — it deferred a range and said so. The defect was one level below: it asked its
question of a **range** when the thing that can be absent is an **endpoint**, so a single `yes`
suppressed a question that was answerable for free. A check inherits the blind spots of whatever
unit it classifies, and no amount of honesty about that unit reveals what the unit hides.

The same wrong granularity produced three defects, which is the evidence that it is the granularity
and not three bugs. **One:** a `.find()` over both endpoints defers the range whole, so
`chore.yaml`'s `integration...implement` never looks at the left endpoint — an ordinary
pre-existing ref. **Two:** the step-time message adds the producer clause only when the endpoint
that failed is the deferred one, so when the *other* one is bad the reader is told a branch is
missing and never told which step was being waited on; and because `.find()` keeps the first match,
a range with two step-created endpoints loses one pair outright. **Three:** the same message
reports a not-yet-created endpoint as one that *"does not resolve either"* — a branch that is not
supposed to exist yet, described as a failure — which is the category error the whole subsystem
exists to remove, reappearing inside its own diagnostic.

**What the money actually bought, which is worse than the record said.** The $13.86 was not merely
unprotected. `ensureWorktree` (`spike/src/git.js`) cuts a worktree from `HEAD` when a step's
declared `base:` does not resolve, silently, and `chore.yaml` declares
`base: "harness/{id}/integration"` — the branch that did not exist. So the implementer was not
stopped by the missing ref; it was handed a worktree from somewhere else and paid to work in it.
A second silent default, under a rule that forbids them, on the same night. It is named here and
deliberately not fixed by Q-0038: it lives in another module, it governs fan-out task bases too,
and *throw, warn, or which callers* is a design question nobody has asked yet. After Q-0038 the
chore shape never reaches it, because the preflight refuses first — the fallback is masked on that
path and still live on every other.

**A note on citing this one.** 044 locates the defect at `spike/src/engine.js:108` and calls it a
`.some()`; today it is a `.find()` at `:133`, and Q-0077 moved the file again on 2026-08-29. The
entries are append-only and right to be, so the rule above is stated in terms of what it decides
rather than where the code sat. Re-derive the position from the file.
