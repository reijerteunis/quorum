// Q-0044: the ported linter, asserted message by message.
//
// Between this ticket and Q-0054, this file is the ONLY thing asserting that `core`'s linter says
// what the spike's linter says: the two suites that pin this behaviour today —
// spike/test/q0033-surface.js and spike/test/q0035-empty-range.js — import from spike/src/ and are
// frozen under charter §3. So the literals below are the specification, not belt-and-braces, and
// every one of them was obtained by RUNNING spike/src/lint.js rather than transcribed by eye. The
// merged requirement records what happens otherwise: it introduced a defect into message 12 while
// copying it.
import fs from 'node:fs';
import path from 'node:path';

import { flowSchema } from '@quorum/shared';
import YAML from 'yaml';
import { afterAll, describe, expect, test } from 'vitest';

import {
  FlowError, flattenSteps, lintDirectory, lintFlow, lintFlowDirectory, validateFlowDirectory,
} from './lint.js';
import { repoFile, repoRoot } from '../../test/corpus.js';
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

/**
 * A flow that consumes one stage and produces another, and does as little else as lint permits.
 *
 * The step is not decoration and the id on it is not either. Q-0055 AC-14 refuses a flow declaring
 * no step, and AC-1 refuses a step with no id, so the shortest flow that lints clean is this one —
 * which is what every directory-walk fixture below needs, none of them being about steps at all.
 */
const basic = (name: string, consumes: string, produces: string): string =>
  yaml([`name: ${name}`, `consumes: ${consumes}`, `produces: ${produces}`, 'steps:', '  - id: s', '    role: r']);

/** The shipped review flow's shape, reduced to the one edge the return-chain walk follows. */
const reviewWith = (target: string): string => yaml([
  'name: review', 'consumes: green', 'produces: reviewed', 'steps:',
  '  - id: verdict', '    role: code-reviewer', '    adapter: claude', '    output:',
  '      verdict: approve|changes-requested', '    on_fail:', `      goto: ${target}`,
  '      counter: review', '      max_iterations: 3', '      on_exhausted: gate',
]);

const step = (extra: Record<string, unknown>): Record<string, unknown> => ({ id: 's', ...extra });
const flowOf = (...steps: unknown[]): Record<string, unknown> => ({ name: 'f', consumes: 'x', produces: 'y', steps });

