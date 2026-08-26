// Q-0044: the ported linter, asserted message by message.
//
// Between this ticket and Q-0054, this file is the ONLY thing asserting that `core`'s linter says
// what the spike's linter says: the two suites that pin this behaviour today —
// spike/test/q0033-surface.js and spike/test/q0035-empty-range.js — import from spike/src/ and are
// frozen under charter §3. So the literals below are the specification, not belt-and-braces, and
// every one of them was obtained by RUNNING spike/src/lint.js rather than transcribed by eye. The
// merged requirement records what happens otherwise: it introduced a defect into message 12 while
// copying it.
import path from 'node:path';

import { afterAll, describe, expect, test } from 'vitest';

import {
  FlowError, flattenSteps, lintDirectory, lintFlow, lintFlowDirectory, validateFlowDirectory,
} from './lint.js';
import { repoRoot } from '../../test/corpus.js';
import { removeTempDirs, tempDir, write } from '../../test/repo.js';

afterAll(removeTempDirs);

/** The whole refusal, split into its header and its bullets — nothing else parses lint's output. */
function refusal(flow: unknown): { header: string; problems: string[]; message: string } {
  let thrown: unknown;
  try {
    lintFlow(flow);
  } catch (error) {
    thrown = error;
  }
  expect(thrown, 'lintFlow was expected to refuse this flow and did not').toBeInstanceOf(FlowError);
  const message = (thrown as Error).message;
  const [header, ...rest] = message.split('\n');
  return { header, problems: rest.map((line) => line.replace(/^ {2}- /, '')), message };
}

/** A fixture built to produce exactly one problem, so the assertion is the message and nothing else. */
function onlyProblem(flow: unknown): string {
  const { problems } = refusal(flow);
  expect(problems, 'the fixture must isolate one message').toHaveLength(1);
  return problems[0];
}

/** A flow directory built from scratch, so no criterion depends on this repository's own state. */
function flowsDir(files: Record<string, string>): string {
  const dir = tempDir('lint-');
  for (const [name, text] of Object.entries(files)) write(path.join(dir, name), text);
  return dir;
}

const yaml = (lines: string[]): string => lines.join('\n') + '\n';

/** A flow that consumes one stage and produces another, and does nothing else. */
const basic = (name: string, consumes: string, produces: string): string =>
  yaml([`name: ${name}`, `consumes: ${consumes}`, `produces: ${produces}`, 'steps: []']);

/** The shipped review flow's shape, reduced to the one edge the return-chain walk follows. */
const reviewWith = (target: string): string => yaml([
  'name: review', 'consumes: green', 'produces: reviewed', 'steps:',
  '  - id: verdict', '    role: code-reviewer', '    adapter: claude', '    output:',
  '      verdict: approve|changes-requested', '    on_fail:', `      goto: ${target}`,
  '      counter: review', '      max_iterations: 3', '      on_exhausted: gate',
]);

const step = (extra: Record<string, unknown>): Record<string, unknown> => ({ id: 's', ...extra });
const flowOf = (...steps: unknown[]): Record<string, unknown> => ({ name: 'f', consumes: 'x', produces: 'y', steps });

