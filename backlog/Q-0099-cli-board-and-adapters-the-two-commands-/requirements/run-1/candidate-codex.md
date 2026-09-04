# Q-0099 — CLI board and adapters, the two commands that always exit 0

## Problem

The CLI frame now implements the other six commands, but `board` and `adapters` remain absent. A maintainer cannot inspect tickets by stage or see whether the supported adapter CLIs and their subscription logins are usable through the workspace CLI.

This ticket ports only the presentation behavior of those two read-only commands from `spike/bin/harness.js`. The domain operations already live in `@quorum/core`; the CLI must compose and render them without duplicating git, backlog, flow-lint, or adapter logic.

Both commands deliberately retain the spike’s exit behavior: they return without setting a failure status and therefore exit 0, including when both adapter checks fail. Known defects remain visible and are not fixed in passing.

Surface: CLI (`quorum`) only. The commands read project files and git state but persist nothing.

### Preconditions

- Q-0091 is `reviewed`. It supplied the command-module layout, guard migrations, core barrel exports, and `binaryCarriedBy` register field required here.
- The branch `harness/Q-0099/integration` must exist before the first chore run. It was not present when these requirements were written. Under `docs/02-sdlc-pipeline-spec.md` §5.8, preflight must refuse before billing if it remains absent.
- Q-0099 must not run concurrently with Q-0091. Q-0039 remains unresolved, so concurrent runs on one ticket can share a worktree and calculate the same run id.
- If implementation proves a contradiction that it is not authorized to resolve, the implementer must write an erratum during the loop. Q-0083 does not currently exist, and a refused finding is a gate rather than another implementation round.

## User story

### Maintainer

As a solo maintainer, I want `quorum board` to show tickets by stage, their recorded cost and iterations, and their current containment state so that I can compare the backlog state with the available git evidence from one read-only command.

### Adopter

As a cold-clone adopter, I want `quorum adapters` to report whether the Claude and Codex CLIs are present and, when I explicitly request it, whether their existing subscription logins answer a probe, without asking me for an API key or changing my project.

### Contributor

As an adapter contributor, I want adapter status rendering to consume the common core adapter interface and continue after one adapter fails so that CLI behavior does not acquire vendor-specific logic and each adapter result remains independently visible.

## Acceptance criteria

1. **The CLI frame registers both commands.**

   `COMMANDS`, `HELP`, and the exhaustive `Readonly<Record<Command, CommandHandler>>` dispatch table register `board` and `adapters`. Help retains the spike command ordering and describes the commands in Quorum vocabulary. The `adapters` help line includes `[--probe] [--json]` and describes subscription login; new help text does not use “API key.” Adding either name without its handler, or its handler without the name, remains a compile-time error. Tests fail against the Q-0091 command set and pin both help lines.

2. **`quorum board` renders ordered stage columns and deterministic flow hints.**

   The command iterates every value in `@quorum/shared`’s `STAGES` order. A heading is the bold stage name padded to 14 characters. Empty columns are omitted except `draft`, `requirements`, and `solutioned`, which always render. If a successfully loaded flow consumes the stage, the heading appends the dim hint `→ harness run <flow> <id>` verbatim; Q-0100 owns that legacy binary name.

   The command obtains flows by calling `lintFlowDirectory(path.join(harnessDir, 'flows'))` and retaining records with a `flow`. It does not reproduce the spike’s `readdirSync`, `loadFlow`, and `catch` sequence. Because `lintFlowDirectory` sorts filenames, `chore` supplies the `requirements` hint when the six shipped flows are used, even though `solutioning` consumes the same stage. If `flows/` is absent, the command treats the flow set as empty, renders the board, and exits 0 rather than exposing a raw `ENOENT`.

   Tests cover a fixture with tickets in two stages, the always-visible empty columns, omitted optional empty columns, the shipped-flow `requirements` hint with an assertion explaining why `chore` wins, and a project with no `flows/` directory.

3. **Every board ticket row preserves the spike’s byte-level format.**

   Each row has this structure, including spaces and ANSI spans:

   ```text
     <teal id> <title>  <dim>owner=<owner> cost=$<n.nn> iter=<json><containment-token></dim>
   ```

   `cost` is the sum of `history[].cost`, treating an absent row cost as zero, formatted to two decimal places. `iter` is `JSON.stringify(meta.iterations ?? {})`. The containment token defined by AC-4, when present, remains inside the same dim span.

   Tests assert a complete zero-cost row with empty history and iterations, plus a fixture whose iterations include `review: 2` and whose appended history rows total `$1.25`. The latter retains the inherited ANSI-stripped assertions `/iter=.*review.*2/` and `/cost=\$1\.25/`.

