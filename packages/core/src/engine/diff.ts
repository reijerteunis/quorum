/**
 * The run's diff subsystem: the preflight that judges every range before a step runs, and the
 * materialisation each diff-bearing step's evidence comes out of.
 *
 * One pass over the flow prepares every distinct range, so a preceding agent can never be billed
 * before a bad ref or an empty review range is discovered, and every panel member receives the same
 * bytes rather than a re-read. A range an earlier step of the same flow still has to produce is
 * recorded instead, and materialised at step time.
 *
 * The unit judged is the ENDPOINT and not the range, because a ref is what can be absent — see
 * *"A range is checked one endpoint at a time, because an endpoint is what can be absent"*
 * (2026-08-30). A range holding one owed endpoint is deferred and every endpoint beside it is
 * still resolved at run start, where it costs nothing.
 *
 * Why: behaviour preserved from spike/src/engine.js — the limit is stated rather than implied. No
 * adapter is billed before bad evidence is found holds for refs that exist when the run starts, and
 * cannot hold for a range whose endpoint the run itself creates: that class gets earliest-possible
 * instead, so the producing adapter may run and the consuming one may not.
 */
import { execFileSync } from 'node:child_process';

import { DEFAULT_BASE_BRANCH, integrationBranch, ticketBranch, ticketBranchPrefix } from '@quorum/shared';
import type { Flow, ProjectConfig } from '@quorum/shared';

import type { TicketRecord } from '../backlog/backlog.js';
import { emptyRangeEvidence, shortSha } from '../git/git.js';
import { interpolate } from './loaders.js';
import { FlowError, type RunPersistence } from './types.js';

/** Which end of a three-dot range an endpoint is, left to right. */
export type EndpointSide = 'left' | 'right';

/**
 * One endpoint an earlier step of this flow creates, and the step that owes it.
 *
 * The classified endpoint itself, `class` and all, because that is what the preflight records: a
 * projection here would declare a shape the map does not hold.
 */
export interface EndpointProducer {
  side: EndpointSide;
  ref: string;
  class: 'step-created';
  /** The producing step's id, as the spike's own interpolation renders it. */
  step: string;
}

/**
 * A range the preflight left to step time, keyed in {@link RunContextDiffFields.deferredDiffs} by
 * the interpolated range.
 *
 * `ref` and `step` mirror the first producer left to right, because an empty deferred range names
 * one owed branch and always did; `producers` is what lets a failure name every step that owed an
 * endpoint. The redundancy is deliberate: collapsing it turns one line of a diagnostic into a list.
 */
export interface DeferredDiff {
  ref: string;
  step: string;
  producers: readonly EndpointProducer[];
}

/**
 * The two maps and the flag `RunContext` carries for this module, declared here so `types.ts`
 * imports one name and the shapes stay beside the code that fills them.
 */
export interface RunContextDiffFields {
  /** Every range materialised at run start, keyed by the interpolated range. */
  diffInputs: Map<string, string>;
  /** Every range deferred to step time, keyed by the interpolated range. */
  deferredDiffs: Map<string, DeferredDiff>;
  /**
   * The revision `--base` named, or `null` when the maintainer typed no flag.
   *
   * `vars.base` cannot answer that question — it is set either way, and an override may legitimately
   * name the configured value — and only a diagnostic reads this, so that an unresolvable revision
   * is blamed on the flag rather than on a file that never supplied it.
   */
  baseOverride: string | null;
}

/**
 * What {@link materialiseDiff} reads. Structurally satisfied by `RunContext`, and narrow so the
 * diagnostics can be driven against a throwaway repository without constructing a run.
 *
 * Why: deliberate addition, not preservation — `RoutingContext` and `LifecycleContext` both widen
 * `RunContext`, so this is the folder's first narrowing context type. Its proof is the call site:
 * `engine.ts` hands `preflightDiffs` the whole run context and it typechecks.
 */
export interface DiffContext {
  repoDir: string;
  config: ProjectConfig;
  vars: Readonly<Record<string, unknown>>;
  ticket: TicketRecord;
  runId: number;
  baseOverride: string | null;
  deferredDiffs: ReadonlyMap<string, DeferredDiff>;
  persistence: Pick<RunPersistence, 'appendLog'>;
}

