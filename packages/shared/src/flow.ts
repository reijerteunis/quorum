// The shape of a flow file, as the six shipped flows are actually written and as the engine
// actually reads them.
//
// ---------------------------------------------------------------------------------------------
// WHERE THIS SCHEMA'S AUTHORITY ENDS
// ---------------------------------------------------------------------------------------------
//
// `lintFlow` (spike/src/lint.js:56) accumulates sixteen problems into an array and throws once, so
// a reader gets every defect in one pass — and fourteen of those messages open with the step id,
// the exact token the reader greps for in the YAML. A zod issue would say
// `steps[3].on_fail.max_iterations`: an index, not an id. So:
//
//   1. Zod describes STRUCTURE and TYPES. Lint keeps every SEMANTIC rule and every message it
//      produces today, and no zod issue may replace a lint message in `quorum lint`'s output.
//      Consumers use `safeParse`, never `parse`, wherever a lint message is the better diagnostic.
//   2. Zod never adds a rule lint does not have. Where lint already has a message for a value
//      (`on_exhausted` must be "gate"; an `input.diff` range's endpoints; a verdict must route
//      somewhere; the cross-vendor rules), the field here is typed open and lint owns the refusal.
//      The case that looks like an obvious enum and is not: `consumes` and `produces` are plain
//      strings, because lint.js:124 checks only that both are present.
//   3. Where a key decides WHICH KIND of step this is, it stays optional even when lint requires
//      it — `branches`, `run` and a fan-out's `step:` template. That is one half of keeping a
//      malformed integrate step recognisably an integrate step, so it still gets lint's message
//      about it. The other half is that the step schema SELECTS its branch by the engine's own
//      dispatch (spike/src/engine.js:176-198) and commits to it, with no fallback to a permissive
//      kind; see `flowStepSchema` below for why a `z.union` cannot do that.
//   4. No field carries a default or a fallback value. A zod default invents state the file did
//      not carry, which harness/rules.md forbids in as many words ("Never default silently").
//      Where the spike applies a fallback — `step.into ?? ticket.meta.branch`, `step.expect ??
//      'pass'`, `step.max_turns ?? 40` — the fallback stays in the engine, where it is visible.
//   5. Every object passes unknown keys through rather than dropping them. Zod strips unknown keys
//      by default, and a stripped key becomes data loss the moment a parsed object is written
//      back. The one exception is a step's `output` block; see step-output.ts for why.
//
// ---------------------------------------------------------------------------------------------
// THE PROPERTY AC-3 ASKS FOR, AND EXACTLY WHERE IT STANDS
// ---------------------------------------------------------------------------------------------
//
// AC-3 states it as binding: "for any flow object, `lintFlow` succeeding implies the flow schema
// parsing succeeding". The converse is deliberately not wanted — a structurally valid flow may
// still be rejected by lint, which is rule 1.
//
// PRESENCE: the property holds. This schema requires no key that lint does not require. `name` and
// `steps` were required here until the third implement round and are now optional, because lint
// accepts a flow carrying neither — lint.js:127 prints `flow.name ?? flow.file`, and
// `flattenSteps(steps = [])` at lint.js:7 defaults `steps` away. Requiring them was zod adding a
// rule lint does not have, which rule 2 forbids. `consumes` and `produces` stay required because
// lint requires them too, at lint.js:124.
//
// TYPES: the property does not hold, and cannot hold alongside rule 1. `lintFlow` type-checks
// almost nothing — verified by running it, not by reading it: it returns true for `adapter: 42`,
// `id: 42`, `gate: 42`, `max_turns: 'many'`, `cross_vendor: 42`, and for a bare string where a step
// object belongs. This schema rejects each. That residue is not a list of exceptions to be argued
// down one at a time; it is precisely the half of "structure and TYPES" that rule 1 assigns to zod,
// and closing it means typing every field `z.unknown()` — a schema that describes nothing, leaving
// thirteen consumers to re-derive what a flow file is, which is the state this package exists to
// end.
//
// So AC-3's property and AC-4's rule 1 cannot both hold as written. That is a contradiction between
// two criteria of one requirement, not a choice this file is entitled to settle, and it is reported
// as such in dev/implement-report.md rather than absorbed here.
//
// One shape that looks like part of that residue and is not: `steps` present but not an array.
// `steps: null` and `steps: [null]` both throw a TypeError out of `flattenSteps`, so `lintFlow`
// does not succeed on them and rejecting them here breaks nothing.
import { z } from 'zod';

import { stepOutputDeclarationSchema } from './step-output.js';

