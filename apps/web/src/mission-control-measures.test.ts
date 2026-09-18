/**
 * Q-0135 AC-10/AC-12/AC-13/AC-16 — the two measured values, asserted by value.
 *
 * No DOM here: every clause drives the pure module against a supplied instant, so a verdict is a
 * property of the commit rather than of the clock on the machine running the suite — *"A test's
 * verdict is a property of the commit, not of the checkout or the account"* (2026-08-30). The
 * rendering of these values is `mission-control-status.test.ts`'s.
 */
import { describe, expect, test } from 'vitest';

import type { WireRun, WireRunHistory, WireVendorRollup } from '@quorum/shared';

import {
  COST_DECIMALS, connectionReportsEnded, elapsedMs, elapsedView, formatCost, formatElapsed,
  historyIdOf, measuredView, runHistoryId, vendorCostRows,
} from './mission-control-measures.js';
import type { ConnectionState } from './connection-state.js';
import type { RunConnectionSnapshot } from './run-connection.js';

/** The instant every elapsed clause measures from, so no figure below depends on a real clock. */
const START = '2026-09-18T00:00:00.000Z';

/** One history response, with only the fields a clause is about supplied per case. */
const history = (
  manifest: Partial<WireRunHistory['manifest']> = {},
  over: Partial<WireRunHistory> = {},
): WireRunHistory => ({
  manifest: { started_at: START, ended_at: null, duration_ms: null, status: 'running', rollup: [], ...manifest },
  incomplete: true,
  tokensByVendor: {},
  ...over,
});

/** One roll-up row, so a case changes the one field it is about. */
const rollupRow = (over: Partial<WireVendorRollup> & { vendor: string }): WireVendorRollup =>
  ({ cost_usd: null, unpriced_steps: 0, step_count: 1, ...over });

/** One run row the daemon reported. */
const run = (over: Partial<WireRun> = {}): WireRun => ({
  handle: 'run-3', flow: 'chore', ticketId: 'Q-0135', runId: 1, dry: false, state: 'running',
  pendingGates: 0, gates: [], refusal: null, ...over,
});

/** A socket snapshot in one state, carrying whatever events a clause is about. */
const snapshot = (state: ConnectionState, events: readonly object[] = []): RunConnectionSnapshot =>
  ({ state, events: events as never[], missedCount: null, browserDiscardedCount: null });

/** The terminal event, which is the run reporting its own end on the stream. */
const TERMINAL = { type: 'terminal', runId: 1, stageBefore: 'requirements', stageAfter: 'reviewed', cost: 0, tokens: 0, status: 'completed' };