/** What {@link preflightDiffs} reads: {@link DiffContext} plus the flow it walks and the maps it fills. */
export interface PreflightContext extends DiffContext {
  flow: Flow;
  diffInputs: Map<string, string>;
  deferredDiffs: Map<string, DeferredDiff>;
}

/**
 * The one step shape both callers hand {@link materialiseDiff}: an id a failure names, and the
 * `input.diff` a flow file wrote. A fan-out template site carries the synthetic `<step id>.step`.
 */
export interface DiffStep {
  id: unknown;
  input: { diff: unknown };
}

/** A `{…}` placeholder that survived interpolation, which only a per-task template may hold. */
const TEMPLATE_HOLE = /\{[\w.]+\}/;

// A range is named twice wherever it appears — interpolated, so it can be pasted into a terminal,
// and as the flow file writes it, so it can be found in the file that has to change.
const named = (range: string, written: string): string => `\`${range}\` (flow file: \`${written}\`)`;

/** One place a flow file put an `input.diff`, and whether it is a per-task template. */
interface DiffSiteEntry {
  site: DiffStep;
  perTask: boolean;
}

/** Whatever `value` is, as a bag of unknown properties — or `undefined` when it is not an object. */
const loose = (value: unknown): Readonly<Record<string, unknown>> | undefined =>
  typeof value === 'object' && value !== null ? value as Readonly<Record<string, unknown>> : undefined;

/**
 * Every place one step of a flow can carry an `input.diff`.
 *
 * The step itself, and — for a `fan_out` step — its `step:` template, which the fan-out copies into
 * a real step and `buildPrompt` then reads like any other `input.diff`. Left out of the preflight, a
 * template range escapes it twice over: a bad one fails only once the fan-out's own adapters have
 * been billed, and a good one is re-materialised by every expanded task, so one range costs n git
 * spawns and the members of a wave read evidence resolved at different moments. `lint/lint.ts`
 * reaches the same site for the same reason, and its `flattenSteps` deliberately still does not —
 * the template's id, role and adapter are placeholders the duplicate-id, goto and cross_vendor rules
 * must not see. The synthetic id matches the label lint uses, so one flow file reads the same in
 * both failures.
 */
function diffSitesOf(step: Readonly<Record<string, unknown>>): DiffSiteEntry[] {
  const own = loose(step.input)?.diff;
  const template = loose(loose(step.step)?.input)?.diff;
  return [
    ...(own ? [{ site: { id: step.id, input: { diff: own } }, perTask: false }] : []),
    ...(step.fan_out && template
      ? [{ site: { id: `${String(step.id)}.step`, input: { diff: template } }, perTask: true }]
      : []),
  ];
}

/** An endpoint no earlier group creates, and which therefore has no producer to name. */
interface UnownedEndpoint {
  side: EndpointSide;
  ref: string;
  class: 'template' | 'pre-existing';
  step: null;
}

/**
 * What the preflight may ask of one endpoint of an interpolated range.
 *
 * A union rather than one shape with a nullable `step`, so that the producer list is filtered out of
 * it without a cast and a producer with no step id is unrepresentable.
 */
type Endpoint = EndpointProducer | UnownedEndpoint;

/**
 * Each endpoint of `range`, left to right, classified against the branches created before this group:
 *
 * - `step-created` — an earlier group of this flow creates it, so it is not due yet and the range is
 *   deferred to step time. True even when the ref already exists at run start: bytes captured before
 *   its producer ran are that step's PREVIOUS output.
 * - `template` — a `fan_out` step's `step:` template naming a per-task variable, which has no value
 *   until `tasks.yaml` is expanded. Only a template can be in this state; an outer step's unresolved
 *   `{…}` is pre-existing and fails like any other ref that does not resolve.
 * - `pre-existing` — everything else, including a ref only a LATER step creates. Deferring one of
 *   those would move the failure past a billed step, which is what the preflight exists to prevent.
 *
 * Why: behaviour preserved from spike/src/engine.js — a range that is not exactly two endpoints is
 * malformed and {@link materialiseDiff}'s shape guard owns that failure, so none are returned and
 * the caller sends the range to that guard unchanged. Classifying the parts of a malformed range
 * answers a different question.
 */
