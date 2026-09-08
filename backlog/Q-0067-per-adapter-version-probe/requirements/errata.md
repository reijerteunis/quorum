# Errata — Q-0067

Corrections to `requirements/merged.md` made after it landed. Each is ruled at a gate, which is the
only window an erratum has — *"the window for an erratum is a gate"* (Q-0094 E-3).

## E-1 — AC-6 is met, and its *Test:* clause bounds the instrument it asked for

**Ruled at the exhaustion gate of chore run 2**, after three implement rounds and three reviews, all
three of which returned `revise` naming AC-6.

**The normative half is met, and it is checkable by inspection of five lines.** AC-6 says no
production file "may select an argv token, a flag name, a JSONL field, a schema, a retry rule or a
model from a version string or from one of these states". Measured over both production corpora at
implement round 3, a version state is read at exactly two sites:

- `packages/cli/src/adapters.ts:109` — `VERSION_CLAUSE[version.state]` inside `versionClause`, a
  table lookup whose whole function returns `string | null`.
- `packages/cli/src/adapters.ts:141` — `{ version_state: seen.state, verified_version: seen.verified }`,
  the `--json` report's own fields.

Neither selects an argv token, a flag, a JSONL field, a schema, a retry rule or a model. The
producer is `cliVersion` and there is no third reader. AC-6's subject is satisfied.

**What the three rounds actually did, because two of them were right.** Round 1 found the scan saw
only single-quoted literals, so a third reader spelling `"ahead"` or a template literal evaded it —
a genuine failure of *"failing on any third reader"*, and the loop working. Round 2 found
`entry['version' + '_state']` evaded it, which round 3 closed properly: the scan now folds static
string concatenation to a fixpoint and does so **additively**, handing every clause the file as
written *and* the folded text, so a fold that gets something wrong can only fail to find a violation
the raw text already shows and can never hide one. That is a better answer than the finding asked
for. Round 1's and round 2's second major — the decision transcribed into production JSDoc at five
sites, against `.claude/rules/engineering.md` and GO-1 — is also closed: no production file restates
the policy, and each carries one `Why:` line naming the entry.

**What is refused is round 3's finding, and the reason is the criterion's own text.** It asks for a
structural assertion confining the *permitted* CLI site to rendering, so that a future edit branching
on `seen.state` to select probe arguments or a model would be rejected. AC-6's *Test:* clause reads:
*"a source scan over both production corpora, **allowing the producing function and the rendering
function by name** and failing on any third reader; demonstrated red by adding a fourth site to a
fixture copy."* Allowing the renderer **by name** is what the criterion specified, and it is what
shipped. Round 3 reads AC-6's normative half — a statement about what the *code* does — as a
specification for how strong the *guard* must be, and derives from it a property the *Test:* clause
does not ask for.

**The rule, stated once.** A criterion's *Test:* clause bounds the instrument. A reviewer may find
that the instrument fails the job that clause gives it — which is exactly what rounds 1 and 2 found,
and why they were right — and may not raise the job. This is the fifth instance of a criterion's
prose read as a literal contract past its own stated test (Q-0091 E-3, Q-0094 E-1, E-2, E-3(b)), and
the first where the escalation is *monotonic*: each round's finding demanded a strictly stronger
instrument than the last, against a subject that had stopped moving after round 1.

**Registered rather than discarded, because the idea is real.** Confining an allow-listed site to
the role its register claims for it is a property **no guard in this repository has**, and this one
is not the place to invent it: `turbo-inputs.test.ts`'s `NOT_READ`, `frame.source.test.ts`'s
`DOMAIN` and `STATE_SITES` here all name a site and trust its body. Whether an allow-list entry
should carry an enforceable role, and what the assertion would be, is a design question about the
guard idiom rather than about this ticket, and it wants its own requirement. Not opened here; if it
is wanted, it is opened against the idiom and not against `cli-version.test.ts`.

**Verified before the ruling rather than after it**: `pnpm turbo run test --force --continue` in the
implement worktree, 7/7 tasks, 0 cached, 620 tests passing in `@quorum/cli` alone.