describe('Q-0135 AC-12 — elapsed formats, clamps, and never wraps', () => {
  test('MM:SS under an hour, H:MM:SS from one, zero-padded, hours unbounded', () => {
    // Exact strings against a controlled clock rather than a shape: the figure IS the contract, and
    // a test asserting only that something renders would pass over a wrapped or unpadded one.
    expect(formatElapsed(0), 'a run that has just started').toBe('00:00');
    expect(formatElapsed(872_000), 'fourteen minutes and thirty-two seconds').toBe('14:32');
    expect(formatElapsed(3_600_000), 'exactly one hour').toBe('1:00:00');
    expect(formatElapsed(3_599_999), 'one millisecond under an hour still reads as minutes').toBe('59:59');
    expect(formatElapsed(5_248_000), 'one hour twenty-seven minutes twenty-eight seconds').toBe('1:27:28');
    // **No day rollover**, which is the case a wrapping formatter gets wrong in the one direction a
    // reader cannot detect: this is 50 hours and it says so.
    expect(formatElapsed(180_000_000), 'a multi-day run wrapped').toBe('50:00:00');
    // Seconds are truncated rather than rounded, so a figure never reads ahead of the clock.
    expect(formatElapsed(1_999), 'a part second was rounded up').toBe('00:01');
  });

  test('a clock that moved backwards renders the floor, and an unreadable instant is not a figure', () => {
    expect(elapsedMs(START, '2026-09-18T00:00:10.000Z'), 'ten seconds').toBe(10_000);
    // A start in the future — a browser clock behind the daemon's — clamps rather than going
    // negative, which is what `formatElapsed` would otherwise render as a nonsense duration.
    expect(elapsedMs('2026-09-18T01:00:00.000Z', START), 'a negative difference was not clamped').toBe(0);
    expect(formatElapsed(elapsedMs('2026-09-18T01:00:00.000Z', START) ?? -1)).toBe('00:00');
    // And a `started_at` the schema accepts as a non-empty string but that is not an instant: `null`
    // rather than a `NaN` that would render as a figure.
    expect(elapsedMs('not an instant', START), 'an unreadable start produced a number').toBeNull();
    expect(elapsedMs(START, 'not an instant'), 'an unreadable now produced a number').toBeNull();
  });

  test("the frozen figure is the ENGINE's duration and never a subtraction performed here", () => {
    // **The one assertion that distinguishes this from recomputing `ended_at - started_at`**, and it
    // looks pointless without the reason: `finalise` computes `duration_ms` from the same `Date`
    // reading that produced `ended_at`, so it is one measurement. The fixture makes the two disagree
    // — 10 seconds by subtraction, 7 by the engine — and the engine's is what renders.
    const ended = history({ ended_at: '2026-09-18T00:00:10.000Z', duration_ms: 7_000, status: 'completed' });
    const view = elapsedView(ended, false, '2026-09-18T09:00:00.000Z');
    expect(view.kind, 'an ended run was still advancing').toBe('ended');
    expect(view.kind === 'ended' && view.text, 'the browser subtracted two instants instead').toBe('00:07');
  });

  test('advancement stops on whichever authority speaks first, and neither invents a figure', () => {
    // The manifest read is a SNAPSHOT. A run that ends after it leaves the browser holding
    // `status: 'running'` and `ended_at: null`, so an elapsed figure gated on the manifest alone
    // advances past an end that has already happened.
    const live = history();
    expect(elapsedView(live, false, '2026-09-18T00:14:32.000Z').kind, 'a live run was not advancing').toBe('running');
    expect(elapsedView(live, false, '2026-09-18T00:14:32.000Z')).toStrictEqual({ kind: 'running', text: '14:32' });
    // The stream speaking first, with the SAME manifest: nothing was read again, and the figure stops.
    expect(elapsedView(live, true, '2026-09-18T00:14:32.000Z').kind, 'a terminal event did not stop the figure')
      .toBe('ended-unmeasured');
    // The read speaking first: an `ended_at` with no duration beside it is a run that is over and a
    // figure that has not been written, which is a sentence rather than a frozen number.
    const endedNoDuration = history({ ended_at: '2026-09-18T00:00:10.000Z', duration_ms: null, status: 'interrupted' });
    expect(elapsedView(endedNoDuration, false, '2026-09-18T09:00:00.000Z').kind).toBe('ended-unmeasured');
    // And the unreadable start is named rather than rendered as a difference nobody can take.
    expect(elapsedView(history({ started_at: 'yesterday' }), false, START).kind).toBe('unreadable-start');
  });

  test('a terminal event ends it before the socket closes, and both signals count', () => {
    // Two signals rather than one, and the EARLIER decides: a terminal event is the run reporting
    // its own end, and `ended` is the socket closing after one. Gating on the close alone keeps a
    // figure advancing across the gap between them.
    expect(connectionReportsEnded(snapshot({ kind: 'live' as const, requestedUrl: 'x' }, [TERMINAL])),
      'a terminal event on a live socket was not read as an end').toBe(true);
    expect(connectionReportsEnded(snapshot({ kind: 'ended' })), 'a closed socket was not read as an end').toBe(true);
    expect(connectionReportsEnded(snapshot({ kind: 'live' as const, requestedUrl: 'x' }, [{ type: 'step', stepId: 'a', message: 'x' }])),
      'an ordinary event was read as an end').toBe(false);
    // A socket that dropped says nothing about the run, which is *"connection state is not run
    // state"* at this predicate: it is the browser's transport, and the run may still be going.
    expect(connectionReportsEnded(snapshot({ kind: 'dropped' })), 'a dropped socket was read as a run ending')
      .toBe(false);
  });
});