/** What a step is given to work with. */
export const stepInputSchema = z.object({
  /** Paths inside the ticket folder, simple `*` globs allowed — spike/src/engine.js:704-705. */
  backlog: z.array(z.string()).optional(),
  /** Filenames inside `harness/` — spike/src/engine.js:700-703. */
  harness: z.array(z.string()).optional(),
  /** Whether the agent is told it is running inside the repository — spike/src/engine.js:707. */
  repo: z.boolean().optional(),
  /**
   * A two-endpoint `...` range. Typed as a plain string on purpose: lint has the rule and the
   * message (spike/src/lint.js:36-40, :83), and it is the one static check that also reaches a
   * fan-out step's `step:` template.
   */
  diff: z.string().optional(),
}).passthrough();

/** A bounded backward edge. */
export const onFailSchema = z.object({
  /** A step id in this flow, or `flow:<name>`. Lint resolves it — spike/src/lint.js:64. */
  goto: z.string(),
  /**
   * An unprefixed counter name. Absent means the engine computes `<flow>.<step>` —
   * spike/src/engine.js:541. Lint rejects an empty or `iterations.`-prefixed one (lint.js:68-74).
   */
  counter: z.string().optional(),
  /** Lint rejects a non-integer or non-positive value — spike/src/lint.js:65-67. */
  max_iterations: z.number(),
  /** Lint requires exactly `gate` — spike/src/lint.js:75 — so the value is lint's to refuse. */
  on_exhausted: z.string(),
}).passthrough();

/**
 * The fields every agent step may carry. Not exported as a step kind of its own: an agent step is
 * `agentStepSchema` below, and a fan-out's `step:` template is the same shape with an optional id.
 */
const agentStepFields = {
  role: z.string().optional(),
  /**
   * An adapter name, open. `getAdapter` refuses an unknown one with a good message
   * (spike/src/adapters/index.js:29), and a contributor's adapter must not need this file edited.
   */
  adapter: z.string().optional(),
  model: z.string().optional(),
  worktree: z.boolean().optional(),
  branch: z.string().optional(),
  base: z.string().optional(),
  /** Agentic turn budget. Implemented (spike/src/engine.js:246) and undocumented. */
  max_turns: z.number().optional(),
  input: stepInputSchema.optional(),
  output: stepOutputDeclarationSchema.optional(),
  instructions: z.string().optional(),
  on_fail: onFailSchema.optional(),
  // `route` is deliberately NOT typed. spike/src/lint.js:77 reads it, and the engine implements
  // nothing for it — `runStep` (spike/src/engine.js:176-198) has no branch for a route and
  // docs/02-sdlc-pipeline-spec.md:365 sketches it only for the unshipped qa-final flow. Giving an
  // unimplemented feature a shape would be inventing one; passthrough carries it untouched.
};

/** The ordinary step: a role on an adapter, producing structured output. */
export const agentStepSchema = z.object({
  id: z.string(),
  ...agentStepFields,
}).passthrough();

/**
 * A `parallel` group. Its members are always agent steps: `runStep` sends each one straight to
 * `runAgentStep` without re-dispatching (spike/src/engine.js:181).
 */
export const parallelGroupSchema = z.object({
  parallel: z.array(agentStepSchema),
}).passthrough();

/**
 * A gate. It carries no `id` — harness/flows/chore.yaml:58 and every other shipped gate are
 * `{gate, reason}` — and the schema does not require one.
 *
 * `gate` is an open string. The three values that exist are `human`, `human-locked` and `auto`,
 * but the engine treats anything that is neither `auto` nor overridden as human-gated
 * (spike/src/engine.js:559), so an unknown value is safe by construction and closing the set would
 * reject a flow the engine runs. `human-locked` can never be flipped to auto; lint additionally
 * requires a deploy flow to contain one (spike/src/lint.js:126).
 */
export const gateStepSchema = z.object({
  gate: z.string(),
  reason: z.string().optional(),
  /** Read as a fallback for `reason` — spike/src/engine.js:574. */
  prompt: z.string().optional(),
}).passthrough();

/** A project command, run in the repository. */
export const scriptStepSchema = z.object({
  id: z.string(),
  type: z.literal('script'),
  /** Optional here for rule 3 above: absence must still read as a script step. */
  run: z.string().optional(),
  output: stepOutputDeclarationSchema.optional(),
  on_fail: onFailSchema.optional(),
}).passthrough();

