/**
 * Flow lint: the sixteen per-flow diagnostics, the four cross-flow ones, and the whole-directory
 * report a command prints.
 *
 * This is the only place this product's opinions are ENFORCED rather than written down, so the
 * exposure is not a lost rule — a lost rule is loud, because a fixture stops throwing. It is a rule
 * that still fires and says something else. Every message below is load-bearing: `lintFlow`
 * accumulates into an array and throws once, so a reader gets every defect in one pass, and
 * fourteen of the sixteen open with the step id — the token a reader greps for in the YAML.
 *
 * Why: behaviour preserved from spike/src/lint.js, and `lintDirectory` lifted from
 * spike/bin/harness.js:374 (charter §2 and §7, Q-0044).
 */
import fs from 'node:fs';
import path from 'node:path';

import YAML from 'yaml';

import { ticketBranchPrefix } from '@quorum/shared';
import type { Flow, FlowStep } from '@quorum/shared';

/**
 * A flow that cannot be run, carrying every problem found in one message.
 *
 * It overrides nothing — not `name`, not `message`. A command routes on `e instanceof FlowError` to
 * print one sentence instead of a stack (spike/bin/harness.js:605), so `.name` reads `'Error'` and
 * setting it would change what a stranger sees at the top of an error.
 */
export class FlowError extends Error {}

/**
 * A flow, a step, or a step's `output` block as the linter reads it: a bag of properties whose
 * types are whatever the YAML held.
 *
 * Why: `lintFlow` validates the flow FORMAT, not its types — see AC-1. It returns `true` today for
 * `adapter: 42`, `id: 42`, `gate: 42` and `max_turns: 'many'`, and a narrowing that refused one
 * would be a schema's rule arriving through the type checker, which is the failure the zod boundary
 * (docs/DECISIONS.md, 2026-08-25) exists to prevent.
 */
type Loose = Record<string, unknown>;

/**
 * A cast, never a check: reading a property through it must still throw the same raw `TypeError` it
 * throws today. Use it wherever the spike reads a property with a plain `.`.
 *
 * Why: preserved defect, see AC-12 defect 4.
 */
const loose = (value: unknown): Loose => value as Loose;

/**
 * The base of an OPTIONAL chain — `value?.key`. `null` and `undefined` read as `undefined` instead
 * of throwing, which is the difference between this and {@link loose}, and the difference is
 * load-bearing at every site where the spike writes `?.`.
 */
const maybe = (value: unknown): Loose | undefined => (value == null ? undefined : (value as Loose));

/**
 * Top-level entries with each `parallel` group replaced by its members, in order.
 *
 * Deliberately shallow: it does NOT descend into a `fan_out` step's `step:` template, whose `id`,
 * `role` and `adapter` are placeholders resolved once per task — so the duplicate-id, `goto`,
 * cross-vendor and loop-convergence rules never see them. {@link diffSites} is the one rule that
 * must, and reaches the template itself.
 *
 * Why: `flattenSteps(null)` and `flattenSteps([null])` throw raw `TypeError`s — preserved defect,
 * see AC-12 defect 4, which is why neither the argument nor an element is guarded.
 */
export function flattenSteps(steps: unknown = []): FlowStep[] {
  return (steps as FlowStep[]).flatMap((step) => (loose(step).parallel ? (loose(step).parallel as FlowStep[]) : [step]));
}

/** Values grouped by a key, preserving first-seen key order and per-key order. */
function groupBy<T>(values: readonly T[], keyOf: (value: T) => unknown): Map<unknown, T[]> {
  const groups = new Map<unknown, T[]>();
  for (const value of values) {
    const key = keyOf(value);
    groups.set(key, [...(groups.get(key) ?? []), value]);
  }
  return groups;
}

/** Every path a step declares it writes: `output.write` first, then `output.writes` in order. */
function writesOf(step: unknown): unknown[] {
  const output = loose(loose(step).output ?? {});
  return [...(output.write ? [output.write] : []), ...((output.writes ?? []) as unknown[])];
}