describe('Q-0135 AC-13 — one entry per vendor, in the roll-up\'s order, keyed on no known name', () => {
  test('a priced vendor and an unpriced one render two entries and no third', () => {
    const rows = vendorCostRows(history(
      { rollup: [rollupRow({ vendor: 'claude', cost_usd: 78.675, step_count: 4 }), rollupRow({ vendor: 'codex', step_count: 2, unpriced_steps: 2 })] },
      { tokensByVendor: { claude: 100, codex: 714_125 } },
    ));
    expect(rows, 'a third entry was composed').toHaveLength(2);
    expect(rows.map((row) => row.vendor), 'the roll-up order was not preserved').toStrictEqual(['claude', 'codex']);
    expect(rows[0]?.cost, 'a priced vendor did not render its price').toBe('$78.675');
    // **`null` and not a zero**, which is the `n/a`-never-`0` rule: nobody reported a price is not
    // the claim that the work was free.
    expect(rows[1]?.cost, 'an unpriced vendor rendered a price').toBeNull();
    expect(rows[1]?.tokens, 'an unpriced vendor did not fall back to its token total').toBe(714_125);
    // A token total belongs to the row that has no price, and nowhere else: a priced vendor showing
    // one would put a count beside a price and invite a reader to add them up.
    expect(rows[0]?.tokens, 'a priced vendor also carried a token count').toBeNull();
    expect(rows[1]?.unpricedSteps, 'the count of unpriced steps did not cross').toBe(2);
  });

  test('vendors no adapter here has ever produced render correctly, which catches a hard-coded name', () => {
    // **This repository's own corpus would validate the wrong implementation.** Across its 169
    // manifests every `claude` row is priced and every `codex` row unpriced, with no exception in
    // either direction — so a browser that branched on the name would pass against real data and
    // fail on the first third adapter. The fixture uses names no adapter here has.
    const rows = vendorCostRows(history(
      { rollup: [rollupRow({ vendor: 'zeta', cost_usd: null }), rollupRow({ vendor: 'omega', cost_usd: 2.5 })] },
      { tokensByVendor: { zeta: 40, omega: 900 } },
    ));
    expect(rows.map((row) => [row.vendor, row.cost, row.tokens]))
      .toStrictEqual([['zeta', null, 40], ['omega', '$2.500', null]]);
  });

  test('a genuinely reported zero is a price, and a vendor reporting no measure at all reads neither', () => {
    // `rollup()`'s own rule: *"a measure nobody reported stays `null` rather than accumulating from
    // `0` … while a genuinely reported `0` stays `0`."* A clause banning `$0.000` outright would be
    // wrong; the rule is about `null`.
    const zero = vendorCostRows(history({ rollup: [rollupRow({ vendor: 'zeta', cost_usd: 0 })] }));
    expect(zero[0]?.cost, 'a reported zero was suppressed as though nobody had reported one').toBe('$0.000');
    // And the third state beneath *unpriced*: the daemon's own per-vendor reduction is itself `null`
    // where neither input nor output tokens were reported, which is the `n/a`-never-`0` rule again.
    const neither = vendorCostRows(history(
      { rollup: [rollupRow({ vendor: 'zeta', cost_usd: null })] },
      { tokensByVendor: { zeta: null } },
    ));
    expect(neither[0], 'a vendor reporting nothing at all invented a figure')
      .toStrictEqual({ vendor: 'zeta', cost: null, tokens: null, unpricedSteps: 0 });
  });

  test('nothing is filtered on status, and no figure is a sum across rows', () => {
    // A failed occurrence that was billed is in the roll-up by design — failure being when the
    // number matters most — so a status is never a reason to drop a row. And the blended figure this
    // whole design refuses: no rendered value equals the sum of two rows' costs.
    const rows = vendorCostRows(history({
      status: 'failed',
      rollup: [rollupRow({ vendor: 'zeta', cost_usd: 1.5 }), rollupRow({ vendor: 'omega', cost_usd: 2.25 })],
    }));
    expect(rows).toHaveLength(2);
    const blended = formatCost(1.5 + 2.25);
    expect(rows.map((row) => row.cost), 'a figure across vendors was composed').not.toContain(blended);
  });

  test('money renders to three decimals, matching the one existing renderer of this field', () => {
    // `packages/cli/src/runs.ts` renders `rollup[].cost_usd` at three, under its own Q-0034
    // authority line — at two a real sub-cent step becomes indistinguishable from a reported zero.
    // A second convention here for one kind of value would be drift.
    expect(COST_DECIMALS, 'the precision moved').toBe(3);
    // Rounded and not truncated, which is what a sum of per-occurrence floats needs: truncation
    // would render this as `$1.234`.
    expect(formatCost(1.23456789), 'a long float was not rounded').toBe('$1.235');
    expect(formatCost(12.5), 'a short float was not padded').toBe('$12.500');
  });
});