4. **Board containment uses the glossary’s three-state vocabulary and passes untrusted branch names only through core.**

   The base branch is read from `config.repo.base_branch` and defaults to `main` only at that read site. A configured value is never replaced. The CLI calls core’s `containment(repoDir, base)` and passes each ticket branch to the returned core interface; it constructs no git arguments.

   At most one of these tokens is appended to a row:

   - ` <base>:contained`
   - ` <base>:not-contained(+<n>)`
   - ` <base>:indeterminate(<reason>)`

   The board uses “contained” and never substitutes “merged,” “landed,” or “shipped.” `not-contained(+<n>)` reports commits in `base..branch`, not the symmetric difference. A `no branch` result renders only for `solutioned`, `red`, `green`, `reviewed`, `qa-passed`, and `deployed`. It is suppressed for `draft`, `requirements`, `blocked`, `abandoned`, and whenever core returns `null`.

   Tests translate scenarios C1–C10 from `spike/test/q0036-board-containment.js`: contained; not contained with two commits ahead; the ten-stage suppression sweep; an absent `branch` key; a missing base ref; a genuinely shallow clone; a non-git project; a project configured with `master` where `main` appears nowhere in output; a branch value beginning `--upload-pack=` that creates no file and adds no git option; and a tag sharing the branch name. Missing refs and shallow evidence must assert the expected indeterminate reason rather than merely assert the absence of `contained`.

5. **Each board legend appears only when a rendered result earns it.**

   If any listed ticket has a non-empty `history`, the command prints exactly this dim legend once:

   ```text
   · cost = billed cost where the vendor reports one; steps on token-only vendors (codex) are not included
   ```

   If any rendered row has an indeterminate containment result, the command prints one dim legend after the columns. It names all four reasons—`missing ref`, `shallow clone`, `a failed git command`, and `no branch`—and states that indeterminate does not mean the code is missing. An indeterminate result suppressed under AC-4 does not earn the legend.

   Tests cover history absent and present, suppressed-only indeterminate results, and a rendered indeterminate result. The latter retains C4’s assertion that `output.split('git could not answer').length - 1 === 1`.

6. **`quorum adapters` reports presence, optional probes, and the requested combined JSON report.**

   The command processes `claude` and then `codex`, using `getAdapter(name, config.adapters)`. A successful `check()` prints `✓ <name>: <version>`. A thrown check prints `✗ <name>: <message>`, appends `{ adapter, installed: false, error }`, and continues to the next adapter.

   Without `--probe`, the command never calls `probeAdapter`, records each successful check with `login: 'unverified'`, and prints the dim presence-only notice verbatim from the spike, including its legacy `harness adapters --probe` command owned by Q-0100.

   With `--probe`, each adapter whose check succeeded is passed to `probeAdapter(adapter, { cwd: repoDir })`, where `repoDir` is the resolved project repository directory. A successful probe prints an indented second line containing `✓ login verified — round-trip <ms>ms`; it appends `, $<cost>` formatted to four decimal places only when `cost_usd` is non-null, and appends `, <n> tokens` only when `tokens` is truthy. A failed probe prints the indented `✗ login not usable: <error>` form. The report records the probe result and sets `login` to `verified` or `failed`.

   With `--json`, the command prints `JSON.stringify({ probed, adapters }, null, 2)` after all human-readable lines. This is deliberately a combined human-and-JSON stream, not JSON-only output. With both flags, probes run and the final JSON reports `probed: true`.

   Tests use stubbed `getAdapter` and `probeAdapter`; no vendor CLI or account is required. They cover presence, absence, continuation after failure, probe success, probe failure, `cost_usd: null`, `tokens: 0`, `--json`, and both flags together.

