# Q-0091 implement — run 2, iteration 4

**This round changed no behaviour, and that is the point.** The two majors reported identically by
review iterations 1, 2 and 3 asked for the same thing each time: a gate erratum authorising two
refusals the implement step could not authorise itself. **The gate has now written them.** E-5 and
E-6 are in `requirements/errata.md` and are supplied as binding inputs to this round, so the code
that has stood unchanged since commit `14a934e` is now the code the requirement asks for.

My diff is **twelve lines across four files**, all comments: the authority lines move from *"an
erratum … is owed at the gate"* to citing the ruling that exists. That is Q-0097 round 4's
precedent — a round that changed no behaviour and added authority lines *"so a reader meeting E-1
first cannot repeat the misreading"* — applied to the two criteria whose original wording sent three
reviews into the same loop.

---

## 1. The two findings, and what E-5 and E-6 settle

### Major 1 — `validate` does not call `loadProject()` (AC-4)

**Now authorised by E-5, and the code is unchanged.** E-5 rules that AC-4's *"Both commands"* binds
`lint` alone, on the measurement both rounds 2 and 3 made independently: `spike/bin/harness.js`'s
`validate` case (`:426–461`) contains no `loadProject` or `findProject` call site, while `lint`
(`:401`) opens with one. Requiring a project would be a behaviour change on the command's
machine-facing surface, where a `type: script` step reads the exit code — refused by ground rule 3.

E-5 also records the consequence that made the alternative visible rather than silent: had it been
ruled the other way, `COMMAND_DOMAIN['validate.ts']` would have had to gain `loadProject` or AC-10
would go red. **I verified that register is in the state E-5 describes** —
`frame.source.test.ts:232` reads `'validate.ts': ['validateArtifact', 'readData']`, with no
`loadProject`.

### Major 2 — `lint` reads `flags.project` (AC-2)

**Now authorised by E-6, and the code is unchanged.** E-6 ruled the distinction the implement step
had found before the gate did: AC-2's *headline* — no command re-parses the command line — binds and
is met, while its *aside* that `lint` reads neither `rest` nor `flags` describes the spike case
block's text rather than the command's behaviour. `spike/bin/harness.js:55` reads `flags.project`
**inside** `loadProject`, which `lint` calls with no argument, so `harness lint --project <dir>`
lints that project today.

The port cannot preserve both, because `core`'s `loadProject(dir?)` takes the directory as a
parameter where the spike's closes over a module-level `flags`. The read moves from implicit to
explicit **by necessity**, and AC-2's own *Test:* clause is fully met: the value read is the one the
frame parsed, no `parseArgv` is called, no `process.argv` is touched, no second flag table exists.

---

## 2. File by file

| file | change |
| --- | --- |
| `packages/cli/src/lint.ts` | `flowsDir`'s `@param` authority line: *"an erratum correcting that aside is owed at the gate"* → **`Why: ruled, see Q-0091 erratum E-6`**, naming why the read is explicit (`loadProject(dir?)` takes a parameter where the spike closes over `flags`). |
| `packages/cli/src/validate.ts` | Module JSDoc authority line: *"an erratum limiting it is owed at the gate"* → **`Why: ruled, see Q-0091 erratum E-5`**, AC-4's *"both commands"* binding `lint` alone. |
| `packages/cli/src/lint.test.ts` | The AC-2 `--project` pin's comment now names **E-6** as correcting the aside, and states the pin goes red if anyone narrows the handler to match it. |
| `packages/cli/src/validate.test.ts` | The AC-2 no-project pin's comment now names **E-5** as limiting AC-4, and states the pin goes red if anyone makes this command open a project. |

**Citations, not transcriptions** — `harness/rules.md` forbids restating a ticket body in a source
file, so each line names the erratum and the reader follows the pointer.

Everything else in the branch is rounds 1 and 2's work, untouched: the two command modules, their
two test files, the five migrated guards, the two barrel symbols, the register schema and the four
documentation edits.

