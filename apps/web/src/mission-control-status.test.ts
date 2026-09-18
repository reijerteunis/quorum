// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import type { WireRun, WireRunHistory, WireVendorRollup } from '@quorum/shared';
import type { ConnectionState } from './connection-state.js';
import { formatCost } from './mission-control-measures.js';
import { MissionControlStatus, type MissionControlStatusProps } from './mission-control-status.js';
import {
  COST_IN_FLIGHT_TEXT, ELAPSED_BROWSER_CLOCK_TEXT, ELAPSED_ENDED_UNMEASURED_TEXT, ELAPSED_ENGINE_TEXT,
  MEASURED_DRY_TEXT, MEASURED_NO_RUN_NUMBER_TEXT, MEASURED_NO_TICKET_TEXT, MISSION_CONTROL_DISCLOSURES,
  NO_ROLLUP_ROWS_TEXT, absentVendorText, browserDiscardedText, daemonMissedText, unpricedStepsText,
  unpricedVendorText,
} from './mission-control-text.js';
import type { RequestState } from './request-state.js';
import { gatePath } from './routes.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const roots: (() => void)[] = [];
afterEach(async () => { for (const close of roots.splice(0)) await act(async () => close()); document.body.innerHTML = ''; });
const run = (pendingGates = 0, runId: number | null = null, over: Partial<WireRun> = {}): WireRun => ({ handle: 'h', flow: 'development', ticketId: 'Q-0015', runId, dry: false, state: 'running', pendingGates, gates: [], refusal: null, ...over });
/**
 * One roll-up row, and the two the measured clauses use.
 *
 * **The vendor names are ones no adapter here produces**, deliberately: every `claude` row in
 * this repository's own history is priced and every `codex` row unpriced, with no exception in
 * either direction, so a fixture using the real two would validate a browser that branched on the
 * name.
 */
const rollupRow = (over: Partial<WireVendorRollup> & { vendor: string }): WireVendorRollup =>
  ({ cost_usd: null, unpriced_steps: 0, step_count: 1, ...over });
const priced = rollupRow({ vendor: 'zeta', cost_usd: 78.675, step_count: 4 });
const unpriced = rollupRow({ vendor: 'omega', step_count: 3, unpriced_steps: 2 });

/** A loaded history read, with only the fields a clause is about supplied per case. */
const loadedHistory = (
  manifest: Partial<WireRunHistory['manifest']> = {},
  over: Partial<WireRunHistory> = {},
): RequestState<WireRunHistory> => ({
  kind: 'loaded',
  value: {
    manifest: { started_at: '2026-09-18T00:00:00.000Z', ended_at: null, duration_ms: null, status: 'running', rollup: [], ...manifest },
    incomplete: true,
    tokensByVendor: {},
    ...over,
  },
  fetchedAt: 'now',
});

// Fake timers for the whole file, because one clause is about a tick that must exist and another
// about one that must not: `vi.getTimerCount()` is the platform's own count rather than a spy, so
// what it reports is the timer being gone and not a call that stopped being made.
beforeAll(() => { vi.useFakeTimers(); });
afterAll(() => { vi.useRealTimers(); });

const socketUrl = ['wss', '://x'].join('');
const states: ConnectionState[] = [{ kind: 'idle' }, { kind: 'connecting', requestedUrl: socketUrl }, { kind: 'live', requestedUrl: socketUrl }, { kind: 'no-daemon', requestedUrl: socketUrl }, { kind: 'no-such-run' }, { kind: 'ended' }, { kind: 'interrupted', code: 1006, reason: 'lost' }, { kind: 'dropped' }, { kind: 'protocol-error', refusal: 'bad' }];
async function renderStatus(state: ConnectionState, over: Partial<MissionControlStatusProps> = {}): Promise<HTMLElement> { const view = document.createElement('div'); const root = createRoot(view); roots.push(() => root.unmount()); const props: MissionControlStatusProps = { handle: 'h', snapshot: { state, events: [], missedCount: null, browserDiscardedCount: null }, metadata: { kind: 'loaded', value: run(), fetchedAt: 'now' }, reported: null, history: null, now: () => '2026-09-18T00:00:00.000Z', onRetryConnection: () => undefined, onRetryMetadata: () => undefined, onRetryHistory: () => undefined, onNavigate: () => undefined, ...over }; await act(async () => root.render(createElement(MissionControlStatus, props))); return view; }