7. **BYOS remains enforced by core, and three known defects remain observable.**

   No file under `packages/cli` may match any pattern in `frame.source.test.ts`’s `CREDENTIAL` list. The CLI introduces no subscription secret input, storage, or forwarding path. Adapter `check()` remains the refusal authority, and the CLI renders a thrown message verbatim. A test stubs `check()` with an opaque sentence and proves that the identical sentence reaches the terminal without embedding a key-shaped value in the test.

   The existing refusal text `Harness runs on subscription OAuth only` also reaches the terminal unchanged. Q-0068 owns its product-name defect; this ticket does not rewrite it.

   When both checks fail, `quorum adapters` prints both failures, completes the loop, and exits 0. The test name and its one-line authority comment state that this zero status is preserved and name the successor responsible for changing it.

   Q-0066’s null-usage defect also remains: if core’s probe path returns the existing `Cannot read properties of null` failure, the CLI renders `✗ login not usable: Cannot read properties of null`. This ticket neither intercepts nor repairs the core defect.

8. **Both commands are read-only, and all four port registers move in the same change.**

   `main.test.ts` adds a real `board` invocation and an `adapters` invocation backed by a stubbed adapter registry to its read-only invocation set. For each, a tracked project-tree snapshot before and after `main()` is byte-identical.

   The per-module domain-symbol map adds `board.ts` and `adapters.ts` with only the core/shared symbols each command is allowed to use. The `node:path` admission list includes both modules. Existing terminal, process-exit, direct-git, and credential scans remain green.

   `packages/core/src/spike-parity.test.ts` updates `q0036-board-containment.js` using Q-0091’s `binaryCarriedBy` field to name the new CLI board test, because this ticket carries that file’s entire 220-line binary half. It does not add a fourth verdict. The `q0033-surface.js` row records the translated board assertion where required by the inherited schema. No register entry is moved for `adapters`: outside Q-0095-owned `smoke.js`, no spike test exercises that command, and the register text states this rather than implying inherited coverage.

   The register’s measurements are recalculated from the changed tree rather than arithmetically adjusted. The test shows the four pinned totals unchanged at `220 / 2739 / 2469 / 5428` and the port percentage at `55%`.

## Non-goals

- Implementing or changing `lint` and `validate`; Q-0091 owns them.
- Implementing or changing `runs`; Q-0092 owns it.
- Implementing or changing `init` and `ticket`; Q-0093 owns them.
- Implementing or changing `run` or the gate reader; Q-0094 owns them.
- Changing the three user-facing sentences that name a binary called `harness`, including the board hint and adapters presence notice; Q-0100 owns them.
- Correcting the BYOS refusal’s product name; Q-0068 owns it.
- Correcting the null-usage probe failure; Q-0066 owns it.
- Changing the successful exit status when adapter checks fail. This ticket preserves the spike behavior and registers it for a successor.
- Adding another adapter, including Gemini.
- Adding a daemon, Studio surface, remote state, cloud sync, plugin marketplace, or visual canvas.
- Changing a flow, ticket, adapter, or project file format.
- Persisting containment or adapter status. Both are calculated for the current invocation only.
- Adding a new dependency.
- Modifying any file under `spike/src/` or editing/deleting any file under `spike/test/`.
- Claiming registry-resolved `npx quorum` works. Only workspace-local and locally packed installation paths are currently supported.

## Open questions

1. **Which successor owns changing `adapters` to a non-zero status when all checks fail?** Owner: head of product. This does not block implementation because AC-7 explicitly preserves exit 0, but the required test comment cannot “name the successor” until an id exists or the requirement is amended to permit a descriptive successor reference.

2. **Who creates `harness/Q-0099/integration`, and when?** Owner: maintainer. This blocks the first chore run, not requirements completion or local inspection. Preflight must refuse without billing until the branch exists.

3. **Does the inherited parity-register schema require changing `q0033-surface.js`, or only `q0036-board-containment.js`?** Owner: implementer, verified against Q-0091’s landed audit rules. AC-8 requires the board assertion to be recorded wherever that schema assigns it, but prohibits inventing an adapters entry. If the landed schema contradicts those instructions, stop and issue an erratum rather than weakening the audit.

## Risks

