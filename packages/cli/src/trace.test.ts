/**
 * Q-0094 AC-3 and AC-4(1) — one `Event` to the bytes `spike/bin/harness.js:63–73` prints for it.
 *
 * **Over the escapes rather than through them.** Every other suite in this package reads its output
 * through `plain`, which is right when the claim is about words; here the claim is about the exact
 * line, marker and colour a maintainer sees, so the assertions are on the raw string and the palette
 * is `colour.ts`'s own rather than a second copy of six escape sequences.
 *
 * **This is where the two rows `--verbose` does not gate are asserted.** The mock adapter emits
 * `stdout` and neither `spawn` nor `retry` (`packages/core/src/adapters/mock.ts:105`), so
 * `run.test.ts`'s end-to-end pair can only show the row that is gated — and on its own it would be
 * satisfied by a renderer that dropped all three.
 */
import { eventSchema, type Event } from '@quorum/shared';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { c } from './colour.js';
import { renderEvent } from './trace.js';

let printed: string[] = [];
let saved: typeof console.log;

beforeEach(() => {
  printed = [];
  saved = console.log;
  console.log = (line: unknown): void => { printed.push(String(line)); };
});

afterEach(() => {
  console.log = saved;
});

/** Render one event and return every line it printed. */
const render = (event: Event, verbose = false): string[] => {
  renderEvent(event, verbose);
  return printed;
};

/** An event, checked against the shipped union first so no fixture here can drift from it. */
const event = (value: unknown): Event => {
  const parsed = eventSchema.safeParse(value);
  expect(parsed.success, `the fixture is not an Event: ${JSON.stringify(value)}`).toBe(true);
  return parsed.data as Event;
};

describe('AC-3 — every kind renders the spike\'s bytes', () => {
  test('info and warn are one marker and the message, and both go to stdout', () => {
    // `warn` on stdout is preserved: the spike writes no event to stderr (`bin/harness.js:65`), and
    // moving one would change what a caller redirecting output sees.
    expect(render(event({ type: 'info', message: 'run #1 started' })))
      .toStrictEqual([`${c.dim('·')} run #1 started`]);
    printed = [];
    expect(render(event({ type: 'warn', message: 'loop exhausted' })))
      .toStrictEqual([`${c.amber('!')} loop exhausted`]);
  });

  test('step and done are the marker, the bold step id and the dim message', () => {
    expect(render(event({ type: 'step', stepId: 'pm-claude', message: 'mock/opus role=product-manager' })))
      .toStrictEqual([`${c.teal('▸')} ${c.bold('pm-claude')} ${c.dim('mock/opus role=product-manager')}`]);
    printed = [];
    expect(render(event({ type: 'done', stepId: 'pm-claude', message: 'verdict=ready cost=$0.010 20ms' })))
      .toStrictEqual([`${c.green('✓')} ${c.bold('pm-claude')} ${c.dim('verdict=ready cost=$0.010 20ms')}`]);
  });

  test('spawn is always shown, verbose or not', () => {
    const spawn = event({ type: 'spawn', stepId: 'pm-claude', vendor: 'claude', cmd: 'claude -p --output-format json' });
    expect(render(spawn)).toStrictEqual([c.dim('  [pm-claude] $ claude -p --output-format json')]);
    printed = [];
    expect(render(spawn, true), 'the line changes with --verbose')
      .toStrictEqual([c.dim('  [pm-claude] $ claude -p --output-format json')]);
  });

  test('retry is always shown too, because a run that goes quiet for thirty seconds should say why', () => {
    const retry = event({
      type: 'retry', stepId: 'pm-codex', vendor: 'codex', attempt: 2, of: 5, delayMs: 8000,
      reason: 'transient 503', message: 'upstream unavailable',
    });
    const line = `${c.amber('↻')} pm-codex: transient 503 — attempt 2/5 failed, retrying in 8s`
      + c.dim('\n    upstream unavailable');
    expect(render(retry)).toStrictEqual([line]);
    printed = [];
    expect(render(retry, true)).toStrictEqual([line]);
  });

  test('the retry delay is rounded to whole seconds, as the spike rounds it', () => {
    const at = (delayMs: number): string => {
      printed = [];
      return render(event({
        type: 'retry', stepId: 's', vendor: 'codex', attempt: 1, of: 3, delayMs,
        reason: 'r', message: 'm',
      }))[0];
    };
    expect(at(1400)).toContain('retrying in 1s');
    expect(at(1600)).toContain('retrying in 2s');
  });

  test('AC-3 — stdout is the one kind --verbose gates, and it is truncated at 160 characters', () => {
    const long = 'x'.repeat(200);
    const line = event({ type: 'stdout', stepId: 'pm-claude', line: long });
    expect(render(line), 'a quiet run showed a step\'s stdout').toStrictEqual([]);
    printed = [];
    expect(render(line, true)).toStrictEqual([c.dim(`  [pm-claude] ${'x'.repeat(160)}`)]);
  });

  test('AC-4(1) — a gate event is the banner and the inspect line, and nothing else', () => {
    expect(render(event({
      type: 'gate', gateId: '1:1', kind: 'human', reason: 'PM owner approves requirements/merged.md',
      ticketDir: '/repo/backlog/T-0001-gate-sites',
    }))).toStrictEqual([
      `\n${c.amber('■ GATE')} (human) PM owner approves requirements/merged.md`,
      c.dim('  inspect: /repo/backlog/T-0001-gate-sites'),
    ]);
  });

  test('R-2 — the terminal event prints nothing at all', () => {
    // `core` already emits the run's own human line as an `info` immediately before it
    // (`lifecycle.ts:155`), so a renderer that also formatted this would print every run's outcome
    // twice. Both shapes of the terminal event, because the regression-carrying one is a separate
    // member of the union and could be handled separately by accident.
    expect(render(event({
      type: 'terminal', status: 'completed', runId: 1, stageBefore: 'draft', stageAfter: 'requirements',
      cost: 0.03, tokens: 2703,
    }))).toStrictEqual([]);
    expect(render(event({
      type: 'terminal', status: 'regressed', runId: 2, stageBefore: 'green', stageAfter: 'red',
      cost: 1, tokens: 2, targetFlow: 'development', counter: 'review.verdict', count: 1, limit: 2, remaining: 1,
    }))).toStrictEqual([]);
  });
});

