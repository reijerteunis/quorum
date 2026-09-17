/**
 * Q-0131 AC-1 — the run number crosses out of band, once per run, from the site that holds it.
 *
 * Over real runs rather than over a composed context, because the claim is that a value the engine
 * allocates at run start reaches a caller at run start: a fixture that called the callback itself
 * would prove only that a function passed in is a function.
 *
 * **The two source clauses at the bottom are about what did NOT move**, and they are here rather
 * than in a file of their own because they are the other half of one criterion: the value travels
 * out of band precisely so that the event union and the narration are unchanged, and a clause
 * asserting that belongs beside the one asserting the value arrives.
 */
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, afterEach, describe, expect, test, vi } from 'vitest';

import { eventSchema } from '@quorum/shared';
import type { Event } from '@quorum/shared';

import { coreSourceFiles } from '../../test/corpus.js';
import { removeTempDirs, write } from '../../test/repo.js';
import { manifestOf, runFixture, stubAdapter, TICKET_ID } from '../../test/run-fixture.js';
import type { RunFixture } from '../../test/run-fixture.js';
import { runFlow } from './engine.js';

afterAll(removeTempDirs);
afterEach(() => { vi.restoreAllMocks(); });

/** Usage a vendor genuinely reported, so nothing here depends on the unpriced path. */
const BILLED = {
  vendor: 'stub', input_tokens: 1200, output_tokens: 34, cost_usd: 0.25,
  cached_input_tokens: null, cache_write_input_tokens: null,
};

/** What one call of the callback saw: the number, and how many events had reached the consumer. */
interface Report {
  readonly runId: number;
  readonly eventsBefore: number;
}

/** A drained run, keeping its events even when it throws — `runFixture.settle` with the order kept. */
async function drain(fixture: RunFixture, events: Event[]): Promise<unknown> {
  try {
    for await (const event of runFlow(fixture.opts)) events.push(event);
    return undefined;
  } catch (error: unknown) {
    return error;
  }
}

/**
 * A fixture whose caller is listening for the run number, with the ticket's log already at `run=2`.
 *
 * The seeded log is the discriminator rather than decoration: `nextRunId` reads it, so this run is
 * the THIRD and a callback handed a hard-coded 1, an iteration counter, or anything recomputed
 * downstream cannot answer 3.
 */
function listening(events: Event[], reports: Report[]): RunFixture {
  const fixture = runFixture({
    run: { reportRunNumber: (runId) => { reports.push({ runId, eventsBefore: events.length }); } },
  });
  write(path.join(fixture.ticketDir, 'runs.log'),
    'ts run=1 flow=chore start stage=requirements\nts run=2 flow=chore start stage=requirements\n');
  return fixture;
}