describe('AC-2 — the sixteen messages, verbatim', () => {
  test('1 — duplicate step id', () => {
    expect(onlyProblem(flowOf({ id: 'twin' }, { id: 'twin' }))).toBe('duplicate step id "twin"');
  });

  test('2 — on_fail without goto', () => {
    expect(onlyProblem(flowOf(step({ on_fail: { max_iterations: 1, on_exhausted: 'gate' } }))))
      .toBe('s: on_fail without goto');
  });

  test('3 — goto target not found', () => {
    expect(onlyProblem(flowOf(step({ on_fail: { goto: 'nope', max_iterations: 1, on_exhausted: 'gate' } }))))
      .toBe('s: goto target "nope" not found');
  });

  test('4 — max_iterations must be an integer greater than zero', () => {
    expect(onlyProblem(flowOf(step({ on_fail: { goto: 's', max_iterations: 0, on_exhausted: 'gate' } }))))
      .toBe('s: on_fail.max_iterations must be an integer greater than zero');
  });

  test('5 — counter must be a non-empty unprefixed key', () => {
    expect(onlyProblem(flowOf(step({ on_fail: { goto: 's', counter: '', max_iterations: 1, on_exhausted: 'gate' } }))))
      .toBe('s: on_fail.counter must be a non-empty unprefixed key');
  });

  test('6 — a prefixed counter, with the correction spelled out', () => {
    expect(onlyProblem(flowOf(step({ on_fail: { goto: 's', counter: 'iterations.review', max_iterations: 1, on_exhausted: 'gate' } }))))
      .toBe('s: counter "iterations.review" must be unprefixed; use "review"');
  });

  test('7 — on_exhausted must be "gate"', () => {
    expect(onlyProblem(flowOf(step({ on_fail: { goto: 's', max_iterations: 1, on_exhausted: 'advance' } }))))
      .toBe('s: on_exhausted must be "gate"');
  });

  test('8 — a verdict with nowhere to go', () => {
    expect(onlyProblem(flowOf(step({ output: { verdict: 'approve|changes-requested' } }))))
      .toBe('s: has a verdict but no on_fail/route — verdicts must go somewhere');
  });

  test('9 — fan_out needs a step template', () => {
    expect(onlyProblem(flowOf(step({ fan_out: { from: 'solution/tasks.yaml' } }))))
      .toBe('s: fan_out needs a step template');
  });

  test('10 — integrate needs branches', () => {
    expect(onlyProblem(flowOf(step({ type: 'integrate' })))).toBe('s: integrate needs branches');
  });

  test('11 — the diff range rule, with the value quoted back', () => {
    const problem = onlyProblem(flowOf(step({ input: { diff: 'bogus' } })));
    expect(problem).toBe('s: input.diff must be two "..."-joined endpoints, each "{base}" or "harness/{id}/…", got "bogus"');
    // The ellipsis is one character, U+2026, and the three dots earlier in the sentence are three.
    // A rewrite that normalises them is a changed message the frozen suite cannot see until Q-0054.
    expect(problem).toContain('"harness/{id}/…"');
    expect(problem.includes('harness/{id}/..."'), 'the ellipsis must not become three dots').toBe(false);
  });

  test('12 — the panel message, which has NO colon after the id list', () => {
    const problem = onlyProblem({
      name: 'f', consumes: 'x', produces: 'y', cross_vendor: 'required',
      steps: [{ parallel: [{ id: 'r1', role: 'rev', adapter: 'claude' }, { id: 'r2', role: 'rev', adapter: 'claude' }] }],
    });
    expect(problem).toBe('parallel group r1, r2 shares role "rev" and adapter "claude" — cross_vendor: required needs at least two adapters');
    // Asserted as its own case because this is where transcription has already failed once: the
    // merged requirement's base candidate wrote `parallel group ${ids}: shares role …`.
    expect(problem.startsWith('parallel group r1, r2 shares'), 'no colon follows the id list').toBe(true);
  });

  test('13 — a judge reading only its own vendor\'s work', () => {
    expect(onlyProblem({
      name: 'f', consumes: 'x', produces: 'y', cross_vendor: 'required',
      steps: [
        { id: 'w', role: 'author', adapter: 'claude', output: { write: 'draft.md' } },
        { id: 'j', role: 'judge', adapter: 'claude', input: { backlog: ['draft.md'] }, output: { verdict: 'ok|no' }, route: {} },
      ],
    })).toBe('j: every input it judges (draft.md) was written by its own vendor (claude) — cross_vendor: required');
  });

  test('14 — a loop that cannot converge', () => {
    expect(onlyProblem(flowOf(
      { id: 'author', role: 'r', adapter: 'claude', input: { backlog: ['spec.md'] }, output: { write: 'draft.md' } },
      { id: 'judge', role: 'r', adapter: 'codex', input: { backlog: ['draft.md'] }, output: { write: 'review.md', verdict: 'ok|no' }, on_fail: { goto: 'author', max_iterations: 2, on_exhausted: 'gate' } },
    ))).toBe('judge: loops back to "author", which never receives review.md — the loop cannot converge');
  });

  test('15 — a flow with no consumes/produces', () => {
    expect(onlyProblem({ name: 'f', steps: [] })).toBe('flow needs consumes/produces');
  });

  test('16 — a deploy flow with no human-locked gate', () => {
    expect(onlyProblem({ name: 'f', consumes: 'x', produces: 'deployed', steps: [{ gate: 'human', reason: 'ship it' }] }))
      .toBe('deploy flow must contain a human-locked gate');
    expect(lintFlow({ name: 'f', consumes: 'x', produces: 'deployed', steps: [{ gate: 'human-locked', reason: 'ship it' }] })).toBe(true);
  });

  test('the header names the flow, and `name` outranks `file`', () => {
    expect(refusal({ name: 'named', consumes: 'x', produces: 'y', steps: [step({ type: 'integrate' })] }).header)
      .toBe('flow named invalid:');
    expect(refusal({ file: '/w/flows/review.yaml', consumes: 'x', produces: 'y', steps: [step({ type: 'integrate' })] }).header)
      .toBe('flow /w/flows/review.yaml invalid:');
    expect(refusal({ name: 'named', file: '/w/flows/review.yaml', consumes: 'x', produces: 'y', steps: [step({ type: 'integrate' })] }).header)
      .toBe('flow named invalid:');
  });

  test('every problem arrives in one pass, in source order, as one FlowError', () => {
    const { message } = refusal({
      name: 'many', produces: 'deployed', cross_vendor: 'required',
      steps: [
        { id: 'dup', role: 'w', adapter: 'claude', output: { write: 'a.md' }, on_fail: { goto: 'dup', max_iterations: 0, counter: 'iterations.x', on_exhausted: 'no' } },
        { id: 'dup', role: 'w', adapter: 'claude' },
        { id: 'v', role: 'r', adapter: 'claude', output: { verdict: 'x|y' } },
        { id: 'g', on_fail: { max_iterations: 1, on_exhausted: 'gate' } },
        { id: 'h', on_fail: { goto: 'nope', max_iterations: 1, counter: '  ', on_exhausted: 'gate' } },
        { id: 'fo', fan_out: { from: 'solution/tasks.yaml' } },
        { id: 'in', type: 'integrate' },
        { id: 'df', input: { diff: 'bogus' } },
      ],
    });
    expect(message).toBe([
      'flow many invalid:',
      '  - duplicate step id "dup"',
      '  - dup: on_fail.max_iterations must be an integer greater than zero',
      '  - dup: counter "iterations.x" must be unprefixed; use "x"',
      '  - dup: on_exhausted must be "gate"',
      '  - v: has a verdict but no on_fail/route — verdicts must go somewhere',
      '  - g: on_fail without goto',
      '  - h: goto target "nope" not found',
      '  - h: on_fail.counter must be a non-empty unprefixed key',
      '  - fo: fan_out needs a step template',
      '  - in: integrate needs branches',
      '  - df: input.diff must be two "..."-joined endpoints, each "{base}" or "harness/{id}/…", got "bogus"',
      '  - dup: loops back to "dup", which never receives a.md — the loop cannot converge',
      '  - flow needs consumes/produces',
      '  - deploy flow must contain a human-locked gate',
    ].join('\n'));
  });

  test('the cross-vendor block sits between the diff sites and loop convergence', () => {
    expect(refusal({
      name: 'order', consumes: 'x', produces: 'y', cross_vendor: 'required',
      steps: [
        { id: 'first', input: { diff: 'bogus' }, output: { write: 'a.md' }, on_fail: { goto: 'last', max_iterations: 1, on_exhausted: 'gate' } },
        { parallel: [{ id: 'r1', role: 'rev', adapter: 'claude' }, { id: 'r2', role: 'rev', adapter: 'claude' }] },
        { id: 'last', role: 'r' },
      ],
    }).problems).toEqual([
      'first: input.diff must be two "..."-joined endpoints, each "{base}" or "harness/{id}/…", got "bogus"',
      'parallel group r1, r2 shares role "rev" and adapter "claude" — cross_vendor: required needs at least two adapters',
      'first: loops back to "last", which never receives a.md — the loop cannot converge',
    ]);
  });

  test('a repeated id and several failing steps stay separate bullets', () => {
    expect(refusal(flowOf({ id: 'd' }, { id: 'd' }, { id: 'd' }, { id: 'e', type: 'integrate' }, { id: 'f', type: 'integrate' })).problems)
      .toEqual([
        'duplicate step id "d"',
        'duplicate step id "d"',
        'e: integrate needs branches',
        'f: integrate needs branches',
      ]);
  });

  test('a valid flow returns true', () => {
    expect(lintFlow(flowOf({ id: 'a', role: 'r', adapter: 'claude' }))).toBe(true);
  });
});

describe('AC-3 — flattenSteps stays shallow, and the fan-out template stays invisible', () => {
  test('ordinary steps, a parallel group, mixed ordering, and no argument at all', () => {
    expect(flattenSteps()).toEqual([]);
    expect(flattenSteps([{ id: 'a' }, { id: 'b' }])).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(flattenSteps([{ parallel: [{ id: 'p1' }, { id: 'p2' }] }])).toEqual([{ id: 'p1' }, { id: 'p2' }]);
    expect(flattenSteps([{ id: 'a' }, { parallel: [{ id: 'p1' }, { id: 'p2' }] }, { id: 'z' }]))
      .toEqual([{ id: 'a' }, { id: 'p1' }, { id: 'p2' }, { id: 'z' }]);
  });

  test('it does not descend into a fan_out step\'s `step:` template', () => {
    const template = { id: 'dev:{task.id}', role: 'developer-{role}' };
    expect(flattenSteps([{ id: 'developers', fan_out: { from: 'solution/tasks.yaml' }, step: template }]))
      .toEqual([{ id: 'developers', fan_out: { from: 'solution/tasks.yaml' }, step: template }]);
  });

  test('so a template carrying a duplicate id, a dead goto and a routeless verdict lints clean', () => {
    // The negative that matters: the port must not satisfy AC-4 by making this function recurse.
    // The template's id, role and adapter are placeholders resolved once per task, so the
    // duplicate-id, goto and verdict rules would fire on values that do not exist yet.
    expect(lintFlow(flowOf(
      { id: 'twin', role: 'r' },
      {
        id: 'developers',
        fan_out: { from: 'solution/tasks.yaml' },
        step: {
          id: 'twin', role: 'r',
          on_fail: { goto: 'nowhere-at-all', max_iterations: 1, on_exhausted: 'gate' },
          output: { verdict: 'ok|no' },
        },
      },
    ))).toBe(true);
  });
});

