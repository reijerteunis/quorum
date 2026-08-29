# A check is not established by reading it — 2026-08-29

**Decision.** A test, guard or assertion is trusted only once it has been **run against the code it
is supposed to reject** and seen to fail. Reading a check — however carefully, however expert the
reader — does not establish that it can fail, and this project now has enough evidence to treat
that as a rule rather than a preference. Where a check is added or widened, the change demonstrates
its red state in the same commit, and where that is impractical the check's own comment says so
instead of implying coverage it does not have.

The corollary is about *scope*: a check that cannot see its whole subject is a special case of a
check that cannot fail, and the two are found the same way. Before trusting a scan, guard or
register, enumerate its subject by an independent route and compare — count the sites, list the
matches, print the corpus — rather than satisfying yourself that the pattern looks right.

**Alternatives considered.**

*"Review more carefully."* This is what failed. Q-0050 ran six review rounds and **every round found
defects in the previous round's fixes** — 14, 8, 11, 10, 9, 10. The count did not fall. Each fix was
written by someone who had just been shown the same mistake, and reviewed by someone reading rather
than running.

*"Require a test for every change."* Necessary and insufficient, and this ticket is the proof:
every one of the five assertions below **had** a test, was green, and was worthless. A
`not.toBe(x)` satisfied by an interpolated id; an identity check run at `{}`, where an object that
was emptied is indistinguishable from the same object; the same defect a second time at a second
site; a fixture selector that looked for "a sentence followed by a newline", which every whole line
also satisfies, so it passed against the very implementation it was written to rule out; and a
`toBeGreaterThanOrEqual` floor that could not fail unless the `toStrictEqual` above it failed first.

*"Trust the author's own verification."* The author is the worst-placed reader of their own check.
Across Q-0050 the cross-vendor reviewer found this class repeatedly and the author found it almost
never unaided — and the one time the author did catch it, it was by running a fixture against the
old implementation on a whim rather than by inspecting it.

**Why.** The clearest evidence is a single defect at four depths, each layer added to fix the one
above it:

1. AC-13d's *"reproduces no sentence"* half was satisfied with a **120-character length proxy** and
   labelled as a proxy. A label describes a gap; it does not close one. Any short copied sentence
   passed.
2. The **scan** that replaced it split on every newline as well as on terminal punctuation. The
   corpus is soft-wrapped markdown, so sentences were shredded into fragments and the fragments
   under the length floor were dropped: measured at **195 corpus entries of which 7 were whole
   sentences, and 65 of 72 real sentences invisible.** The scan written to close fake coverage was
   about 90% blind.
3. The **fixture** written to prove that fix selected "a corpus sentence followed by a newline in
   the source" — which every whole line satisfies. It passed against the old builder. This was found
   only by running it against that builder.
4. One round later, the **marker register** was widened to close a *spelling* gap
   (`preserved behaviour` / `preserved behavior`) and left the **word-order** one
   (`Why: behaviour preserved from spike/…`), plus a third form carrying no word `preserved` at all.
   Three of thirteen authority lines were invisible to the register built to enumerate them.

Every step was a competent, well-reasoned fix to a real finding, and every step was verified by
reading. The measurements that ended it — 195 entries, 65 of 72, three of thirteen — each took one
command, and each contradicted what reading had concluded.

This is the same shape as *"a check that skips its subject must not report success"* (2026-08-25)
and *"the demonstration that a guard has a subject proves the guard fires, not that each of its
clauses does"* (Q-0071), and it generalises both: those entries say a check must have a subject and
must exercise each clause. This one says **you do not know either of those things until you have
watched it fail.**
