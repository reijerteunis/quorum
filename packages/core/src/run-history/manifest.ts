/**
 * What a run manifest is, and the arithmetic over it.
 *
 * The format is frozen: `contracts/Q-0011/run-manifest.schema.json` closes all four of its levels
 * with `additionalProperties: false`, so the shapes below are a transcription of a document rather
 * than a design. `JSON.stringify` does not warn about a sixteenth key, which is why the bookkeeping
 * this module needs lives in a side table in the writer and never on an occurrence.
 *
 * Nothing here touches the filesystem, and nothing here renders: the roll-up is an accumulator over
 * persisted numbers, and the one place a null cost could become `$0.000` is a formatter, which is
 * the command line's until Q-0010. This module may not import `../contracts/run-manifest.js`
 * either — that pass recomputes the roll-up as a group-then-sum where {@link rollup} accumulates,
 * and their disagreement is the whole signal.
 *
 * Why: behaviour preserved from spike/src/engine.js:452-494 and :523-530 — see
 * `harness/port-charter.md` §2, Q-0049.
 */
import { USAGE_MEASURES } from '@quorum/shared';
import type { UsageMeasure } from '@quorum/shared';

import { authError, transientError } from '../adapters/adapters.js';

/**
 * The eight values the schema's run-level `status` enum admits.
 *
 * Seven of them are terminal and one is not, which is the only distinction any caller draws.
 * `exhausted` is legal and the engine never writes it: exhaustion is recorded as a ticket-history
 * event and the run continues to a gate, ending later with its actual outcome. That is a note about
 * the caller and not a restriction here — the writer's `finalise` writes whichever it is given.
 *
 * One union serves both levels, and since Q-0040 the two levels no longer admit the same set:
 * `undecided` is a run's conclusion about itself and never a step's, because a gate allocates no
 * occurrence and nothing one level down can be undecided. What refuses it there is the schema's
 * separate occurrence enum and the guard over it, not this type.
 */
export type RunStatus = 'running' | 'completed' | 'failed' | 'aborted' | 'regressed' | 'exhausted' | 'interrupted' | 'undecided';

/**
 * What an occurrence was: an adapter call, a script step, or an integrate step.
 *
 * Nothing else allocates one. A gate and a fan-out parent schedule work rather than perform it, so
 * neither appears in `steps` at all.
 */
export type OccurrenceKind = 'adapter' | 'script' | 'integrate';

/**
 * The eight categories the schema admits, of which {@link errorOf} produces three.
 *
 * The other five are written by callers this module does not own — a script failure, an integrate
 * failure, invalid structured output, a signal, and the fallback — so the type admits all eight and
 * none of those callers needs a widening cast to record one.
 */
export type ErrorCategory =
  | 'auth' | 'transient' | 'structured_output' | 'adapter'
  | 'script' | 'integrate' | 'interrupted' | 'unknown';

/** Why an occurrence ended badly, as the manifest carries it. */
export interface RunError {
  /** The classification a reader groups by. */
  category: ErrorCategory;
  /** One sentence, never empty — the schema requires `minLength: 1`. */
  message: string;
}

/**
 * The five measures as a manifest carries them: a number, or `null` for "the vendor did not report
 * this", which is not zero (the tokens-only decision, `docs/DECISIONS.md` 2026-08-22).
 *
 * Keyed by `USAGE_MEASURES` rather than by five more string literals — the constant exists because
 * the spike spells them twice and a roll-up drifts on the second copy.
 */
type Measures = { [Measure in UsageMeasure]: number | null };

/** What one occurrence was billed, and to whom. */
export interface OccurrenceUsage extends Measures {
  /**
   * The vendor the call was billed to, exactly as the adapter declared it. Required, and
   * `minLength: 1` in the schema — which is why {@link normaliseUsage} takes a fallback that
   * cannot be omitted.
   */
  vendor: string;
}

/** One vendor's row of the roll-up. The shape the semantic pass recomputes independently. */
export interface VendorRollup extends Measures {
  /** The grouping key: the exact `usage.vendor` string, never normalised or mapped. */
  vendor: string;
  /** How many occurrences carrying usage were included. Never zero — a row without one is absent. */
  step_count: number;
  /** How many of those had `cost_usd: null`, so a total can say how much of itself it cannot see. */
  unpriced_steps: number;
}