describe('AC-4 — the diff range grammar, at every site a flow can hold one', () => {
  const ACCEPTED = [
    '{base}...harness/{id}/integration',
    'harness/{id}/integration...harness/{id}/implement',
    'harness/{id}/integration...{base}',
    '{base}...harness/{id}/a/b',
  ];

  const REFUSED: [string, unknown][] = [
    ['one endpoint', 'harness/{id}/integration'],
    ['three endpoints', '{base}...harness/{id}/a...harness/{id}/b'],
    ['two dots, not three', 'main..harness/{id}/integration'],
    ['an interpolated base instead of {base}', 'main...harness/{id}/integration'],
    ['another ticket\'s branch', '{base}...harness/Q-0001/integration'],
    ['a ref belonging to no ticket', 'harness/other/x...{base}'],
    ['a bare ticket prefix with no branch', 'harness/{id}/'],
    ['an empty suffix after the prefix', '{base}...harness/{id}/'],
    ['an empty endpoint', '{base}...'],
    ['leading whitespace', ' {base}...harness/{id}/integration'],
    ['whitespace after the base endpoint', '{base} ...harness/{id}/integration'],
    ['whitespace before a ticket endpoint', '{base}... harness/{id}/integration'],
    ['whitespace after the base endpoint, on the right', 'harness/{id}/integration...{base} '],
    ['the empty string', ''],
    ['a number', 42],
    ['a boolean', true],
  ];

  test('every accepted range passes, and `{id}` is never interpolated', () => {
    for (const range of ACCEPTED) {
      expect(lintFlow(flowOf(step({ input: { diff: range } }))), range).toBe(true);
    }
  });

  test('every refused range gives message 11 with its value quoted back', () => {
    for (const [why, value] of REFUSED) {
      expect(onlyProblem(flowOf(step({ input: { diff: value } }))), why)
        .toBe(`s: input.diff must be two "..."-joined endpoints, each "{base}" or "harness/{id}/…", got ${JSON.stringify(value)}`);
    }
  });

  test('the site inside a fan_out template is read, and labelled `<step id>.step`', () => {
    // Register row 12, and the one rule with no corpus behind it: there is no `input.diff` inside a
    // fan-out template in any of the twelve shipped flow files, so a port that dropped this site
    // would leave all twelve linting clean. Q-0035: "a static check that skips a step template is a
    // static check with a hole in exactly the place a run is most expensive to fail."
    const fanFlow = (diff: unknown): Record<string, unknown> => flowOf({
      id: 'developers',
      fan_out: { from: 'solution/tasks.yaml', by: 'role' },
      step: { id: 'dev:{task.id}', role: 'developer-{role}', input: { diff } },
    });
    expect(lintFlow(fanFlow('{base}...harness/{id}/integration'))).toBe(true);
    for (const [, value] of REFUSED) {
      expect(onlyProblem(fanFlow(value)), String(value))
        .toBe(`developers.step: input.diff must be two "..."-joined endpoints, each "{base}" or "harness/{id}/…", got ${JSON.stringify(value)}`);
    }
  });

  test('a fan_out step with no template diff, and a template with no input, are not findings', () => {
    expect(lintFlow(flowOf({ id: 'developers', fan_out: { from: 't' }, step: { id: 'd', input: { backlog: ['ticket.md'] } } }))).toBe(true);
    expect(lintFlow(flowOf({ id: 'developers', fan_out: { from: 't' }, step: { id: 'd' } }))).toBe(true);
  });

  test('UNRESOLVED — trailing whitespace on a TICKET endpoint is accepted, against AC-4\'s test clause', () => {
    // AC-4's two halves disagree, and this assertion is the disagreement rather than a decision
    // about it. Its RULE says a range is valid when each endpoint "is exactly `{base}` or matches
    // /^harness\/\{id\}\/.+/", with "no whitespace trimming" — under which `.+` matches a trailing
    // space. Its TEST clause lists "leading or trailing whitespace" among the refused forms.
    //
    // The scope is one placement, established by running BOTH linters over each of them rather
    // than by reading either. Whitespace can sit in four positions in `A...B`, and it is refused in
    // every one — all four are pinned in REFUSED above, trailing whitespace on a `{base}` endpoint
    // included — EXCEPT trailing whitespace on a ticket-prefixed endpoint, which `.+` matches and
    // which is therefore accepted in either position, for a tab as readily as for a space. Spike
    // and port agree on every case, so the conflict is internal to AC-4: it is not a divergence
    // between this port and the code it transcribes.
    //
    // Carried as the spike has it, because every normative authority points one way and only a
    // parenthetical in a *Test* clause points the other: AC-4's own rule, AC-11 ("no rule added,
    // tightened or newly applied"), charter §2, and the merged requirement's own precedence note —
    // "verified by running spike/src/lint.js, not by reading it … where a candidate's transcription
    // disagreed with the code, the code won". Refusing it would narrow the grammar Q-0034 settled.
    //
    // Recorded under AC-12's stop-and-report in dev/implement-report.md, which carries the erratum
    // text ready to commit. It stays open here because closing it needs an accepted erratum under
    // backlog/, which no agent step may write (docs/DECISIONS.md, 2026-08-25) — and this test is
    // what turns that erratum from a silent edit into a red suite.
    expect(lintFlow(flowOf(step({ input: { diff: '{base}...harness/{id}/integration ' } })))).toBe(true);
    expect(lintFlow(flowOf(step({ input: { diff: 'harness/{id}/integration ...{base}' } })))).toBe(true);
    // `.` does not match a line terminator, so the character right after the prefix still cannot be
    // a newline — which is why the rule is a regexp and not a `startsWith` plus a length check.
    expect(() => lintFlow(flowOf(step({ input: { diff: '{base}...harness/{id}/\nx' } })))).toThrow(FlowError);
  });

  test('`diff: null` slips the grammar and `diff: \'\'` does not', () => {
    // Why: preserved defect, see AC-12 defect 6 — `diffSites` filters on `value != null`.
    expect(lintFlow(flowOf(step({ input: { diff: null } })))).toBe(true);
    expect(onlyProblem(flowOf(step({ input: { diff: '' } }))))
      .toBe('s: input.diff must be two "..."-joined endpoints, each "{base}" or "harness/{id}/…", got ""');
  });

  test('a diff inside a parallel member is read, because flattenSteps does reach those', () => {
    expect(onlyProblem({ name: 'f', consumes: 'x', produces: 'y', steps: [{ parallel: [{ id: 'm1', input: { diff: 'bogus' } }, { id: 'm2' }] }] }))
      .toBe('m1: input.diff must be two "..."-joined endpoints, each "{base}" or "harness/{id}/…", got "bogus"');
  });
});