/**
 * The characters a literal must have escaped to survive being spliced into a `RegExp` source. It is
 * the spike's own set, shared by {@link globMatch} and {@link TICKET_ENDPOINT}: neither `/` nor `*`
 * is in it, and `globMatch` depends on `*` surviving to be expanded afterwards.
 */
const escapeRegExp = (text: string): string => text.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

/** A ticket-folder path pattern: `*` matches within one segment, and a trailing `/` is a prefix. */
function globMatch(pattern: string, value: string): boolean {
  return new RegExp('^' + escapeRegExp(pattern).replace(/\*/g, '[^/]*') + '$').test(value)
    || (pattern.endsWith('/') && value.startsWith(pattern));
}

/** The one endpoint a range may name besides a branch of the ticket's own. */
const BASE_ENDPOINT = '{base}';

/**
 * The prefix an endpoint must carry to name one of this ticket's own branches, with `{id}` left
 * uninterpolated. Taken from the single spelling of that prefix rather than written out again, and
 * bound once so the rule below and the message it produces cannot drift apart.
 */
const TICKET_ENDPOINT_PREFIX = ticketBranchPrefix('{id}');

/** That prefix followed by at least one character, which — as `.+` — may not be a line terminator. */
const TICKET_ENDPOINT = new RegExp(`^${escapeRegExp(TICKET_ENDPOINT_PREFIX)}.+`);

/**
 * The static half of `materialiseDiff`'s range guard: both endpoints must be the configured base or
 * one of this ticket's own branches. Deliberately text-only — it interpolates nothing and runs no
 * git — which is precisely why it is the one check that also protects a DEFERRED range, whose
 * endpoint no run has created yet and whose emptiness therefore cannot be known early. `{id}` is
 * uninterpolated in a flow file, so the rule is a property of the text and needs no run to check.
 * It restates the engine's guard rather than adding to it: a flow the engine would accept must pass
 * here, and a flow rejected here would have been rejected at step time anyway — after a preceding
 * adapter had already been billed. See Q-0035.
 */
function validDiffRange(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const endpoints = value.split('...');
  return endpoints.length === 2 && endpoints.every((ref) => ref === BASE_ENDPOINT || TICKET_ENDPOINT.test(ref));
}

/** One place a flow file put an `input.diff`, labelled with what a reader can find in the file. */
interface DiffSite {
  label: unknown;
  value: unknown;
}

/**
 * Every place a flow file can put an `input.diff`, each labelled so a problem names something the
 * reader can find in the file. {@link flattenSteps} deliberately does not descend into a `fan_out`
 * step's `step:` template — the template's id, role and adapter are placeholders resolved per task,
 * so the duplicate-id, goto and cross_vendor rules must not see it. This rule must: `runFanOut`
 * copies the template into a real step and `buildPrompt` reads its `input.diff` like any other, so
 * a malformed range there would survive lint and fail mid-run, after the fan-out's own adapters had
 * been billed — which is the failure the static rule exists to make impossible. See Q-0035.
 */
function diffSites(steps: readonly FlowStep[]): DiffSite[] {
  return steps.flatMap((step): DiffSite[] => {
    const view = loose(step);
    return [
      { label: view.id, value: maybe(view.input)?.diff },
      ...(view.fan_out && view.step
        ? [{ label: `${view.id}.step`, value: maybe(loose(view.step).input)?.diff }]
        : []),
    ];
  }).filter((site) => site.value != null);
}

/**
 * Lint one flow, reporting everything wrong with it at once.
 *
 * The parameter is `unknown` and is narrowed here rather than parsed: no schema runs in front of
 * this function, and no schema issue may replace one of its messages (AC-1, and rule 1 of
 * docs/DECISIONS.md 2026-08-25).
 *
 * @param flow a parsed flow file, as `YAML.parse` returned it.
 * @returns `true` when the flow is clean.
 * @throws {FlowError} naming the flow and listing every problem, one per line.
 */