describe('AC-2 — the eighteen messages, verbatim', () => {
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

  test('4 — max_iterations must be an integer of zero or more', () => {
    // Q-0083 made zero legal and gave it a meaning: no traversal happens unattended, so the FIRST
    // failure is the gate. Negative is what is refused now, and the message says so.
    expect(onlyProblem(flowOf(step({ on_fail: { goto: 's', max_iterations: -1, on_exhausted: 'gate' } }))))
      .toBe('s: on_fail.max_iterations must be an integer of zero or more');
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
    // The fixture carries a step where it carried `steps: []` until Q-0055, and the MESSAGE is
    // unedited: AC-14 made an empty list a second problem, so a fixture without one no longer
    // isolates this one. What AC-5 protects is the text, which is what `onlyProblem` reads.
    expect(onlyProblem({ name: 'f', steps: [{ id: 's' }] })).toBe('flow needs consumes/produces');
  });

  test('16 — a deploy flow with no human-locked gate', () => {
    expect(onlyProblem({ name: 'f', consumes: 'x', produces: 'deployed', steps: [{ gate: 'human', reason: 'ship it' }] }))
      .toBe('deploy flow must contain a human-locked gate');
    expect(lintFlow({ name: 'f', consumes: 'x', produces: 'deployed', steps: [{ gate: 'human-locked', reason: 'ship it' }] })).toBe(true);
  });

  test('17 — a step the engine cannot name, located rather than named (Q-0055)', () => {
    expect(onlyProblem(flowOf({ role: 'r', adapter: 'claude' })))
      .toBe('step 1: id is required — the engine names a branch, a loop counter and a run-history occurrence after it');
    // The `parallel` form carries both numbers, which is the whole of why this rule walks the
    // flow's own `steps` list rather than `flattenSteps`'s output.
    expect(onlyProblem({
      name: 'f', consumes: 'x', produces: 'y',
      steps: [{ id: 'first', role: 'r' }, { parallel: [{ id: 'm1', role: 'r' }, { role: 'r' }] }],
    })).toBe('step 2, parallel member 2: id is required — the engine names a branch, a loop counter and a run-history occurrence after it');
  });

  test('18 — a flow that declares no step at all (Q-0055 AC-14)', () => {
    expect(onlyProblem({ name: 'f', consumes: 'x', produces: 'y' })).toBe('flow needs steps');
    expect(onlyProblem({ name: 'f', consumes: 'x', produces: 'y', steps: [] })).toBe('flow needs steps');
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
        { id: 'dup', role: 'w', adapter: 'claude', output: { write: 'a.md' }, on_fail: { goto: 'dup', max_iterations: -1, counter: 'iterations.x', on_exhausted: 'no' } },
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
      '  - dup: on_fail.max_iterations must be an integer of zero or more',
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

  test('trailing whitespace on a TICKET endpoint is accepted — requirements/errata.md E-1', () => {
    // Why: AC-4's *Test* clause is superseded here, and only here. See errata.md E-1 (2026-08-26).
    //
    // Which way a placement goes depends on the endpoint's KIND, not on its position in the range.
    // Leading whitespace breaks both `=== '{base}'` and `^harness/`, so it is refused on either
    // endpoint; trailing whitespace breaks `=== '{base}'` but is matched by `.+`, so it is refused
    // on a `{base}` endpoint and accepted on a ticket-prefixed one. That is four refused forms —
    // leading whitespace in both positions, trailing-on-`{base}` in both — all pinned in REFUSED
    // above, against the one accepted kind asserted here in both positions, tab as well as space.
    //
    // E-1 corrects AC-4's *Test* clause to agree with AC-4's own normative rule — each endpoint "is
    // exactly `{base}` or matches /^harness\/\{id\}\/.+/", with "no whitespace trimming" — because
    // refusing it would narrow the grammar Q-0034 settled, and the port authorises one behaviour
    // change, which is Q-0050's. Spike and port agree on all four placements, so the conflict was
    // always internal to AC-4 rather than a divergence between the port and what it transcribes.
    //
    // What E-1 does not settle is whether the grammar *should* refuse it. It is a real rough edge —
    // `harness/{id}/integration ` is not a ref anyone means — and tightening it is a behaviour
    // change belonging to its own ticket beside Q-0056. It named Q-0055 too until that ticket
    // shipped, which refuses an unusable step ID and leaves this grammar untouched; the citation is
    // corrected rather than left pointing at a closed ticket (Q-0055 non-goal 8).
    expect(lintFlow(flowOf(step({ input: { diff: '{base}...harness/{id}/integration ' } })))).toBe(true);
    expect(lintFlow(flowOf(step({ input: { diff: 'harness/{id}/integration ...{base}' } })))).toBe(true);
    expect(lintFlow(flowOf(step({ input: { diff: '{base}...harness/{id}/integration\t' } })))).toBe(true);
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

  test('S7.1-S7.5 — every invalid bound is refused, and zero is not one of them', () => {
    for (const max_iterations of [undefined, 'three', 1.5, -1]) {
      expect(onlyProblem(withOnFail({ goto: 's', max_iterations, on_exhausted: 'gate' })), JSON.stringify(max_iterations))
        .toBe('s: on_fail.max_iterations must be an integer of zero or more');
    }
    expect(lintFlow(withOnFail({ goto: 's', max_iterations: 3, on_exhausted: 'gate' }))).toBe(true);
    // Q-0083: zero is a bound and not an absence. It authorises no unattended traversal, which is
    // how `chore.yaml`'s `implement` reaches a human on its first refusal instead of after a round
    // that cannot converge. Asserted beside the refusals so the two cannot be confused.
    expect(lintFlow(withOnFail({ goto: 's', max_iterations: 0, on_exhausted: 'gate' })), 'zero is refused').toBe(true);
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
  /**
   * The two flow directories this repository keeps: the ones its own runs load, and the ones an
   * adopter's first `quorum init` copies.
   *
   * Q-0107 AC-14 — `re-aimed`. The second was `spike/templates/harness/flows` until then, and it
   * was link 2 of a three-link chain: `packages/cli/templates` ≡ `spike/templates` (by
   * `packages/cli/src/templates.test.ts`), `spike/templates` ≡ `harness/flows` (here), and
   * `harness/flows` carries the scoping rule (by `packages/shared/src/flow.test.ts`). Q-0103
   * deletes the middle link, so the chain becomes one direct comparison rather than losing a step:
   * this pair now names the copy that ships, which is also the one the property is about.
   */
  const SHIPPED = ['harness/flows', 'packages/cli/templates/harness/flows'];

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

// ---------------------------------------------------------------------------------------------
// Q-0055 — a step the engine can name, and a flow that has steps.
//
// The rule is one sentence: **every step that is not a gate must carry a usable id, and a gate must
// not be required to**. One predicate rather than an enumeration of the kinds that carry
// `worktree: true` or `on_fail`, because the id reaches nine consumers and only two of them are
// gated on those keys — so a rule keyed on them had already missed three sites before it was
// written, `runFanOut`'s `${step.id}:{task.id}` child id among them, whose default branch then
// carries a `:` git refuses as a refname.
//
// **The message is the deliverable, and a diagnostic cannot be established by reading it.** Every
// clause below was demonstrated failing against the pre-change linter on its own before it was
// trusted — *showing a guard has a subject proves the guard fires, not that each of its clauses
// does* (Q-0071). What each mutation said is recorded in this run's implement report.
// ---------------------------------------------------------------------------------------------

describe('Q-0055 AC-1 — one rule, one predicate: usable id, or not a gate', () => {
  const AGENT = { role: 'r', adapter: 'claude' };

  test('every kind but the gate is refused, and the gate is not', () => {
    // Six rows, one per kind the engine dispatches, split five refusals against one acceptance.
    // Written out per kind rather than looped over a shared fixture, because the point of the
    // single predicate is that no kind is special — which only a per-kind row can lose.
    expect(lintAccepts(flowOf(AGENT)), 'a plain agent step').toBe(false);
    expect(lintAccepts({ name: 'f', consumes: 'x', produces: 'y', steps: [{ parallel: [AGENT, { role: 'r', adapter: 'codex' }] }] }), 'a parallel member').toBe(false);
    expect(lintAccepts(flowOf({ type: 'script', run: 'pnpm test' })), 'a script step').toBe(false);
    expect(lintAccepts(flowOf({ type: 'integrate', branches: ['b'] })), 'an integrate step').toBe(false);
    expect(lintAccepts(flowOf({ fan_out: { by: 'role' }, step: { role: 'r' } })), 'a fan-out parent').toBe(false);
    expect(lintAccepts(flowOf({ gate: 'human', reason: 'approve' })), 'a gate step').toBe(true);
  });

  test('presence AND blankness, each refused as its own row, and the type still is not', () => {
    // The blank clause has a precedent one screen up in the same function: `on_fail.counter` has
    // been `typeof !== 'string' || !trim()` since the spike, and for the same reason — a branch
    // named out of whitespace is a refname git will not take.
    for (const id of ['', '   ', '\t', 0]) {
      expect(lintAccepts(flowOf({ id, role: 'r' })), `id: ${JSON.stringify(id)}`).toBe(false);
    }
    expect(lintAccepts(flowOf({ id: null, role: 'r' })), 'id: null').toBe(false);
    // And what the rule deliberately does NOT do. `id: 42` is a TYPE, which is the schema's to
    // refuse — a `typeof` here would move three rows out of the type-divergence register instead of
    // the one presence rows Q-0055 moves. See AC-1's non-goal 3 and Appendix A.3.
    expect(lintAccepts(flowOf({ id: 42 })), 'id: 42 is the schema\'s refusal, not lint\'s').toBe(true);
  });

  test('a step that is not an object at all is refused, by the same predicate', () => {
    // Neither carries an id and neither is a gate, so the rule reaches them without a clause of its
    // own — which is the direction a default-on rule is chosen for.
    expect(onlyProblem({ name: 'f', consumes: 'x', produces: 'y', steps: ['a-string'] }))
      .toBe('step 1: id is required — the engine names a branch, a loop counter and a run-history occurrence after it');
    expect(onlyProblem({ name: 'f', consumes: 'x', produces: 'y', steps: [42] }))
      .toBe('step 1: id is required — the engine names a branch, a loop counter and a run-history occurrence after it');
    // `steps: null` and `steps: [null]` are untouched: both still throw a raw `TypeError` out of
    // `flattenSteps` before any rule runs. Why: preserved defect, see AC-12 defect 4.
    for (const steps of [null, [null]]) {
      expect(() => lintFlow({ name: 'f', consumes: 'x', produces: 'y', steps }), JSON.stringify(steps)).toThrow(TypeError);
    }
  });

  test('the duplicate-id filter keeps its own predicate, and a blank id reports under both', () => {
    // The two read alike and ask different questions: this rule asks whether the engine can name
    // something after the id, and the duplicate check asks whether two steps collide. Blank ids
    // are where they disagree, and the disagreement is visible rather than theoretical — replacing
    // the duplicate filter's truthiness with `usableId` would silently drop message 1 here while
    // every other assertion in this file stayed green.
    expect(refusal({ name: 'f', consumes: 'x', produces: 'y', steps: [{ id: '   ', role: 'r' }, { id: '   ', role: 'r' }] }).problems)
      .toEqual([
        'duplicate step id "   "',
        'step 1: id is required — the engine names a branch, a loop counter and a run-history occurrence after it',
        'step 2: id is required — the engine names a branch, a loop counter and a run-history occurrence after it',
      ]);
    // And an EMPTY id is not a duplicate of another empty one, which is the pre-existing behaviour
    // the truthiness filter has always had and which this rule does not disturb.
    expect(refusal({ name: 'f', consumes: 'x', produces: 'y', steps: [{ id: '', role: 'r' }, { id: '', role: 'r' }] }).problems)
      .toEqual([
        'step 1: id is required — the engine names a branch, a loop counter and a run-history occurrence after it',
        'step 2: id is required — the engine names a branch, a loop counter and a run-history occurrence after it',
      ]);
  });
});

describe('Q-0055 AC-2 — the gate exemption, which is the engine\'s property and not the corpus\'s', () => {
  test('a gate with no id lints clean, alone, and `gate: 42` is a gate for this rule', () => {
    expect(lintFlow(flowOf({ gate: 'human', reason: 'approve' }))).toBe(true);
    // Truthiness is `runStep`'s own test and the deploy-gate rule's, so a malformed gate stays a
    // gate here too rather than becoming an agent step that owes an id.
    expect(lintFlow(flowOf({ gate: 42 }))).toBe(true);
  });

  test('beside a refused step it contributes nothing, and the one problem locates the agent', () => {
    expect(onlyProblem({
      name: 'f', consumes: 'x', produces: 'y',
      steps: [{ gate: 'human', reason: 'approve' }, { role: 'r' }],
    })).toBe('step 2: id is required — the engine names a branch, a loop counter and a run-history occurrence after it');
  });

  test('and every one of the twelve shipped gates is id-less, so the exemption is not hypothetical', () => {
    // The corpus half of the same claim, derived rather than transcribed: if a shipped gate ever
    // gained an id this would still pass, and if the rule ever reached one it would not.
    let gates = 0;
    for (const relative of ['harness/flows', 'packages/cli/templates/harness/flows']) {
      for (const flow of validateFlowDirectory(path.join(repoRoot, relative))) {
        for (const step of flattenSteps(flow.steps)) {
          if (!(step as Record<string, unknown>).gate) continue;
          gates += 1;
          expect((step as Record<string, unknown>).id, `a shipped gate in ${String(flow.name)} carries an id`).toBeUndefined();
        }
      }
    }
    expect(gates, 'both corpora together ship twelve gates').toBe(12);
  });
});

describe('Q-0055 AC-3 — the fan-out template stays exempt, and flattenSteps stays shallow', () => {
  test('a template with no id is not a finding, and the parent\'s missing id is', () => {
    expect(lintFlow(flowOf({ id: 'devs', fan_out: { from: 't' }, step: { role: 'r' } }))).toBe(true);
    expect(onlyProblem(flowOf({ fan_out: { from: 't' }, step: { role: 'r' } })))
      .toBe('step 1: id is required — the engine names a branch, a loop counter and a run-history occurrence after it');
  });

  test('and the template is invisible even when the parent is refused — one problem, not two', () => {
    // The negative that matters: the rule must not have been satisfied by making the walk recurse.
    // A template's id is an interpolation placeholder resolved once per task, so a rule that saw it
    // would refuse a flow the engine runs.
    const { problems } = refusal(flowOf({ fan_out: { from: 't' }, step: { role: 'r', adapter: 'claude' } }));
    expect(problems).toHaveLength(1);
    expect(flattenSteps([{ id: 'devs', fan_out: { from: 't' }, step: { role: 'r' } }]))
      .toEqual([{ id: 'devs', fan_out: { from: 't' }, step: { role: 'r' } }]);
  });
});

describe('Q-0055 AC-4 — the diagnostic locates a step it cannot name', () => {
  const ID_REQUIRED = /^(step \d+|step \d+, parallel member \d+): id is required\b/;

  test('a top-level step and a parallel member locate distinguishably', () => {
    expect(onlyProblem({ name: 'f', consumes: 'x', produces: 'y', steps: [{ id: 'a' }, { id: 'b' }, { role: 'r' }] }))
      .toMatch(/^step 3: id is required/);
    expect(onlyProblem({
      name: 'f', consumes: 'x', produces: 'y',
      steps: [{ id: 'a' }, { parallel: [{ id: 'm1' }, { id: 'm2' }, { role: 'r' }] }],
    })).toMatch(/^step 2, parallel member 3: id is required/);
  });

  test('the locator is the flow\'s own list, not flattenSteps\', which erases the group position', () => {
    // Under a flattened walk both of these would be "step 2" and "step 3" — one number where two
    // are needed, and the group's own position lost. This is the assertion that would fail if the
    // rule were built on `flattenSteps`, which is why it names both shapes in one flow.
    expect(refusal({
      name: 'f', consumes: 'x', produces: 'y',
      steps: [{ parallel: [{ role: 'r' }, { role: 'r' }] }, { role: 'r' }],
    }).problems.map((problem) => problem.split(':')[0]))
      .toEqual(['step 1, parallel member 1', 'step 1, parallel member 2', 'step 2']);
  });

  test('two id-less steps produce two DIFFERENT messages, which is what the locator is for', () => {
    const { problems } = refusal({ name: 'f', consumes: 'x', produces: 'y', steps: [{ role: 'r' }, { role: 'r' }] });
    expect(problems).toHaveLength(2);
    expect(problems[0]).not.toBe(problems[1]);
    // Before this rule, two id-less steps carrying two defects each produced four problems that
    // were pairwise identical, so a reader could not tell which step any of them belonged to.
    for (const problem of problems) expect(problem).toMatch(ID_REQUIRED);
  });

  test('and it renders neither absent value: no `undefined` and no `null` anywhere in it', () => {
    for (const flow of [
      flowOf({ role: 'r' }),
      { name: 'f', consumes: 'x', produces: 'y', steps: [{ parallel: [{ role: 'r' }] }] },
      { name: 'f', consumes: 'x', produces: 'y', steps: [{ id: null, role: 'r' }] },
      { name: 'f', consumes: 'x', produces: 'y', steps: ['a-string'] },
    ]) {
      const problem = onlyProblem(flow);
      expect(problem, 'the absent id must not be rendered').not.toContain('undefined');
      expect(problem, 'the absent id must not be rendered').not.toContain('null');
      // It says what is missing as well as where, which is the half a bare position would lose.
      expect(problem).toContain('id is required');
    }
  });
});

describe('Q-0055 AC-5/AC-6 — additive, deterministic, and the fourteen keep their prefix', () => {
  test('the new problems join the accumulated error in flow order, and nothing stops early', () => {
    expect(refusal({
      name: 'many', consumes: 'x', produces: 'deployed', cross_vendor: 'required',
      steps: [
        { type: 'integrate' },
        { parallel: [{ id: 'r1', role: 'rev', adapter: 'claude' }, { role: 'rev', adapter: 'claude' }] },
        { id: 'df', input: { diff: 'bogus' } },
      ],
    }).problems).toEqual([
      'step 1: id is required — the engine names a branch, a loop counter and a run-history occurrence after it',
      'step 2, parallel member 2: id is required — the engine names a branch, a loop counter and a run-history occurrence after it',
      'undefined: integrate needs branches',
      'df: input.diff must be two "..."-joined endpoints, each "{base}" or "harness/{id}/…", got "bogus"',
      // `Array.prototype.join` renders `undefined` as the empty string, so the panel message names
      // the id-less member as nothing at all — which is why "one rule for every kind" is what the
      // id rule needed to be, and why AC-6 leaves this message alone rather than patching it: the
      // line above it now says which member has no id.
      'parallel group r1,  shares role "rev" and adapter "claude" — cross_vendor: required needs at least two adapters',
      'deploy flow must contain a human-locked gate',
    ]);
  });

  test('AC-6 — an id-less step still reports its other defects, and they keep the `undefined:` prefix', () => {
    // Non-goal 4, asserted rather than described: the fourteen id-prefixed messages get NO
    // positional fallback. Rewriting all fourteen to improve a case that can now only occur beside
    // the id problem itself is cost with no reader, and the id problem is what explains the prefix.
    expect(refusal(flowOf({ type: 'integrate' })).problems).toEqual([
      'step 1: id is required — the engine names a branch, a loop counter and a run-history occurrence after it',
      'undefined: integrate needs branches',
    ]);
    // §0.4's fifth rendering site, which neither candidate named: `diffSites` labels with `view.id`.
    expect(refusal(flowOf({ input: { diff: 'bogus' } })).problems).toEqual([
      'step 1: id is required — the engine names a branch, a loop counter and a run-history occurrence after it',
      'undefined: input.diff must be two "..."-joined endpoints, each "{base}" or "harness/{id}/…", got "bogus"',
    ]);
  });

  test('and every flow whose steps all carry ids reports exactly what it reported before', () => {
    // The other half of "additive": the rule must be invisible to a clean flow and to a dirty one
    // whose steps are all named. Sixteen of the eighteen messages are asserted verbatim above; this
    // is the claim that none of them MOVED.
    expect(lintFlow(flowOf({ id: 'a', role: 'r', adapter: 'claude' }))).toBe(true);
    expect(refusal(flowOf({ id: 'i', type: 'integrate' }, { id: 'v', output: { verdict: 'a|b' } })).problems)
      .toEqual([
        'i: integrate needs branches',
        'v: has a verdict but no on_fail/route — verdicts must go somewhere',
      ]);
  });
});

describe('Q-0055 AC-14 — a flow with no steps, refused by its own rule and its own message', () => {
  test('the absent key and the empty list get the same message, and it is not the id rule\'s', () => {
    expect(onlyProblem({ name: 'f', consumes: 'x', produces: 'y' })).toBe('flow needs steps');
    expect(onlyProblem({ name: 'f', consumes: 'x', produces: 'y', steps: [] })).toBe('flow needs steps');
    // Two rules, never reported as one: a flow that has steps and cannot name them says only the
    // first, and a flow with none says only the second.
    expect(onlyProblem(flowOf({ role: 'r' }))).toMatch(/^step 1: id is required/);
  });

  test('it joins the accumulated error beside the other flow-level message, in that order', () => {
    expect(refusal({ name: 'f' }).problems).toEqual(['flow needs steps', 'flow needs consumes/produces']);
  });

  test('and `flattenSteps`\'s own preserved defect is untouched', () => {
    // The rule reads the flow's declared list; `steps: null` and `steps: [null]` still throw a raw
    // TypeError out of `flattenSteps` before it, so neither becomes a polite refusal.
    // Why: preserved defect, see AC-12 defect 4.
    for (const steps of [null, [null]]) {
      expect(() => lintFlow({ name: 'f', consumes: 'x', produces: 'y', steps }), JSON.stringify(steps)).toThrow(TypeError);
    }
    expect(flattenSteps()).toEqual([]);
  });
});

describe('AC-12 — FlowError, and the eight preserved defects', () => {
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

  test('5 — CLOSED by Q-0055: an id-less step is refused, and the gate alone is not', () => {
    // **Inverted rather than deleted.** This was defect 5, the gap Q-0044 carried forward: lint
    // required an `id` on no step kind, so an id-less step linted clean and the engine interpolated
    // the literal `undefined` into a worktree branch name and a loop counter. Deleting the pin when
    // the defect closed would replace a check that can fail with an absence that cannot, so it now
    // asserts the REFUSAL — five kinds refused, the gate accepted — and a regression fails here
    // instead of passing unnoticed. Q-0037 AC-4h is the precedent.
    const { problems } = refusal({
      name: 'f', consumes: 'x', produces: 'y',
      steps: [
        { role: 'r', adapter: 'claude' },
        { parallel: [{ role: 'r', adapter: 'claude' }, { role: 'r', adapter: 'codex' }] },
        { type: 'script', run: 'pnpm test' },
        { type: 'integrate', branches: ['b'] },
        { fan_out: { from: 'solution/tasks.yaml' }, step: { role: 'r' } },
        { gate: 'human', reason: 'approve' },
      ],
    });
    // Six top-level entries, of which the second is a two-member group and the sixth is the gate:
    // six refusals, and the gate contributes none.
    expect(problems.map((problem) => problem.split(':')[0])).toEqual([
      'step 1', 'step 2, parallel member 1', 'step 2, parallel member 2', 'step 3', 'step 4', 'step 5',
    ]);
    // The literal the engine used to be handed is still what an id-less step's OTHER messages open
    // with — AC-6 keeps those fourteen unchanged, and the id problem beside them is what explains
    // the prefix rather than a positional fallback that would rewrite all fourteen.
    expect(refusal(flowOf({ type: 'integrate' })).problems).toContain('undefined: integrate needs branches');
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

// ---------------------------------------------------------------------------------------------
// The property, asserted against the real linter rather than against a reading of it.
//
// **Q-0107 AC-9/AC-10 — `moved`, from `packages/shared/src/flow.test.ts`.** It stood there and
// reached the real `lintFlow` by importing `spike/src/lint.js` through a file URL, because that was
// the only linter `packages/shared` could execute: the dependency direction is `core → shared` and
// never the reverse (04-architecture.md), so this package's linter was out of reach from there.
// Q-0103 deletes the spike, and the property has no counterpart to re-aim at from that side — so
// the tests come to the linter rather than the linter going to the tests. Nothing about them
// changed except which `lintFlow` they run and where the citations point.
//
// `requirements/errata.md` E-1 (2026-08-25) supersedes Q-0041 AC-3's original wording. The property
// is about PRESENCE — "lint succeeding implies the schema requires no key that is absent" — and the
// type divergence below is the boundary E-1 draws, asserted as `lint accepts / schema rejects` and
// named as such. It is not a list of exceptions to be argued down one at a time: three review
// rounds were spent on that, from reading `lintFlow` rather than running it.
//
// Every verdict here comes from `./lint.js` itself, called rather than transcribed. If the linter
// changes, this file fails rather than continuing to assert a property about a linter that no
// longer exists.
// ---------------------------------------------------------------------------------------------

/**
 * Whether the real `lintFlow` accepts a flow object.
 *
 * A `FlowError` is a refusal and is the answer; anything else thrown is not, and is re-raised
 * rather than counted as one — a linter that crashed has not accepted or rejected anything, and
 * reading a crash as "rejected" is the conflation the containment decision of 2026-08-24 forbids in
 * its own domain. Moved from `packages/shared/test/corpus.ts`, whose only callers these tests were.
 */
function lintAccepts(flow: unknown): boolean {
  try {
    return lintFlow(flow) === true;
  } catch (error) {
    if (error instanceof FlowError) return false;
    throw error;
  }
}

/**
 * A shipped flow, parsed the way the engine parses it.
 *
 * The loader assigns `flow.file = file` onto the parsed object BEFORE lint or anything else sees
 * it, so every corpus flow is read with the injected key included: that is the object the rest of
 * the product actually holds.
 */
function loadAsTheEngineDoes(file: string): Record<string, unknown> {
  const flow = YAML.parse(repoFile(file)) as Record<string, unknown>;
  flow.file = file;
  return flow;
}

/** The shipped flow files, relative to the repository root, and never an empty list. */
function shippedFlows(): string[] {
  const dir = 'harness/flows';
  const files = fs.readdirSync(path.join(repoRoot, dir))
    .filter((name) => name.endsWith('.yaml')).sort().map((name) => `${dir}/${name}`);
  if (!files.length) throw new Error(`corpus empty: ${dir} holds no flow — this test proves nothing without one`);
  return files;
}

describe('Q-0041 AC-3 as errata E-1 amends it — lint succeeding implies no absent key is required', () => {
  /**
   * Flows the real `lintFlow` accepts. Each must therefore parse, unchanged.
   *
   * **Six of these rows gained a step at Q-0055 and two left the register entirely**, and the
   * distinction is the point. The six were about something else — a missing `name`, the injected
   * `file`, a key nothing reads, a stage outside the ten — and merely happened to carry `steps: []`
   * or no `steps` key at all, which AC-14 now refuses; each keeps its own subject and gains the one
   * step that lets it isolate it. The two that were *about* the absent key could not be repaired
   * that way, because repairing them would delete the claim: they moved to the refusing register
   * below rather than being deleted, so the reversal is asserted instead of merely unmade (AC-15).
   */
  const PRESENCE_CASES: [string, Record<string, unknown>][] = [
    ['no name — the refusal header prints `flow.name ?? flow.file`',
      { consumes: 'green', produces: 'reviewed', steps: [{ id: 's' }] }],
    ['the loader-injected `file`, which is in no YAML file',
      { consumes: 'green', produces: 'reviewed', file: '/abs/harness/flows/review.yaml', steps: [{ id: 's' }] }],
    ['a key nothing reads', { consumes: 'green', produces: 'reviewed', notes: 'hand-added', steps: [{ id: 's' }] }],
    ['stages outside the ten-member list — the flow rule checks presence only',
      { name: 'x', consumes: 'custom', produces: 'custom-next', steps: [{ id: 's' }] }],
    ['a gate step with no id — chore.yaml:59',
      { consumes: 'green', produces: 'reviewed', steps: [{ gate: 'human', reason: 'approve' }] }],
    ['a script step with no `run` — lint has no rule for it',
      { consumes: 'red', produces: 'green', steps: [{ id: 's', type: 'script' }] }],
    ['an agent step carrying nothing but an id',
      { consumes: 'draft', produces: 'requirements', steps: [{ id: 'a' }] }],
  ];

  /**
   * The same flow written once per step kind, each with its step carrying NO id.
   *
   * **This register changed direction at Q-0055 and kept every row.** Until then it recorded the
   * premise of the defect — that `lintFlow` required an id on no kind, gathering ids with
   * `steps.filter((step) => step.id)` so an id-less step was simply absent from the duplicate-id
   * check and no other rule looked for one. Five of its six rows are now REFUSALS and the sixth,
   * the gate, is unmoved; each row carries the verdict it expects, so a linter that stopped
   * refusing fails here rather than emptying a register that would go on reading as coverage.
   *
   * The schema assertion beside each is unchanged and is what makes this the third boundary rather
   * than a repeat of the first: **lint refuses / the schema accepts**. E-1's property is one-way —
   * lint SUCCEEDING implies no absent key is required — so a rule lint has and the schema does not
   * is exactly what decision *"Zod describes structure and types; the flow lint keeps the
   * semantics"* (2026-08-25) asks for. Until Q-0041 iteration 5 the schema required `id` on the
   * agent, script, integrate and fan-out kinds, which is that rule in the wrong file; restoring it
   * now that lint has one would be the same mistake with a better excuse (Q-0055 AC-7).
   *
   * Each row carries whatever else its kind needs to reach the id rule (`branches` on integrate, a
   * `step:` template on fan-out), so the only thing under test is the missing id.
   */
  const ID_LESS_CASES: [string, Record<string, unknown>, boolean][] = [
    ['a plain agent step',
      { consumes: 'a', produces: 'b', steps: [{ role: 'r', adapter: 'claude' }] }, false],
    ['a `parallel` member',
      { consumes: 'a', produces: 'b', steps: [{ parallel: [{ role: 'r', adapter: 'claude' }, { role: 'r', adapter: 'codex' }] }] }, false],
    ['a script step',
      { consumes: 'a', produces: 'b', steps: [{ type: 'script', run: 'pnpm test' }] }, false],
    ['an integrate step',
      { consumes: 'a', produces: 'b', steps: [{ type: 'integrate', branches: ['harness/{id}/implement'] }] }, false],
    ['a fan-out step',
      { consumes: 'a', produces: 'b', steps: [{ fan_out: { by: 'role' }, step: { role: 'developer-{role}' } }] }, false],
    ['a gate step — chore.yaml:59, the one kind that was already right',
      { consumes: 'a', produces: 'b', steps: [{ gate: 'human', reason: 'approve' }] }, true],
  ];

  /**
   * Flows the real `lintFlow` also accepts, and `flowSchema` rejects — because `lintFlow`
   * type-checks almost nothing: where a value reaches it at all it reaches `String()` or
   * `.includes()`, which accept anything. This is E-1's boundary, in the direction E-1 chose:
   * describing what a value may be is `packages/shared`'s reason to exist, and closing the gap the
   * other way means `z.unknown()` on every field.
   *
   * **Q-0055 took exactly one row out of it**, and the row MOVED rather than being deleted: a bare
   * string where a step object belongs is now refused by lint on PRESENCE — a string carries no
   * usable `id` and is not a gate — and by the schema on TYPE. The two agree by coincidence and for
   * unrelated reasons, which is precisely why it is no longer evidence of a divergence; it sits in
   * the refusing register below with that sentence attached. The other five are verified untouched,
   * `{ id: 42 }` and `{ gate: 42 }` among them, which is what refusing to type-check the id buys.
   */
  const TYPE_DIVERGENCE_CASES: [string, Record<string, unknown>][] = [
    ['a step adapter that is a number', { consumes: 'a', produces: 'b', steps: [{ id: 'a', adapter: 42 }] }],
    ['a step id that is a number', { consumes: 'a', produces: 'b', steps: [{ id: 42 }] }],
    ['a gate that is a number', { consumes: 'a', produces: 'b', steps: [{ gate: 42 }] }],
    ['`cross_vendor` that is a number', { consumes: 'a', produces: 'b', cross_vendor: 42, steps: [{ id: 's' }] }],
    ['`max_turns` that is a word', { consumes: 'a', produces: 'b', steps: [{ id: 'a', max_turns: 'many' }] }],
  ];

  test('presence: every flow the real lintFlow accepts parses, unchanged', () => {
    for (const [why, flow] of PRESENCE_CASES) {
      expect(lintAccepts(flow), `lintFlow must accept: ${why}`).toBe(true);
      const result = flowSchema.safeParse(flow);
      expect(result.error?.issues ?? [], `schema must accept: ${why}`).toEqual([]);
      expect(result.data, `schema must not alter: ${why}`).toEqual(flow);
    }
  });

  test('the third boundary: lint refuses an id-less step of every kind but a gate, and the schema still accepts it', () => {
    const refused = ID_LESS_CASES.filter(([, , accepted]) => !accepted);
    expect(refused, 'a register with nothing refused in it asserts nothing').toHaveLength(5);
    expect(ID_LESS_CASES.filter(([, , accepted]) => accepted), 'the gate is the one exemption').toHaveLength(1);
    for (const [what, flow, accepted] of ID_LESS_CASES) {
      expect(lintAccepts(flow), `lintFlow must ${accepted ? 'accept' : 'refuse'} ${what} with no id`).toBe(accepted);
      // Unchanged from before the rule landed, and that is the boundary: the schema requires no key
      // lint refuses a flow for lacking, so a presence rule lives in exactly one file.
      const result = flowSchema.safeParse(flow);
      expect(result.error?.issues ?? [], `the schema must accept ${what} with no id`).toEqual([]);
      expect(result.data, `the schema must not alter ${what}`).toEqual(flow);
    }
  });

  test('presence: the six shipped flows lint clean and parse, as the engine hands them over', () => {
    const files = shippedFlows();
    expect(files.length, 'the shipped set is six flows').toBe(6);
    for (const file of files) {
      const flow = loadAsTheEngineDoes(file);
      expect(lintAccepts(flow), `${path.basename(file)} must lint clean`).toBe(true);
      expect(flowSchema.parse(flow), `${path.basename(file)} must parse unchanged`).toEqual(flow);
    }
  });

  test('types: the boundary E-1 draws — lint accepts these, the schema rejects them', () => {
    for (const [why, flow] of TYPE_DIVERGENCE_CASES) {
      expect(lintAccepts(flow), `lintFlow accepts ${why} — that is the premise`).toBe(true);
      expect(flowSchema.safeParse(flow).success, `the schema rejects ${why} — that is the boundary`).toBe(false);
    }
  });

  test('`consumes` and `produces` stay required, because lint requires them too', () => {
    // lint.ts:245 pushes "flow needs consumes/produces", so requiring them adds no rule.
    expect(lintAccepts({})).toBe(false);
    expect(flowSchema.safeParse({}).success).toBe(false);
    expect(lintAccepts({ consumes: 'a', steps: [] })).toBe(false);
    expect(flowSchema.safeParse({ consumes: 'a', steps: [] }).success).toBe(false);
  });

  test('`steps` present but not an array is not part of the divergence — lint does not accept it either', () => {
    // E-1 names this shape explicitly. `flattenSteps` throws a raw TypeError — NOT a FlowError — on
    // both, so `lintAccepts` re-raises rather than counting a crash as a refusal, and the schema
    // narrows nothing by rejecting them.
    for (const steps of [null, [null]]) {
      expect(() => lintAccepts({ name: 'x', consumes: 'a', produces: 'b', steps })).toThrow(TypeError);
      expect(flowSchema.safeParse({ name: 'x', consumes: 'a', produces: 'b', steps }).success).toBe(false);
    }
  });

  test('no zod issue replaces a lint message: the semantic refusals stay lint\'s', () => {
    // Q-0041 AC-4 rule 1, which E-1 leaves untouched. Each of these is a flow the SCHEMA accepts and
    // LINT refuses — the opposite direction from the property, and the one that must keep working,
    // since a schema that rejected first would take the eighteen messages out of `quorum lint`'s
    // output.
    //
    // **The last three rows are Q-0055's, and two of them arrived here from `PRESENCE_CASES`.**
    // AC-15 requires a row that asserts the opposite to be flipped rather than deleted, so the two
    // that recorded `flattenSteps(steps = [])` defaulting the key away now record the refusal that
    // replaced it, and the register they left is smaller by exactly the claim that moved.
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
      ['a step with no usable id (Q-0055)', { consumes: 'a', produces: 'b', steps: [{ id: '   ', role: 'r' }] }],
      ['no `steps` key — was a PRESENCE row until Q-0055 AC-14', { name: 'x', consumes: 'green', produces: 'reviewed' }],
      ['neither a name nor steps — the same rule, and the second row AC-15 moved', { consumes: 'green', produces: 'reviewed' }],
    ];
    // Named rather than counted from `semantic.length`, which would agree with itself whatever the
    // list held. `flow.ts`'s own comment says twelve, and this is the arithmetic behind it.
    expect(semantic).toHaveLength(12);
    for (const [why, flow] of semantic) {
      expect(lintAccepts(flow), `lint must refuse ${why}`).toBe(false);
      const result = flowSchema.safeParse(flow);
      expect(result.error?.issues ?? [], `the schema must NOT refuse ${why} — that message is lint's`).toEqual([]);
    }
  });
});