describe('AC-5 — both cross-vendor rules, and the short-circuit between them', () => {
  /** The shipped review panel's shape: one role, two members, two adapters. */
  const panel = (members: Record<string, unknown>[]): Record<string, unknown> => ({
    name: 'f', consumes: 'green', produces: 'reviewed', cross_vendor: 'required',
    steps: [{ parallel: members }],
  });
  const reviewer = (id: string, adapter: string): Record<string, unknown> => ({ id, role: 'code-reviewer', adapter });

  test('S8.1 — a two-member single-vendor panel is refused, and says nothing about a judge', () => {
    const { problems, message } = refusal(panel([reviewer('member-0', 'codex'), reviewer('member-1', 'codex')]));
    expect(problems).toEqual(['parallel group member-0, member-1 shares role "code-reviewer" and adapter "codex" — cross_vendor: required needs at least two adapters']);
    expect(/written by its own vendor/i.test(message)).toBe(false);
  });

  test('S8.2 — a panel spanning adapters satisfies the rule', () => {
    expect(lintFlow(panel([reviewer('r-claude', 'claude'), reviewer('r-codex', 'codex')]))).toBe(true);
  });

  test('S8.3 — three members on one vendor, all three named in member order', () => {
    expect(onlyProblem(panel([reviewer('member-0', 'codex'), reviewer('member-1', 'codex'), reviewer('member-2', 'codex')])))
      .toBe('parallel group member-0, member-1, member-2 shares role "code-reviewer" and adapter "codex" — cross_vendor: required needs at least two adapters');
  });

  test('S8.4 — a mixed three-member panel passes; not every member need differ', () => {
    expect(lintFlow(panel([reviewer('a', 'claude'), reviewer('b', 'codex'), reviewer('c', 'claude')]))).toBe(true);
  });

  test('a group of one, and two roles of one member each, are not panels', () => {
    expect(lintFlow(panel([reviewer('solo', 'claude')]))).toBe(true);
    expect(lintFlow(panel([{ id: 'a', role: 'x', adapter: 'claude' }, { id: 'b', role: 'y', adapter: 'claude' }]))).toBe(true);
  });

  test('the judge rule runs ONLY when the panel rule reported nothing', () => {
    // It reads like something to tidy into two independent loops, and the frozen suite pins it by
    // asserting the judge's text is ABSENT (spike/test/q0033-surface.js:228, :233).
    const bothDefects = (panelAdapter: string): Record<string, unknown> => ({
      name: 'f', consumes: 'green', produces: 'reviewed', cross_vendor: 'required',
      steps: [
        { id: 'w', role: 'author', adapter: 'claude', output: { write: 'draft.md' } },
        { parallel: [reviewer('r1', 'claude'), reviewer('r2', panelAdapter)] },
        { id: 'j', role: 'judge', adapter: 'claude', input: { backlog: ['draft.md'] }, output: { verdict: 'ok|no' }, route: {} },
      ],
    });
    const silenced = refusal(bothDefects('claude'));
    expect(silenced.problems).toHaveLength(1);
    expect(silenced.problems[0]).toContain('parallel group r1, r2');
    expect(/written by its own vendor/i.test(silenced.message)).toBe(false);

    // Fix the panel and the judge problem becomes visible — so the flow really did carry both.
    expect(onlyProblem(bothDefects('codex')))
      .toBe('j: every input it judges (draft.md) was written by its own vendor (claude) — cross_vendor: required');
  });

  test('a judge over candidates spanning adapters passes, even sharing one of them', () => {
    expect(lintFlow({
      name: 'f', consumes: 'x', produces: 'y', cross_vendor: 'required',
      steps: [
        { id: 'w1', adapter: 'claude', output: { write: 'requirements/candidate-claude.md' } },
        { id: 'w2', adapter: 'codex', output: { write: 'requirements/candidate-codex.md' } },
        { id: 'j', adapter: 'claude', input: { backlog: ['requirements/*.md'] }, output: { verdict: 'ready|revise' }, route: {} },
      ],
    })).toBe(true);
  });

  test('a step that judges nothing is exempt, whichever way it judges nothing', () => {
    const exempt = (judge: Record<string, unknown>): Record<string, unknown> => ({
      name: 'f', consumes: 'x', produces: 'y', cross_vendor: 'required',
      steps: [{ id: 'w', adapter: 'claude', output: { write: 'draft.md' } }, judge],
    });
    expect(lintFlow(exempt({ id: 'j', adapter: 'claude', output: { verdict: 'ok|no' }, route: {} }))).toBe(true);
    expect(lintFlow(exempt({ id: 'j', adapter: 'claude', input: { backlog: ['nothing/*.md'] }, output: { verdict: 'ok|no' }, route: {} }))).toBe(true);
  });

  test('the producer map takes both output shapes, and the last writer wins', () => {
    expect(onlyProblem({
      name: 'f', consumes: 'x', produces: 'y', cross_vendor: 'required',
      steps: [
        { id: 'w1', adapter: 'codex', output: { writes: ['review/a.md'] } },
        { id: 'w2', adapter: 'claude', output: { write: 'review/a.md' } },
        { id: 'j', adapter: 'claude', input: { backlog: ['review/*.md'] }, output: { verdict: 'ok|no' }, route: {} },
      ],
    })).toBe('j: every input it judges (review/a.md) was written by its own vendor (claude) — cross_vendor: required');
  });

  test('the glob anchors both ends, keeps `*` inside a segment, and treats a trailing / as a prefix', () => {
    const judged = (pattern: string, written: string): boolean => {
      try {
        lintFlow({
          name: 'f', consumes: 'x', produces: 'y', cross_vendor: 'required',
          steps: [
            { id: 'w', adapter: 'claude', output: { write: written } },
            { id: 'j', adapter: 'claude', input: { backlog: [pattern] }, output: { verdict: 'ok|no' }, route: {} },
          ],
        });
        return false;
      } catch (error) {
        expect(error).toBeInstanceOf(FlowError);
        return true;
      }
    };
    expect(judged('review/*.md', 'review/a.md'), '* matches inside a segment').toBe(true);
    expect(judged('review/*.md', 'review/sub/a.md'), '* does not cross a /').toBe(false);
    expect(judged('review/', 'review/sub/a.md'), 'a trailing / is a prefix match').toBe(true);
    expect(judged('a.b', 'a.b'), 'a literal dot matches itself').toBe(true);
    expect(judged('a.b', 'axb'), 'a literal dot is escaped, not a wildcard').toBe(false);
  });

  test('without `cross_vendor: required` neither rule runs', () => {
    for (const cross_vendor of [undefined, 'optional']) {
      expect(lintFlow({
        name: 'f', consumes: 'x', produces: 'y', cross_vendor,
        steps: [
          { id: 'w', adapter: 'claude', output: { write: 'draft.md' } },
          { parallel: [{ id: 'r1', role: 'rev', adapter: 'claude' }, { id: 'r2', role: 'rev', adapter: 'claude' }] },
          { id: 'j', adapter: 'claude', input: { backlog: ['draft.md'] }, output: { verdict: 'ok|no' }, route: {} },
        ],
      }), String(cross_vendor)).toBe(true);
    }
  });
});