/** Merge branches onto a target branch in a worktree, then optionally run the test command. */
export const integrateStepSchema = z.object({
  id: z.string(),
  type: z.literal('integrate'),
  /**
   * Both shapes the engine accepts (spike/src/engine.js:981-983): a list of branch templates
   * (chore.yaml:52, qa-red.yaml:31, solutioning.yaml:57) or a single string, which when it
   * contains `*` is resolved against the fan-out's own branches rather than globbed
   * (development.yaml:23). Optional for rule 3; lint has the message (spike/src/lint.js:79).
   */
  branches: z.union([z.array(z.string()), z.string()]).optional(),
  into: z.string().optional(),
  /** `true` runs `commands.test`; a string is a command template — spike/src/engine.js:1031. */
  run_tests: z.union([z.boolean(), z.string()]).optional(),
  /** `pass` or `fail`. Open: the engine reads anything that is not `fail` as `pass` (:1055). */
  expect: z.string().optional(),
  output: stepOutputDeclarationSchema.optional(),
  on_fail: onFailSchema.optional(),
}).passthrough();

export const fanOutSchema = z.object({
  /**
   * Both `from` and `by` are inert: `loadTasks` hard-codes `solution/tasks.yaml`
   * (spike/src/fanout.js:14) and grouping is by wave, not by role. Typed as they are written so
   * the schema describes the file, not so anything acts on them.
   */
  from: z.string().optional(),
  by: z.string().optional(),
  /** `depends_on` puts tasks into waves; anything else is one wave — spike/src/engine.js:938. */
  respect: z.string().optional(),
  /** `failing-tasks-only` narrows a retry to the tasks that failed — spike/src/engine.js:932. */
  scope: z.string().optional(),
}).passthrough();

/**
 * The per-task template a fan-out expands. Its `id`, `role`, `adapter` and `model` are
 * interpolation placeholders resolved once per task (spike/src/engine.js:946-952), so `id` is
 * optional here where it is required on a real agent step.
 */
export const fanOutStepTemplateSchema = z.object({
  id: z.string().optional(),
  ...agentStepFields,
}).passthrough();

export const fanOutStepSchema = z.object({
  id: z.string(),
  fan_out: fanOutSchema,
  /** Optional for rule 3; lint has the message (spike/src/lint.js:78). */
  step: fanOutStepTemplateSchema.optional(),
  output: stepOutputDeclarationSchema.optional(),
  on_fail: onFailSchema.optional(),
}).passthrough();

/** The six kinds a step can be. The names are this file's; the engine dispatches, it does not label. */
type StepKind = 'parallel' | 'gate' | 'script' | 'integrate' | 'fan_out' | 'agent';

/**
 * `runStep`'s dispatch, transcribed (spike/src/engine.js:176-198): the TRUTHINESS of `parallel`,
 * `gate` and `fan_out` in that order, with `type` separating only script from integrate, and
 * everything left over an agent step. Truthiness rather than presence is the engine's own test and
 * matters in the file: `gate:` written with no value parses to `null`, which `engine.js:192` reads
 * as not-a-gate, so the schema must read it that way too. A step that is not an object at all is
 * sent to the agent branch, which is where its "expected an object" issue comes from.
 */
function stepKind(value: unknown): StepKind {
  const step = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  if (step.parallel) return 'parallel';
  if (step.gate) return 'gate';
  if (step.type === 'script') return 'script';
  if (step.type === 'integrate') return 'integrate';
  if (step.fan_out) return 'fan_out';
  return 'agent';
}

function schemaForKind(kind: StepKind) {
  switch (kind) {
    case 'parallel': return parallelGroupSchema;
    case 'gate': return gateStepSchema;
    case 'script': return scriptStepSchema;
    case 'integrate': return integrateStepSchema;
    case 'fan_out': return fanOutStepSchema;
    case 'agent': return agentStepSchema;
  }
}

/** The six kinds, as a type. Written out rather than inferred, so the selector below can name it. */
export type FlowStep =
  | ParallelGroup | GateStep | ScriptStep | IntegrateStep | FanOutStep | AgentStep;

/**
 * The step schema SELECTS one branch by the engine's own dispatch and then commits to it: whatever
 * `stepKind` picks is the only schema that runs, and a failure there is the result — there is no
 * second attempt at another kind.
 *
 * That is why this is not a `z.union`. A union tries its branches in turn and accepts the first
 * that fits, so `{id: 'x', gate: 42}` — which `engine.js:192` sends to `runGate` — would fail the
 * gate branch, fall through to the permissive agent branch, and be accepted there with `gate` kept
 * as an unknown key. The object would then be typed as the one kind the engine will never run it
 * as, and its actual structure would never be checked. Same for `{id: 's', type: 'script', run: 5}`
 * and `{id: 'f', fan_out: 42}`. Rule 3 above keeps the kind-deciding keys optional so a malformed
 * step of a kind stays that kind; this is the other half of it, and without both a malformed
 * integrate step is silently an agent step rather than lint's `integrate needs branches`.
 *
 * The transform is a selector, not a conversion: every branch is a passthrough object with no
 * default and no transform of its own, so what comes out is what went in. The round-trip test in
 * flow.test.ts is what holds that true.
 */
