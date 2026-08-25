import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { flowSchema, flowStepSchema } from './flow.js';
import { flowFiles, parseYaml, sharedSourceFiles } from '../test/corpus.js';

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
    // fail that kind's branch and then accept the object as an agent step, where `.passthrough()`
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

  test('no key is required here that lint does not require', () => {
    // All three lint clean today — spike/src/lint.js:127 prints `flow.name ?? flow.file`, and
    // `flattenSteps(steps = [])` at spike/src/lint.js:7 defaults `steps` away — so requiring
    // either key would be zod adding a rule lint does not have. Each verdict below was taken from
    // the real `lintFlow`; the transcript is in dev/implement-report.md.
    for (const flow of [
      { consumes: 'green', produces: 'reviewed', steps: [] },        // no name
      { name: 'x', consumes: 'green', produces: 'reviewed' },        // no steps
      { consumes: 'green', produces: 'reviewed' },                   // neither
    ]) {
      const result = flowSchema.safeParse(flow);
      expect(result.error?.issues ?? [], JSON.stringify(flow)).toEqual([]);
      expect(result.data).toEqual(flow);
    }
    // `consumes` and `produces` stay required, and that is not an added rule either: lint pushes
    // "flow needs consumes/produces" at spike/src/lint.js:124, so `{}` fails both.
    expect(flowSchema.safeParse({}).success).toBe(false);
  });

  test('`steps` present but not an array is rejected — which is where lint stops accepting too', () => {
    // Not an exception to the property: `flattenSteps` throws a raw TypeError on both of these, so
    // `lintFlow` does not succeed on them and nothing is narrowed by refusing them here.
    expect(flowSchema.safeParse({ name: 'x', consumes: 'a', produces: 'b', steps: null }).success).toBe(false);
    expect(flowSchema.safeParse({ name: 'x', consumes: 'a', produces: 'b', steps: [null] }).success).toBe(false);
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

  test('a step\'s `output` block is the one object that rejects instead of preserving', () => {
    // Rejected explicitly, never dropped: the engine reads this block exhaustively, so a key it
    // does not know is a key nothing acts on. `append` (docs/02-sdlc-pipeline-spec.md:365) is the
    // named casualty and is a stop-and-report for whichever ticket writes qa-final.yaml.
    const result = flowStepSchema.safeParse({ id: 'x', output: { write: 'a.md', wrties: 'b.md' } });
    expect(result.success).toBe(false);
    expect(flowStepSchema.safeParse({ id: 'x', output: { append: 'qa/final-report.md' } }).success).toBe(false);
  });
});
