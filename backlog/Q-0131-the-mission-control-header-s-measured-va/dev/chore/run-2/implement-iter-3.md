# Q-0131 — implement report, run 2, iteration 3

*Verdict: `proceed`. One review finding, addressed as written. Full forced suite green in 7/7 tasks, 0 cached; `lint` and `typecheck` 14/14; `quorum lint` 6/6; `pnpm sweep:git-identity` green. Seven mutations across five sites, each red with a discriminating message, each reverted. One file changed: 143 insertions, 5 deletions, no production code.*

---

## 0. The finding, and the two measurements that decided the remedy

> **major:** `apps/web/test/source.test.ts:129` The AC-6 guard only detects parsing performed directly on an identifier named `message`. A parser can evade both checks by aliasing `event.message` and assembling the forbidden literal — for example, `const prose = event.message; Number(prose.split(['run', ' ', '#'].join(''))[1])` — so the required prohibition against extracting a number from an event message is not enforced. Extend the guard to track or prohibit event-message aliasing into parsing operations, and add a discriminating fixture for this assembled-literal/aliased-message case.

**Accepted in full.** The finding names this repository's most-recorded shape from the inside: a guard **keyed on a name rather than on the behaviour it is about**. `\bmessage\b` is the name; taking prose apart is the behaviour; and a rename separates the two. The prohibition AC-6 states was not the one being enforced.

The reviewer offered two remedies — *track* the aliasing, or *prohibit* it. I measured the corpus before choosing, and the measurements removed one of them and produced a third that is better than either.

**Measurement 1 — "prohibit aliasing" is not available, because this app legitimately aliases a message.** `grep -rn '\.message\b' apps/web/src` returns nine sites. `mission-control-model.ts:88` writes `row.doneMessage = event.message`, and `mission-control-trace.tsx:29–33` return `event.message` from five switch arms. Rendering a message verbatim is what the trace is *for*, so a rule forbidding the text from acquiring a second name would be red on the shipped tree on the day it landed.

**Measurement 2 — and this is the one that decides the shape: there are ZERO numeric coercions under `apps/web/src`.** `grep -rnE '\bNumber\b|\bparseInt\b|\bparseFloat\b' apps/web/src` returns **nothing at all**, across every file including the 40-odd test files in that tree.

That second figure is what turns an endless question into a bounded one. **AC-6's words are *"any expression extracting a NUMBER from an event message"*, and what makes a number is the COERCION rather than the operand.** Anchoring there is anchoring on the behaviour, at which point the name the text is carrying when it arrives stops mattering — and so does how the literal was assembled, and how many hands the string passed through first. The reviewer's own example fails a coercion clause whatever `prose` is called.

So the remedy is two clauses rather than one, and neither stands in for the other:

- **the aliasing half**, which is what the finding literally asked for — the same needles, over every name a file gives a message; and
- **the coercion half**, which needs no dataflow at all and is what lets the first one state a residual instead of growing an ever-longer list of forms.

---

## 1. What changed, in `apps/web/test/source.test.ts`

### `MESSAGE_ALIAS_FORMS` — the three binding forms that rename a message

```
const prose = event.message;        →  prose
row.doneMessage = event.message;    →  doneMessage
const { message: prose } = event;   →  prose
```

Each is `=`-guarded with a lookbehind and a lookahead — `(?<![=!<>])=(?![=>])` — so a comparison (`a.b === c.message`) is not read as a binding, which would have tainted a boolean and reported files doing nothing of the kind.

**The second form has a subject in the shipped tree rather than only in a fixture**: it is there for `row.doneMessage = event.message`, which this app really writes. That alias is never taken apart — it is compared with `null` and rendered — so collecting it leaves the corpus clean, which is the evidence that the walk discriminates rather than merely fires.

**The third form requires `const {`**, so a type annotation (`message: string`) and a plain object literal are not read as renames. Without that the walk would have tainted the name `string`.

### `messageAliases` — to a fixpoint

A rename of a rename (`const cut = prose;`) is the same act performed twice, and a walk that stops one step short of it is one an evader steps over. The fixpoint iterates until stable. It **over-collects rather than under-collects** by design: a binding that merely mentions a tainted name is taken as carrying it, which can only report a file that is innocent and never pass over one that is not.

### `extractsFrom(text, name)` — the same three patterns, parameterised