describe('AC-6 — bounds, counter spelling, goto resolution and the verdict-must-route rule', () => {
  const withOnFail = (on_fail: unknown): Record<string, unknown> => flowOf(step({ role: 'r', on_fail }));

  test('S7.1-S7.5 — every invalid bound is refused', () => {
    for (const max_iterations of [undefined, 'three', 1.5, 0, -1]) {
      expect(onlyProblem(withOnFail({ goto: 's', max_iterations, on_exhausted: 'gate' })), JSON.stringify(max_iterations))
        .toBe('s: on_fail.max_iterations must be an integer greater than zero');
    }
    expect(lintFlow(withOnFail({ goto: 's', max_iterations: 3, on_exhausted: 'gate' }))).toBe(true);
  });

  test('S7.6/S7.7 — counter spelling, and it is not a verdict-specific rule', () => {
    expect(onlyProblem(withOnFail({ goto: 's', counter: 'iterations.review', max_iterations: 3, on_exhausted: 'gate' })))
      .toBe('s: counter "iterations.review" must be unprefixed; use "review"');
    expect(onlyProblem(withOnFail({ goto: 's', counter: '', max_iterations: 3, on_exhausted: 'gate' })))
      .toBe('s: on_fail.counter must be a non-empty unprefixed key');
    expect(onlyProblem(withOnFail({ goto: 's', counter: '   ', max_iterations: 3, on_exhausted: 'gate' })))
      .toBe('s: on_fail.counter must be a non-empty unprefixed key');
    expect(onlyProblem(withOnFail({ goto: 's', counter: 7, max_iterations: 3, on_exhausted: 'gate' })))
      .toBe('s: on_fail.counter must be a non-empty unprefixed key');
    // A step carrying no verdict at all: spike/test/q0033-surface.js:219 exists to prove this.
    expect(onlyProblem({
      name: 'plain', consumes: 'x', produces: 'y',
      steps: [{ id: 'ordinary', role: 'worker', on_fail: { goto: 'ordinary', counter: 'iterations.ordinary', max_iterations: 3, on_exhausted: 'gate' } }],
    })).toBe('ordinary: counter "iterations.ordinary" must be unprefixed; use "ordinary"');
  });

  test('an absent or null counter is accepted; the engine computes one', () => {
    expect(lintFlow(withOnFail({ goto: 's', max_iterations: 3, on_exhausted: 'gate' }))).toBe(true);
    expect(lintFlow(withOnFail({ goto: 's', counter: null, max_iterations: 3, on_exhausted: 'gate' }))).toBe(true);
  });

  test('on_exhausted must be exactly "gate"', () => {
    for (const on_exhausted of [undefined, null, 'Gate', 'advance']) {
      expect(onlyProblem(withOnFail({ goto: 's', max_iterations: 3, on_exhausted })), String(on_exhausted))
        .toBe('s: on_exhausted must be "gate"');
    }
  });

  test('a `flow:` target is deferred to directory validation; a local one must resolve', () => {
    expect(lintFlow(withOnFail({ goto: 'flow:whatever-it-is', max_iterations: 3, on_exhausted: 'gate' }))).toBe(true);
    expect(onlyProblem(withOnFail({ goto: 'elsewhere', max_iterations: 3, on_exhausted: 'gate' })))
      .toBe('s: goto target "elsewhere" not found');
  });

  test('a verdict routed by either `on_fail` or `route` is accepted', () => {
    expect(lintFlow(flowOf(step({ output: { verdict: 'a|b' }, route: { a: 'next' } })))).toBe(true);
    expect(lintFlow(flowOf(step({ output: { verdict: 'a|b' }, on_fail: { goto: 's', max_iterations: 1, on_exhausted: 'gate' } })))).toBe(true);
  });
});

describe('AC-7 — loop convergence, including both exemptions', () => {
  test('a loop that hides its verdict from the step it returns to fails, and names the artifact', () => {
    const blind = {
      name: 'blind', consumes: 'a', produces: 'b',
      steps: [
        { id: 'author', role: 'r', adapter: 'claude', input: { backlog: ['spec.md'] }, output: { write: 'draft.md' } },
        { id: 'judge', role: 'r', adapter: 'codex', input: { backlog: ['draft.md'] }, output: { write: 'review.md', verdict: 'ok|no' }, on_fail: { goto: 'author', max_iterations: 2, on_exhausted: 'gate' } },
      ],
    };
    expect(onlyProblem(blind)).toBe('judge: loops back to "author", which never receives review.md — the loop cannot converge');

    const fed = structuredClone(blind);
    fed.steps[0].input.backlog.push('review.md');
    expect(lintFlow(fed), 'feeding the verdict back makes the loop lintable').toBe(true);
  });

  test('a fan-out destination is exempt — the engine feeds it the integration result', () => {
    expect(lintFlow({
      name: 'fanned', consumes: 'a', produces: 'b',
      steps: [
        { id: 'devs', fan_out: { from: 'tasks.yaml' }, step: { id: 'x', role: 'r' } },
        { id: 'integrate', type: 'integrate', branches: ['b'], output: { writes: ['report.md'] }, on_fail: { goto: 'devs', max_iterations: 2, on_exhausted: 'gate' } },
      ],
    })).toBe(true);
  });

  test('a step that writes nothing is exempt', () => {
    expect(lintFlow(flowOf(
      { id: 'a', role: 'r', input: { backlog: ['x.md'] } },
      { id: 'b', role: 'r', on_fail: { goto: 'a', max_iterations: 1, on_exhausted: 'gate' } },
    ))).toBe(true);
  });

  test('a cross-flow edge skips this rule entirely', () => {
    expect(lintFlow(flowOf(step({ output: { write: 'verdict.md' }, on_fail: { goto: 'flow:development', max_iterations: 1, on_exhausted: 'gate' } })))).toBe(true);
  });

  test('an unresolved destination is skipped, because message 3 already reported it', () => {
    expect(onlyProblem(flowOf(step({ output: { write: 'v.md' }, on_fail: { goto: 'ghost', max_iterations: 1, on_exhausted: 'gate' } }))))
      .toBe('s: goto target "ghost" not found');
  });

  test('the destination\'s `input.backlog` is glob-matched, not compared literally', () => {
    expect(lintFlow(flowOf(
      { id: 'author', role: 'r', input: { backlog: ['review/*.md'] }, output: { write: 'draft.md' } },
      { id: 'judge', role: 'r', output: { write: 'review/round-1.md' }, on_fail: { goto: 'author', max_iterations: 2, on_exhausted: 'gate' } },
    ))).toBe(true);
  });
});