describe('Q-0015 AC-8/10/11/12 — mission-control status', () => {
  test('renders distinct non-empty prose for all nine connection states', async () => {
    const texts: string[] = []; for (const state of states) texts.push((await renderStatus(state)).querySelector('[data-mission-control-state]')?.textContent?.trim() ?? '');
    expect(texts.every(Boolean)).toBe(true); expect(new Set(texts).size).toBe(9);
  });

  test('keeps metadata and socket failure accounts and retry actions independent', async () => {
    const connection = vi.fn(); const metadata = vi.fn(); const view = await renderStatus(states[2]!, { metadata: { kind: 'unreachable', path: ['', 'runs', 'h'].join('/') }, onRetryConnection: connection, onRetryMetadata: metadata });
    const buttons = [...view.querySelectorAll('button')]; expect(buttons).toHaveLength(1); await act(async () => buttons[0]!.click()); expect(metadata).toHaveBeenCalledOnce(); expect(connection).not.toHaveBeenCalled();
  });

  test('renders independent non-zero loss sentences and suppresses zero/null', async () => {
    const view = await renderStatus(states[2]!, { snapshot: { state: states[2], events: [], missedCount: 7, browserDiscardedCount: 3 } });
    expect(view.textContent).toContain(daemonMissedText(7)); expect(view.textContent).toContain(browserDiscardedText(3));
    const zero = await renderStatus(states[2]!, { snapshot: { state: states[2], events: [], missedCount: 0, browserDiscardedCount: null } });
    expect(zero.textContent).not.toContain(daemonMissedText(0)); expect(zero.textContent).not.toContain(browserDiscardedText(0));
    // Both directions, because one is satisfied by a sentence that is a strict SUBSET of the
    // other — which would lose the vocabulary AC-10 rests on while still passing. Review round 1, N3.
    const words = (text: string) => new Set(text.toLowerCase().match(/[a-z]+/g));
    const daemon = words(daemonMissedText(7)); const browser = words(browserDiscardedText(7));
    expect([...daemon].some((word) => !browser.has(word)), 'the daemon sentence adds no word of its own').toBe(true);
    expect([...browser].some((word) => !daemon.has(word)), 'the browser sentence adds no word of its own').toBe(true);
  });

  test('a loaded read still offers a control to ask again', async () => {
    // M2: `canRetryRequest` is false for `loaded`, so a live+loaded screen rendered zero buttons —
    // and this screen holds no socket for metadata, so a gate opened while it watches surfaces only
    // when the reader asks again. Without a control the only exit was a page reload. Round 1, M2.
    let asked = 0;
    const view = await renderStatus(states[2]!, { onRetryMetadata: () => { asked += 1; } });
    const buttons = [...view.querySelectorAll('button')].filter((node) => /again|retry/i.test(node.textContent ?? ''));
    expect(buttons.length, 'a loaded metadata read offers no way to ask again').toBeGreaterThan(0);
    await act(async () => { buttons[buttons.length - 1]!.click(); });
    expect(asked, 'the control does not re-read the metadata').toBe(1);
  });

  test('Q-0131 AC-4/AC-5 — a loaded number reaches the header and drops the sentence saying it has none', async () => {
    // **Both regions on ONE fixture**, which is the instrument failure behind major 2: AC-11's two
    // clauses were each satisfied by a different snapshot — disclosures on `live`, identity on
    // `ended` — so the contradiction between them was asserted by neither. Review round 2, major 2.
    //
    // **Re-aimed at the metadata read by Q-0131**, and the snapshot is what makes the re-aim
    // checkable rather than a rename: it carries a terminal event with a DIFFERENT number, so a
    // screen that still read the socket would render 42 and fail here. The value under test is 7.
    const terminal = { type: 'terminal', runId: 42, stageBefore: 'red', stageAfter: 'green', cost: 0, tokens: 0, status: 'completed' };
    const view = await renderStatus(states[5]!, {
      metadata: { kind: 'loaded', value: run(0, 7), fetchedAt: 'now' },
      snapshot: { state: states[5], events: [terminal] as never[], missedCount: null, browserDiscardedCount: null },
    });
    const identity = view.querySelector('[data-run-identity]')?.textContent;
    expect(identity, 'the loaded run number did not reach the identity region').toContain('7');
    expect(identity, 'the number came from the socket snapshot rather than from the metadata read').not.toContain('42');
    expect(view.querySelector('[data-mission-control-disclosures]')?.textContent,
      'the screen shows the run number and, beside it, the sentence saying it has none')
      .not.toContain(MISSION_CONTROL_DISCLOSURES[0]);
    // …and the other four survive, so the filter removed one sentence rather than the region.
    for (const disclosure of MISSION_CONTROL_DISCLOSURES.slice(1)) {
      expect(view.querySelector('[data-mission-control-disclosures]')?.textContent).toContain(disclosure);
    }
  });

  test("the daemon's own account of the run reaches the header", async () => {
    // `state` and `refusal` were read and discarded. Connection state is this browser's transport and
    // is a different fact; `refusal` is the field Q-0016 added so a surface would stop admitting a
    // gap with the daemon's words one field away. Review round 2, major 3.
    const loaded = await renderStatus(states[2]!);
    expect(loaded.querySelector('[data-mission-control-header]')?.textContent, "the run's own state is not rendered").toContain('running');
    const refused = await renderStatus(states[2]!, { metadata: { kind: 'loaded', fetchedAt: 'now', value: { ...run(), state: 'refused', refusal: { condition: 'no ticket T-0404 in this backlog', remedy: null } } } });
    expect(refused.querySelector('[data-mission-control-header]')?.textContent, "the daemon's refusal condition is not rendered").toContain('T-0404');
  });

  test('renders all five disclosures verbatim in order and no fabricated header placeholder', async () => {
    // **Q-0131 AC-5: the count is asserted as well as the contents.** The first sentence is now
    // rendered conditionally, and a disclosure quietly leaving the array is exactly what a loop
    // over the array cannot see — it would iterate four and report five renderings of four.
    expect(MISSION_CONTROL_DISCLOSURES, 'a disclosure left the array without anyone deciding to').toHaveLength(5);
    const view = await renderStatus(states[2]!, { metadata: { kind: 'loaded', value: run(0, null), fetchedAt: 'now' } }); const region = view.querySelector('[data-mission-control-disclosures]')!; let at = -1;
    for (const disclosure of MISSION_CONTROL_DISCLOSURES) { expect(region.textContent).toContain(disclosure); const next = region.textContent!.indexOf(disclosure); expect(next).toBeGreaterThan(at); at = next; }
    expect(view.querySelector('[data-mission-control-header]')?.textContent).not.toMatch(/—|\$|0:00|n\/a/);
  });

  test('Q-0131 AC-4 — the handle stands in only where no number has been loaded', async () => {
    // **The inverse of what this clause asserted until Q-0131**, and it is written as both branches
    // so that deleting either fails: the assertion it replaced said a metadata number must be
    // IGNORED, which was right while a live run's `runId` was always `null` there and is the
    // premise `core` removed by reporting its number at run start.
    const loaded = await renderStatus(states[2]!, { metadata: { kind: 'loaded', value: run(0, 99), fetchedAt: 'now' } });
    expect(loaded.querySelector('[data-run-identity]')?.textContent, 'a loaded number was not rendered').toContain('99');
    const none = await renderStatus(states[2]!, { metadata: { kind: 'loaded', value: run(0, null), fetchedAt: 'now' } });
    expect(none.querySelector('[data-run-identity]')?.textContent, 'a row carrying no number did not fall back to the handle').toContain('h');
    // …and a read that has not resolved, and one that failed, are the two states that still have no
    // number to render: a fabricated one is what `04-architecture.md` forbids, and this is where a
    // later change would reach for the socket to invent one.
    // The path is assembled rather than written, which is this suite's existing rule: `routes.test.ts`
    // holds every route-path literal a component carries against the register, and a daemon endpoint
    // is not a route of this app.
    const metadataPath = ['', 'runs', 'h'].join('/');
    for (const metadata of [{ kind: 'in-flight' as const, path: metadataPath }, { kind: 'unreachable' as const, path: metadataPath }]) {
      const terminal = { type: 'terminal' as const, runId: 42, stageBefore: 'a', stageAfter: 'b', cost: 0, tokens: 0, status: 'completed' as const };
      const view = await renderStatus(states[5]!, { metadata, snapshot: { state: states[5], events: [terminal], missedCount: null, browserDiscardedCount: null } });
      const identity = view.querySelector('[data-run-identity]')?.textContent;
      expect(identity, `a ${metadata.kind} read did not fall back to the handle`).toContain('h');
      expect(identity, `a ${metadata.kind} read took a number off the socket`).not.toContain('42');
      // …and the failed read still renders its own account rather than a blank region.
      expect(view.textContent?.trim(), `a ${metadata.kind} read rendered nothing`).not.toBe('');
      // …with the sentence saying the number has not been read, which is the state it now names.
      expect(view.querySelector('[data-mission-control-disclosures]')?.textContent,
        `a ${metadata.kind} read dropped the sentence explaining the missing number`)
        .toContain(MISSION_CONTROL_DISCLOSURES[0]);
    }
  });

  test('Q-0135 AC-14 — the measured values render in their own region and the header keeps its subject', async () => {
    // **The header assertion above is untouched and still passes, which is why this region is a
    // SIBLING.** A cost figure, an `n/a` and a clamped `00:00` each trip it, and weakening it would
    // be the Q-0014 AC-5 failure — a scan narrowed until every value carrying the forbidden shape
    // sits outside it. The design brief's word *header* names the top area; the marker names one
    // region within it, and the two are not the same thing.
    const view = await renderStatus(states[2]!, {
      reported: run(0, 1), history: loadedHistory({ rollup: [priced] }),
    });
    const header = view.querySelector('[data-mission-control-header]')?.textContent ?? '';
    expect(header, 'a measured figure reached the region whose guard forbids one').not.toMatch(/—|\$|0:00|n\/a/);
    expect(view.querySelector('[data-mission-control-measures]'), 'the measured region is not rendered').not.toBeNull();
    expect(view.querySelector('[data-mission-control-measures]')?.textContent, 'the cost did not reach the new region')
      .toContain('$78.675');
    // …and the existing assertion still HAS a subject: a `$` placed inside the header region fails
    // it, so its passing above is an absence rather than a guard that stopped looking.
    const forbidden = /—|\$|0:00|n\/a/;
    expect(forbidden.test('Mission control Run 1 $78.675'), 'the header needle matches nothing at all').toBe(true);
    expect(forbidden.test(header), 'the header carries one of the four forms').toBe(false);
  });

  test('Q-0135 AC-12 — a live figure advances once a second and a terminal event freezes it', async () => {
    // Against a clock this test moves, so the verdict is a property of the commit. The tick is the
    // only thing on this screen that moves on its own, and it performs no read: `fetcher` is not a
    // prop of this component at all, so nothing here can have made one.
    let at = '2026-09-18T00:00:00.000Z';
    const view = await renderStatus(states[2]!, {
      reported: run(0, 1), history: loadedHistory(), now: () => at,
    });
    expect(view.querySelector('[data-elapsed]')?.getAttribute('data-elapsed'), 'a live run was not advancing').toBe('running');
    expect(view.querySelector('[data-elapsed-figure]')?.textContent).toBe('00:00');
    at = '2026-09-18T00:14:32.000Z';
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(view.querySelector('[data-elapsed-figure]')?.textContent, 'the figure did not advance with the clock')
      .toBe('14:32');
    // The rendering names WHOSE clock produced it, because a live figure and a frozen one have two
    // authorities and a reader comparing them across machines is owed the difference.
    expect(view.querySelector('[data-elapsed]')?.textContent).toContain(ELAPSED_BROWSER_CLOCK_TEXT);

    // **The stream speaking, with no new read**: the same history, a terminal event, and the figure
    // stops — which is the clause the manifest snapshot alone cannot satisfy.
    const terminal = { type: 'terminal', runId: 1, stageBefore: 'a', stageAfter: 'b', cost: 0, tokens: 0, status: 'completed' };
    const stopped = await renderStatus(states[2]!, {
      reported: run(0, 1),
      history: loadedHistory(),
      now: () => at,
      snapshot: { state: states[2], events: [terminal] as never[], missedCount: null, browserDiscardedCount: null },
    });
    expect(stopped.querySelector('[data-elapsed]')?.getAttribute('data-elapsed'),
      'a terminal event did not stop the figure').toBe('ended-unmeasured');
    expect(stopped.querySelector('[data-elapsed]')?.textContent).toContain(ELAPSED_ENDED_UNMEASURED_TEXT);
    // …and no figure is frozen in its place, which would name an instant nobody measured.
    expect(stopped.querySelector('[data-elapsed-figure]'), 'a browser-computed figure was frozen').toBeNull();
  });

  test("Q-0135 AC-12 — an ended read renders the engine's own duration, not a subtraction", async () => {
    // The fixture makes the two disagree: ten seconds by subtraction, seven by the engine.
    const view = await renderStatus(states[5]!, {
      reported: run(0, 1),
      history: loadedHistory({ ended_at: '2026-09-18T00:00:10.000Z', duration_ms: 7_000, status: 'completed' }, { incomplete: false }),
      now: () => '2026-09-18T09:00:00.000Z',
    });
    expect(view.querySelector('[data-elapsed-figure]')?.textContent, 'the browser subtracted two instants').toBe('00:07');
    expect(view.querySelector('[data-elapsed]')?.textContent).toContain(ELAPSED_ENGINE_TEXT);
    // A run that is over renders no in-flight caveat beside its cost.
    expect(view.querySelector('[data-cost-incomplete]'), 'a finished run was reported still in flight').toBeNull();
  });

  test('Q-0135 AC-12 — the timer does not survive the terminal transition or the unmount', async () => {
    // Asserted over the platform's own count rather than over a spy, so it is the timer that is
    // gone rather than a call that stopped being made.
    let at = '2026-09-18T00:00:00.000Z';
    const before = vi.getTimerCount();
    const view = document.createElement('div');
    const root = createRoot(view);
    const props = (events: readonly object[]): MissionControlStatusProps => ({
      handle: 'h', snapshot: { state: states[2]!, events: events as never[], missedCount: null, browserDiscardedCount: null },
      metadata: { kind: 'loaded', value: run(), fetchedAt: 'now' }, reported: run(0, 1),
      history: loadedHistory(), now: () => at,
      onRetryConnection: () => undefined, onRetryMetadata: () => undefined,
      onRetryHistory: () => undefined, onNavigate: () => undefined,
    });
    await act(async () => root.render(createElement(MissionControlStatus, props([]))));
    expect(vi.getTimerCount(), 'a live figure scheduled no tick at all').toBeGreaterThan(before);
    const terminal = { type: 'terminal', runId: 1, stageBefore: 'a', stageAfter: 'b', cost: 0, tokens: 0, status: 'completed' };
    await act(async () => root.render(createElement(MissionControlStatus, props([terminal]))));
    expect(vi.getTimerCount(), 'the tick survived the run ending').toBe(before);
    // …and an unmount while it IS live leaves nothing behind either.
    await act(async () => root.render(createElement(MissionControlStatus, props([]))));
    expect(vi.getTimerCount()).toBeGreaterThan(before);
    await act(async () => root.unmount());
    expect(vi.getTimerCount(), 'the tick survived the unmount').toBe(before);
    at = at.slice(0);
  });

  test('Q-0135 AC-13 — one entry per vendor, in order, with no figure across them', async () => {
    const view = await renderStatus(states[2]!, {
      reported: run(0, 1),
      history: loadedHistory({ rollup: [priced, unpriced] }, { tokensByVendor: { zeta: 100, omega: 714_125 } }),
    });
    const rows = [...view.querySelectorAll('[data-vendor-row]')];
    expect(rows.map((node) => node.getAttribute('data-vendor-row')), 'the roll-up order was not preserved')
      .toStrictEqual(['zeta', 'omega']);
    expect(rows, 'a third entry was composed').toHaveLength(2);
    // **The labels are the roll-up's own strings.** The fixture's vendors are names no adapter here
    // produces, which is what catches a browser that branched on a known one — and this
    // repository's own corpus would validate that design, every `claude` row in it being priced and
    // every `codex` row unpriced with no exception in either direction.
    expect(rows[0]?.textContent).toContain('$78.675');
    expect(rows[1]?.textContent, 'an unpriced vendor did not fall back to its token total')
      .toContain(unpricedVendorText(714_125));
    expect(rows[1]?.textContent, 'an unpriced vendor rendered a price anyway').not.toContain('$');
    expect(rows[1]?.textContent, 'the partly-unpriced count was not disclosed').toContain(unpricedStepsText(2));
    // **And the blended figure this design refuses**, over a fixture where BOTH rows are priced, so
    // the sum is a figure that could be composed rather than one row's own: *"Codex cost is reported
    // as tokens, never priced locally"* (2026-08-22) is what a total across vendors would break, and
    // `terminal.cost` is a typed number already in this browser's hands, which is what makes the
    // wrong answer tempting.
    const bothPriced = await renderStatus(states[2]!, {
      reported: run(0, 1),
      history: loadedHistory({ rollup: [priced, rollupRow({ vendor: 'omega', cost_usd: 2.25 })] }),
    });
    const region = bothPriced.querySelector('[data-mission-control-measures]')?.textContent ?? '';
    expect(region, 'a row lost its own figure').toContain('$78.675');
    expect(region, 'a row lost its own figure').toContain('$2.250');
    expect(region, 'a figure across vendors was rendered').not.toContain(formatCost(78.675 + 2.25));
    expect(formatCost(78.675 + 2.25), 'the sum needle is one of the two row figures').toBe('$80.925');
  });

  test('Q-0135 AC-16 — a vendor seen running with no roll-up row is named, one row then two', async () => {
    // **The state an emptiness check cannot see**, which is review round 1's second major. The
    // roll-up is not empty — `zeta` has finished a billed occurrence and `omega` has not — so the
    // sentence that speaks for a wholly empty one never spoke, and the second vendor rendered as
    // nothing at all beside a trace column carrying its name.
    const events = [
      { type: 'spawn', stepId: 'a', vendor: 'zeta', cmd: 'go' },
      { type: 'spawn', stepId: 'b', vendor: 'omega', cmd: 'go' },
    ] as never[];
    const oneBilled = await renderStatus(states[2]!, {
      reported: run(0, 1),
      snapshot: { state: states[2], events, missedCount: null, browserDiscardedCount: null },
      history: loadedHistory({ rollup: [priced] }),
    });
    expect([...oneBilled.querySelectorAll('[data-vendor-row]')].map((node) => node.getAttribute('data-vendor-row')),
      'the billed vendor lost its row').toStrictEqual(['zeta']);
    const named = [...oneBilled.querySelectorAll('[data-vendor-absent]')];
    expect(named.map((node) => node.getAttribute('data-vendor-absent')),
      'a vendor seen running with no roll-up row of its own was rendered as nothing').toStrictEqual(['omega']);
    expect(named[0]?.textContent, 'the absent vendor does not render its own sentence')
      .toBe(absentVendorText('omega'));
    // …and it is an absence rather than a zero, which is the placeholder rule: no fabricated figure.
    expect(named[0]?.textContent, 'an absent vendor was rendered as a figure').not.toMatch(/\$|—|00:00/);
    // **The general sentence gives way to the specific one**, so a reader is never shown both a
    // statement that the roll-up names none and a list of the ones it does not name.
    expect(oneBilled.querySelector('[data-vendor-costs]')?.textContent, 'the general sentence stood beside the specific one')
      .not.toContain(NO_ROLLUP_ROWS_TEXT);

    // Then the transition the reader actually watches: the second vendor's occurrence terminates,
    // the roll-up carries it, and there is no absence left to name.
    const bothBilled = await renderStatus(states[2]!, {
      reported: run(0, 1),
      snapshot: { state: states[2], events, missedCount: null, browserDiscardedCount: null },
      history: loadedHistory({ rollup: [priced, unpriced] }, { tokensByVendor: { omega: 714_125 } }),
    });
    expect([...bothBilled.querySelectorAll('[data-vendor-row]')].map((node) => node.getAttribute('data-vendor-row')),
      'the second vendor did not become a row when the roll-up gained one').toStrictEqual(['zeta', 'omega']);
    expect(bothBilled.querySelector('[data-vendor-absent]'), 'a vendor the roll-up carries was still called absent')
      .toBeNull();
  });

  test('Q-0135 AC-13/AC-16 — an all-unpriced run renders no zero, and an empty roll-up says why', async () => {
    const allUnpriced = await renderStatus(states[2]!, {
      reported: run(0, 1),
      history: loadedHistory({ rollup: [unpriced] }, { tokensByVendor: { omega: 714_125 } }),
    });
    const region = allUnpriced.querySelector('[data-mission-control-measures]')?.textContent ?? '';
    expect(region, 'an all-unpriced run rendered a price of zero').not.toContain('$0');
    expect(region, 'an all-unpriced run rendered a dollar figure at all').not.toContain('$');
    // A vendor that has run and finished no billed step is ABSENT from the roll-up rather than
    // present at zero, which is a different claim again and is not *unpriced*.
    const none = await renderStatus(states[2]!, { reported: run(0, 1), history: loadedHistory({ rollup: [] }) });
    expect(none.querySelector('[data-vendor-row]'), 'an empty roll-up invented a row').toBeNull();
    expect(none.querySelector('[data-vendor-costs]')?.textContent).toContain(NO_ROLLUP_ROWS_TEXT);
    // …and a run still in flight says the figures are behind, naming the step rather than the read.
    expect(none.querySelector('[data-cost-incomplete]')?.textContent).toBe(COST_IN_FLIGHT_TEXT);
  });

  test('Q-0135 AC-16 — every reason for no measured values is its own sentence, and none is blank', async () => {
    const cases: [string, Partial<MissionControlStatusProps>, string][] = [
      ['dry', { reported: run(0, 1, { dry: true }), history: null }, MEASURED_DRY_TEXT],
      ['no-run-number', { reported: run(0, null), history: null }, MEASURED_NO_RUN_NUMBER_TEXT],
      ['no-ticket-id', { reported: run(0, 1, { ticketId: null }), history: null }, MEASURED_NO_TICKET_TEXT],
    ];
    const rendered: string[] = [];
    for (const [kind, over, sentence] of cases) {
      const view = await renderStatus(states[2]!, over);
      const region = view.querySelector('[data-measured-absence]');
      expect(region?.getAttribute('data-measured-absence'), `${kind} was reported as something else`).toBe(kind);
      const text = region?.textContent?.trim() ?? '';
      expect(text, `${kind} rendered nothing`).not.toBe('');
      expect(text, `${kind} does not render its own sentence`).toBe(sentence);
      // None of them is a zero, a dash, a spinner or an empty region, which is the placeholder rule.
      expect(text, `${kind} rendered a fabricated figure`).not.toMatch(/\$|—|\bn\/a\b|00:00/);
      rendered.push(text);
    }
    // **The dry case specifically**, being both the first anyone exercising this will meet and the
    // one no inference from a 404 can get right. It explains the absence by what the walk RECORDED,
    // and deliberately not by what it spent: those are claims about two different subjects, and only
    // the first is why this screen has no figures. Review round 1, nit.
    expect(rendered[0], 'the dry sentence does not say a walk recorded nothing').toContain('wrote no run history');
    expect(rendered[0], 'the dry sentence explains the absence by what was spent rather than by what was recorded')
      .not.toMatch(/\bspent\b/);
    expect(new Set(rendered).size, 'two absences share a sentence').toBe(3);

    // The fourth reason is the only repairable one, and it carries the daemon's own words with a
    // retry rather than a general sentence — so a 404 and a 422 are not one thing.
    const refused = await renderStatus(states[2]!, {
      reported: run(0, 1),
      history: { kind: 'refused', path: ['', 'history', 'Q-0135-1'].join('/'), refusal: { code: 'no-such-run', condition: 'no run history under "Q-0135-1"', remedy: null } },
    });
    const failure = refused.querySelector('[data-measured-absence="not-read"]');
    expect(failure?.textContent, "the daemon's own condition was not rendered").toContain('no run history under');
    expect([...(failure?.querySelectorAll('button') ?? [])], 'a failed history read offers no retry').toHaveLength(1);
    // …and the three that are not failures offer nothing to retry, because no read was made.
    const dry = await renderStatus(states[2]!, { reported: run(0, 1, { dry: true }), history: null });
    expect(dry.querySelector('[data-measured-absence] button'), 'a walk offered a retry').toBeNull();
  });

  test('Q-0135 AC-16 — the sentences this screen adds are non-empty, distinct, and share no prefix', () => {
    // Asserted over the copy contract by value, because *no two cases share a sentence* is a claim
    // about the words rather than about a render — and a case that quietly reused a neighbour's
    // would be invisible to a clause that only checked each one rendered something.
    // **The per-vendor absence joined them at review round 1**, and it is asserted here at a
    // supplied label for the same reason the fixtures use one: a sentence built around a vendor's
    // name must be distinct whatever that name is, which the two real ones would not establish.
    const ADDED = [
      MEASURED_DRY_TEXT, MEASURED_NO_RUN_NUMBER_TEXT, MEASURED_NO_TICKET_TEXT,
      ELAPSED_ENDED_UNMEASURED_TEXT, NO_ROLLUP_ROWS_TEXT, COST_IN_FLIGHT_TEXT,
      absentVendorText('omega'),
    ];
    expect(new Set(ADDED).size, 'two of the absent cases share a sentence').toBe(ADDED.length);
    for (const sentence of ADDED) {
      expect(sentence.trim(), 'a case renders an empty sentence').not.toBe('');
      // None of them is a fabricated figure, which is `04-architecture.md`'s placeholder rule: an
      // absence is named in prose and never rendered as a zero, a dash or a spinner.
      expect(sentence, `"${sentence}" renders a figure rather than naming an absence`).not.toMatch(/\$\d|—|\b0\.00\b|00:00/);
    }
    // …and each is distinguishable in TEXT alone, without colour or motion: no two are prefixes of
    // one another, which is the way a shorter sentence can be read as a longer one's beginning.
    for (const one of ADDED) {
      for (const other of ADDED) {
        if (one === other) continue;
        expect(one.startsWith(other), `"${other}" is a prefix of "${one}"`).toBe(false);
      }
    }
  });

  test('Q-0135 AC-17 — the two disclosures retire only where their values are present', async () => {
    // **The array is still five**, which is Q-0131 AC-5's assertion above: a disclosure that left it
    // would be a deletion, and what this ticket does is retire two conditionally.
    expect(MISSION_CONTROL_DISCLOSURES, 'a disclosure left the array without anyone deciding to').toHaveLength(5);
    const present = await renderStatus(states[2]!, {
      metadata: { kind: 'loaded', value: run(0, 1), fetchedAt: 'now' },
      reported: run(0, 1), history: loadedHistory({ rollup: [priced] }),
    });
    const shown = present.querySelector('[data-mission-control-disclosures]')?.textContent ?? '';
    for (const at of [0, 1, 2]) {
      expect(shown, `disclosure ${String(at)} stands beside the value it says is missing`)
        .not.toContain(MISSION_CONTROL_DISCLOSURES[at]);
    }
    // …and the two that are still unconditional survive, so the register retired sentences rather
    // than the region.
    for (const at of [3, 4]) expect(shown).toContain(MISSION_CONTROL_DISCLOSURES[at]);

    // **The half a set of retirements cannot carry**: a state where the value is ABSENT and the
    // sentence is absent too fails here. Both disclosures stand for every reason no read was made,
    // and for a read that failed.
    for (const over of [
      { reported: run(0, 1, { dry: true }), history: null },
      { reported: run(0, null), history: null },
      { reported: run(0, 1), history: { kind: 'unreachable' as const, path: 'x' } },
      { reported: null, history: null },
    ]) {
      const view = await renderStatus(states[2]!, over);
      const text = view.querySelector('[data-mission-control-disclosures]')?.textContent ?? '';
      expect(text, 'the elapsed disclosure was retired with no elapsed figure beside it')
        .toContain(MISSION_CONTROL_DISCLOSURES[1]);
      expect(text, 'the cost disclosure was retired with no cost beside it')
        .toContain(MISSION_CONTROL_DISCLOSURES[2]);
      expect(view.querySelector('[data-elapsed-figure]'), 'a figure was rendered with no read behind it').toBeNull();
      expect(view.querySelector('[data-vendor-row]'), 'a vendor row was rendered with no read behind it').toBeNull();
    }
    // **An EMPTY roll-up retires the cost disclosure**, because it is an answer about what has been
    // billed rather than a failure to answer one.
    const empty = await renderStatus(states[2]!, {
      metadata: { kind: 'loaded', value: run(0, 1), fetchedAt: 'now' },
      reported: run(0, 1), history: loadedHistory({ rollup: [] }),
    });
    expect(empty.querySelector('[data-mission-control-disclosures]')?.textContent,
      'an empty roll-up was treated as no answer at all').not.toContain(MISSION_CONTROL_DISCLOSURES[2]);
  });

  test('Q-0135 AC-17 — the in-flight caveat and the two loss sentences are visible at once', async () => {
    // They are three different claims about three different things — what has been billed, what the
    // daemon omitted from a replay, and what this browser discarded — so a screen folding any two
    // into one would be dropping one of them.
    const view = await renderStatus(states[2]!, {
      reported: run(0, 1),
      history: loadedHistory({ rollup: [priced] }),
      snapshot: { state: states[2], events: [], missedCount: 7, browserDiscardedCount: 3 },
    });
    const text = view.textContent ?? '';
    expect(text).toContain(COST_IN_FLIGHT_TEXT);
    expect(text).toContain(daemonMissedText(7));
    expect(text).toContain(browserDiscardedText(3));
    // …and the caveat sits in the cost region rather than being folded into the loss region.
    expect(view.querySelector('[data-vendor-costs]')?.textContent, 'the caveat left the region it is about')
      .toContain(COST_IN_FLIGHT_TEXT);
  });

  test('derives the gate link only from loaded pendingGates, even with no gate event retained', async () => {
    const yes = await renderStatus(states[2]!, { metadata: { kind: 'loaded', value: run(1), fetchedAt: 'now' } }); expect(yes.querySelector(`a[href="${gatePath('h')}"]`)).not.toBeNull();
    const no = await renderStatus(states[2]!); expect(no.querySelector(`a[href="${gatePath('h')}"]`)).toBeNull();
  });
});