The three regexes are **byte-identical in shape** to the ones round 2 reviewed, including the `[ \t]` gaps that stop `\s` crossing a newline. What moved is the name they are anchored on. AC-6 asks for the guard to be *extended and not weakened*, and applying unchanged needles to a wider set of operands is the one direction that cannot weaken it.

### `COERCES_TO_NUMBER` — the blanket clause, and its own test

```
/\b(?:Number|parseInt|parseFloat)[ \t]*\(/
```

Asserted empty over the complete `src` corpus. **No register and no exemptions, and that is a measurement rather than a preference** — there is nothing to except. It is the strongest shape available and it is the one round 1's finding asked for when it refused a register of exceptions; this clause never needed one.

It is worth being explicit that this is a **blanket** prohibition and not a clause about messages. That is precisely what makes it immune to the name: `parseInt(row.count, 10)` fails it too. The design it states as a property of the source is this ticket's own — `WireRun.runId` is a typed `number`, so a screen that needs a number is handed one and never reads one out of prose.

---

## 2. Every clause shown red by mutation

A guard read is not a guard established. Seven mutations, three by injecting into a real `src` file and four by disabling a part of the guard:

| # | Mutation | Red, with the message it produced |
| --- | --- | --- |
| A | round 2's evasion verbatim, injected into `mission-control-model.ts` | **both** clauses, each naming the file: *"a file under src takes a value out of an event message"* **and** *"a file under src coerces a string to a number"* |
| B | an aliased parse with **no** coercion, same file | the extraction clause **alone** |
| C | `parseInt(row.stepId, 10)` — a coercion of something that was never a message | the coercion clause **alone** |
| D | the alias tracking reverted, so the needles anchor on `message` again | *"a parse of a renamed message is not reported"* — **the finding reproduced** |
| E | alias form 2 (property assignment) disabled | *"the rename form this app really writes is not collected"* |
| F | alias form 3 (destructuring rename) disabled | *"a destructuring rename is not collected"* |
| G | the fixpoint disabled | *"a rename of a rename is not followed"* |

**A, B and C together are the point.** A proves both clauses catch the evasion the finding named. B and C prove each catches something the other does not — so neither is a sibling standing in for the other, and deleting either leaves a real hole that fails here rather than quietly passing. That is the property round 2's own major about `LITERAL_PERMITTED` was about, applied to the fix for it.

**D is the finding reproduced**, which is what makes the new fixtures evidence rather than decoration.

Mutations A–C were injected as comment lines and that is stated rather than glossed: the clause is a text scan, so a comment is a faithful subject for it, and a live statement would have needed bindings these modules have no reason to introduce. Each mutation was reverted and the file re-run green before the next; `git status` confirms `mission-control-model.ts` is byte-identical to `HEAD`.

---

## 3. The anti-vacuity half, and why it needs no mutation

```ts
expect(messageAliases(model)).toContain('doneMessage');
```

This is a **positive** assertion over the shipped corpus, so it cannot pass vacuously — an emptiness can be an absence or a corpus nobody looked at, and a `toContain` over real bytes is neither. It is what says the alias walk sees the one rename this app really writes, rather than only the five in the fixtures beside it. Mutation E is what shows it is load-bearing from the other direction.

Round 2's `ASSEMBLED_FIXTURES` clause is untouched and still asserts that the two files whose fixtures were assembled are still in the corpus and still carry the refusal condition as prose — so "delete the sites" is still not a way to satisfy a corpus-wide prohibition.

---

## 4. The residual, stated rather than implied

Three things the alias walk does **not** follow, each with its reason:

1. **An object-literal property.** `daemon-client.ts` writes `{ kind: 'unparseable', path, problem: parsed.error.message }`, where the `.message` is a **zod error's** and not an event's — and a text scan cannot tell the two fields apart. Under a rule that followed object fields, `problem` would be tainted and `daemon-client.test.ts`'s two `state.problem.slice(0, 40)` labels would fail, so the rule would have needed a register of forgiven sites. **That is exactly the shape round 1's finding refused**, so following renames and not object fields is the line, and it is drawn on that measurement rather than on taste.
2. **A function boundary.** `render(event.message)` into a parameter is not followed, and cannot be by a text scan.
3. **`+text`, `text * 1`, `charCodeAt`.** `+` cannot be told from addition or string concatenation by a scan, and a needle reporting every `+` is one a reader learns to override.