describe('AC-8 — the directory walk records, and validateFlowDirectory aggregates', () => {
  test('files are read in filename order; nested directories and other extensions are ignored', () => {
    const dir = flowsDir({
      'zulu.yaml': basic('zulu', 'a', 'b'),
      'alpha.yaml': basic('alpha', 'c', 'd'),
      'skipped.yml': basic('skipped', 'e', 'f'),
      'notes.md': 'not a flow',
      'nested/deep.yaml': basic('deep', 'g', 'h'),
    });
    const records = lintFlowDirectory(dir);
    expect(records.map((r) => path.basename(r.file))).toEqual(['alpha.yaml', 'zulu.yaml']);
    expect(records.every((r) => r.problems.length === 0)).toBe(true);
  });

  test('a successful record carries the flow, with `file` assigned to the joined path', () => {
    const dir = flowsDir({ 'one.yaml': basic('one', 'a', 'b') });
    const [record] = lintFlowDirectory(dir);
    expect('flow' in record).toBe(true);
    expect(record.file).toBe(path.join(dir, 'one.yaml'));
    expect(record.flow?.file).toBe(path.join(dir, 'one.yaml'));
    expect(record.flow?.name).toBe('one');
  });

  test('every failure path records no `flow` key at all, and one problem per file', () => {
    const dir = flowsDir({
      'lint-error.yaml': yaml(['name: lint-error', 'consumes: a', 'produces: b', 'steps:', '  - id: t', '  - id: t']),
      'syntax-error.yaml': 'name: broken\nsteps: [\n',
      'empty.yaml': '',
      'valid.yaml': basic('valid', 'a', 'b'),
    });
    const records = lintFlowDirectory(dir);
    expect(records.map((r) => path.basename(r.file))).toEqual(['empty.yaml', 'lint-error.yaml', 'syntax-error.yaml', 'valid.yaml']);
    for (const record of records) {
      expect('flow' in record, `${path.basename(record.file)}`).toBe(record.problems.length === 0);
    }
    // A lint failure is ONE element holding its whole multi-line message.
    const lintError = records.find((r) => path.basename(r.file) === 'lint-error.yaml');
    expect(lintError?.problems).toEqual(['flow lint-error invalid:\n  - duplicate step id "t"']);
    // And one bad file does not stop the rest being read.
    expect(records.find((r) => path.basename(r.file) === 'valid.yaml')?.problems).toEqual([]);
  });

  test('a failing file takes no part in the cross-flow indexes', () => {
    const dir = flowsDir({
      'review.yaml': reviewWith('flow:development'),
      'development.yaml': 'name: development\nconsumes: red\nproduces: [\n',
    });
    const records = lintFlowDirectory(dir);
    expect(records.find((r) => path.basename(r.file) === 'review.yaml')?.problems)
      .toEqual(['flow review: target flow development is missing or unloadable']);
  });

  test('nothing is cached: each invocation rebuilds its records and indexes', () => {
    const dir = flowsDir({ 'review.yaml': reviewWith('flow:development') });
    expect(lintFlowDirectory(dir)[0].problems).toHaveLength(1);
    write(path.join(dir, 'development.yaml'), basic('development', 'red', 'green'));
    const second = lintFlowDirectory(dir);
    expect(second.map((r) => r.problems)).toEqual([[], []]);
    expect(second[0]).not.toBe(lintFlowDirectory(dir)[0]);
  });

  test('validateFlowDirectory returns the flows in filename order when every file is clean', () => {
    const dir = flowsDir({ 'zulu.yaml': basic('zulu', 'a', 'b'), 'alpha.yaml': basic('alpha', 'c', 'd') });
    expect(validateFlowDirectory(dir).map((flow) => flow.name)).toEqual(['alpha', 'zulu']);
  });

  test('and names every failing file at once, in filename order', () => {
    const dir = flowsDir({
      'c-clean.yaml': basic('c-clean', 'a', 'b'),
      'a-dup.yaml': yaml(['name: a-dup', 'consumes: a', 'produces: b', 'steps:', '  - id: t', '  - id: t']),
      'b-stages.yaml': yaml(['name: b-stages', 'steps: []']),
      'd-syntax.yaml': 'steps: [\n',
    });
    let thrown: unknown;
    try {
      validateFlowDirectory(dir);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(FlowError);
    const lines = (thrown as Error).message.split('\n');
    expect(lines.slice(0, 4)).toEqual([
      'a-dup.yaml:',
      '  - flow a-dup invalid:',
      '  - duplicate step id "t"',
      'b-stages.yaml:',
    ]);
    expect(lines).toContain('d-syntax.yaml:');
    expect(lines.filter((line) => line.endsWith('.yaml:'))).toEqual(['a-dup.yaml:', 'b-stages.yaml:', 'd-syntax.yaml:']);
    expect((thrown as Error).message).not.toContain('c-clean.yaml');
  });
});

describe('AC-9 — cross-flow targets and return chains, derived from stages', () => {
  /** The source flow's record is the one that carries the problem, whichever file the target is in. */
  const problemsFor = (files: Record<string, string>, sourceFile: string): string[] =>
    lintFlowDirectory(flowsDir(files)).find((r) => path.basename(r.file) === sourceFile)?.problems ?? [];

  test('S6.1 — a direct return passes with zero iterations', () => {
    expect(problemsFor({ 'review.yaml': reviewWith('flow:development'), 'development.yaml': basic('development', 'red', 'green') }, 'review.yaml')).toEqual([]);
  });

  test('S6.2 — a multi-hop chain that reaches the source\'s consumed stage passes', () => {
    expect(problemsFor({
      'review.yaml': reviewWith('flow:qa-red'),
      'qa-red.yaml': basic('qa-red', 'qa', 'red'),
      'development.yaml': basic('development', 'red', 'green'),
    }, 'review.yaml')).toEqual([]);
  });

  test('S6.3 — a target no file provides', () => {
    expect(problemsFor({ 'review.yaml': reviewWith('flow:nonexistent'), 'development.yaml': basic('development', 'red', 'green') }, 'review.yaml'))
      .toEqual(['flow review: target flow nonexistent is missing or unloadable']);
  });

  test('S6.4 — a target whose own file did not load reads as missing', () => {
    expect(problemsFor({
      'review.yaml': reviewWith('flow:broken'),
      'broken.yaml': 'name: broken\nsteps: [\n',
      'development.yaml': basic('development', 'red', 'green'),
    }, 'review.yaml')).toEqual(['flow review: target flow broken is missing or unloadable']);
  });

  test('S6.5 — a chain that dies at a stage nothing consumes', () => {
    expect(problemsFor({ 'review.yaml': reviewWith('flow:dead'), 'dead.yaml': basic('dead', 'x', 'nowhere') }, 'review.yaml'))
      .toEqual(['flow review: target flow dead dies at stage nowhere; it never returns to green']);
  });

  test('S6.6 — two flows consuming one stage, both named', () => {
    expect(problemsFor({
      'review.yaml': reviewWith('flow:a'),
      'a.yaml': basic('a', 'x', 'y'), 'b.yaml': basic('b', 'y', 'z'), 'c.yaml': basic('c', 'y', 'green'),
    }, 'review.yaml')).toEqual(['flow review: target flow a is ambiguous at stage y; implicated flows: b, c']);
  });

  test('S6.7 — ambiguity on a stage the walk never reaches is not reported', () => {
    expect(problemsFor({
      'source.yaml': reviewWith('flow:development').replace('name: review', 'name: source'),
      'development.yaml': basic('development', 'red', 'green'),
      'x1.yaml': basic('x1', 'unused', 'a'), 'x2.yaml': basic('x2', 'unused', 'b'),
    }, 'source.yaml')).toEqual([]);
  });

  test('S6.8/S6.10 — a repeated (flow, stage) pair is a cycle, with the flows implicated', () => {
    expect(problemsFor({
      'source.yaml': reviewWith('flow:a').replace('name: review', 'name: source'),
      'a.yaml': basic('a', 'x', 'y'), 'b.yaml': basic('b', 'y', 'x'),
    }, 'source.yaml')).toEqual(['flow source: target flow a has a cycle at stage y; implicated flows: a, b, a']);
  });

  test('S6.9 — a flow targeting itself dies at its own produced stage', () => {
    expect(problemsFor({ 'review.yaml': reviewWith('flow:review') }, 'review.yaml'))
      .toEqual(['flow review: target flow review dies at stage reviewed; it never returns to green']);
  });

  test('resolution is by filename stem, never by the target\'s own `name:`', () => {
    // Why: preserved defect, see AC-12 defect 8 — the two halves of one message come from two
    // different identifiers, the source by `name:` and the target by its filename.
    const files = { 'review.yaml': reviewWith('flow:on-disk'), 'on-disk.yaml': basic('internal-name', 'red', 'green') };
    expect(problemsFor(files, 'review.yaml')).toEqual([]);
    expect(problemsFor({ ...files, 'review.yaml': reviewWith('flow:internal-name') }, 'review.yaml'))
      .toEqual(['flow review: target flow internal-name is missing or unloadable']);
  });

  test('one edge yields at most one problem, because each failure breaks the walk', () => {
    expect(problemsFor({
      'review.yaml': reviewWith('flow:a'),
      'a.yaml': basic('a', 'x', 'y'), 'b.yaml': basic('b', 'y', 'z'), 'c.yaml': basic('c', 'y', 'q'),
      'd.yaml': basic('d', 'z', 'nowhere'),
    }, 'review.yaml')).toHaveLength(1);
  });
});

describe('AC-10 — lintDirectory is presentation-free, and the printed bytes are reproducible', () => {
  /**
   * `yaml`'s own wording for a malformed document. It is the only text in the fixture this product
   * does not author, and pinning it is what proves the flattening did not touch it.
   */
  const YAML_SYNTAX_ERROR = 'Flow sequence in block collection must be sufficiently indented and end with a ] at line 3, column 1:';

  const fixture = (): string => flowsDir({
    'clean.yaml': basic('clean', 'draft', 'requirements'),
    'broken.yaml': 'name: broken\nsteps: [\n',
    'three.yaml': yaml([
      'name: three', 'consumes: green', 'produces: reviewed', 'steps:',
      '  - id: twin', '  - id: twin', '  - id: integrate', '    type: integrate',
      '  - id: judge', '    output:', '      verdict: approve|changes-requested',
    ]),
    'edge.yaml': yaml([
      'name: edge', 'consumes: green', 'produces: reviewed', 'steps:',
      '  - id: verdict', '    output:', '      verdict: approve|changes-requested',
      '    on_fail:', '      goto: flow:absent', '      max_iterations: 2', '      on_exhausted: gate',
    ]),
  });

  test('one record per file, in filename order, problems flattened one per element', () => {
    const dir = fixture();
    const { ok, records } = lintDirectory(dir);
    expect(ok).toBe(false);
    expect(records.map((r) => r.filename)).toEqual(['broken.yaml', 'clean.yaml', 'edge.yaml', 'three.yaml']);
    expect(records.map((r) => r.file)).toEqual(['broken.yaml', 'clean.yaml', 'edge.yaml', 'three.yaml'].map((n) => path.join(dir, n)));

    // A YAML error's own multi-line text is split, trimmed and kept whole: its first line does not
    // end with `invalid:`, so nothing is dropped.
    expect(records[0].problems).toEqual([YAML_SYNTAX_ERROR, 'steps: [', '^']);
    expect(records[1].problems).toEqual([]);
    expect(records[2].problems).toEqual(['flow edge: target flow absent is missing or unloadable']);
    // A lint message's `… invalid:` header IS dropped, and its bullets lose their leading hyphen.
    expect(records[3].problems).toEqual([
      'duplicate step id "twin"',
      'integrate: integrate needs branches',
      'judge: has a verdict but no on_fail/route — verdicts must go somewhere',
    ]);
  });

  test('`ok` is true only when no file has a problem', () => {
    expect(lintDirectory(fixture()).ok).toBe(false);
    expect(lintDirectory(flowsDir({ 'a.yaml': basic('a', 'x', 'y') })).ok).toBe(true);
    expect(lintDirectory(flowsDir({})).ok).toBe(true);
  });

  test('no escape byte, marker or indentation is anywhere in what it returns', () => {
    const { records } = lintDirectory(fixture());
    for (const record of records) {
      for (const problem of record.problems) {
        expect(/\x1b/.test(problem), problem).toBe(false);
        expect(/^\s|\s$/.test(problem), `"${problem}" must arrive trimmed`).toBe(false);
        expect(problem.includes('\n'), 'one problem per element').toBe(false);
      }
      expect(/[✓✗]/.test(record.filename)).toBe(false);
    }
  });

  test('a three-line renderer reproduces the CLI\'s bytes, escape sequences included', () => {
    // The renderer belongs to Q-0010. Asserting that one exists which reproduces
    // spike/bin/harness.js:376-384 byte for byte is what makes this criterion checkable now.
    const render = ({ filename, problems }: { filename: string; problems: string[] }): string =>
      problems.length === 0
        ? `\x1b[32m✓\x1b[0m ${filename}`
        : `\x1b[31m✗\x1b[0m ${filename}\n${problems.map((p) => `  - ${p}`).join('\n')}`;

    expect(lintDirectory(fixture()).records.map(render)).toEqual([
      `\x1b[31m✗\x1b[0m broken.yaml\n  - ${YAML_SYNTAX_ERROR}\n  - steps: [\n  - ^`,
      '\x1b[32m✓\x1b[0m clean.yaml',
      '\x1b[31m✗\x1b[0m edge.yaml\n  - flow edge: target flow absent is missing or unloadable',
      '\x1b[31m✗\x1b[0m three.yaml\n  - duplicate step id "twin"\n  - integrate: integrate needs branches\n  - judge: has a verdict but no on_fail/route — verdicts must go somewhere',
    ]);
  });

  test('and the rendered block is what spike/test/q0033-surface.js:38-45 parses', () => {
    const render = ({ filename, problems }: { filename: string; problems: string[] }): string =>
      problems.length === 0
        ? `\x1b[32m✓\x1b[0m ${filename}`
        : `\x1b[31m✗\x1b[0m ${filename}\n${problems.map((p) => `  - ${p}`).join('\n')}`;
    const printed = lintDirectory(fixture()).records.map(render).join('\n');
    const lines = printed.replace(/\x1b\[[0-9;]*m/g, '').split('\n');

    const start = lines.findIndex((line) => /^[✗x]\s+three\.yaml$/u.test(line.trim()));
    expect(start, 'the header line the frozen parser looks for').toBeGreaterThanOrEqual(0);
    const block = [lines[start].trim()];
    for (let i = start + 1; i < lines.length && /^\s+-\s/.test(lines[i]); i++) block.push(lines[i].trim());
    expect(block).toEqual([
      '✗ three.yaml',
      '- duplicate step id "twin"',
      '- integrate: integrate needs branches',
      '- judge: has a verdict but no on_fail/route — verdicts must go somewhere',
    ]);
    expect(lines).toContain('✓ clean.yaml');
  });

  test('it calls lintFlowDirectory rather than validating again', () => {
    // Same records, same problems, same order — the flattening is the only difference.
    const dir = fixture();
    expect(lintDirectory(dir).records.map((r) => r.file)).toEqual(lintFlowDirectory(dir).map((r) => r.file));
  });
});

describe('AC-11 — every shipped flow still lints clean, through the ported code', () => {
  const SHIPPED = ['harness/flows', 'spike/templates/harness/flows'];

  test('both directories hold six flows and none is refused', () => {
    const seen: Record<string, string[]> = {};
    for (const relative of SHIPPED) {
      const dir = path.join(repoRoot, relative);
      const records = lintFlowDirectory(dir);
      // Fails loudly rather than passing over an empty directory: deleting a flow must not be a
      // way to satisfy this criterion.
      expect(records.length, `${relative} must hold at least six .yaml flow files`).toBeGreaterThanOrEqual(6);
      expect(records.map((r) => r.problems)).toEqual(records.map(() => []));
      expect(validateFlowDirectory(dir)).toHaveLength(6);
      seen[relative] = records.map((r) => path.basename(r.file));
    }
    expect(seen[SHIPPED[0]]).toEqual(['chore.yaml', 'development.yaml', 'qa-red.yaml', 'requirements.yaml', 'review.yaml', 'solutioning.yaml']);
    expect(seen[SHIPPED[1]]).toEqual(seen[SHIPPED[0]]);
  });

  test('the shipped set and the template set say the same thing about the same filenames', () => {
    const [shipped, templates] = SHIPPED.map((relative) => validateFlowDirectory(path.join(repoRoot, relative))
      .map((flow) => ({ ...flow, file: path.basename(String(flow.file)) })));
    expect(templates).toEqual(shipped);
  });
});

describe('AC-12 — FlowError, and the nine preserved defects', () => {
  test('FlowError extends Error and overrides nothing', () => {
    const error = new FlowError('x');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(FlowError);
    // Not 'FlowError'. spike/bin/harness.js:605 routes on `instanceof`, and setting `name` would
    // change what a stranger reads at the top of the error (spike/test/q0034-review-fixes.js:109).
    expect(error.name).toBe('Error');
    expect(error.message).toBe('x');
  });

  test('lintFlow and validateFlowDirectory both throw one', () => {
    expect(() => lintFlow({ steps: [] })).toThrow(FlowError);
    expect(() => validateFlowDirectory(flowsDir({ 'a.yaml': 'name: a\nsteps: []\n' }))).toThrow(FlowError);
  });

  test('1 — a missing directory throws a raw ENOENT, not a FlowError', () => {
    const absent = path.join(tempDir('lint-'), 'no-such-directory');
    let thrown: unknown;
    try {
      lintFlowDirectory(absent);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBeInstanceOf(FlowError);
    expect((thrown as NodeJS.ErrnoException).code).toBe('ENOENT');
  });

  test('2 — an empty .yaml file surfaces a TypeError as a user-facing problem string', () => {
    const [record] = lintFlowDirectory(flowsDir({ 'empty.yaml': '' }));
    expect('flow' in record).toBe(false);
    // Obtained by running the spike, not transcribed: `flow.file = file` on `YAML.parse`'s null.
    expect(record.problems).toEqual(["Cannot set properties of null (setting 'file')"]);
  });

  test('3 — a .yml file is skipped without being reported as unread', () => {
    const records = lintFlowDirectory(flowsDir({ 'only.yml': basic('only', 'a', 'b') }));
    expect(records).toEqual([]);
  });

  test('4 — flattenSteps throws raw TypeErrors on null and on [null]', () => {
    for (const argument of [null, [null]]) {
      let thrown: unknown;
      try {
        flattenSteps(argument);
      } catch (error) {
        thrown = error;
      }
      expect(thrown, JSON.stringify(argument)).toBeInstanceOf(TypeError);
      expect(thrown).not.toBeInstanceOf(FlowError);
    }
  });

  test('5 — lint requires an `id` on no step kind, so an id-less step lints clean', () => {
    // The engine then interpolates the literal `undefined` into a worktree branch name
    // (spike/src/engine.js:211) and a loop counter (:541). Q-0055 owns the fix and lands after
    // this ticket; the port carries the gap forward unchanged.
    expect(lintFlow({
      name: 'f', consumes: 'x', produces: 'y',
      steps: [
        { role: 'r', adapter: 'claude' },
        { parallel: [{ role: 'r', adapter: 'claude' }, { role: 'r', adapter: 'codex' }] },
        { type: 'script', run: 'pnpm test' },
        { type: 'integrate', branches: ['b'] },
        { fan_out: { from: 'solution/tasks.yaml' }, step: { role: 'r' } },
        { gate: 'human', reason: 'approve' },
      ],
    })).toBe(true);
    // And the message it would produce names that literal, which is the tell.
    expect(onlyProblem(flowOf({ type: 'integrate' }))).toBe('undefined: integrate needs branches');
  });

  test('6 — `diff: null` is exempt from the range grammar while `diff: \'\'` is refused', () => {
    expect(lintFlow(flowOf(step({ input: { diff: null } })))).toBe(true);
    expect(() => lintFlow(flowOf(step({ input: { diff: '' } })))).toThrow(FlowError);
  });

  test('7 — a flow with neither `name` nor `file` refuses as `flow undefined invalid:`', () => {
    expect(refusal({ consumes: 'x', produces: 'y', steps: [step({ type: 'integrate' })] }).header)
      .toBe('flow undefined invalid:');
  });

  test('8 — a cross-flow message names the source by `name:` and the target by filename', () => {
    const dir = flowsDir({ 'on-disk.yaml': reviewWith('flow:absent').replace('name: review', 'name: internal-name') });
    expect(lintFlowDirectory(dir)[0].problems)
      .toEqual(['flow internal-name: target flow absent is missing or unloadable']);
  });

  test('9 — a lint failure is one element; nothing stringifies a throw that is not an Error', () => {
    // No reachable path produces a non-Error throw here. The narrowing is an assertion rather than
    // a `String(error)`, because stringifying would be a diagnostic behaviour change.
    const [record] = lintFlowDirectory(flowsDir({ 'a.yaml': yaml(['name: a', 'consumes: x', 'produces: y', 'steps:', '  - id: t', '  - id: t']) }));
    expect(record.problems).toHaveLength(1);
    expect(record.problems[0]).toBe('flow a invalid:\n  - duplicate step id "t"');
  });

  test('the linter still type-checks nothing, which is why it accepts `unknown`', () => {
    // A zod parse at the top of `lintFlow` would refuse this and replace sixteen messages with a
    // path like `steps[0].max_turns`. See AC-1 and docs/DECISIONS.md, 2026-08-25.
    expect(lintFlow({ consumes: 'a', produces: 'b', cross_vendor: 42, steps: [{ id: 42, adapter: 42, gate: 42, max_turns: 'many' }] })).toBe(true);
  });
});