function classifyEndpoints(
  range: string,
  createdSoFar: ReadonlyMap<string, string>,
  perTask: boolean,
): Endpoint[] {
  const refs = range.split('...');
  if (refs.length !== 2) return [];
  return refs.map((ref, index): Endpoint => {
    const side: EndpointSide = index === 0 ? 'left' : 'right';
    const step = createdSoFar.get(ref);
    if (step !== undefined) return { side, ref, class: 'step-created', step };
    return { side, ref, class: perTask && TEMPLATE_HOLE.test(ref) ? 'template' : 'pre-existing', step: null };
  });
}

// What the preflight may say about the endpoint that is NOT due, when the other one fails. It is not
// supposed to resolve — its producer has not run — so reporting it as one that does not resolve
// either would be the same category error the diagnosis half exists to remove. Reached only for an
// endpoint whose class is not `pre-existing`, since that is the class that failed.
const notDueClause = (endpoint: Endpoint | undefined, site: DiffStep): string | null => {
  if (endpoint === undefined) return null;
  return endpoint.class === 'step-created'
    ? `the ${endpoint.side} endpoint ${endpoint.ref} is not created until step "${endpoint.step}" runs`
    : `the ${endpoint.side} endpoint ${endpoint.ref} is a per-task template with no value until "${String(site.id)}" expands its tasks`;
};

/** The evidence {@link missingEndpointFailure} words around its identifying phrase. */
interface MissingEndpoint {
  side: EndpointSide;
  ref: string;
  range: string;
  written: string;
  /** What is known about the endpoint beside it; `null` entries are dropped. */
  clauses: ReadonlyArray<string | null>;
  /** The run's effective diff anchor, passed in so one place writes that fallback down. */
  base: string;
}

/**
 * The failure for an endpoint that does not resolve, raised by the preflight and by
 * {@link materialiseDiff} alike — so which layer noticed does not change what a maintainer reads.
 *
 * The three identifying phrases are chosen by the failing endpoint's own identity and are matched by
 * substring in existing fixtures; `clauses` are the evidence added around them, and are the only
 * part the two callers word differently.
 */
function missingEndpointFailure(step: DiffStep, context: DiffContext, detail: MissingEndpoint): FlowError {
  const { side, ref, range, written, clauses, base } = detail;
  const integration = integrationBranch(context.ticket.meta.id);
  const tail = `${[`it is the ${side} endpoint of ${named(range, written)}`, ...clauses]
    .filter((clause): clause is string => Boolean(clause)).join('; ')}. Neither the diff nor the containment check was run.`;
  if (ref === base) {
    // Why: preserved behaviour, see Q-0038 — keyed on whether the run was GIVEN --base, never on
    // whether its value differs from repo.base_branch: an override may legitimately name the
    // configured value and the maintainer still typed it. An absent field is no override, so a
    // hand-built context keeps the configured wording. Supersedes the Q-0006 review-runtime contract
    // for the override path only, per Q-0038 errata E-1.
    return new FlowError(context.baseOverride != null
      ? `--base names missing ref "${ref}" — ${tail}`
      : `repo.base_branch in harness/harness.yaml names missing ref "${base}" — ${tail}`);
  }
  if (ref === integration) {
    return new FlowError(`ticket ${context.ticket.meta.id}: expected ${integration}; review requires an integrated branch — ${tail}`);
  }
  return new FlowError(`${String(step.id)}: input.diff names missing ref "${ref}" — ${tail}`);
}

/**
 * The prompt section one diff-bearing step reads: the range's `--stat` and its patch, truncated to
 * the configured byte limit at a character boundary.
 *
 * @throws {FlowError} when the range is out of class, when an endpoint does not resolve, or when the
 *   range is empty — each with the evidence that exists and no claim git did not return.
 */