export function lintFlow(flow: unknown): boolean {
  const problems: string[] = [];
  const steps = flattenSteps(loose(flow).steps);
  const ids = steps.filter((step) => loose(step).id).map((step) => loose(step).id);
  ids.forEach((id, index) => { if (ids.indexOf(id) !== index) problems.push(`duplicate step id "${id}"`); });
  for (const step of steps) {
    const view = loose(step);
    if (view.on_fail) {
      const onFail = loose(view.on_fail);
      if (!onFail.goto) problems.push(`${view.id}: on_fail without goto`);
      else if (!String(onFail.goto).startsWith('flow:') && !ids.includes(onFail.goto)) problems.push(`${view.id}: goto target "${onFail.goto}" not found`);
      if (!Number.isInteger(onFail.max_iterations) || (onFail.max_iterations as number) <= 0) {
        problems.push(`${view.id}: on_fail.max_iterations must be an integer greater than zero`);
      }
      const counter = onFail.counter;
      if (counter != null && (typeof counter !== 'string' || !counter.trim())) {
        problems.push(`${view.id}: on_fail.counter must be a non-empty unprefixed key`);
      } else if (typeof counter === 'string' && counter.startsWith('iterations.')) {
        const corrected = counter.slice('iterations.'.length);
        problems.push(`${view.id}: counter "${counter}" must be unprefixed; use "${corrected}"`);
      }
      if (onFail.on_exhausted !== 'gate') problems.push(`${view.id}: on_exhausted must be "gate"`);
    }
    if (maybe(view.output)?.verdict && !view.on_fail && !view.route) problems.push(`${view.id}: has a verdict but no on_fail/route — verdicts must go somewhere`);
    if (view.fan_out && !view.step) problems.push(`${view.id}: fan_out needs a step template`);
    if (view.type === 'integrate' && !view.branches) problems.push(`${view.id}: integrate needs branches`);
  }
  for (const { label, value } of diffSites(steps)) {
    if (!validDiffRange(value)) {
      problems.push(`${label}: input.diff must be two "..."-joined endpoints, each "${BASE_ENDPOINT}" or "${TICKET_ENDPOINT_PREFIX}…", got ${JSON.stringify(value)}`);
    }
  }
  if (loose(flow).cross_vendor === 'required') {
    let invalidPanel = false;
    for (const group of (loose(flow).steps ?? []) as FlowStep[]) {
      const members = loose(group).parallel as FlowStep[] | undefined;
      if (!members || members.length < 2) continue;
      const byRole = groupBy(members, (step) => loose(step).role);
      for (const sameRole of byRole.values()) {
        if (sameRole.length < 2) continue;
        const adapters = new Set(sameRole.map((step) => loose(step).adapter));
        if (adapters.size < 2) {
          invalidPanel = true;
          problems.push(`parallel group ${sameRole.map((step) => loose(step).id).join(', ')} shares role "${loose(sameRole[0]).role}" and adapter "${loose(sameRole[0]).adapter}" — cross_vendor: required needs at least two adapters`);
        }
      }
    }
    // Runs only when the panel rule found nothing. A flow carrying BOTH defects reports the panel
    // problem alone and says nothing about a judge, which two frozen scenarios pin by asserting the
    // judge's text is ABSENT (spike/test/q0033-surface.js:228, :233). It reads like something to
    // tidy into two independent loops; tidying it changes the output. See AC-5.
    if (!invalidPanel) {
      const producer: Loose = {};
      for (const step of steps) for (const written of writesOf(step)) producer[written as string] = loose(step).adapter;
      for (const step of steps) {
        const view = loose(step);
        if (!maybe(view.output)?.verdict) continue;
        const reviewed = ((maybe(view.input)?.backlog ?? []) as string[]).flatMap((input) => Object.keys(producer).filter((written) => globMatch(input, written)));
        if (reviewed.length && reviewed.every((written) => producer[written] === view.adapter)) {
          problems.push(`${view.id}: every input it judges (${reviewed.join(', ')}) was written by its own vendor (${view.adapter}) — cross_vendor: required`);
        }
      }
    }
  }
  for (const step of steps) {
    const view = loose(step);
    const target = maybe(view.on_fail)?.goto;
    if (!target || String(target).startsWith('flow:')) continue;
    const written = writesOf(step);
    if (!written.length) continue;
    const destination = steps.find((candidate) => loose(candidate).id === target);
    if (!destination || loose(destination).fan_out) continue;
    const receives = (maybe(loose(destination).input)?.backlog ?? []) as string[];
    if (!written.some((output) => receives.some((input) => globMatch(input, output as string)))) {
      problems.push(`${view.id}: loops back to "${target}", which never receives ${written.join(', ')} — the loop cannot converge`);
    }
  }
  if (!loose(flow).consumes || !loose(flow).produces) problems.push('flow needs consumes/produces');
  const gates = steps.filter((step) => loose(step).gate);
  if (loose(flow).produces === 'deployed' && !gates.some((gate) => loose(gate).gate === 'human-locked')) problems.push('deploy flow must contain a human-locked gate');
  if (problems.length) throw new FlowError(`flow ${loose(flow).name ?? loose(flow).file} invalid:\n  - ${problems.join('\n  - ')}`);
  return true;
}

