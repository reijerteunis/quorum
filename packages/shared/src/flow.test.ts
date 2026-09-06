import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { flowSchema, flowStepSchema } from './flow.js';
import { flowFiles, parseYaml, read, sharedSourceFiles } from '../test/corpus.js';

// `loadFlow` assigns `flow.file = file` onto the parsed object BEFORE lint or anything else sees
// it (spike/src/engine.js:15-20). Every corpus flow is parsed the way the engine parses it,
// injected key included, because that is the object the rest of the product actually holds.
function loadAsTheEngineDoes(file: string): Record<string, unknown> {
  const flow = parseYaml(file) as Record<string, unknown>;
  flow.file = file;
  return flow;
}

/**
 * The interpolation variables that scope a write path to one execution.
 *
 * `{run}` is the id `runs.log` carries as `run=N`, allocated per ticket and monotonic across every
 * flow, so two flows writing into one directory never collide. `{round}` is `review.yaml`'s own
 * counter, derived from the ticket directory rather than from the run, and it increments once per
 * review run — a different variable reaching the same guarantee, which is why it counts here and
 * why `review/round-<n>/` was never the defect the flat paths were.
 */
const SCOPING_VARS = ['{run}', '{round}'];

/**
 * Every path a step writes, in the engine's own terms.
 *
 * Mirrors `writesOf` (`spike/src/engine.js:844`, and `routing.ts`'s port) exactly: BOTH the
 * singular `write:` and the plural `writes:`, in that order. Reading only `writes:` is how the
 * first draft of this guard went blind to `solutioning.yaml`'s `merge-contracts`, which is the only
 * shipped integrate step using the singular — a check that cannot see half its subject, found by
 * the register beside it rather than by review.
 */
function writePathsOf(step: Record<string, unknown>): string[] {
  const output = step.output as { write?: unknown; writes?: unknown } | undefined;
  return [...(output?.write ? [output.write] : []), ...((output?.writes as unknown[]) ?? [])].map(String);
}

/**
 * The ids a backward edge can re-enter, so their steps may be written more than once in one run.
 *
 * A `goto` naming another flow ends this run and is not a loop here. Everything from the target's
 * position through the edge's own position is re-runnable, which is what makes `{iter}` load-bearing
 * rather than decorative.
 */