export function materialiseDiff(step: DiffStep, context: DiffContext): string {
  const written = String(step.input.diff);
  const range = interpolate(written, context.vars);
  const base = String(context.vars.base ?? context.config.repo?.base_branch ?? DEFAULT_BASE_BRANCH);
  // The guard forbids a flow file aiming input.diff at refs unrelated to this ticket — a merge
  // commit, another ticket's branch, an arbitrary SHA. It used to demand exactly
  // `{base}...{integration}`, which was the review flow's shape and only that: the chore flow reviews
  // integration...implement and the stale guard rejected it the day it landed. Both endpoints must be
  // the configured base or one of this ticket's own branches, and the guard composes with `--base`
  // because `base` is ctx.vars.base. Its static twin lives in `lint/lint.ts`. See Q-0034, Q-0077.
  const ticketPrefix = ticketBranchPrefix(context.ticket.meta.id);
  const [left, right, ...extra] = range.split('...');
  const related = (ref: string): boolean => ref === base || ref.startsWith(ticketPrefix);
  if (!left || !right || extra.length || !related(left) || !related(right)) {
    throw new FlowError(`${String(step.id)}: input.diff must relate the configured base or this ticket's own branches ("${base}", "${ticketPrefix}…") with "...", got ${range}`);
  }
  // Which endpoint an earlier step of THIS flow was supposed to create, when the preflight deferred
  // this range. Naming that step is the difference between telling the reader a branch is missing and
  // telling them the producing step committed nothing.
  const deferred = context.deferredDiffs.get(range) ?? null;
  // One spawn per endpoint answers both "does it resolve?" and "to what?" — and the SHA is what makes
  // the failure re-checkable tomorrow, after the branch tips have moved.
  const sha = { left: shortSha(context.repoDir, left), right: shortSha(context.repoDir, right) };
  for (const side of ['left', 'right'] as const) {
    const ref = side === 'left' ? left : right;
    if (sha[side] != null) continue;
    const other: EndpointSide = side === 'left' ? 'right' : 'left';
    const otherRef = other === 'left' ? left : right;
    const otherSha = sha[other];
    throw missingEndpointFailure(step, context, {
      side, ref, range, written, base,
      clauses: [
        otherSha != null
          ? `the ${other} endpoint ${otherRef} resolves to ${otherSha}`
          : `the ${other} endpoint ${otherRef} does not resolve either`,
        // Which step owed which ref, whichever endpoint went bad. The failing endpoint's own producer
        // is named as the step that was expected to create it; a producer of the OTHER endpoint
        // explains why the range was deferred and is never phrased as owing the ref that failed,
        // because no step owed that one. Both are kept when both endpoints were deferred, so a
        // reversal of endpoint order cannot hide either. See Q-0038.
        ...(deferred?.producers ?? []).map((producer) => producer.ref === ref
          ? `step "${producer.step}" was expected to create ${producer.ref}`
          : `the range was deferred waiting for step "${producer.step}" to create ${producer.ref}`),
      ],
    });
  }
  const stat = execFileSync('git', ['diff', '--stat', range], { cwd: context.repoDir, encoding: 'utf8' });
  if (!stat.trim()) throw new FlowError(emptyRangeFailure({ step, written, range, left, right, sha, deferred, context }));
  const full = execFileSync('git', ['diff', range], { cwd: context.repoDir });
  // Spelled here as the spike spells it, and as packages/shared/src/project.test.ts spells it again.
  // Promoting it would edit another child's module for a value this ticket does not change.
  const limit = context.config.repo?.max_diff_bytes ?? 200000;
  const truncated = full.length > limit;
  const bytes = truncated ? trimIncompleteUtf8Suffix(full.subarray(0, limit)) : full;
  if (truncated) {
    context.persistence.appendLog(context.ticket, `run=${context.runId} diff truncated range=${range} limit=${limit} kept=${bytes.length}`);
  }
  const notice = truncated ? `\n\n## Truncation notice\n\nPatch truncated to ${bytes.length} UTF-8 bytes (configured limit ${limit}).` : '';
  return `\n## Diff to review\n\n### git diff --stat ${range}\n\n${stat.trim()}\n\n## Patch (${range})\n\n${bytes.toString('utf8')}${notice}`;
}

/** Everything {@link emptyRangeFailure} quotes, gathered by the caller that already read it. */
interface EmptyRange {
  step: DiffStep;
  written: string;
  range: string;
  left: string;
  right: string;
  sha: { left: string | null; right: string | null };
  deferred: DeferredDiff | null;
  context: DiffContext;
}

