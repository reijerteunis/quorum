# Q-0126 — implement report, run 2, iteration 3

**Verdict: `proceed`. The one review finding is closed, in both directions, with real fixtures.**

Round 2's review returned a single major against `packages/cli/src/open.ts:160`: the blanket `catch`
turned **every** failure of `await import('@quorum/server')` into *"`@quorum/server` did not resolve
from this installation"*, including failures of a package that had resolved perfectly well. That is
the inference decision *"An optional edge says the daemon may be absent, and never why"*
(2026-09-14) clause 2 forbids, and it hides an actionable failure behind a packaging sentence. The
finding is correct and was not defensible; it is fixed rather than argued with.

---

## 0. What Node actually raises, measured before anything was written

The reviewer named three shapes. I measured four, in a plain `node` process against fixture
installations built for the purpose, rather than reasoning about them:

| how the load failed | `code` | `message` |
| --- | --- | --- |
| the package is not installed | `ERR_MODULE_NOT_FOUND` | `Cannot find package '@quorum/server' imported from …` |
| a dependency missing **inside** it | `ERR_MODULE_NOT_FOUND` | `Cannot find package 'hono' imported from …/@quorum/server/dist/index.js` |
| the module will not parse | *(none)* | `SyntaxError: Unexpected token '='` |
| it threw while loading | *(none)* | whatever was thrown |

**The measurement makes the review's point sharper than it was made.** Rows 1 and 2 carry the
*identical* code, so **narrowing on `code` alone would still have been wrong** — a missing transitive
dependency would have gone on being reported as an absent package. The error's own properties are
`stack`, `code` and `message` and nothing else, so there is no structured field naming the specifier
that failed.

What separates rows 1 and 2 is that **Node quotes the specifier it could not find and leaves the
importer's path beside it unquoted**. `'@quorum/server'` as a quoted needle matches row 1 and does
not match row 2, whose path segment is `/@quorum/server/`.

A fifth shape turned up and is reported rather than acted on — see §8.

---

## 1. The fix

`packages/cli/src/open.ts` gains one exported predicate and `daemon()`'s catch consults it:

```ts
export function isDaemonUnresolved(error: unknown): boolean {
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown };
  if (code !== 'ERR_MODULE_NOT_FOUND' || typeof message !== 'string') return false;
  return message.includes("'@quorum/server'");
}
```

```ts
} catch (error) {
  if (!isDaemonUnresolved(error)) throw error;
  return die(`${NO_DAEMON_CONDITION} — ${NO_DAEMON_REMEDY}`);
}
```

A rethrow reaches `main().catch(dieOnUnexpected)` and prints the stack, which is **`run.ts:216`'s own
shape for the same distinction** — that module renders a `FlowError` as one red sentence and rethrows
everything else for exactly this reason.

**Reading a message is what `isPortInUse` three lines up refuses to do, and the exception is stated
in place rather than left to be noticed.** There is nothing else to read, and what makes it safe is
the *direction* it fails in: a runtime that rewords that sentence stops matching, and an unrecognised
error **propagates as a stack** instead of being reported as an absence. A rewording costs the
refusal, never the truth of it — and `build.test.ts`'s packed fixture is what goes red the day one
arrives, because it asserts that refusal by bytes.

**`import.meta.resolve` was the alternative and was measured rather than dismissed.** Under Vitest it
is Vite's and honours `quorum-source` — it answers `packages/server/src/index.ts`, not `dist` — so it
is the *same* resolver the dynamic import uses in both environments, which was the objection I
expected to kill it. What ruled it out is the failure direction: it runs only on a path this
workspace can never take, so a runtime where `import.meta.resolve` were absent would have its
`TypeError` caught by the probe's own `try` and read as *the package is not here* — a false claim,
which is the one thing this predicate may not produce. The message clause fails the other way.

---

## 2. File by file

### `packages/cli/src/open.ts`

- `isDaemonUnresolved` added and exported, with its docblock carrying the measurement above and the
  bound on reading a message.
- `daemon()`'s `catch {` became `catch (error)` with the guard and the rethrow, and one line naming
  the authority — decision 094 clause 2 — rather than transcribing it.
- The module header gains one paragraph: the refusal is reached only where that package is what
  failed to resolve.
- One stale sentence corrected: `daemon()`'s docblock said the erasure means *"the emit carries
  exactly one occurrence of the specifier"*. It never did — `NO_DAEMON_CONDITION` carries it too —
  and my needle makes a third. It now says what is true and load-bearing: the only occurrence the
  emit *loads* anything for is inside that call.

### `packages/cli/src/open.test.ts`

- `daemonImportFailure(entry)` — builds a fixture installation under the per-test sandbox and runs a
  plain `node` process rooted at it, returning the real `{ code, message }`. Spawned rather than
  imported **because what the predicate must recognise is Node's error**: an import performed under
  Vitest goes through Vite and fails in a different shape. `build.test.ts` and `package.test.ts` each
  keep a plain-process probe for the same reason, and the header's *"nothing here spawns the binary"*
  stays true — this is not the binary.
- Two tests. The first drives all four real failures through the shipped predicate and asserts the
  three resolved-then-failed shapes are **not** reported as unresolved. It also pins
  `transitive.code === absent.code`, so if Node ever stops sharing the code this says so rather than
  the message clause quietly becoming decoration. The second covers both clauses separately, over
  values that are not `Error`s at all — `dieOnUnexpected` is handed whatever was thrown.
- An anti-vacuity clause: a fixture that **loads** makes the helper throw, so four probes that
  silently succeeded could not read as agreement.

### `packages/cli/src/frame.source.test.ts`