**What bounds all three is the coercion clause**, and that is the argument for it existing rather than it being a second opinion: every one of those evasions must still turn a string into a number to produce a run number, and no file under `src` may do that. The claim made is the three named coercion forms — which is how a number is read out of prose in practice, and is what round 2's own example uses.

Going further would mean a type-aware lint rule over `apps/web` — real taint analysis rather than a scan. That is a decision with its own subject and its own dependency question, and it is not this ticket's; it is named here rather than attempted.

---

## 5. What I deliberately left alone

- **The six `MESSAGE_PARSE_NEEDLES`, the `toHaveLength(6)` assertion, and their own discriminating test.** AC-6 requires the existing scan to pass *unmodified*; it is untouched, including the `[role="progressbar"]` acceptance case. The diff's five deletions are the three regex lines (replaced by name-parameterised versions carrying the identical patterns), one docblock line and one comment line — nothing else was removed.
- **The `RUN_NUMBER_LITERAL` clause and `ASSEMBLED_FIXTURES`**, which round 2 made corpus-wide. The literal prohibition is unchanged and still has no exemptions.
- **Everything AC-1 to AC-5 and AC-7 shipped.** No production file changed this round, in either of the last two.
- **`contracts/Q-0015/mission-control.contract.md`** — `contracts/` is not among `developer-generalist`'s fourteen roots, the merged requirement says in as many words that **no criterion may name this file**, and it is GO-2, the human's at the gate. Unchanged and unnamed.
- **`docs/06-development-plan.md`** (Q-0094 E-3(a)) and **`docs/05-design-prompt.md`**.
- **`RUN_EVENT_RETENTION`'s value and `DEFAULT_RETENTION`** — AC-7 is honoured by not revisiting the figure.
- **`packages/core/src/engine/run-number.test.ts`**, which assembles the run-start narration from its own parts. It is in `packages/core`, the **producer** of that narration, and outside AC-6's corpus by the criterion's own words.
- **Iterations 1 and 2's reports.** They are in `backlog/`, which this role does not write; iteration 2's §1 description of `extractsFromMessage` is superseded by this document rather than edited.

---

## 6. Deviations a reviewer should weigh

1. **I added a clause the finding did not ask for.** The finding asked for the aliasing to be tracked or prohibited; I did that *and* added the blanket coercion clause. I think it is the more important of the two and I want it weighed rather than waved through: it is the half that makes AC-6's stated prohibition hold against evasions no text scan can follow, and it costs nothing today because the corpus contains zero coercions. If a reviewer reads it as scope beyond the finding, the argument for it is that AC-6's own words say *number*, and the aliasing half alone leaves the criterion resting on a residual with no floor.

2. **The coercion clause forbids something broader than this ticket's subject.** A future screen wanting `Number(...)` for an unrelated reason fails it. That is deliberate — it is measured at zero, the wire hands this app typed numbers, and a blanket rule with no exceptions is what round 1's finding preferred over a register — but it is a constraint on files this ticket does not own, so it is flagged rather than buried.

3. **The alias walk over-collects on purpose.** A binding that merely mentions a tainted name is treated as carrying it. That can report an innocent file and never miss a guilty one, which is the safe direction, and the corpus is green under it today — but it means a future edit could be reported for a rename that carries nothing, and the fix then is to read the message rather than to widen an exemption.

---

## 7. Verification

- `pnpm install --frozen-lockfile` → *"Already up to date"*, then `pnpm turbo run test --force --continue` — **7/7 tasks, 0 cached**, all green (`@quorum/cli` 26 files / 692 tests among them), 1m56s.
- `pnpm turbo run lint typecheck --force --continue` — **14/14 tasks, 0 cached**, 0 errors.
- `pnpm exec quorum lint` — **6/6**.
- `pnpm sweep:git-identity` — green: *"the workspace suite executed and green with no resolvable git identity"*, 7/7 tasks 0 cached.
- `apps/web/test/source.test.ts` alone — **45 passed**.
- The seven mutations in §2, each red with a discriminating message and each reverted; `git status` shows one modified file.

GO-3 (the product run by hand against a real daemon, with the transcript recorded), GO-4 (the truncated review's omitted tail read cross-vendor, with the ratio and file set per round) and GO-5 (both environment rows after the merge) are the operator's at the gate and are not claimed here.