export const flowStepSchema = z.unknown().transform((value, ctx): FlowStep => {
  const result = schemaForKind(stepKind(value)).safeParse(value);
  if (result.success) return result.data;
  // Re-raised as-is, so the code, the message and the path all stay the selected branch's. The
  // spread is not cosmetic: zod types the argument as a raw issue with an index signature, which a
  // `$ZodIssue` read straight out of the error does not satisfy.
  for (const issue of result.error.issues) ctx.addIssue({ ...issue });
  return z.NEVER;
});

export const flowSchema = z.object({
  /**
   * Optional, because lint is. `lint.js:127` throws with `flow ${flow.name ?? flow.file}`, so a
   * nameless flow lints clean and must parse here; requiring the key would be a presence rule lint
   * does not have. It is still typed rather than left to passthrough, because `name` is what the
   * cross-flow messages print (spike/src/lint.js:156, :166, :172, :176) and what the engine names
   * in a stage mismatch (spike/src/engine.js:39). A `goto: flow:<target>` resolves against the
   * FILENAME, not this field — `byFilename` is keyed by basename at spike/src/lint.js:146.
   */
  name: z.string().optional(),
  /**
   * A flow may only run on a ticket whose stage equals this — spike/src/engine.js:38-40. A plain
   * string, deliberately NOT `stageSchema`: `lint.js:124` is `if (!flow.consumes || !flow.produces)`
   * and checks nothing else, so a flow naming a stage outside the ten-member list passes lint today
   * and must parse here. Making this an enum would add a rule lint does not have, which is rule 1,
   * and would break the property AC-3 asks for — lint succeeding implies parsing succeeding.
   * `stageSchema` is right for a ticket's own `stage` (ticket.ts) and wrong here.
   */
  consumes: z.string(),
  /** The stage a completed run advances the ticket to — spike/src/engine.js:622-624. Same as above. */
  produces: z.string(),
  /** `required` is the only value lint acts on — spike/src/lint.js:86. */
  cross_vendor: z.string().optional(),
  /**
   * Optional, because lint is: `flattenSteps(steps = [])` (spike/src/lint.js:7) defaults the key
   * away, so a flow with no `steps` returns true from lint today. The engine then reads
   * `flow.steps` directly (spike/src/engine.js:83, :115) and throws a raw TypeError — a real
   * defect, and one this ticket reports rather than fixes ("The port preserves behaviour",
   * docs/DECISIONS.md 2026-08-25). Note that the fallback stays in the engine per rule 4: the key
   * is optional here and carries no zod default, so a consumer writes `flow.steps ?? []` exactly as
   * `flattenSteps` does. Present-but-not-an-array IS rejected, and that is not an exception to the
   * property — `steps: null` and `steps: [null]` throw a TypeError out of `flattenSteps`, so lint
   * does not succeed on them either.
   */
  steps: z.array(flowStepSchema).optional(),
  /**
   * Not in any YAML file. `loadFlow` assigns it onto the parsed object before lint sees it
   * (spike/src/engine.js:17) and `lint.js:127` prints it as the flow's name when `name` is absent,
   * so it is load-bearing for a message and a schema that rejected it would reject all six shipped
   * flows. This is the key that makes a naive `.strict()` flow schema wrong.
   */
  file: z.string().optional(),
}).passthrough();

export type StepInput = z.infer<typeof stepInputSchema>;
export type OnFail = z.infer<typeof onFailSchema>;
export type AgentStep = z.infer<typeof agentStepSchema>;
export type ParallelGroup = z.infer<typeof parallelGroupSchema>;
export type GateStep = z.infer<typeof gateStepSchema>;
export type ScriptStep = z.infer<typeof scriptStepSchema>;
export type IntegrateStep = z.infer<typeof integrateStepSchema>;
export type FanOut = z.infer<typeof fanOutSchema>;
export type FanOutStepTemplate = z.infer<typeof fanOutStepTemplateSchema>;
export type FanOutStep = z.infer<typeof fanOutStepSchema>;
// `FlowStep` is declared beside the selector above, because the selector's return type names it.
export type Flow = z.infer<typeof flowSchema>;