function loopReachable(flow: Record<string, unknown>): Set<string> {
  const top = (flow.steps ?? []) as Record<string, unknown>[];
  const idsAt = top.map((s) => (s.parallel ? (s.parallel as Record<string, unknown>[]).map((m) => m.id) : [s.id]));
  const positionOf = new Map<string, number>();
  idsAt.forEach((ids, index) => ids.forEach((id) => { if (typeof id === 'string') positionOf.set(id, index); }));

  const reachable = new Set<string>();
  top.forEach((step, index) => {
    const members = (step.parallel ? (step.parallel as Record<string, unknown>[]) : [step]);
    for (const member of members) {
      const target = (member.on_fail as Record<string, unknown> | undefined)?.goto;
      if (typeof target !== 'string' || target.startsWith('flow:')) continue;
      const from = positionOf.get(target);
      expect(from, `${String(flow.name)}: on_fail goto names ${target}, which is not a step`).toBeDefined();
      for (let at = from!; at <= index; at += 1) {
        for (const id of idsAt[at]!) if (typeof id === 'string') reachable.add(id);
      }
    }
  });
  return reachable;
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
// What is left here of the property, and where the rest of it went.
//
// **Q-0107 AC-9/AC-10 — `moved`.** Seven tests stood here and reached the real `lintFlow` by
// importing `spike/src/lint.js` through a file URL, because that was the only linter this package
// could execute: the dependency direction is `core → shared` and never the reverse
// (04-architecture.md), so `packages/core`'s own linter was out of reach from here. Q-0103 deletes
// the spike and there is no third linter to re-aim at, so the tests went to
// `packages/core/src/lint/lint.test.ts`, where both `lintFlow` and `flowSchema` are importable —
// the same fixtures, the same assertions, one `describe` down the file, under
// *"Q-0041 AC-3 as errata E-1 amends it"*. `lintAccepts` went with them.
//
// The two below stay because neither ever ran the linter: they are statements about this schema
// and about a shipped flow file, which is what this package is for.
// ---------------------------------------------------------------------------------------------
describe('AC-3 — what the schema says on its own, with no linter in the room', () => {
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

describe('Q-0087 — every artifact a run can rewrite is named by what makes it unique', () => {
  // The rule, stated once and applied by derivation rather than by a list of paths: a write path
  // carries {run}, and one a bounded loop can re-enter within a run additionally carries {iter}.
  // {run} alone lets iteration 2 overwrite iteration 1; {iter} alone lets run 2 overwrite run 1.
  // Derived from each flow's own on_fail edges, so a flow that gains a loop or a step is covered
  // without anyone remembering to come back here.
  test('a write path is scoped, or it is a pointer beside a scoped copy written by the same step', () => {
    for (const file of flowFiles()) {
      const flow = flowSchema.parse(loadAsTheEngineDoes(file));
      const loops = loopReachable(flow as Record<string, unknown>);
      for (const step of (flow.steps ?? [])) {
        const members = ('parallel' in step && Array.isArray(step.parallel) ? step.parallel : [step]) as Record<string, unknown>[];
        for (const member of members) {
          const paths = writePathsOf(member);
          const scoped = (target: string): boolean => SCOPING_VARS.some((variable) => target.includes(variable));
          for (const target of paths) {
            const where = `${path.basename(file)} ${String(member.id)} → ${target}`;
            if (!scoped(target)) {
              // The pointer case, and the ONLY licence a flat path has. `review.yaml`'s verdict step
              // is the pattern: a per-round copy for history beside a stable name its consumer in a
              // LATER run reads as a literal. A later run cannot glob `{run}`, because `{run}` is the
              // reading run's own id — which is why a cross-flow artifact is a pointer and not a
              // glob, and why this is a property rather than a list of excused paths.
              expect(paths.some(scoped), `${where} is flat, so the same step must also write a scoped copy — otherwise a second run replaces it with no history`).toBe(true);
              continue;
            }
            const inLoop = typeof member.id === 'string' && loops.has(member.id);
            expect(target.includes('{iter}'), `${where}: {iter} is required exactly when a loop re-enters the step (loop-reachable: ${String(inLoop)})`).toBe(inLoop);
          }
        }
      }
    }
  });

  // Every flat path a flow still writes, named, so that adding one is a visible act. This is the
  // register that used to hold fourteen entries with a prose reason each; the pointer rule above
  // replaced the reasons, and what is left is an identity check on the four that remain.
  test('the flat pointers are exactly the four artifacts a later flow reads by literal name', () => {
    const flat: string[] = [];
    for (const file of flowFiles()) {
      const flow = flowSchema.parse(loadAsTheEngineDoes(file));
      for (const step of (flow.steps ?? [])) {
        const members = ('parallel' in step && Array.isArray(step.parallel) ? step.parallel : [step]) as Record<string, unknown>[];
        for (const member of members) {
          for (const target of writePathsOf(member)) {
            if (!SCOPING_VARS.some((variable) => target.includes(variable))) flat.push(target);
          }
        }
      }
    }
    expect(flat.sort()).toStrictEqual([
      'requirements/merged.md',
      'review/verdict.md',
      'solution/solution.md',
      'solution/tasks.yaml',
    ]);
  });

  // The trap this change had to walk past, pinned so the next rename cannot spring it. Both engines
  // choose an integrate step's CONTENT by whether its write path contains the substring "report"
  // (spike/src/engine.js:1241, packages/core/src/engine/composite.ts:340) — the test output if it
  // does, the integration notes if it does not. So a path renamed across that boundary silently
  // swaps what the file holds, and nothing else would notice.
  test('an integrate step\'s write paths keep the content class their spelling selects', () => {
    const REPORT_CLASS: Record<string, ('notes' | 'report')[]> = {
      'chore.yaml': ['notes'],
      'development.yaml': ['notes', 'report'],
      'qa-red.yaml': ['notes', 'report'],
      // Registered by the guard's own first run, which found this integrate step where the draft
      // register had none: `solution/integration.md` is flat, and it stays flat for the reason in
      // FLAT_BY_DESIGN, but its content class is pinned like the others.
      'solutioning.yaml': ['notes'],
    };
    for (const file of flowFiles()) {
      const flow = flowSchema.parse(loadAsTheEngineDoes(file));
      const integrates = (flow.steps ?? []).filter((step) => 'type' in step && step.type === 'integrate') as Record<string, unknown>[];
      const expected = REPORT_CLASS[path.basename(file)];
      if (!expected) {
        expect(integrates, `${path.basename(file)} has an integrate step and no expected content classes`).toHaveLength(0);
        continue;
      }
      expect(integrates, `${path.basename(file)} must still have exactly one integrate step`).toHaveLength(1);
      const classes = writePathsOf(integrates[0]!).map((target) => (target.includes('report') ? 'report' : 'notes'));
      expect(classes, `${path.basename(file)}'s integrate writes, by the class its spelling selects`).toStrictEqual(expected);
    }
  });
});