describe('Q-0131 AC-1 — a run reports its own number', () => {
  test('the number reaches the caller before any event, and is the one runs.log and run history carry', async () => {
    const events: Event[] = [];
    const reports: Report[] = [];
    const fixture = listening(events, reports);
    fixture.steps([{ id: 'implement', output: { write: 'dev/i.md' } }]);
    stubAdapter(() => ({ output: { summary: 's', document: '# i\n' }, raw: '{}', usage: BILLED }));

    const error = await drain(fixture, events);

    expect(error).toBeUndefined();
    expect(reports, 'the callback was not called, or was called more than once').toHaveLength(1);
    // Before the run-start narration, which is the first event of every run — so before any step
    // event by construction rather than by counting which kinds arrived first.
    expect(reports[0]?.eventsBefore, 'an event reached the consumer before the number did').toBe(0);
    // THREE, because the seeded log says two runs came before. A recomputation cannot answer it.
    expect(reports[0]?.runId, 'the reported number is not the one this run was allocated').toBe(3);
    const log = fs.readFileSync(path.join(fixture.ticketDir, 'runs.log'), 'utf8');
    expect(log, 'the number reported is not the number runs.log records').toContain('run=3 flow=chore start');
    // …and run history agrees, which is the directory `.quorum/runs/<id>-N/` is named after: three
    // readings of one value rather than one assertion repeated.
    expect(manifestOf(fixture.repoDir, 3).run_id, 'run history was written under a different number')
      .toBe(`${TICKET_ID}-3`);
    const terminal = events.find((event) => event.type === 'terminal');
    expect(terminal?.type === 'terminal' ? terminal.runId : null,
      'the number reported at the start and the number the terminal event carries disagree').toBe(3);
  });

  test('a dry walk reports its number too', async () => {
    // `nextRunId` runs above the `if (!dry)` guard, so a dry run is allocated a number like any
    // other and a caller watching one is owed the same identity. It is also the first case anyone
    // exercising this will meet, which is why it is asserted rather than assumed (R-5).
    const events: Event[] = [];
    const reports: Report[] = [];
    const fixture = runFixture({
      run: { dry: true, reportRunNumber: (runId) => { reports.push({ runId, eventsBefore: events.length }); } },
    });
    fixture.steps([{ id: 'implement', output: { write: 'dev/i.md' } }]);

    const error = await drain(fixture, events);

    expect(error).toBeUndefined();
    expect(reports.map((report) => report.runId), 'a dry walk did not report its number').toStrictEqual([1]);
    // …and it really was dry: no run history was written, so the number came from the allocation
    // rather than from anything on disk.
    expect(fs.existsSync(path.join(fixture.repoDir, '.quorum')),
      'the dry walk wrote run history, so this fixture is not exercising the dry path').toBe(false);
  });

  test('a flow that traverses a backward edge reports once, not once per traversal', async () => {
    const events: Event[] = [];
    const reports: Report[] = [];
    const fixture = listening(events, reports);
    fixture.steps([
      { id: 'review', output: { write: 'dev/r.md', verdict: 'approve|changes-requested' }, on_fail: { goto: 'review', max_iterations: 1 } },
    ]);
    stubAdapter((_invocation, call) => call === 1
      ? { output: { summary: 'round one', document: '# r\n', verdict: 'changes-requested', findings: ['major: a.ts:1 x'] }, raw: '{}', usage: BILLED }
      : { output: { summary: 'round two', document: '# r\n', verdict: 'approve', findings: [] }, raw: '{}', usage: BILLED });

    const error = await drain(fixture, events);

    expect(error).toBeUndefined();
    // The loop really turned — otherwise this asserts "once" over a run that ran the step once.
    expect(events.filter((event) => event.type === 'step' && event.stepId === 'review'),
      'the backward edge was never traversed, so this check has lost its subject').toHaveLength(2);
    expect(reports.map((report) => report.runId), 'a re-entered step reported the number again').toStrictEqual([3]);
  });

  test('a callback that throws costs one warn and changes nothing else about the run', async () => {
    const events: Event[] = [];
    const fixture = runFixture({
      run: { reportRunNumber: () => { throw new Error('the caller fell over'); } },
    });
    fixture.steps([{ id: 'implement', output: { write: 'dev/i.md' } }]);
    stubAdapter(() => ({ output: { summary: 's', document: '# i\n' }, raw: '{}', usage: BILLED }));

    const error = await drain(fixture, events);

    expect(error, 'a reporting channel took the run down').toBeUndefined();
    const terminal = events.find((event) => event.type === 'terminal');
    expect(terminal?.type === 'terminal' ? terminal.status : null,
      'the terminal status moved because a callback threw').toBe('completed');
    // Explicit rather than silent: the failure is said out loud, in the caller's own words.
    const warnings = events.filter((event) => event.type === 'warn').map((event) => event.message);
    expect(warnings.filter((message) => message.includes('the caller fell over')),
      'the callback failed and nothing said so').toHaveLength(1);
    // …and the run is otherwise the run it would have been: the step ran and its document landed.
    expect(fs.readFileSync(path.join(fixture.ticketDir, 'dev/i.md'), 'utf8')).toBe('# i\n');
  });

  test('a run whose caller supplies no callback is unchanged', async () => {
    const events: Event[] = [];
    const fixture = runFixture();
    fixture.steps([{ id: 'implement', output: { write: 'dev/i.md' } }]);
    stubAdapter(() => ({ output: { summary: 's', document: '# i\n' }, raw: '{}', usage: BILLED }));

    const error = await drain(fixture, events);

    expect(error).toBeUndefined();
    const terminal = events.find((event) => event.type === 'terminal');
    expect(terminal?.type === 'terminal' ? terminal.status : null).toBe('completed');
    expect(events.filter((event) => event.type === 'warn'),
      'a run with no reporting channel warned about one').toStrictEqual([]);
  });
});

