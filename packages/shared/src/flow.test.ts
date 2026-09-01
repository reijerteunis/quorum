import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { flowSchema, flowStepSchema } from './flow.js';
import { flowFiles, lintAccepts, parseYaml, read, sharedSourceFiles, spikeLintFlow } from '../test/corpus.js';

// `loadFlow` assigns `flow.file = file` onto the parsed object BEFORE lint or anything else sees
// it (spike/src/engine.js:15-20). Every corpus flow is parsed the way the engine parses it,
// injected key included, because that is the object the rest of the product actually holds.
function loadAsTheEngineDoes(file: string): Record<string, unknown> {
  const flow = parseYaml(file) as Record<string, unknown>;
  flow.file = file;
  return flow;
}

describe('AC-3 — the flow schema describes the format as it is', () => {
  test('all six shipped flows parse, with the loader-injected `file` key', () => {
    const files = flowFiles();
    expect(files.map((f) => path.basename(f))).toEqual([
      'chore.yaml', 'development.yaml', 'qa-red.yaml', 'requirements.yaml', 'review.yaml',
      'solutioning.yaml',
    ]);
    for (const file of files) {
      const result = flowSchema.safeParse(loadAsTheEngineDoes(file));
      expect(result.error?.issues ?? [], `${path.basename(file)} must parse`).toEqual([]);
      expect(result.success).toBe(true);
    }
  });

  test('a parallel group', () => {
    expect(flowStepSchema.safeParse({
      parallel: [
        { id: 'pm-claude', role: 'product-manager', adapter: 'claude', model: 'opus', input: { backlog: ['ticket.md'] }, output: { write: 'requirements/candidate-claude.md' } },
        { id: 'pm-codex', role: 'product-manager', adapter: 'codex', input: { backlog: ['ticket.md'] }, output: { write: 'requirements/candidate-codex.md' } },
      ],
    }).success).toBe(true);
  });

  test('a gate step, which carries no id', () => {
    expect(flowStepSchema.safeParse({ gate: 'human', reason: 'PM owner approves requirements/merged.md' }).success).toBe(true);
    expect(flowStepSchema.safeParse({ gate: 'human-locked' }).success).toBe(true);
  });

  test('a script step', () => {
    expect(flowStepSchema.safeParse({ id: 'open-pr', type: 'script', run: 'gh pr create --base main' }).success).toBe(true);
  });

  test('an integrate step, with either shape of `branches`', () => {
    expect(flowStepSchema.safeParse({
      id: 'integrate', type: 'integrate', branches: ['harness/{id}/implement'],
      into: 'harness/{id}/integration', run_tests: true, expect: 'pass',
      output: { writes: ['dev/integration.md'] },
    }).success).toBe(true);
    // development.yaml:23 — a glob string resolved against the fan-out's own branches.
    expect(flowStepSchema.safeParse({
      id: 'integrate', type: 'integrate', branches: 'harness/{id}/*', into: 'harness/{id}/integration',
      run_tests: true, expect: 'pass', on_fail: { goto: 'developers', max_iterations: 3, on_exhausted: 'gate' },
    }).success).toBe(true);
  });

  test('a fan-out step and its `step:` template', () => {
    expect(flowStepSchema.safeParse({
      id: 'developers',
      fan_out: { from: 'solution/tasks.yaml', by: 'role', respect: 'depends_on', scope: 'failing-tasks-only' },
      step: {
        id: 'dev:{task.id}', role: 'developer-{role}', adapter: '{role.adapter}', model: '{role.model}',
        branch: 'harness/{id}/{task.id}', base: 'harness/{id}/integration',
        input: { backlog: ['solution/solution.md'], harness: ['rules.md'], repo: true },
        instructions: 'Implement ONLY your task.',
      },
    }).success).toBe(true);
  });

  test('a plain agent step', () => {
    expect(flowStepSchema.safeParse({
      id: 'head-of-product', role: 'head-of-product', adapter: 'claude', model: 'opus',
      input: { backlog: ['ticket.md'] },
      output: { write: 'requirements/merged.md', verdict: 'ready|needs-input' },
      on_fail: { goto: 'head-of-product', max_iterations: 1, on_exhausted: 'gate' },
    }).success).toBe(true);
  });

  test('`output.verdict` is the pipe-delimited string the engine splits, not a list', () => {
    expect(flowStepSchema.safeParse({ id: 'v', output: { verdict: 'approve|revise' } }).success).toBe(true);
    expect(flowStepSchema.safeParse({ id: 'v', output: { verdict: ['approve', 'revise'] } }).success).toBe(false);
  });

  test('discrimination follows the engine\'s dispatch, by presence and not by `type` alone', () => {
    // spike/src/engine.js:176-198: parallel, then gate, then type===script, then type===integrate,
    // then fan_out, then everything else is an agent step. An unrecognised `type` is an agent step
    // there, so it must be one here.
    const parsed = flowStepSchema.parse({ id: 'x', type: 'something-else', role: 'r' });
    expect(parsed).toEqual({ id: 'x', type: 'something-else', role: 'r' });
    // A fan-out step whose `step:` template is missing is still a fan-out step — lint has that
    // message (spike/src/lint.js:78) and must be the one to give it.
    expect(flowStepSchema.safeParse({ id: 'developers', fan_out: { by: 'role' } }).success).toBe(true);
    // Same for an integrate step with no branches (lint.js:79) and a script with no run.
    expect(flowStepSchema.safeParse({ id: 'i', type: 'integrate' }).success).toBe(true);
    expect(flowStepSchema.safeParse({ id: 's', type: 'script' }).success).toBe(true);
  });

  test('the selected kind is validated, and never falls through to the agent step', () => {
    // Each of these is dispatched by spike/src/engine.js:176-198 to runGate, runScript, runFanOut,
    // runIntegrate or the parallel branch on the truthiness of ONE key. An ordered `z.union` would
    // fail that kind's branch and then accept the object as an agent step, where `z.looseObject`
    // keeps the deciding key as an unknown one — so the parsed type would name the single kind the
    // engine will never run it as, and its real structure would go unchecked.
    for (const step of [
      { id: 'x', gate: 42 },
      { id: 's', type: 'script', run: 5 },
      { id: 'f', fan_out: 42 },
      { id: 'p', parallel: 42 },
      { id: 'i', type: 'integrate', branches: 7 },
      { id: 'g', gate: 'human', reason: 9 },
    ]) {
      expect(flowStepSchema.safeParse(step).success, JSON.stringify(step)).toBe(false);
    }
  });

  test('a failure names the field of the kind the engine selected, not every branch it is not', () => {
    const result = flowSchema.safeParse({
      name: 'x', consumes: 'green', produces: 'reviewed', steps: [{ id: 'g', gate: 42 }],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(['steps.0.gate']);
  });

  test('a falsy discriminator is not that kind — `gate:` with no value is an agent step', () => {
    // YAML `gate:` with nothing after it parses to null, and `if (step.gate)` at
    // spike/src/engine.js:192 is false for it, so the engine runs it as an agent step. Truthiness,
    // not presence, is what the selector copies.
    const step = { id: 'x', gate: null, role: 'r' };
    expect(flowStepSchema.parse(step)).toEqual(step);
  });

  test('`consumes` and `produces` are typed as strings, not enumerated against the stage list', () => {
    // spike/src/lint.js:124 is `if (!flow.consumes || !flow.produces)` and checks nothing further,
    // so a flow naming stages outside the ten-member list passes lint today. Making these an enum
    // would add a rule lint does not have and break the property below.
    const flow = { name: 'x', consumes: 'custom', produces: 'custom-next', steps: [] };
    expect(flowSchema.parse(flow)).toEqual(flow);
    // The ticket's own `stage` field is the one that IS the enum; that lives in ticket.ts.
    expect(flowSchema.safeParse({ ...flow, consumes: 42 }).success).toBe(false);
  });

  test('the property: what lint accepts, the schema accepts — including what a naive `.strict()` would reject', () => {
    // Two things a naive strict schema rejects and lint does not. `file` is injected by the loader
    // and appears in no YAML file (spike/src/engine.js:17); `notes` stands for any key an author
    // or a later ticket adds that nothing reads yet.
    const flow = {
      name: 'review', consumes: 'green', produces: 'reviewed', cross_vendor: 'required',
      file: '/abs/path/harness/flows/review.yaml',
      notes: 'a key nothing reads',
      steps: [{ id: 'verdict', role: 'code-reviewer', depends_on: 'Q-0006', output: { verdict: 'approve|changes-requested' }, on_fail: { goto: 'flow:development', counter: 'review', max_iterations: 3, on_exhausted: 'gate' } }],
    };
    const result = flowSchema.safeParse(flow);
    expect(result.error?.issues ?? []).toEqual([]);
    expect(result.data).toEqual(flow);
  });
});

// ---------------------------------------------------------------------------------------------
// The property, asserted against the real linter rather than against a reading of it.
//
// requirements/errata.md E-1 (2026-08-25) supersedes AC-3's original wording. The property is now
// about PRESENCE — "lint succeeding implies the schema requires no key that is absent" — and the
// type divergence below is the boundary E-1 draws, asserted as `lint accepts / schema rejects` and
// named as such. It is not a list of exceptions to be argued down one at a time: three review
// rounds were spent on that, from reading `lintFlow` rather than running it.
//
// Every verdict here comes from `spike/src/lint.js` itself, imported and executed. If the linter
// changes, this file fails rather than continuing to assert a property about a linter that no
// longer exists.
// ---------------------------------------------------------------------------------------------
describe('AC-3 as errata E-1 amends it — lint succeeding implies no absent key is required', () => {
  /** Flows the real `lintFlow` accepts. Each must therefore parse, unchanged. */
  const PRESENCE_CASES: [string, Record<string, unknown>][] = [
    ['no name — lint.js:127 prints `flow.name ?? flow.file`',
      { consumes: 'green', produces: 'reviewed', steps: [] }],
    ['no steps — `flattenSteps(steps = [])` at lint.js:7 defaults the key away',
      { name: 'x', consumes: 'green', produces: 'reviewed' }],
    ['neither', { consumes: 'green', produces: 'reviewed' }],
    ['the loader-injected `file`, which is in no YAML file — engine.js:17',
      { consumes: 'green', produces: 'reviewed', file: '/abs/harness/flows/review.yaml' }],
    ['a key nothing reads', { consumes: 'green', produces: 'reviewed', notes: 'hand-added' }],
    ['stages outside the ten-member list — lint.js:124 checks presence only',
      { name: 'x', consumes: 'custom', produces: 'custom-next', steps: [] }],
    ['a gate step with no id — chore.yaml:58',
      { consumes: 'green', produces: 'reviewed', steps: [{ gate: 'human', reason: 'approve' }] }],
    ['a script step with no `run` — lint has no rule for it',
      { consumes: 'red', produces: 'green', steps: [{ id: 's', type: 'script' }] }],
    ['an agent step carrying nothing but an id',
      { consumes: 'draft', produces: 'requirements', steps: [{ id: 'a' }] }],
  ];

  /**
   * The same flow written once per step kind, each with its step carrying NO id.
   *
   * `lintFlow` requires an id on none of them: it gathers ids with `steps.filter((step) => step.id)`
   * (spike/src/lint.js:59), so an id-less step is absent from the duplicate-id check and no other
   * rule in the function looks for one. Until iteration 5 this schema required `id` on the agent,
   * script, integrate and fan-out kinds — and `parallel` members inherited the requirement through
   * `agentStepSchema` — which is four presence rules lint does not have, and the exact failure E-1
   * names. The gate step was never the exception it looked like; it was the only kind that had been
   * checked.
   *
   * Each row carries whatever else its kind needs to lint clean (`branches` on integrate, a `step:`
   * template on fan-out), so the only thing under test is the missing id.
   */
  const ID_LESS_CASES: [string, Record<string, unknown>][] = [
    ['a plain agent step',
      { consumes: 'a', produces: 'b', steps: [{ role: 'r', adapter: 'claude' }] }],
    ['a `parallel` member',
      { consumes: 'a', produces: 'b', steps: [{ parallel: [{ role: 'r', adapter: 'claude' }, { role: 'r', adapter: 'codex' }] }] }],
    ['a script step',
      { consumes: 'a', produces: 'b', steps: [{ type: 'script', run: 'pnpm test' }] }],
    ['an integrate step',
      { consumes: 'a', produces: 'b', steps: [{ type: 'integrate', branches: ['harness/{id}/implement'] }] }],
    ['a fan-out step',
      { consumes: 'a', produces: 'b', steps: [{ fan_out: { by: 'role' }, step: { role: 'developer-{role}' } }] }],
    ['a gate step — chore.yaml:58, the one kind that was already right',
      { consumes: 'a', produces: 'b', steps: [{ gate: 'human', reason: 'approve' }] }],
  ];

  /**
   * Flows the real `lintFlow` also accepts, and this schema rejects — because `lintFlow`
   * type-checks almost nothing: where a value reaches it at all it reaches `String()` or
   * `.includes()`, which accept anything. This is E-1's boundary, in the direction E-1 chose:
   * describing what a value may be is the package's reason to exist, and closing the gap the other
   * way means `z.unknown()` on every field.
   */
  const TYPE_DIVERGENCE_CASES: [string, Record<string, unknown>][] = [
    ['a step adapter that is a number', { consumes: 'a', produces: 'b', steps: [{ id: 'a', adapter: 42 }] }],
    ['a step id that is a number', { consumes: 'a', produces: 'b', steps: [{ id: 42 }] }],
    ['a gate that is a number', { consumes: 'a', produces: 'b', steps: [{ gate: 42 }] }],
    ['`cross_vendor` that is a number', { consumes: 'a', produces: 'b', cross_vendor: 42, steps: [] }],
    ['a bare string where a step object belongs', { consumes: 'a', produces: 'b', steps: ['just-a-string'] }],
    ['`max_turns` that is a word', { consumes: 'a', produces: 'b', steps: [{ id: 'a', max_turns: 'many' }] }],
  ];

  test('presence: every flow the real lintFlow accepts parses here, unchanged', async () => {
    const lintFlow = await spikeLintFlow();
    for (const [why, flow] of PRESENCE_CASES) {
      expect(lintAccepts(lintFlow, flow), `lintFlow must accept: ${why}`).toBe(true);
      const result = flowSchema.safeParse(flow);
      expect(result.error?.issues ?? [], `schema must accept: ${why}`).toEqual([]);
      expect(result.data, `schema must not alter: ${why}`).toEqual(flow);
    }
  });

  test('presence: no step kind requires an id, because lintFlow requires one on none of them', async () => {
    const lintFlow = await spikeLintFlow();
    for (const [what, flow] of ID_LESS_CASES) {
      expect(lintAccepts(lintFlow, flow), `lintFlow accepts ${what} with no id — that is the premise`).toBe(true);
      const result = flowSchema.safeParse(flow);
      expect(result.error?.issues ?? [], `the schema must accept ${what} with no id`).toEqual([]);
      expect(result.data, `the schema must not alter ${what}`).toEqual(flow);
    }
  });

  test('presence: an id-less step is still parsed as its own kind, not demoted to an agent step', () => {
    // Making `id` optional must not blur the selector: `stepKind` reads the truthiness of
    // `parallel`, `gate` and `fan_out` and then `type`, none of which is `id`. So a malformed
    // id-less step of a kind keeps getting that kind's issue — and lint's message about it — rather
    // than falling through to the permissive agent branch.
    for (const [step, expectedPath] of [
      [{ gate: 42 }, 'steps.0.gate'],
      [{ type: 'script', run: 5 }, 'steps.0.run'],
      [{ type: 'integrate', branches: 7 }, 'steps.0.branches'],
      [{ fan_out: 42 }, 'steps.0.fan_out'],
    ] as [Record<string, unknown>, string][]) {
      const result = flowSchema.safeParse({ consumes: 'a', produces: 'b', steps: [step] });
      expect(result.success, JSON.stringify(step)).toBe(false);
      expect(result.error?.issues.map((issue) => issue.path.join('.')), JSON.stringify(step))
        .toContain(expectedPath);
    }
  });

  // Q-0057 made the review artifact run-scoped and left the implement report flat, so a revise
  // round's report replaced the previous round's and the evidence a criterion was verified with
  // stopped existing. Q-0037 review round 2 found exactly that and could not check four criteria;
  // its erratum E-2 is the record. The rule is the pair, not either path: an artifact a bounded
  // loop rewrites is named by BOTH the run and the iteration, and the step that reads it globs the
  // iteration within its own run. Asserted over the shipped file rather than over a fixture,
  // because the shipped file is what a run loads.
  test('chore.yaml: every artifact a revise round rewrites is named by its run and its iteration', () => {
    const chore = flowFiles().find((file) => path.basename(file) === 'chore.yaml');
    expect(chore, 'chore.yaml must be among the shipped flows').toBeDefined();
    // Parsed through the schema rather than cast: the shape these assertions read is the shape the
    // engine is handed, and a cast would let a rename here pass while a run broke.
    const flow = flowSchema.parse(loadAsTheEngineDoes(chore!));
    expect(flow.steps, 'chore.yaml must still declare steps').toBeDefined();
    const steps = flow.steps ?? [];
    const step = (id: string): { output?: { writes?: unknown }; input?: { backlog?: unknown } } => {
      const found = steps.find((s) => 'id' in s && s.id === id);
      expect(found, `chore.yaml must still have a step called ${id}`).toBeDefined();
      return found as { output?: { writes?: unknown }; input?: { backlog?: unknown } };
    };

    // The two writers inside the loop. Both carry {run} AND {iter}: {run} alone lets iteration 2
    // overwrite iteration 1, and {iter} alone lets run 2 overwrite run 1 — which is the defect
    // Q-0057 fixed on one path and this closes on the other.
    for (const [id, expected] of [
      ['implement', 'dev/chore/run-{run}/implement-iter-{iter}.md'],
      ['review', 'review/chore/run-{run}/chore-iter-{iter}.md'],
    ] as const) {
      expect(step(id).output?.writes, `${id} writes one run- and iteration-scoped artifact`).toStrictEqual([expected]);
    }

    // Each reader globs the OTHER step's artifacts within its own run, so a round sees every
    // earlier round of this run and no earlier run's. A flat path here would read one file and a
    // {run}-less glob would mix runs.
    for (const [id, expected] of [
      ['implement', 'review/chore/run-{run}/chore-iter-*.md'],
      ['review', 'dev/chore/run-{run}/implement-iter-*.md'],
    ] as const) {
      expect(step(id).input?.backlog, `${id} reads its own run's artifacts and no others`).toContain(expected);
    }

    // The flat spellings are gone from the file entirely, not merely unreferenced by these four
    // assertions — a second `writes:` naming one would satisfy everything above.
    const text = read(chore!);
    for (const flat of ['dev/implement-report.md', 'review/chore-iter-']) {
      expect(text, `chore.yaml must not name the flat ${flat}`).not.toContain(flat);
    }
  });

  test('presence: the six shipped flows lint clean and parse, as the engine hands them over', async () => {
    const lintFlow = await spikeLintFlow();
    for (const file of flowFiles()) {
      const flow = loadAsTheEngineDoes(file);
      expect(lintAccepts(lintFlow, flow), `${path.basename(file)} must lint clean`).toBe(true);
      expect(flowSchema.parse(flow), `${path.basename(file)} must parse unchanged`).toEqual(flow);
    }
  });

  test('types: the boundary E-1 draws — lint accepts these, the schema rejects them', async () => {
    const lintFlow = await spikeLintFlow();
    for (const [why, flow] of TYPE_DIVERGENCE_CASES) {
      expect(lintAccepts(lintFlow, flow), `lintFlow accepts ${why} — that is the premise`).toBe(true);
      expect(flowSchema.safeParse(flow).success, `the schema rejects ${why} — that is the boundary`).toBe(false);
    }
  });

  test('`consumes` and `produces` stay required, because lint requires them too', async () => {
    const lintFlow = await spikeLintFlow();
    // lint.js:124 pushes "flow needs consumes/produces", so requiring them adds no rule.
    expect(lintAccepts(lintFlow, {})).toBe(false);
    expect(flowSchema.safeParse({}).success).toBe(false);
    expect(lintAccepts(lintFlow, { consumes: 'a', steps: [] })).toBe(false);
    expect(flowSchema.safeParse({ consumes: 'a', steps: [] }).success).toBe(false);
  });

  test('`steps` present but not an array is not part of the divergence — lint does not accept it either', async () => {
    const lintFlow = await spikeLintFlow();
    // E-1 names this shape explicitly. `flattenSteps` throws a raw TypeError — NOT a FlowError — on
    // both, so `lintAccepts` re-raises rather than counting a crash as a refusal, and the schema
    // narrows nothing by rejecting them.
    for (const steps of [null, [null]]) {
      expect(() => lintAccepts(lintFlow, { name: 'x', consumes: 'a', produces: 'b', steps }))
        .toThrow(TypeError);
      expect(flowSchema.safeParse({ name: 'x', consumes: 'a', produces: 'b', steps }).success).toBe(false);
    }
  });

  test('no zod issue replaces a lint message: the semantic refusals stay lint\'s', async () => {
    const lintFlow = await spikeLintFlow();
    // AC-4 rule 1, which E-1 leaves untouched. Each of these is a flow the SCHEMA accepts and LINT
    // refuses — the opposite direction from the property, and the one that must keep working, since
    // a schema that rejected first would take the sixteen messages out of `quorum lint`'s output.
    const semantic: [string, Record<string, unknown>][] = [
      ['duplicate step ids', { consumes: 'a', produces: 'b', steps: [{ id: 'x' }, { id: 'x' }] }],
      ['a goto that resolves nowhere', { consumes: 'a', produces: 'b', steps: [{ id: 'x', on_fail: { goto: 'nope', max_iterations: 1, on_exhausted: 'gate' } }] }],
      ['on_exhausted that is not "gate"', { consumes: 'a', produces: 'b', steps: [{ id: 'x', on_fail: { goto: 'x', max_iterations: 1, on_exhausted: 'abort' } }] }],
      ['an `iterations.`-prefixed counter', { consumes: 'a', produces: 'b', steps: [{ id: 'x', on_fail: { goto: 'x', counter: 'iterations.review', max_iterations: 1, on_exhausted: 'gate' } }] }],
      ['a verdict that routes nowhere', { consumes: 'a', produces: 'b', steps: [{ id: 'x', output: { verdict: 'approve|revise' } }] }],
      ['an integrate step with no branches', { consumes: 'a', produces: 'b', steps: [{ id: 'i', type: 'integrate' }] }],
      ['a fan_out with no step template', { consumes: 'a', produces: 'b', steps: [{ id: 'f', fan_out: { by: 'role' } }] }],
      ['an out-of-class input.diff range', { consumes: 'a', produces: 'b', steps: [{ id: 'x', input: { diff: 'main...some/other/ref' } }] }],
      ['a deploy flow with no human-locked gate', { consumes: 'a', produces: 'deployed', steps: [{ gate: 'human' }] }],
    ];
    for (const [why, flow] of semantic) {
      expect(lintAccepts(lintFlow, flow), `lint must refuse ${why}`).toBe(false);
      const result = flowSchema.safeParse(flow);
      expect(result.error?.issues ?? [], `the schema must NOT refuse ${why} — that message is lint's`).toEqual([]);
    }
  });
});

describe('AC-4 — the schema invents nothing and discards nothing', () => {
  test('no field in the package carries a zod default or a swallowed error', () => {
    for (const [name, text] of sharedSourceFiles()) {
      expect(text, `${name} must not default silently`).not.toContain('.default(');
      expect(text, `${name} must not swallow a parse failure`).not.toContain('.catch(');
    }
  });

  test('an accepted flow survives parsing with no key or value removed or added', () => {
    for (const file of flowFiles()) {
      const flow = loadAsTheEngineDoes(file);
      expect(flowSchema.parse(flow), `${path.basename(file)} round-trip`).toEqual(flow);
    }
  });

  test('unknown keys are preserved, not stripped, at every depth', () => {
    const flow = {
      name: 'x', consumes: 'draft', produces: 'requirements', steps: [
        { parallel: [{ id: 'a', unknown_member_key: 1 }], unknown_group_key: 2 },
        { id: 'b', input: { backlog: ['ticket.md'], unknown_input_key: 3 }, on_fail: { goto: 'a', max_iterations: 1, on_exhausted: 'gate', unknown_on_fail_key: 4 } },
      ],
      unknown_top_key: 5,
    };
    expect(flowSchema.parse(flow)).toEqual(flow);
  });

  test('`route` is carried untouched, not given a shape', () => {
    // requirements/errata.md E-2. spike/src/lint.js:77 tests only `!step.route`; no shipped flow
    // uses it; and docs/02-sdlc-pipeline-spec.md:370 sketches it as a step of its own, which is a
    // different shape from the one lint reads. Whatever an author writes survives parsing exactly.
    for (const route of ['qa-final', { pass: 'deploy', fail: 'development' }, ['a', 'b']]) {
      const step = { id: 'verdict', output: { verdict: 'pass|fail' }, route };
      expect(flowStepSchema.parse(step), JSON.stringify(route)).toEqual(step);
    }
  });

  test('a step\'s `output` block is the one object that rejects instead of preserving', () => {
    // Rejected explicitly, never dropped: the engine reads this block exhaustively, so a key it
    // does not know is a key nothing acts on. `append` (docs/02-sdlc-pipeline-spec.md:365) is the
    // named casualty and is a stop-and-report for whichever ticket writes qa-final.yaml.
    const result = flowStepSchema.safeParse({ id: 'x', output: { write: 'a.md', wrties: 'b.md' } });
    expect(result.success).toBe(false);
    expect(flowStepSchema.safeParse({ id: 'x', output: { append: 'qa/final-report.md' } }).success).toBe(false);
  });
});

describe('Q-0069 AC-7 — the deprecated zod object API is gone, and stays gone', () => {
  // THE PIN FOR ONE MIGRATION, and deliberately not more. The general net is
  // `@typescript-eslint/no-deprecated` in eslint.config.js, which catches the NEXT deprecation in
  // any dependency without anyone thinking to look — but it runs in `pnpm lint`, and
  // harness/harness.yaml's `commands.test` runs the two suites and neither gate, so a chore run's
  // `integrate` cannot see a lint failure. This assertion is the half a flow run can see.
  //
  // The needle is assembled rather than written so the check is sound with respect to its own
  // text: `sharedSourceFiles()` skips `*.test.ts` today, and a check that fails on itself if it
  // ever moves is one refactor away from being deleted rather than fixed. Same device, and the
  // same reason, as index.test.ts:11.
  const DEPRECATED_OBJECT_CALL = `.${'passthrough'}(`;

  test('no source file in the package calls the deprecated passthrough', () => {
    for (const [name, text] of sharedSourceFiles()) {
      expect(text, `${name} must spell preservation z.looseObject, not the deprecated method`)
        .not.toContain(DEPRECATED_OBJECT_CALL);
    }
  });
});
