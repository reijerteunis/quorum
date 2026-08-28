# Errata — Q-0049 requirements

Amendments to `requirements/merged.md`. The implementer and the reviewer both read this file beside
the requirement (`chore.yaml` lists `requirements/errata.md` among the inputs of both steps); where
this file and the requirement disagree, this file wins **for the clauses it names and no others**.
Each entry is dated and names the clause it supersedes. Nothing here widens scope — an erratum
resolves a contradiction, it does not add requirements.

## E-1 — 2026-08-28 — two of AC-2's and AC-5's *Test:* sketches describe branches the ported code cannot reach

**Supersedes:** the *Test:* sentence of **AC-2** (`merged.md:349`) so far as it reads *"a
`.quorum/runs` that is a **file**, asserting the 'could not create' branch"*, and the *Test:*
sentence of **AC-5** (`merged.md:430`) so far as it reads *"an occurrence whose `output.txt` path is
a directory, asserting the warning names the path"*. **The numbered bodies of AC-2 and AC-5 are
unchanged and remain normative.** No other criterion is affected.

**The contradiction.** Both sketches ask for behaviour the spike does not have, so satisfying them
literally would be a behaviour change — which charter §2 and *"The port preserves behaviour; one
exception is authorised and everything else stops the child"* (2026-08-25) forbid. The implementer
preserved the spike, tested what is actually there, and reported both. That is the correct handling
of a §2 conflict, and round 1's review raised both as majors.

**Measured against the tree and against Node, not inferred:**

- **AC-2.** The criterion's own numbered body binds the `could not create <relative dir>` message to
  **step 3**, the run directory. Step 2 is bare — `fs.mkdirSync(historyRoot, { recursive: true })`
  at `spike/src/engine.js:342`, with no `try`/`catch` of its own. A *file* at `.quorum/runs` therefore
  fails at step 2 and what reaches the caller is a **raw `Error` with `code: 'EEXIST'`**, not a
  `FlowError` and not the "could not create" branch. Verified directly: `mkdirSync(<file>,
  {recursive: true})` throws `EEXIST` as a plain `Error`. The sketch conflates the runs root with the
  run directory; the body does not.
- **AC-5.** `spike/src/engine.js:421` guards the guarantee with `if (!fs.existsSync(outputPath))`, and
  `fs.existsSync` answers `true` for a directory. So the directory case **writes nothing and warns
  nothing** — the guarantee is silently skipped. There is no path on which the spike warns here.

**Replacement.** Both cases are covered by testing what the code does: the runs-root-is-a-file case
asserts the raw `EEXIST` and that it stops the run *before* the named refusals; the genuine
`could not create` branch is reached with a read-only runs root; the `output.txt`-is-a-directory case
asserts the silent skip and that the occurrence still reaches the manifest, with the warning branch
reached by a removed occurrence directory. The implementer has done all four.

**Standing instruction to the reviewer: neither is a finding.** Raising either again is raising the
requirement against charter §2, which this erratum settles in §2's favour. A reviewer **may** block
if the behaviour has been *changed* to match the sketch.

## E-2 — 2026-08-28 — the dropped `String(text)` is real, and it is a nit

**Supersedes:** nothing in the requirement. It rules the severity of round 1's third finding, which
`chore.yaml` requires be classified before it can approve.

**The finding is factually right.** `persist` is typed `(occurrence, name, text: string)` and calls
`fs.writeFileSync(target, text)` at `writer.ts:362`; **AC-6 (`merged.md:441`) specifies
`String(text)`**, which is what `spike/src/engine.js:431` does. The conversion was dropped.

**It is a nit and not a major**, because no caller that can exist reaches a difference: every
argument is a `string` at the type level, and the five spike call sites pass `prompt`, `e.raw ?? ''`,
`res.raw ?? ''`, `r.out` and `out`. A non-string argument is a compile error in `packages/core`
rather than a silently written `"[object Object]"`.

**Resolution: restore `String(text)` and keep the parameter typed `string`.** It costs one line, it
makes AC-6 literally true, and it keeps the compile-time refusal as well — the type is the guard and
the conversion is the port. Do **not** widen the parameter type to `unknown` or `string | number`;
that would be the behaviour change this erratum exists to avoid, in the opposite direction.

## What this erratum does not do

It does not weaken AC-2, AC-5 or AC-6, whose numbered bodies stand unchanged, and it does not excuse
the module from any obligation. It records that two *Test:* sketches were written from the
requirement's intent rather than from the spike, and that one real finding is a nit. Charter §2's
default — a defect found while reading is reported, never fixed in passing — is unaffected and still
governs everything in AC-13's reported list.
