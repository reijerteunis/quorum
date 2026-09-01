/**
 * The `run-manifest-v1` semantic pass: the lifecycle and occurrence invariants JSON Schema cannot
 * express, and the per-vendor roll-up recomputed from occurrence usage.
 *
 * The recomputation below is a check only because it is a SECOND implementation. The writer's own
 * roll-up (spike/src/engine.js:463, Q-0049's to port) is an accumulator; this is a group-then-sum,
 * and their disagreement is the whole signal. Importing one into the other would compile, keep
 * every message and leave every test green, and the check would then compare a manifest against a
 * recomputation by the code that wrote it — able to detect a hand-edited file and nothing else.
 * Nothing here may import from `../run-history/`, now or later.
 *
 * Why: behaviour preserved from spike/bin/harness.js:266–355, lifted into core per charter §7
 * (Q-0045, register row 14).
 */
import { USAGE_MEASURES } from '@quorum/shared';
import type { UsageMeasure } from '@quorum/shared';

/**
 * The statuses that end a run or an occurrence, and therefore oblige it to carry a duration.
 *
 * Both readers are in this file, which is why it is neither exported nor in `@quorum/shared`: a
 * constant with one consumer does not belong in the package everything imports (Q-0045 OQ-7).
 */
const TERMINAL_STATUSES: readonly string[] = ['completed', 'failed', 'aborted', 'regressed', 'exhausted', 'interrupted', 'undecided'];

/**
 * The seven roll-up fields compared against the persisted row, in the order the comparison walks
 * them. The five measures come from `@quorum/shared` rather than being spelled out again — a
 * second copy is exactly what a roll-up drifts on.
 */
const ROLLUP_FIELDS = ['step_count', 'unpriced_steps', ...USAGE_MEASURES] as const;

/** The five measures as a manifest carries them: a number, or `null` for "the vendor did not report it". */
type Measures = { [M in UsageMeasure]: number | null };

/** One occurrence's usage. */
interface UsageView extends Measures {
  vendor: string;
}

/** One row of the per-vendor roll-up, persisted or recomputed — the shapes are identical. */
interface VendorRollup extends Measures {
  vendor: string;
  step_count: number;
  unpriced_steps: number;
}

/** One occurrence, as the pass reads it. */
interface StepView {
  step_id: string;
  occurrence_dir: string;
  kind: string;
  adapter: string | null;
  model: string | null;
  status: string;
  duration_ms: number | null;
  usage: UsageView | null;
}

/** A run manifest, as the pass reads it. */
interface ManifestView {
  status: string;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  steps: StepView[];
  rollup: VendorRollup[];
}

/**
 * Groups occurrence usage by its exact `vendor` value and sums each measure, treating `null` as
 * "not reported" rather than as zero: a measure every occurrence left null recomputes to `null`,
 * and a genuinely reported `0` stays `0`. That distinction is the single defect this pass exists to
 * catch — see `contracts/Q-0011/runs-cli.contract.md:49–52` and Q-0011's errata E-2.
 *
 * Occurrences carrying no usage are skipped, which is what makes a gate or a fan-out parent absent
 * from the roll-up rather than a zero row in it.
 */
function computeManifestRollup(steps: StepView[]): Map<string, VendorRollup> {
  const groups = new Map<string, UsageView[]>();
  for (const s of steps ?? []) {
    if (!s.usage) continue;
    // Why: preserved defect, see AC-8 defect 6 — nothing checks that `vendor` is a string, so a
    // usage block without one groups under the key `undefined` and is reported as a missing row
    // for a vendor of that name.
    const vendor = s.usage.vendor;
    const existing = groups.get(vendor);
    if (existing) existing.push(s.usage);
    else groups.set(vendor, [s.usage]);
  }
  const sum = (usages: UsageView[], key: UsageMeasure): number | null => {
    const values = usages.map((u) => u[key]).filter((v): v is number => v != null);
    return values.length ? values.reduce((a, b) => a + b, 0) : null;
  };
  const rows = new Map<string, VendorRollup>();
  for (const [vendor, usages] of groups) {
    rows.set(vendor, {
      vendor,
      step_count: usages.length,
      unpriced_steps: usages.filter((u) => u.cost_usd == null).length,
      input_tokens: sum(usages, 'input_tokens'),
      output_tokens: sum(usages, 'output_tokens'),
      cached_input_tokens: sum(usages, 'cached_input_tokens'),
      cache_write_input_tokens: sum(usages, 'cache_write_input_tokens'),
      cost_usd: sum(usages, 'cost_usd'),
    });
  }
  return rows;
}

