/**
 * What an agent step hands its adapter: the prompt text, and the JSON Schema Quorum generates for
 * the answer it expects back.
 *
 * Composition only. Nothing here reaches an adapter, and nothing here writes a byte — the module
 * imports no `../adapters/` symbol and calls no write API, so M3's server can call it to preview
 * what a step would send without the preview being able to send it. That is why `schemaFor`'s
 * return type is declared locally rather than imported as `AdapterSchema`: the two are structurally
 * compatible where `steps.ts` joins them, and the import would defeat the property.
 *
 * The one read it does perform is a step's declared `input.harness` files and, through
 * `./diff.js`, the diff a step reviews.
 *
 * Why: behaviour preserved from spike/src/engine.js (charter §2, Q-0052).
 */
import fs from 'node:fs';
import path from 'node:path';

import { FINDING_PATTERN } from '@quorum/shared';

import type { Backlog, Frontmatter } from '../backlog/backlog.js';
import { materialiseDiff, type DiffContext } from './diff.js';
import { interpolate, writesOf } from './loaders.js';

/**
 * What {@link buildPrompt} reads: {@link DiffContext} plus the three readers the prompt adds.
 *
 * `vars` is inherited `Readonly`, which is the checkable half of the narrowing — `runAgentStep`
 * overlays a fan-out task's variables for the duration of one call, and nothing can assign back
 * through this view into the run context every later step shares.
 */
export interface PromptContext extends DiffContext {
  /** The ticket folder's reader, for each `input.backlog` glob. */
  backlog: Backlog;
  /** Absolute path of `<repoDir>/harness`, which `input.harness` names files under. */
  harnessDir: string;
  /** A preview resolves everything and materialises nothing an earlier step still has to create. */
  dry: boolean;
  /** Every range the preflight materialised at run start, keyed by the interpolated range. */
  diffInputs: ReadonlyMap<string, string>;
}

/** One property of a generated step schema, as the vendor receives it. */
interface GeneratedProperty {
  type: string;
  description?: string;
  enum?: string[];
  items?: { type: string; pattern?: string };
}

/**
 * The schema one step's answer is asked for and checked against.
 *
 * Every declared property appears in `required` and the object is closed, which is the rule a
 * strict-structured-output vendor refuses a schema for — with an error indistinguishable from a
 * broken login (Q-0034). `packages/core/test/strict-schema.ts` is that rule as an executable check.
 */
export interface GeneratedSchema {
  type: 'object';
  properties: Record<string, GeneratedProperty>;
  required: string[];
  additionalProperties: false;
}

/** A step's `input:` block, as the four readers below narrow it. */
interface StepInput {
  harness?: readonly string[];
  backlog?: readonly unknown[];
  repo?: unknown;
  diff?: unknown;
}

/** A step's `output:` block, as far as the prompt and the schema read it. */
interface StepOutput {
  verdict?: unknown;
}

/** Whatever `value` is, as the shape `key` is read off it — or `undefined` when it is not an object. */
const block = <T>(value: unknown): T | undefined =>
  typeof value === 'object' && value !== null ? value as T : undefined;

/**
 * The JSON Schema this step's answer must match: four shapes, from two independent decisions.
 *
 * `document` is present exactly when the step declares a write path, `verdict` and `findings`
 * exactly when it declares a verdict vocabulary. The findings pattern is imported rather than
 * spelled again, so one spelling reaches the vendor.
 *
 * @param step the step, as the flow file wrote it.
 * @returns a closed object schema listing every property it declares in `required`.
 */
export function schemaFor(step: Readonly<Record<string, unknown>>): GeneratedSchema {
  const properties: Record<string, GeneratedProperty> = {
    summary: { type: 'string', description: 'One paragraph: what you did and why.' },
  };
  const required = ['summary'];
  if (writesOf(step).length) {
    properties.document = { type: 'string', description: 'The full markdown document to be written to the backlog.' };
    required.push('document');
  }
  const declared = block<StepOutput>(step.output)?.verdict;
  if (declared) {
    const vocabulary = String(declared).split('|');
    properties.verdict = { type: 'string', enum: vocabulary };
    const items = vocabulary.includes('changes-requested')
      ? { type: 'string', pattern: FINDING_PATTERN }
      : { type: 'string' };
    properties.findings = { type: 'array', items, description: 'Concrete, actionable findings. With the first verdict, only findings prefixed "nit: " are permitted.' };
    required.push('verdict', 'findings');
  }
  return { type: 'object', properties, required, additionalProperties: false };
}