- **Fixture construction can accidentally depend on commands outside scope.** The original containment suite creates projects through `init` and `ticket new`, but those are Q-0093’s surface. Board fixtures must write `harness/harness.yaml` directly and create tickets with `Backlog.create()` from `@quorum/core`, preserving product-generated frontmatter without making Q-0099 depend on another CLI command.
- **Git fixtures can become machine-dependent.** Commit-producing tests must set their own identity and all configuration they rely on. A shallow-clone test must construct genuine shallow history rather than use the developer’s checkout as its oracle.
- **Missing evidence can be misreported as a negative fact.** A missing base ref or shallow clone must remain indeterminate. Reporting either as not contained would defeat the three-state containment vocabulary.
- **Untrusted branch names can become git options.** The CLI must never construct a git command. The `--upload-pack=` and tag-collision scenarios guard the core boundary from the presentation layer.
- **Flow ordering could regress.** The deterministic `chore` hint depends on retaining `lintFlowDirectory`’s sorted records. Reintroducing a direct directory read restores latent platform-dependent output.
- **Adapter tests can accidentally depend on installed vendor software or a developer account.** All CLI-level adapter cases must use stubs. Real adapter behavior belongs to core and the mock-adapter end-to-end suite.
- **Human-readable output followed by JSON may surprise automation.** This is intentional spike parity. Consumers must not treat `--json` as a JSON-only stream until a separately authorized change defines that contract.
- **The packed-install path could regress even though these commands are tested in-process.** Existing Q-0098 packed-install coverage must remain green; this ticket does not add a new packed fixture.

## Cross-cutting checklist

| Concern | Requirement |
| --- | --- |
| BYOS | Applies. AC-7 prohibits a secret path and preserves core’s subscription refusal verbatim. |
| Worktree safety | Applies as read-only safety. AC-8 requires byte-identical project trees; neither command starts a flow or creates a worktree. |
| Gate behavior | N/A to command behavior. No gate is opened or bypassed. The integration-branch preflight remains a prerequisite for the chore run. |
| Files and schemas | No persistent format or schema changes. The parity test’s TypeScript register is extended using Q-0091’s existing `binaryCarriedBy` field. |
| Cross-vendor rule | N/A. Neither command authors, reviews, judges, or executes a flow step. |
| Product-agnostic behavior | Applies. `claude` and `codex` are the two supported coding-agent adapters, not SaaS project integrations; vendor-specific execution remains below the adapter interface. |
| Lint and source guards | Applies. AC-8 extends the module-symbol and `node:path` registers; all credential, terminal, process-exit, and direct-git guards remain green. |
| Cold-clone impact | No additional installation step or dependency. `adapters` gives an adopter a presence check and optional explicit probe; tests do not require either vendor CLI. |
| Error handling | Applies. Per-adapter errors are rendered verbatim and do not stop the loop. Both commands preserve exit 0. |

## Ground rules — Q-0010’s, repeated because a child cannot read its parent

1. **Do not modify `spike/src/`.** The spike stays authoritative and green until cutover; a witness that has been edited is not one. Q-0010’s children are not in `harness/port-charter.md`’s `children:` list, so the branch-scope job reports them out of scope rather than failing them — the rule is this body’s, not the guard’s. If a change there is genuinely required, stop and say so; it takes §3’s mirror-and-re-record path and is a decision, not a step.
2. **The spike’s own tests are not deleted or edited to make room.** A child *adds* coverage under `packages/cli`; `spike/test/**` keeps working until the cutover deletes it wholesale.
3. **Behaviour is preserved, and a known defect is reported rather than fixed in passing.** Q-0059’s traversing `dirOf`, Q-0060’s silent frontmatter, Q-0066’s probe crash and Q-0068’s product name in the BYOS refusal are open tickets landing in both trees; do not close one here. **Q-0100** now carries the three user-facing sentences that name a binary called `harness`, including the board’s own hint — preserve them verbatim.
4. **`packages/core` already holds the logic.** `containment`, `lintDirectory`, `lintFlowDirectory`, `getAdapter` and `probeAdapter` are all exported from `packages/core/src/index.ts`. If something appears to need porting, look there first and say so if it is genuinely absent; the CLI is a presentation layer over an API that exists.
5. **`packages/core/src/spike-parity.test.ts` is updated in the same change**, with its line totals **re-derived rather than adjusted**. Use the `binaryCarriedBy` field Q-0091 added; do not add a fourth verdict.

## Verification

Before claiming the implementation is complete, install the locked dependencies in the fresh worktree and run both independent suites:

```text
pnpm install --frozen-lockfile
npm install --prefix spike --no-audit --no-fund
npm test --prefix spike
pnpm turbo run test --force
```

A suite that was not installed and run must be reported as unrun, not green.
