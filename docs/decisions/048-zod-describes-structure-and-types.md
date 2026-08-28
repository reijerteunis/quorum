# Zod describes structure and types; the flow lint keeps the semantics — 2026-08-25

**Decision:** `packages/shared` holds zod schemas for Quorum's own files — the flow file, `ticket.md`
frontmatter, the role file, and the two step-output shapes — and the boundary between those schemas
and `lintFlow` is drawn here, once, so that no later ticket has to decide it again. Four rules,
each checkable against a proposed new rule by reading one paragraph:

1. **Zod describes structure and types. Lint keeps every semantic rule and every message it
   produces today.** No zod issue may replace a lint message in `quorum lint`'s output, and
   consumers call `safeParse`, never `parse`, wherever a lint message is the better diagnostic.
   Zod may reject something lint also rejects; it may never add a rule lint does not have. Where
   lint owns a value — `on_exhausted` must be `gate`, an `input.diff` range's endpoints, a verdict
   must route somewhere, the two cross-vendor rules — the field is typed open and lint refuses it.
   The same rule decides a case that looks like an obvious enum and is not: a flow's `consumes` and
   `produces` are typed as plain strings, because `lint.js:124` checks only that both are present,
   so a flow naming a stage outside the ten-member list runs today and the schema may not be the
   thing that stops it. `stageSchema` is right for a ticket's own `stage` and wrong there.
   **The same rule governs which keys are required, and it is the half that was got wrong twice.**
   A required key is a rule, so the schema requires a key only where lint requires it —
   `consumes` and `produces`, at `lint.js:124`, and nothing else at the top level. `name` and
   `steps` are optional, because `lint.js:127` prints `flow.name ?? flow.file` and
   `flattenSteps(steps = [])` at `lint.js:7` defaults `steps` away, so a flow carrying neither
   lints clean today. `steps` present but not an array is still refused, and that is not an
   exception: `flattenSteps` throws a `TypeError` on `null` and on `[null]`, so lint does not
   succeed on them either.
2. **Where a key decides which KIND of step an object is, it stays optional even when lint requires
   it** — `integrate.branches`, `script.run`, and a `fan_out` step's `step:` template — **and the
   step schema selects its kind by `runStep`'s own dispatch and then commits to it**
   (`spike/src/engine.js:176–198`, by truthiness of `parallel`, `gate` and `fan_out`, with `type`
   separating only script from integrate). Both halves are needed and the second is the one that is
   easy to get wrong: an ordered `z.union` tries its branches in turn, so `{id: 'x', gate: 42}` —
   which the engine sends to `runGate` — fails the gate branch and is then *accepted* by the
   permissive agent branch, which keeps `gate` as an unknown key. The object ends up typed as the
   one kind the engine will never run it as, and its real structure is never checked. Selecting
   first and validating once means a malformed integrate step is still an integrate step, still
   receives lint's message about it rather than a union error naming an array index, and reports its
   own field (`steps.0.gate`) rather than every branch it is not.
3. **No field carries `.default()` or `.catch()`.** A zod default invents state the file did not
   carry, in the package thirteen tickets import, and no test would fail. `harness/rules.md` forbids
   it in as many words. The spike's fallbacks — `step.into ?? ticket.meta.branch`, `step.expect ??
   'pass'`, `step.max_turns ?? 40`, `iterations ?? {}` — stay in the engine where they are visible.
4. **Nothing is discarded.** Zod strips unknown object keys by default, which turns any
   parse-then-write path into silent data loss; every object here passes them through instead. The
   one exception is a step's `output:` block, which rejects unknown keys explicitly rather than
   dropping them, because the engine reads that block exhaustively and a key it does not know is a
   key nothing will ever act on.

**Alternatives considered:** (a) Let zod own everything it structurally can — seven of `lintFlow`'s
sixteen checks are expressible in zod (`lint.js:63, 66, 70, 75, 78, 79, 124`). Rejected on the
diagnostics: lint accumulates into an array and throws once, so a reader gets every defect in one
pass, and fourteen of the sixteen messages open with the **step id** — the token the reader greps
for in the YAML. Zod's path-based issue would say `steps[3].on_fail.max_iterations`: an index, not
an id. The one check that looks structural and is not is the `input.diff` range rule at `lint.js:83`,
which must visit a `fan_out` step's `step:` template that `flattenSteps` deliberately does not.
(b) A `.strict()` flow schema, so an unknown key is an error everywhere. Rejected by the corpus:
`loadFlow` assigns `flow.file = file` onto the parsed object *before* lint sees it
(`engine.js:15–20`) and `lint.js:127` prints that key as the flow's name — so a strict schema would
reject all six shipped flows on a key that appears in no YAML file. (c) Skip zod for flows and keep
lint as the only check — leaves thirteen later tickets each re-deriving what a flow file is from
`YAML.parse`'s return, which is the state this ticket exists to end.

**Why:** `lintFlow` is good at what it does and its value is almost entirely in its *messages*.
Adding a second validator in front of it is exactly how a project loses them — the new one runs
first, fails on a technicality, and the sixteen carefully written sentences never print. Writing the
boundary down as four rules rather than as taste is what lets a reviewer settle "does this belong to
zod or to lint?" without reopening the question, and the rules are testable: the package's own suite
asserts that every shipped flow parses with the injected key, that no `.default(` or `.catch(`
appears in the source, and that an accepted object round-trips with no key added or removed.

**Cost accepted:** the flow schema is looser than a schema written from scratch would be, and a
consumer that wants a guarantee lint already provides has to run lint. That is the right direction
of error: a schema that is too tight rejects an adopter's legal flow file in the package everything
imports, and that failure surfaces in the field.

**The limit of "lint accepting implies the schema parsing", stated rather than implied.** Q-0041's
AC-3 asks for that implication as a binding property over *any* flow object. It holds for key
presence, and after the third implement round the schema requires nothing lint does not. It does
**not** hold for value types, and it cannot hold alongside rule 1 above. `lintFlow` type-checks
almost nothing — run against it, it returns true for `adapter: 42`, `id: 42`, `gate: 42`,
`max_turns: 'many'`, `cross_vendor: 42` and for a bare string where a step object belongs, each of
which the schema refuses. Closing that gap means typing every field `z.unknown()`, which describes
nothing and hands thirteen consumers back the job of re-deriving what a flow file is. So the rule
is: **the schema may add no rule about which keys are present, and it is the only thing that checks
what their values are.** Anyone proposing to tighten a presence rule or loosen a type is
re-opening this paragraph, not making a local call.