/**
 * The complete prompt one agent step sends: role, ticket, declared inputs, task and output
 * contract, in that order and under the headings the vendor CLIs and the mock adapter both parse.
 *
 * @param step the step, as the flow file wrote it.
 * @param role the role file's frontmatter and body; an empty body becomes `(no role description)`.
 * @param context the run's narrowed view — an `input.harness` file that is not there is skipped
 *   silently, exactly as the spike skips it.
 * @returns the sections joined by newlines. Nothing is truncated here; the diff's own byte limit is
 *   `materialiseDiff`'s.
 * @throws {FlowError} through `materialiseDiff`, for a range that is out of class, unresolvable or
 *   empty.
 */
export function buildPrompt(
  step: Readonly<Record<string, unknown>>,
  role: Frontmatter,
  context: PromptContext,
): string {
  const { ticket, backlog, harnessDir } = context;
  const input = block<StepInput>(step.input) ?? {};
  const parts: string[] = [];
  parts.push(`# Role: ${String(step.role ?? 'agent')}`);
  parts.push(role.body.trim() || '(no role description)');
  parts.push(`\n# Ticket ${ticket.meta.id}: ${ticket.meta.title}\nStage: ${ticket.meta.stage}. Iteration: ${String(context.vars.iter)}.\n\n${ticket.body.trim()}`);
  for (const name of input.harness ?? []) {
    const file = path.join(harnessDir, name);
    if (fs.existsSync(file)) parts.push(`\n## Input: harness/${name}\n\n${fs.readFileSync(file, 'utf8').trim()}`);
  }
  for (const glob of input.backlog ?? []) {
    for (const { rel, text } of backlog.readFiles(ticket, interpolate(String(glob), context.vars))) {
      parts.push(`\n## Input: backlog/${ticket.folder}/${rel}\n\n${text.trim()}`);
    }
  }
  if (input.repo) {
    parts.push(`\n## Repository\n\nYou are running inside the repository at your working directory. Inspect it as needed.${step.worktree ? ' You MAY write files; this is an isolated worktree on its own branch.' : ' Do NOT modify files.'}`);
  }
  if (input.diff) {
    const range = interpolate(String(input.diff), context.vars);
    // A range absent from `diffInputs` is one the preflight deferred, because an earlier step of
    // this flow creates an endpoint of it. In a real run that step has run and the branch exists;
    // in a dry run no worktree step created anything, so a preview says so rather than demanding a
    // branch only a paid run produces.
    //
    // Why: preserved defect, see Q-0038 E-3(b) / Q-0078 — the cache is keyed by the interpolated
    // range alone and is preferred unconditionally, so a correctly deferred site can be handed
    // bytes captured before its producer ran.
    parts.push(context.diffInputs.get(range) ?? (context.dry
      ? `\n## Diff to review\n\n(dry run: \`${range}\` is produced by an earlier step of this flow and is materialised when that step has run)`
      : materialiseDiff({ id: step.id, input: { diff: input.diff } }, context)));
  }
  const instructions = step.instructions as string | undefined;
  if (instructions) parts.push(`\n# Task\n\n${instructions.trim()}`);
  const writes = writesOf(step).map((rel) => interpolate(rel, context.vars));
  const verdict = block<StepOutput>(step.output)?.verdict;
  parts.push(`\n# Output contract\n\nRespond ONLY with a JSON object matching the provided schema.${writes.length ? ` Put the complete markdown document in "document" (it will be saved as ${writes.join(', ')}).` : ''}${verdict ? ` Set "verdict" to one of: ${String(verdict)}. The first option means pass.` : ''}`);
  return parts.join('\n');
}