/** A kind no union may legitimately carry, so the parse below always misses every member. */
const IMPOSSIBLE = '__no_such_kind__';

/**
 * Every value `eventSchema`'s discriminator accepts, read out of the issue zod raises when none
 * matches — the derivation `exit.test.ts` uses on the terminal union, for the same reason.
 *
 * `.options` cannot be mapped over directly here: the terminal member is itself a discriminated
 * union, so it carries `.options` where the other eight carry `.shape`. Throws rather than
 * returning an empty list, because a derivation that quietly yielded nothing would make the
 * comparisons below vacuous.
 */
function eventKinds(): string[] {
  const parsed = eventSchema.safeParse({ type: IMPOSSIBLE });
  if (parsed.success) throw new Error(`${IMPOSSIBLE} was accepted, so no discriminator was checked`);
  const issue = parsed.error.issues.find((candidate) => candidate.code === 'invalid_union');
  if (issue === undefined) throw new Error('no invalid_union issue — the schema is not a discriminated union');
  if (!('options' in issue) || issue.options === undefined) throw new Error('the issue named no discriminator options');
  return [...issue.options.filter((option): option is string => typeof option === 'string')].sort();
}

describe('AC-3 — the switch is exhaustive over the shipped union', () => {
  test('the derivation has a subject, and it is the nine kinds this file renders', () => {
    // A tenth member added to `@quorum/shared` fails to compile in `trace.ts` — a property no test
    // can observe — and this is the runtime half: the register below is what fails if the union
    // grows, so the new kind cannot go unrendered while the suite reports green.
    expect(eventKinds()).toStrictEqual([
      'done', 'gate', 'info', 'retry', 'spawn', 'stdout', 'step', 'terminal', 'warn',
    ].sort());
    expect(eventKinds().length, 'the union has no members — this test proves nothing').toBe(9);
  });

  test('and every kind is accounted for above: eight print, one is silent', () => {
    // The two halves are named rather than counted, because "nine kinds, nine tests" would be
    // satisfied by rendering one of them twice and none of `terminal`.
    const silent = ['terminal'];
    const loud = ['info', 'warn', 'step', 'done', 'spawn', 'retry', 'stdout', 'gate'];
    expect([...silent, ...loud].sort()).toStrictEqual(eventKinds());
  });
});