/**
 * Every semantic problem in a run manifest, in the order they are found: duplicate occurrence
 * directories, duplicate roll-up vendors, the three run-level lifecycle rules, the per-occurrence
 * rules in occurrence order, then the roll-up comparison.
 *
 * It assumes a structurally valid document and guards nothing — `validateArtifact` runs it only
 * after JSON Schema validation has passed, which is what makes the assumption safe.
 * Why: preserved defect, see AC-8 defect 4.
 *
 * @param data a manifest that has already passed `contracts/Q-0011/run-manifest.schema.json`.
 * @returns one string per problem; empty when the manifest is clean.
 */
export function checkRunManifestSemantics(data: unknown): string[] {
  // A cast, never a check: every read below must still throw the same raw `TypeError` the spike
  // throws on a malformed document.
  const manifest = data as ManifestView;
  const errors: string[] = [];

  const seenDirs = new Set<string>();
  for (const s of manifest.steps ?? []) {
    if (seenDirs.has(s.occurrence_dir)) errors.push(`steps: duplicate occurrence_dir "${s.occurrence_dir}"`);
    seenDirs.add(s.occurrence_dir);
  }

  const seenVendors = new Set<string>();
  for (const r of manifest.rollup ?? []) {
    if (seenVendors.has(r.vendor)) errors.push(`rollup: duplicate vendor "${r.vendor}"`);
    seenVendors.add(r.vendor);
  }

  const terminal = TERMINAL_STATUSES.includes(manifest.status);
  if (terminal && (manifest.ended_at == null || manifest.duration_ms == null)) {
    errors.push(`run: terminal status "${manifest.status}" requires non-null ended_at and duration_ms`);
  }
  if (manifest.status === 'running' && (manifest.ended_at != null || manifest.duration_ms != null)) {
    errors.push('run: status "running" requires null ended_at and duration_ms');
  }
  if (manifest.started_at && manifest.ended_at && manifest.duration_ms != null) {
    const computed = Date.parse(manifest.ended_at) - Date.parse(manifest.started_at);
    if (computed !== manifest.duration_ms) errors.push(`run: duration_ms ${manifest.duration_ms} does not match ended_at - started_at (${computed})`);
  }

  for (const s of manifest.steps ?? []) {
    if (s.kind === 'adapter') {
      if (s.adapter == null) errors.push(`steps[${s.step_id}]: kind "adapter" requires non-null adapter`);
    } else {
      if (s.adapter != null) errors.push(`steps[${s.step_id}]: kind "${s.kind}" requires null adapter, got "${s.adapter}"`);
      if (s.model != null) errors.push(`steps[${s.step_id}]: kind "${s.kind}" requires null model`);
      if (s.usage != null) errors.push(`steps[${s.step_id}]: kind "${s.kind}" requires null usage`);
    }
    const stepTerminal = TERMINAL_STATUSES.includes(s.status);
    if (stepTerminal && s.duration_ms == null) errors.push(`steps[${s.step_id}]: terminal status "${s.status}" requires non-null duration_ms`);
    if (s.status === 'running' && s.duration_ms != null) errors.push(`steps[${s.step_id}]: status "running" requires null duration_ms`);
  }

  const computedRollup = computeManifestRollup(manifest.steps);
  const persistedByVendor = new Map((manifest.rollup ?? []).map((r) => [r.vendor, r]));
  for (const [vendor, computed] of computedRollup) {
    const persisted = persistedByVendor.get(vendor);
    if (!persisted) { errors.push(`rollup: missing row for vendor "${vendor}" (occurrences report usage but rollup has no entry)`); continue; }
    for (const field of ROLLUP_FIELDS) {
      if (persisted[field] !== computed[field]) {
        errors.push(`rollup: vendor "${vendor}" field "${field}" is ${JSON.stringify(persisted[field])}, recomputed from occurrence usage is ${JSON.stringify(computed[field])}`);
      }
    }
  }
  for (const vendor of persistedByVendor.keys()) {
    if (!computedRollup.has(vendor)) errors.push(`rollup: vendor "${vendor}" has a row but no occurrence reported its usage`);
  }

  return errors;
}
