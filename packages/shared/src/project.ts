// `harness/harness.yaml` — the project config, declared once here and validated nowhere.
//
// DECLARED BUT NOT CALLED, and that is the point. Q-0010's CLI and M3's server both need this
// shape without importing `core`, and this package already ships `flowSchema` and `roleSchema`
// ahead of their consumers. What it must NOT do is start policing the file: `loadProject` today
// accepts any YAML at all and every consumer supplies its own fallback (`?? 'main'`, `?? 200000`,
// `?? 'npm test'`), so rejecting a config that loads today would change what a command prints and
// its exit code. Validation is its own decision, taken by whoever wants the behaviour, and not
// smuggled in with a port. Q-0043 AC-11.
//
// EVERY KEY IS OPTIONAL and unknown keys are preserved, for the reason "Unknown keys are refused
// where Quorum owns the key set, and preserved where it does not" (docs/DECISIONS.md, 2026-08-25)
// gives: this file belongs to the user, not to Quorum. An adopter annotating their own config with
// a key we have never heard of is not committing an error, and a parse-then-write path that
// stripped it would be silent data loss.
//
// NO FIELD CARRIES A ZOD DEFAULT OR A SWALLOWED PARSE FAILURE. A default here would hand a later
// child a value the file did not contain, in the package thirteen tickets import, and no test
// would fail (harness/rules.md; "Zod describes structure and types", docs/DECISIONS.md
// 2026-08-25). The spike's fallbacks stay at their reading sites, where they are visible.
//
// The keys below are exactly the ones the spike READS. Three of them are read by nothing and are
// typed anyway, because typing a key is not the same as enforcing it: `budget.per_run_usd`,
// `budget.per_ticket_usd` and `backlog.layout` remain unenforced after this ticket, which is what
// "Budget caps are specified but not yet enforced" already says.
import { z } from 'zod';

/**
 * Per-adapter retry policy — `adapters.<vendor>.retry` (spike/src/adapters/index.js:31, :68).
 *
 * The key names are CAMEL CASE because that is what `withRetry` destructures. Both shipped
 * `harness.yaml` files show `base_delay_ms` in a commented example instead, which nothing reads;
 * that mismatch is reported rather than repaired, since correcting either side is a behaviour
 * change this ticket is not authorised to make.
 */
const retryPolicySchema = z.object({
  attempts: z.number().optional(),
  baseDelayMs: z.number().optional(),
  maxDelayMs: z.number().optional(),
}).passthrough();

/**
 * One adapter's entry. `bin` is the executable name the adapter spawns
 * (spike/src/adapters/claude.js:6, codex.js:6) and `extraArgs` is appended to its argv
 * (claude.js:28, codex.js:48). The map is keyed by adapter name as an OPEN string: a contributor's
 * `gemini` adapter must not need this package edited before its config can be typed, and an
 * unknown name is already refused with a good message by `getAdapter`
 * (spike/src/adapters/index.js:29).
 */
const adapterConfigSchema = z.object({
  bin: z.string().optional(),
  extraArgs: z.array(z.string()).optional(),
  retry: retryPolicySchema.optional(),
}).passthrough();

export const projectConfigSchema = z.object({
  /**
   * `path` is resolved against the repository root to give the backlog root
   * (spike/bin/harness.js:57). `layout` is `in-repo` or `central` in every shipped file and is read
   * by nothing, so it is typed as an open string rather than an enum — an enum here would be this
   * package adding a rule no other code has.
   */
  backlog: z.object({
    path: z.string().optional(),
    layout: z.string().optional(),
  }).passthrough().optional(),
  adapters: z.record(z.string(), adapterConfigSchema).optional(),
  /**
   * `base_branch` is what a run syncs and compares against, defaulted at every reading site to
   * `DEFAULT_BASE_BRANCH`; `max_diff_bytes` caps a materialised review diff.
   */
  repo: z.object({
    base_branch: z.string().optional(),
    max_diff_bytes: z.number().optional(),
  }).passthrough().optional(),
  /**
   * What `integrate` and `type: script` steps run. `install` goes first in a fresh worktree, `test`
   * is what `green` means, and `timeout_ms` kills a suite that never finishes — an orchestrator
   * that can wait forever cannot run unattended.
   */
  commands: z.object({
    install: z.string().optional(),
    test: z.string().optional(),
    timeout_ms: z.number().optional(),
  }).passthrough().optional(),
  /** Specified, and read by nothing. A cap that only describes is not a cap; see Q-0038. */
  budget: z.object({
    per_run_usd: z.number().optional(),
    per_ticket_usd: z.number().optional(),
  }).passthrough().optional(),
}).passthrough();

export type ProjectConfig = z.infer<typeof projectConfigSchema>;