/** One entry in the manifest's record of what actually executed. Exactly fifteen keys, always. */
export interface Occurrence {
  /** The flow step's id, interpolated — `dev:T1` for a fan-out task. */
  step_id: string;
  /** `steps/NNN-<sanitised step id>`, relative to the run directory. */
  occurrence_dir: string;
  /** What performed the work. */
  kind: OccurrenceKind;
  /** The role the step ran as, where it named one. */
  role: string | null;
  /** The adapter that ran it. Non-null exactly when `kind` is `adapter`. */
  adapter: string | null;
  /** The model the step pinned, where it pinned one. */
  model: string | null;
  /** The branch the work was performed on. */
  branch: string | null;
  /** The working directory, relative to the repository — `null` when it is the repository root. */
  worktree: string | null;
  /** When the occurrence was allocated, as an ISO 8601 instant in UTC. */
  started_at: string;
  /** How long it ran. `null` until it terminates, and never negative. */
  duration_ms: number | null;
  /** Adapter invocations including retries; `0` for a script or an integrate step. */
  attempts: number;
  /** `running` until it terminates, then whichever terminal status it was given. */
  status: RunStatus;
  /** The verdict a structured output declared, where it declared one. */
  verdict: string | null;
  /** Why it failed, or `null`. */
  error: RunError | null;
  /** What it was billed, or `null` — which is what keeps it out of the roll-up entirely. */
  usage: OccurrenceUsage | null;
}

/** One run, as `manifest.json` holds it. Exactly thirteen keys, in the schema's own order. */
export interface RunManifest {
  /** The format version. `1` is the only value the frozen schema admits. */
  schema_version: 1;
  /** `<ticket id>-<run number>`, which is also the run directory's name. */
  run_id: string;
  /** The ticket this run was for. */
  ticket_id: string;
  /** The ticket file, relative to the repository. Never absolute, and never an environment value. */
  ticket_path: string;
  /** The flow's `name`. */
  flow: string;
  /** The flow file, relative to the repository. */
  flow_file: string;
  /** Where the ticket stood, and where the run left it — `after` is `null` until it finalises. */
  stage: { before: string; after: string | null };
  /** When the run started, as an ISO 8601 instant in UTC. */
  started_at: string;
  /** When it ended, or `null` while it is running or if it was killed outright. */
  ended_at: string | null;
  /** `ended_at - started_at` exactly, from the same clock reading, or `null`. */
  duration_ms: number | null;
  /** `running` until it finalises. A `running` manifest is reported as it stands, never repaired. */
  status: RunStatus;
  /** Every occurrence, in allocation order. */
  steps: Occurrence[];
  /** One row per vendor that reported usage, recomputed in full on every terminal occurrence. */
  rollup: VendorRollup[];
}

/** The five measures off whatever reported them, each absent value becoming an explicit `null`. */
const measuresOf = (source: Partial<Measures>): Measures =>
  Object.fromEntries(USAGE_MEASURES.map((measure) => [measure, source[measure] ?? null])) as Measures;

/** One property off whatever was thrown, or `undefined` when it carried none. */
const errorProperty = (error: unknown, key: 'message'): unknown =>
  typeof error === 'object' && error !== null && key in error
    ? (error as Record<string, unknown>)[key]
    : undefined;

/**
 * An adapter's report as the manifest wants it: the vendor resolved, and every measure explicit.
 *
 * It invents no measure and drops none. A falsy report — an adapter that billed nothing — stays
 * `null` rather than becoming a row of zeros, which is what keeps it out of the roll-up.
 *
 * @param usage what the call reported, if anything.
 * @param fallbackVendor the vendor to bill when the call itself declared none. Required and
 *   non-optional: `vendor` is a required key with `minLength: 1`, and an absent fallback would
 *   leave it `undefined`, which `JSON.stringify` drops — a manifest silently losing a required
 *   field. Preserved behaviour is that every caller supplies one; this makes it a type obligation.
 */