/**
 * The message an empty range stops the run with: evidence, and no claim about how it came about.
 *
 * An empty range is never a reviewable state and it must not be one silently — a review once paid
 * two vendors to read zero bytes and returned a verdict the engine acted on. That the run stops is
 * settled; what it stops WITH is Q-0035's subject.
 *
 * The message this replaced reported a historical event from an ancestry check, which establishes a
 * relationship between two commits and says nothing about the route by which it arose. It named no
 * SHA, so it could not be re-checked once the branch tips moved, which is exactly when someone wants
 * to. And it recommended a range the guard above refuses.
 *
 * So: the range as written and as interpolated, both endpoints with the short SHA each resolved to,
 * the check verbatim, and its outcome — then nothing git did not return. Each outcome is tied to an
 * exit code and to nothing else; every further branch would be a new claim that can be wrong in the
 * way this function exists to stop being wrong. The vocabulary is the board's, recorded under
 * Containment in the glossary: "contained", and never a word asserting an event. The spaced form in
 * the "adds nothing since its merge base" line survives because it names the commit a three-dot range
 * is defined against; the command git spells with a hyphen is quoted by `git/git.ts`, which is the
 * one file that runs it and the one file a source guard lets carry its name.
 */
function emptyRangeFailure({ step, written, range, left, right, sha, deferred, context }: EmptyRange): string {
  const { check, sameTree } = emptyRangeEvidence(context.repoDir, left, right);
  const outcome = check.state === 'contained' ? 'contained'
    : check.state === 'not-contained' ? 'not contained'
      : `indeterminate (${check.reason}${check.detail ? `: ${check.detail}` : ''})`;
  const committed = deferred
    ? `check that step "${deferred.step}" committed its work to ${deferred.ref}`
    : `check that the ticket's work was committed to ${right}`;
  const [diagnosis, remedy] = check.state === 'contained'
    ? [`${right} is contained in ${left}, so the range spans no commits. That is a relationship between the two commits above, not a record of how it came about.`,
      // "Review it before it becomes contained" is the right next move only when the endpoint
      // pre-dates the run. For a range this run deferred, the endpoint was created moments ago by a
      // step of this very flow, so it never *became* contained — it started that way, because that
      // step committed nothing. Sending the reader to review earlier is advice about a state that
      // never arose.
      deferred ? committed : `review ${right} before it becomes contained in ${left}`]
    : check.state === 'indeterminate'
      ? [`git could not answer whether ${right} is contained in ${left}, so this failure reports the emptiness and claims nothing further.`,
        're-run the check above and fix whatever stopped git answering']
      : [`${right} is not contained in ${left}, and the range is still empty.`
        + (sameTree === true ? ` ${left} and ${right} are different commits holding identical trees.`
          : sameTree === false ? ` ${right} adds nothing since its merge base with ${left}.`
            : ''),
        committed];
  return [
    `${String(step.id)}: ${named(range, written)} is empty — git diff --stat printed nothing.`,
    `  left endpoint   ${left} = ${sha.left}`,
    `  right endpoint  ${right} = ${sha.right}`,
    deferred ? `  produced by     step "${deferred.step}", which was expected to create ${deferred.ref}` : null,
    `  containment     \`${check.command}\` → ${outcome}`,
    `  ${diagnosis}`,
    `  Remedy: ${remedy}.`,
  ].filter((line): line is string => line !== null).join('\n');
}

/**
 * `bytes` cut back to the last complete UTF-8 character, so a truncated patch never ends mid-code
 * point. A buffer of continuation bytes alone, and an empty one, are returned unchanged: neither
 * holds a boundary this can find, and the scan stops at the final candidate lead byte either way.
 */
export function trimIncompleteUtf8Suffix(bytes: Buffer): Buffer {
  if (!bytes.length) return bytes;
  let lead = bytes.length - 1;
  while (lead >= 0 && (bytes[lead]! & 0xc0) === 0x80) lead -= 1;
  if (lead < 0) return bytes;
  const first = bytes[lead]!;
  const width = first < 0x80 ? 1 : first >= 0xc2 && first <= 0xdf ? 2 : first >= 0xe0 && first <= 0xef ? 3 : first >= 0xf0 && first <= 0xf4 ? 4 : 1;
  return bytes.length - lead < width ? bytes.subarray(0, lead) : bytes;
}