describe('Q-0131 AC-1 — and what the out-of-band supply exists to leave alone', () => {
  test('no run emits an event this union does not already have', () => {
    // The refused alternative from the ENGINE's side: a `start` member would have carried the
    // number in band, and it is what an implementer reaches for next because it mirrors `terminal`.
    // The union's own member count is asserted in `packages/shared/src/events.test.ts`, where the
    // union is declared and where zod is a dependency; this is the half that says the engine emits
    // nothing outside it, which a count cannot say. Erratum E-1.
    const events: Event[] = [];
    const fixture = runFixture({ run: { reportRunNumber: () => undefined } });
    fixture.steps([{ id: 'implement', output: { write: 'dev/i.md' } }]);
    stubAdapter(() => ({ output: { summary: 's', document: '# i\n' }, raw: '{}', usage: BILLED }));

    return drain(fixture, events).then((error) => {
      expect(error).toBeUndefined();
      expect(events.length, 'the run emitted nothing — this check has lost its subject').toBeGreaterThan(0);
      const refused = events.filter((event) => !eventSchema.safeParse(event).success);
      expect(refused, 'a run emitted something the event union does not admit').toStrictEqual([]);
      // …and the union really would refuse a run-start event, so the emptiness above is a property
      // of what was emitted rather than of a parser that accepts anything.
      expect(eventSchema.safeParse({ type: 'start', runId: 3 }).success,
        'the union accepts a run-start event, which is the shape erratum E-1 refuses').toBe(false);
    });
  });

  test('the run-start narration is unchanged, and is still narration', () => {
    // It carries the number and always has. What this asserts is that the number now ALSO travelling
    // out of band did not move it: `runs.log`'s readers and the trace both read this sentence, and a
    // rewrite would have been a second change nobody asked for. The literal is assembled so this
    // file is not its own subject.
    const engine = coreSourceFiles().find(([name]) => name === 'engine/engine.ts')?.[1];
    expect(engine, 'there is no engine module — this check has lost its subject').toBeDefined();
    const narration = ['run #${runId}', '  flow=${flow.name}', '  ticket=${ticket.meta.id}'].join('');
    expect(engine ?? '', 'the run-start info message moved').toContain(narration);
    // The needle discriminates, over a fixture that changes exactly the thing it is about.
    expect(narration.replace('run #', 'run ').includes(narration), 'the needle matches a changed message').toBe(false);
    expect([['fixture.ts', `emit({ type: 'info', message: \`${narration}\` });`]]
      .filter(([, text]) => text.includes(narration)).map(([name]) => name)).toStrictEqual(['fixture.ts']);
  });

  test('the number is reported from one site, and that site is the run loop', () => {
    // A second call site would be a second moment at which a caller is told a number, and the two
    // could disagree the day one of them moved. One occurrence of the option's own name as a call.
    const calls = coreSourceFiles()
      .flatMap(([name, text]) => [...text.matchAll(/\breportRunNumber\s*\(/g)].map(() => name));
    expect(calls, 'the run number is reported from somewhere other than the run loop, or twice')
      .toStrictEqual(['engine/engine.ts']);
    // The needle discriminates.
    expect([...'reportRunNumber(context.runId);'.matchAll(/\breportRunNumber\s*\(/g)]).toHaveLength(1);
    expect([...'reportRunNumber?: ReportRunNumber;'.matchAll(/\breportRunNumber\s*\(/g)]).toHaveLength(0);
  });
});