export function normaliseUsage(usage: Partial<OccurrenceUsage> | null | undefined, fallbackVendor: string): OccurrenceUsage | null {
  if (!usage) return null;
  return { vendor: usage.vendor ?? fallbackVendor, ...measuresOf(usage) };
}

/**
 * The per-vendor roll-up, accumulated over every occurrence that carries usage.
 *
 * Two properties are the whole of it, and both are one plausible simplification away from being
 * lost. **Status is never consulted**: a failed occurrence that was billed is in the roll-up, and
 * filtering on status instead of on the presence of usage is the defect that once hid $4.54 of a
 * $10.25 run — failure is when the number matters most. And a measure nobody reported stays `null`
 * rather than accumulating from `0`, so a wholly token-only vendor's row has `cost_usd: null` and
 * `unpriced_steps === step_count`, while a genuinely reported `0` stays `0`.
 *
 * No cross-vendor total is produced here or anywhere: one blended number is fiction the moment a
 * vendor that reports no price is in the mix.
 *
 * @param steps every occurrence of the run, in any state.
 * @returns one row per vendor, in first-appearance order.
 */
export function rollup(steps: readonly Occurrence[]): VendorRollup[] {
  const rows = new Map<string, VendorRollup>();
  for (const { usage } of steps) {
    if (!usage) continue;
    const row = rows.get(usage.vendor) ?? { vendor: usage.vendor, step_count: 0, unpriced_steps: 0, ...measuresOf({}) };
    row.step_count += 1;
    if (usage.cost_usd == null) row.unpriced_steps += 1;
    for (const measure of USAGE_MEASURES) {
      const reported = usage[measure];
      if (reported != null) row[measure] = (row[measure] ?? 0) + reported;
    }
    rows.set(usage.vendor, row);
  }
  return [...rows.values()];
}

/**
 * The wording the contract layer produces once it has rewritten a vendor's auth noise into one
 * actionable sentence — which its own patterns no longer match, so both forms have to be
 * recognised: the original through {@link authError}, the rewritten through this.
 */
const AUTH_REWRITTEN = /login expired or missing|is not available on a .+ subscription|API_KEY is set/i;

/**
 * How an adapter failure is filed.
 *
 * Classification is **imported** from the contract layer, where vendor error shapes are already
 * normalised and where a contributor's adapter inherits it for free. Re-implementing it here had
 * already drifted three ways, of which `\b5\d\d\b` calling any message containing a three-digit
 * number "transient" — a token count sufficed — is the one to remember.
 *
 * @param error whatever was thrown; its `message` is used when it carries one, and its own string
 *   form otherwise.
 * @param adapterName the adapter the call was routed to, which the auth sentence names.
 * @returns one of three categories — `auth`, `transient` or `adapter` — and a message that is never
 *   empty. The other five categories in {@link ErrorCategory} are constructed by their own callers.
 */
export function errorOf(error: unknown, adapterName: string): RunError {
  const message = String(errorProperty(error, 'message') ?? error);
  const isAuth = AUTH_REWRITTEN.test(message) || authError(adapterName, message) != null;
  const category: ErrorCategory = isAuth ? 'auth' : transientError(message) != null ? 'transient' : 'adapter';
  return { category, message: message || 'adapter failed' };
}

/**
 * What one call contributes to a run's running totals.
 *
 * Tokens are comparable across vendors and money is not, so an unpriced call is **counted** rather
 * than zeroed: the run can then say how much of its total it could not see. Tokens are input plus
 * output only — the cache measures are a breakdown of the input total and adding them back
 * overstates it.
 *
 * Accumulation is the engine's, which is the only thing that changed in the port: the spike adds
 * straight onto `ctx.stats`, and this returns the contribution instead.
 *
 * @param usage what the call reported, if anything. Nothing reported contributes nothing.
 * @returns `cost` in USD, `tokens` as input + output, and `unpriced` as 1 when no price was given.
 */
export function countUsage(usage: Partial<OccurrenceUsage> | null | undefined): { cost: number; tokens: number; unpriced: number } {
  if (!usage) return { cost: 0, tokens: 0, unpriced: 0 };
  return {
    cost: usage.cost_usd ?? 0,
    tokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
    unpriced: usage.cost_usd == null ? 1 : 0,
  };
}