/**
 * Judges every diff site in `context.flow`, in flow order, before any step runs.
 *
 * A range whose endpoints all already exist is materialised once into `context.diffInputs`; a range
 * holding an endpoint an earlier group creates is recorded in `context.deferredDiffs`, and every
 * endpoint beside it is still proven now. The first range that cannot be satisfied stops the run,
 * even when another distinct range was valid. Identical under `--dry` and under a real run: there is
 * no branch on `context.dry` here and none belongs here.
 *
 * @throws {FlowError} for an out-of-class range, an endpoint that does not resolve, or an empty one.
 * @throws {TypeError} for a flow carrying no `steps`, which is read directly and uncoalesced.
 */
export function preflightDiffs(context: PreflightContext): void {
  const { flow } = context;
  // ref → the id of the earliest step that creates it. A Set answered "is this deferred?"; the map
  // also answers "deferred waiting on whom?", which is what lets a deferred range that turns out
  // empty at step time tell the reader the producing step committed nothing rather than that a branch
  // is missing.
  const createdSoFar = new Map<string, string>();
  const remember = (ref: string, stepId: string): void => {
    if (!createdSoFar.has(ref)) createdSoFar.set(ref, stepId);
  };
  // `flow.steps` is iterated directly rather than through a local binding, so a flow with no `steps`
  // key throws here naming the expression the reader can find — the same first line the terminal
  // note, the runs.log line and the terminal event then carry.
  for (const group of flow.steps as unknown as ReadonlyArray<Readonly<Record<string, unknown>>>) {
    const members = (group.parallel ?? [group]) as ReadonlyArray<Readonly<Record<string, unknown>>>;
    // Judge every diff in the group against branches created strictly before the group: a parallel
    // sibling's branch is concurrent, not earlier.
    for (const { site, perTask } of members.flatMap(diffSitesOf)) {
      const written = String(site.input.diff);
      const range = interpolate(written, context.vars);
      const endpoints = classifyEndpoints(range, createdSoFar, perTask);
      if (endpoints.every((endpoint) => endpoint.class === 'pre-existing')) {
        // Why: preserved defect, see Q-0078 — the cache is keyed by the interpolated range alone, so
        // a site materialising `X...Y` before a later group creates `Y` leaves bytes a correctly
        // deferred second site then reads back. Unreachable in every shipped flow, and its obvious
        // fix collides with the identical-bytes guarantee the once-per-range rule exists for.
        if (!context.diffInputs.has(range)) context.diffInputs.set(range, materialiseDiff(site, context));
        continue;
      }
      const producers = endpoints.filter((endpoint): endpoint is EndpointProducer => endpoint.class === 'step-created');
      // A half-interpolated key can never be looked up at step time, so recording one would be a
      // record nothing reads.
      if (producers.length > 0 && !endpoints.some((endpoint) => endpoint.class === 'template')) {
        context.deferredDiffs.set(range, { ref: producers[0].ref, step: producers[0].step, producers });
      }
      // Every endpoint that is due is proven now, where it costs nothing — one endpoint being owed by
      // a later step says nothing about the other. See Q-0038.
      for (const endpoint of endpoints) {
        if (endpoint.class !== 'pre-existing' || shortSha(context.repoDir, endpoint.ref) != null) continue;
        throw missingEndpointFailure(site, context, {
          side: endpoint.side, ref: endpoint.ref, range, written, base: String(context.vars.base),
          clauses: [notDueClause(endpoints.find((other) => other !== endpoint), site)],
        });
      }
    }
    for (const s of members) {
      // Two renderings of the same absent id, both preserved. A step with no `id` — which lint does
      // not yet refuse; see Q-0055 — names its branch `harness/<ticket>/undefined`, as the worktree
      // step itself does, while the producer a diagnostic then quotes reads `null`, which is what the
      // spike's own `?? null` puts there. Collapsing them would change one message or the other.
      const stepId = String(s.id ?? null);
      const defaultBranch = ticketBranch(context.ticket.meta.id, String(s.id));
      if (s.worktree) remember(interpolate(String(s.branch ?? defaultBranch), context.vars), stepId);
      if (s.type === 'integrate' && s.into) remember(interpolate(String(s.into), context.vars), stepId);
    }
  }
}
