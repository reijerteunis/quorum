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
//   3. Where a key decides WHICH KIND of step this is, it stays optional even when lint requires
//      it — `branches`, `run` and a fan-out's `step:` template. That is what keeps the union below
//      discriminating exactly as spike/src/engine.js:176-198 dispatches, so a malformed integrate
//      step is still recognisably an integrate step and still gets lint's message about it.
//   4. No field carries a default or a fallback value. A zod default invents state the file did
//      not carry, which harness/rules.md forbids in as many words ("Never default silently").
//      Where the spike applies a fallback — `step.into ?? ticket.meta.branch`, `step.expect ??
//      'pass'`, `step.max_turns ?? 40` — the fallback stays in the engine, where it is visible.
//   5. Every object passes unknown keys through rather than dropping them. Zod strips unknown keys
//      by default, and a stripped key becomes data loss the moment a parsed object is written
//      back. The one exception is a step's `output` block; see step-output.ts for why.
//
// The property this buys, and the one AC-3 asks for: a flow object `lintFlow` accepts parses here.
// The converse does not hold and is not wanted — a structurally valid flow may still be rejected
// by lint, which is rule 1.
import { z } from 'zod';

import { stageSchema } from './stages.js';
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

/**
 * The six kinds, in the engine's own dispatch order (spike/src/engine.js:176-198) — by PRESENCE of
 * `parallel`, `gate` and `fan_out`, with `type` distinguishing only script from integrate. Not by
 * `type` alone, which is why this is an ordered union and not `z.discriminatedUnion`.
 */
export const flowStepSchema = z.union([
  parallelGroupSchema,
  gateStepSchema,
  scriptStepSchema,
  integrateStepSchema,
  fanOutStepSchema,
  agentStepSchema,
]);

export const flowSchema = z.object({
  name: z.string(),
  /** A flow may only run on a ticket whose stage equals this — spike/src/engine.js:38-40. */
  consumes: stageSchema,
  /** The stage a completed run advances the ticket to — spike/src/engine.js:622-624. */
  produces: stageSchema,
  /** `required` is the only value lint acts on — spike/src/lint.js:86. */
  cross_vendor: z.string().optional(),
  steps: z.array(flowStepSchema),
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
export type FlowStep = z.infer<typeof flowStepSchema>;
export type Flow = z.infer<typeof flowSchema>;