describe('Q-0135 AC-10/AC-16 — what is read, and every reason nothing was', () => {
  test('the id is composed from two typed fields, and a walk composes none', () => {
    expect(historyIdOf('Q-0135', 1)).toBe('Q-0135-1');
    expect(runHistoryId(run()), 'a real run composed no id').toBe('Q-0135-1');
    // **The dry gate, which is the whole reason `dry` is on the wire.** A walk is allocated a number
    // and writes no history; the next real run of that ticket receives the identical number, so the
    // id would name that run's directory.
    expect(runHistoryId(run({ dry: true })), 'a dry walk composed a history id').toBeNull();
    expect(runHistoryId(run({ runId: null })), 'a run with no number composed an id').toBeNull();
    expect(runHistoryId(run({ ticketId: null })), 'a run with no ticket composed an id').toBeNull();
    // The handle is never a component of it: two runs at one id would otherwise be told apart by a
    // token that is meaningless across a daemon restart.
    expect(runHistoryId(run({ handle: 'run-99' })), 'the handle reached the id').toBe('Q-0135-1');
  });

  test('each no-read reason is its own answer, and a loaded read is none of them', () => {
    const loaded = { kind: 'loaded' as const, value: history(), fetchedAt: 'now' };
    expect(measuredView(null, null).kind, 'a run nobody has reported was measured').toBe('absent');
    expect(measuredView(null, null)).toStrictEqual({ kind: 'absent', absence: { kind: 'no-run-number' } });
    expect(measuredView(run({ dry: true }), null)).toStrictEqual({ kind: 'absent', absence: { kind: 'dry' } });
    expect(measuredView(run({ ticketId: null }), null)).toStrictEqual({ kind: 'absent', absence: { kind: 'no-ticket-id' } });
    expect(measuredView(run({ runId: null }), null)).toStrictEqual({ kind: 'absent', absence: { kind: 'no-run-number' } });
    // **The dry gate is asked BEFORE the two address gates**, so a walk that has both components is
    // still refused — which is the only ordering under which the hazard is actually closed.
    const walkWithNoTicket = measuredView(run({ dry: true, ticketId: null }), loaded);
    expect(walkWithNoTicket.kind === 'absent' && walkWithNoTicket.absence.kind,
      'a walk was read as an address problem').toBe('dry');
    // A read that came back with something other than a history is the ONE repairable reason, and
    // it carries its own state so the sentence is the daemon's rather than a general one.
    const failed = { kind: 'unreachable' as const, path: 'x' };
    expect(measuredView(run(), failed)).toStrictEqual({ kind: 'absent', absence: { kind: 'not-read', state: failed } });
    // And a composable id with no read state yet names the path being asked for rather than a gap.
    const pending = measuredView(run(), null);
    expect(pending.kind === 'absent' && pending.absence.kind === 'not-read' && pending.absence.state.kind)
      .toBe('in-flight');
    // A loaded read is measured, which is what makes every clause above an absence rather than a
    // predicate that answers `absent` to everything.
    expect(measuredView(run(), loaded)).toStrictEqual({ kind: 'measured', history: loaded.value });
  });
});