---

## 3. Verification

Both suites forced, from a worktree that started with no `node_modules`.

| check | result |
| --- | --- |
| `pnpm install --frozen-lockfile`, `npm install --prefix spike` | exit 0 |
| `pnpm turbo run test --force` | **7/7 tasks, 0 cached**; `@quorum/cli` 12 files, **226 tests passed** |
| `npm test --prefix spike` | **19/19 files passed** |
| `git diff --stat 5cc23c7 HEAD -- spike/` | **empty** — ground rules 1 and 2 hold |
| `pnpm turbo run lint typecheck --force` | **14/14 tasks, 0 cached** |
| `pnpm sweep:git-identity` | green — *"both suites executed and green with no resolvable git identity"* |
| `pnpm turbo run build --force` | 3/3 tasks, 0 cached |
| AC-13's four pinned totals | **220 / 2739 / 2469 / 5428 and 55% — re-derived and unmoved**, as expected: this ticket edits no file under `spike/test/` |

The packed-install fixture Q-0098 left is inside the CLI suite and passed, so the new modules are
proven to reach a tarball rather than only a transpiler.

### §10's manual proof, run for the first time

No earlier round recorded it. Five comparisons of `pnpm exec quorum` against
`node spike/bin/harness.js`, **all byte-identical including the escape bytes**:

1. `lint` over the shipped flow directory — six green ticks, exit 0, identical.
2. `validate` with a draft-07 `$schema` ajv refuses — identical message, exit 1, **and the loop
   continues past the first failure**, which is AC-8's per-file property.
3. `validate` over a schema with no annotation — **E-3's skip notice byte for byte**, the `·`
   marker, `✓ … matches …`, and the violation's four-space indent.
4. `validate` with no arguments — `usage: harness validate <schema.json> <file…>`, preserving the
   `harness` name verbatim per OQ-2.
5. `lint --project <projectless dir>` — see below.

### One pinned claim confirmed by execution rather than by reading

Comparison 5 prints a **raw ENOENT stack in both trees**, not AC-4's sentence. That is not a
divergence: `lint.test.ts:264` already pins it, on the reasoning that `loadProject(dir)` with an
explicit directory never consults `findProject`. I ran both binaries and the outputs match frame for
frame, differing only in each tree's own file paths. So AC-4's no-stack-trace clause governs the
**search** path — no argument, walk up, find nothing — which is what the AC-4 block tests behind an
orphan-directory assertion that refuses the run rather than acting as the oracle.

---

## 4. Deliberately left alone

- **`spike/**`** — zero edits, verified by diff against the base commit.
- **`backlog/**`** — not an agent-writable surface. E-5 and E-6 are the human's and are already
  written; I added nothing to them.
- **`docs/decisions/`** — no decision is implied by this round.
- **`build.test.ts:1324`** — the one remaining *"erratum … is owed"* string under `packages/`. It is
  **Q-0098's**, about that ticket's AC-26 wording, reported at its own gate and unrelated to this
  ticket. Not mine to touch; reported so the grep result is not mistaken for an outstanding
  obligation of Q-0091's.
- **The stale `packages/cli/dist/*.js` comments** I saw mid-round were gitignored build output and
  were regenerated by the forced build after my edits; the manual proof above ran against the
  rebuilt artifacts.

---

## 5. Nothing is ambiguous or contradictory this round

For the first time on this ticket I have no refusal to report. The two contradictions rounds 1 to 3
were stopped by are ruled, and both were ruled in favour of the measurement. Every one of the
thirteen criteria is satisfied under the errata as they now stand.

**Worth recording once, since E-7 already put the number on it:** rounds 2 and 3 cost $7.129 and
$7.154 holding refusals that were correct on the first telling, and round 3 changed no files at all.
The mechanism that would have ended this at round 2 — **Q-0083**, an implement step that can return
`blocked` — is named and unbuilt. This round is the cheap one only because the gate finally supplied
what no step in the loop can write.