/**
 * One flow file as {@link lintFlowDirectory} read it.
 *
 * `flow` is ABSENT — not `undefined` — on every failure path, so `'flow' in record` distinguishes a
 * file that loaded from one that did not. A record that did not load takes no part in either
 * cross-flow index, and does not stop the remaining files being read.
 */
export interface FlowRecord {
  /** The file's path, as joined from the directory it was read from. */
  file: string;
  /** The parsed flow, carrying the `file` key the loader assigns. Present only on success. */
  flow?: Flow;
  /** Empty when the file is clean. A lint failure is ONE element holding its whole message. */
  problems: string[];
}

/** A record whose file loaded and linted — the only kind the cross-flow pass walks. */
type LoadedRecord = FlowRecord & { flow: Flow };

/**
 * Lint every `.yaml` file directly inside `directory`, then walk the cross-flow edges between them.
 *
 * Nothing is cached: each invocation rebuilds its own records and indexes. Nested directories and
 * every other extension are ignored.
 *
 * Why: a missing directory throws a raw `ENOENT` rather than a {@link FlowError}, an empty `.yaml`
 * file surfaces a `TypeError` as a user-facing problem string, and a `.yml` file is skipped without
 * being reported — preserved defects, see AC-12 defects 1, 2 and 3.
 *
 * @returns one record per `.yaml` file, in filename order.
 */
export function lintFlowDirectory(directory: string): FlowRecord[] {
  const records: FlowRecord[] = [];
  for (const filename of fs.readdirSync(directory).filter((name) => name.endsWith('.yaml')).sort()) {
    const file = path.join(directory, filename);
    try {
      const parsed: unknown = YAML.parse(fs.readFileSync(file, 'utf8'));
      // Assigned onto whatever `YAML.parse` returned, `null` included: an empty file throws here,
      // and that throw becomes the reported problem. Why: preserved defect, see AC-12 defect 2.
      loose(parsed).file = file;
      const flow = parsed as Flow;
      lintFlow(flow);
      records.push({ file, flow, problems: [] });
    } catch (error) {
      // Deliberately not stringified: `String(error)` would be a diagnostic behaviour change, and
      // every throw reachable here is an Error. Why: preserved defect, see AC-12 defect 9.
      records.push({ file, problems: [(error as Error).message] });
    }
  }
  // A record carries a flow only if it loaded, and a loaded flow is always an object — a scalar
  // document throws on the `file` assignment above and never reaches here.
  const loaded = records.filter((record): record is LoadedRecord => record.flow !== undefined);
  const byFilename = new Map(loaded.map((record) => [path.basename(record.file, '.yaml'), record.flow]));
  const byStage = groupBy(loaded.map((record) => record.flow), (flow) => flow.consumes);
  for (const record of loaded) {
    const source = record.flow;
    for (const step of flattenSteps(source.steps)) {
      const edge = maybe(loose(step).on_fail)?.goto;
      if (!String(edge ?? '').startsWith('flow:')) continue;
      // Resolved by YAML filename stem, never by the target's own `name:` — `byFilename` is keyed
      // by basename, so the two halves of one message come from two different identifiers.
      // Why: preserved defect, see AC-12 defect 8.
      const targetName = (edge as string).slice(5);
      const target = byFilename.get(targetName);
      if (!target) {
        record.problems.push(`flow ${source.name}: target flow ${targetName} is missing or unloadable`);
        continue;
      }
      let stage = target.produces;
      let current = target;
      const visited = new Map<string, string | undefined>();
      while (stage !== source.consumes) {
        const pair = `${current.name}\0${stage}`;
        if (visited.has(pair)) {
          const cycle = [...visited.values(), current.name].join(', ');
          record.problems.push(`flow ${source.name}: target flow ${targetName} has a cycle at stage ${stage}; implicated flows: ${cycle}`);
          break;
        }
        visited.set(pair, current.name);
        const consumers = byStage.get(stage) ?? [];
        if (consumers.length === 0) {
          record.problems.push(`flow ${source.name}: target flow ${targetName} dies at stage ${stage}; it never returns to ${source.consumes}`);
          break;
        }
        if (consumers.length > 1) {
          record.problems.push(`flow ${source.name}: target flow ${targetName} is ambiguous at stage ${stage}; implicated flows: ${consumers.map((flow) => flow.name).join(', ')}`);
          break;
        }
        [current] = consumers;
        stage = current.produces;
      }
    }
  }
  return records;
}