One clause, placed here rather than in `open.test.ts` because `codeOf` lives here and duplicating it
would be a third copy of a helper: the catch binds its error and consults the predicate, and a bare
`catch {` — which cannot have looked at what it caught — fails. Structural for the reason the AC-4
ordering clause already is: **in this workspace `@quorum/server` always resolves, so no fixture here
can drive that branch.** Read through `codeOf`, because the module's own docblock explains the
distinction and a raw-text scan would be satisfied by the explanation — the trap this ticket has now
met four times.

### `packages/cli/src/build.test.ts`

- **The behavioural half, inside the packed fixture**, which is the only place a daemon can be both
  installed and broken. After the absent-package refusal, a resolvable `@quorum/server` whose entry
  imports a package that is not there is written into the packed project, `quorum open` is run
  through the installed shim, and the assertions are that the packaging refusal is **not** what comes
  out and that the real cause **is**. The fixture is removed again so the `quorum init` assertions
  below it meet the installation the fixture installed.
- **The sharp case rather than an easy one**: a missing transitive dependency is row 2, the one that
  shares a code with row 1, so a code-only narrowing would still fail here.
- AC-8's comment corrected — it said `open.ts` names the specifier *"twice in source"*, which was
  already false and is now further so.

---

## 3. GO-6 — five mutations, one at a time, each red with its own message

None was shown red by a neighbour (Q-0107). Each was reverted immediately.

| Mutation | Red, and how |
| --- | --- |
| predicate drops the message clause (code only) | *"a dependency missing from inside the daemon is reported as a daemon that did not resolve"* — **the review's own case**, plus the second test |
| predicate drops the code clause (message only) | *"the specifier without the code was read as a daemon that did not resolve"* |
| `catch (error)` back to `catch {` | *"the catch no longer asks whether it was this package that failed to resolve"* |
| the same, against the packed fixture | *"a daemon that resolved and then failed is reported as one that did not resolve"* — the defect reproduced end to end through the emitted command |
| rethrow replaced by a fresh `Error` | *"the failure a maintainer has to act on was swallowed"* — which is what establishes the second packed assertion independently of the first |

The two clauses of the predicate fail in different tests, which is what says neither is the other
written twice: with the code clause gone the four real shapes are still discriminated, and what
breaks is a thrown *string* naming the package.

---

## 4. Verification

- `pnpm install --frozen-lockfile` clean. `pnpm turbo run test lint typecheck --force --continue`
  → **21/21 tasks, 0 cached, 0 errors**; `@quorum/cli` 26 files / 677 tests passed.
- `pnpm turbo run build --force` → **5/5, 0 cached** in 4.1 s.
- **The emit was exercised directly**: `pnpm exec node packages/cli/dist/quorum.js open --port later`
  → exit 1, `✗ --port takes a number from 0 to 65535, and was given "later"` — so the built command
  still resolves the daemon and gets past it.
- `pnpm exec quorum lint` → 6/6.
- `pnpm sweep:git-identity` → *"the workspace suite executed and green with no resolvable git
  identity"*, 7/7 forced 0 cached.

---

## 5. What I deliberately left alone

- **AC-1 to AC-16 are otherwise untouched.** Round 1 landed AC-1 to AC-11 and round 2 AC-12 to
  AC-16; this round changes one branch of one function and the tests for it. Nothing in the launcher,
  the port, the lifecycle, the manifest or the documents moved.
- **No new seam.** `openOn({ bundle, launcher })` did not gain a third parameter for an injectable
  loader. The packed fixture drives the real thing end to end, which is stronger than an injection,
  and a production parameter that exists only to be stubbed is what non-goal 6's reasoning refuses.
- **`DISTRIBUTION`, `files`, `private`, `bin` and `ServeOptions` are unchanged** — non-goal 3 and
  §0.1's single exception, both already landed.

---

## 6. The class, not the instance

The review named one site, and this repository's most-recorded failure is repairing that site alone.
I checked the two production modules this ticket added for the same shape: **`open.ts` and
`browser/browser.ts` now contain no blanket `catch` at all.** `browser.ts` was already narrow by
construction — `ENOENT` alone is the observation and everything else is the *could not tell* member —
and `open.ts`'s two other catches each look at what they caught (`projectAt` rethrows a non
`ProjectNotFoundError`; the `createDaemon` catch tells `EADDRINUSE` from the library's own refusal by
`code` and renders the message verbatim without composing a cause). The `frame.source.test.ts` clause
added above forbids a bare `catch {` returning in `open.ts` from here on.

---

## 7. Reported and not fixed

- **`ERR_PACKAGE_PATH_NOT_EXPORTED` is a fifth shape the probe turned up**, and it is a genuine
  failure to resolve the requested package — a `@quorum/server` present with an `exports` map that
  refuses its root. `isDaemonUnresolved` does not recognise it, so it propagates as a stack rather
  than as the refusal. Stated rather than widened: it cannot arise from this ticket's packaging shape
  (npm skipping an optional edge leaves no directory at all), it makes no false claim, and adding a
  second code and a second message shape with no fixture exercising it is the unmeasured move this
  round exists to avoid.
- **`harness/architecture.md:25` and `harness/product-context.md:80` still say "four packages emit"**,
  stale since Q-0125 made `@quorum/server` the fifth; `docs/04-architecture.md` says five. Rounds 1
  and 2 both reported and left it, for the reason that stands: it is Q-0125's claim with its own
  sixteen register sites, and moving one of two makes the drift worse.
- **`packages/core/src/backlog/backlog.ts:330`** — unused `eslint-disable` directive. Pre-existing,
  in a file this change does not touch, 0 lint errors.