/**
 * The same walk, as an assertion: every flow in `directory`, or none.
 *
 * The cast is safe by construction rather than by check — a record that did not load always carries
 * a problem, so reaching the return means every record has a flow.
 *
 * @returns the flow objects, in filename order.
 * @throws {FlowError} naming every failing file at once, each with its problems beneath it.
 */
export function validateFlowDirectory(directory: string): Flow[] {
  const records = lintFlowDirectory(directory);
  const invalid = records.filter((record) => record.problems.length);
  if (invalid.length) {
    throw new FlowError(invalid.map((record) => `${path.basename(record.file)}:\n  - ${record.problems.join('\n  - ')}`).join('\n'));
  }
  return records.map((record) => record.flow) as Flow[];
}

/** One flow file's outcome, ready for a caller to render however it renders things. */
export interface FlowFileReport {
  /** The file's path, as {@link lintFlowDirectory} recorded it. */
  file: string;
  /** Its basename — what a report names beside the file's outcome. */
  filename: string;
  /** One problem per element, already split out of the multi-line messages lint throws. */
  problems: string[];
}

/** What {@link lintDirectory} answers: whether a flows directory is clean, and why it is not. */
export interface DirectoryReport {
  /** True only when no record has a problem. */
  ok: boolean;
  /** One per `.yaml` file, in filename order. */
  records: FlowFileReport[];
}

/**
 * A lint message carries every problem in one string; a reader wants them one at a time. The header
 * line is dropped only when there is something under it to drop it in favour of.
 */
function flattenProblems(problems: readonly string[]): string[] {
  return problems.flatMap((problem) => {
    const parts = String(problem).split('\n').map((line) => line.trim()).filter(Boolean);
    return (parts.length > 1 && /invalid:$/.test(parts[0]) ? parts.slice(1) : parts)
      .map((line) => line.replace(/^-+\s*/, ''));
  });
}

/**
 * Whole-directory validation as a caller can present it: one record per file, problems flattened,
 * and no marker, colour, indentation or escape byte anywhere.
 *
 * Presentation is absent deliberately rather than merely unused. The same records have to reach a
 * terminal, a browser (M4's flow editor) and a WebSocket (M3's server), and an escape byte is a bug
 * in two of the three. Charter §7 puts event rendering in the CLI's residual scope; the SHAPE is
 * what §2 says is not preserved, and the bytes a terminal prints do not change.
 */
export function lintDirectory(flowsDir: string): DirectoryReport {
  const records = lintFlowDirectory(flowsDir);
  return {
    ok: records.every((record) => !record.problems.length),
    records: records.map((record) => ({
      file: record.file,
      filename: path.basename(record.file),
      problems: flattenProblems(record.problems),
    })),
  };
}
