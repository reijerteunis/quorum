// @vitest-environment jsdom
/**
 * Q-0018 AC-3, AC-6, AC-8, AC-9, AC-11, AC-12 and AC-13's rendering halves.
 *
 * **Every fixture is built here rather than drawn from `.quorum/runs`.** That directory is
 * gitignored and created by use, so a fixture taken from it would make a verdict a property of the
 * checkout, which *"A test's verdict is a property of the commit"* (2026-08-30) forbids — and the
 * cases this screen has to get right are the ones this repository's own history cannot supply.
 *
 * **The vendor names are ones no adapter here produces**, deliberately: every `claude` row in this
 * repository's history is priced and every `codex` row unpriced, with no exception in either
 * direction, so a fixture using them would pass over an implementation that branched on the name.
 */
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { WireRunHistory, WireRunHistoryRow, WireVendorRollup } from '@quorum/shared';

import { DAEMON_ENDPOINTS, historyDetailPath, historyFilePath, historyRetainedPath } from './daemon-endpoints.js';
import { HistoryScreen } from './history-screen.js';
import {
  COLLAPSE_LABEL, EMPTY_HISTORY_TEXT, EXPAND_LABEL, HISTORY_HEADING, HISTORY_REFRESH_LABEL,
  HISTORY_RETRY_LABEL, INCOMPLETE_TEXT, LISTING_UNPRICED_TEXT, LIVE_RUN_TEXT, NO_DURATION_TEXT,
  NO_READABLE_RUNS_TEXT, UNREADABLE_HEADING, notAnAdapterCallText, runStatusText,
} from './history-text.js';
import { NO_ROLLUP_ROWS_TEXT, unpricedStepsText, unpricedVendorText } from './mission-control-text.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const roots: (() => void)[] = [];
afterEach(async () => {
  vi.useRealTimers();
  for (const close of roots.splice(0)) await act(async () => close());
  document.body.innerHTML = '';
});

const CLOCK = (): string => '2026-09-18T09:00:00.000Z';

/** One roll-up row, so a case changes the one field it is about. */
const rollupRow = (over: Partial<WireVendorRollup> & { vendor: string }): WireVendorRollup =>
  ({ cost_usd: null, unpriced_steps: 0, step_count: 1, ...over });

/** One listing row, with only the fields a clause is about supplied per case. */
const row = (over: Partial<WireRunHistoryRow> & { id: string }): WireRunHistoryRow => ({
  ticket: 'Q-0018', flow: 'chore', status: 'completed', incomplete: false,
  started_at: '2026-09-18T01:00:00.000Z', ended_at: '2026-09-18T01:10:00.000Z', duration_ms: 600_000,
  occurrenceCount: 2, rollup: [], ...over,
});

/** One detail response, for the row a reader opens. */
const detail = (over: Partial<WireRunHistory> = {}): WireRunHistory => ({
  manifest: {
    started_at: '2026-09-18T01:00:00.000Z', ended_at: '2026-09-18T01:10:00.000Z',
    duration_ms: 600_000, status: 'completed', rollup: [],
  },
  incomplete: false,
  tokensByVendor: {},
  steps: [],
  ...over,
});

/**
 * The screen over a daemon that answers the listing, and each detail by id.
 *
 * Every request is recorded, because three clauses are about WHICH requests were made rather than
 * about what came back: exactly one on mount, one per row opened, and none to the live-run listing.
 */
async function mount(listing: unknown, details: Record<string, unknown> = {}, status = 200) {
  const calls: string[] = [];
  const fetcher = (path: string) => {
    calls.push(path);
    const body = path === DAEMON_ENDPOINTS.history ? listing : details[path];
    return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
  };
  const view = document.createElement('div');
  document.body.append(view);
  const root = createRoot(view);
  roots.push(() => root.unmount());
  await act(async () => root.render(createElement(HistoryScreen, { fetcher, now: CLOCK })));
  return { view, calls };
}

/** The one control on a row, found by the label it renders in whichever position it is in. */
const toggleFor = (view: HTMLElement, id: string): HTMLButtonElement => {
  const found = [...(view.querySelector(`[data-history-row="${id}"]`)?.querySelectorAll('button') ?? [])]
    .find((node) => node.textContent === EXPAND_LABEL || node.textContent === COLLAPSE_LABEL);
  if (!found) throw new Error(`no control on row ${id} — this clause has lost its subject`);
  return found;
};

describe('Q-0018 AC-6/AC-8 — one read for the whole table, in the order the daemon sent it', () => {
  test('exactly one request on mount, to the listing and never to the live-run route', async () => {
    // Not one per row, which is 171 requests against this repository's own store and is the whole
    // reason the listing carries what it carries; and not a second to `GET /runs`, which answers a
    // different question about a different id space.
    const { calls } = await mount({
      runs: [row({ id: 'Q-0018-1' }), row({ id: 'Q-0018-2' }), row({ id: 'Q-0018-3' })],
      warnings: [],
    });
    expect(calls, 'the table was not loaded in one request').toStrictEqual([DAEMON_ENDPOINTS.history]);
    expect(calls.some((path) => path === DAEMON_ENDPOINTS.runs), 'the screen asked for the live runs too')
      .toBe(false);
    expect(calls.some((path) => path.startsWith(`${DAEMON_ENDPOINTS.history}/`)),
      'the screen read a detail nobody opened').toBe(false);
  });

  test('never polls, and refresh alone repeats the read', async () => {
    vi.useFakeTimers();
    const { view, calls } = await mount({ runs: [], warnings: [] });
    expect(calls).toHaveLength(1);
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(calls, 'a timer repeated the read').toHaveLength(1);
    const refresh = [...view.querySelectorAll('button')].find((node) => node.textContent === HISTORY_REFRESH_LABEL);
    await act(async () => (refresh as HTMLButtonElement).click());
    expect(calls, 'refresh did not repeat the read').toHaveLength(2);
  });

  test("rows keep the daemon's order, and each cell comes from its own row's fields", async () => {
    // Three runs whose every field is mutually distinguishable, so a cell taken from a neighbour is
    // visible rather than absorbed. The order is `sortRuns`' and this screen declares no comparator:
    // an order derived here would be one the screen invented.
    const { view } = await mount({
      runs: [
        row({ id: 'Q-0018-3', ticket: 'Q-0003', flow: 'review', duration_ms: 3000, occurrenceCount: 7 }),
        row({ id: 'Q-0018-1', ticket: 'Q-0001', flow: 'chore', duration_ms: 1000, occurrenceCount: 2 }),
        row({ id: 'Q-0018-2', ticket: 'Q-0002', flow: 'requirements', duration_ms: 2000, occurrenceCount: 4 }),
      ],
      warnings: [],
    });
    expect([...view.querySelectorAll('[data-history-row]')].map((node) => node.getAttribute('data-history-row')),
      'the screen re-ordered what the daemon sent').toStrictEqual(['Q-0018-3', 'Q-0018-1', 'Q-0018-2']);
    const cells = (id: string): string => view.querySelector(`[data-history-row="${id}"]`)?.textContent ?? '';
    expect(cells('Q-0018-3')).toContain('Q-0003');
    expect(cells('Q-0018-3')).toContain('review');
    expect(cells('Q-0018-3'), 'the occurrence count came from another row').toContain('7 occurrences');
    expect(cells('Q-0018-1')).toContain('Q-0001');
    expect(cells('Q-0018-1')).toContain('chore');
    expect(cells('Q-0018-1'), 'a singular count was rendered as a plural').toContain('2 occurrences');
    expect(cells('Q-0018-2')).toContain('requirements');
    // …and the durations are each row's own, formatted rather than rendered raw.
    expect(cells('Q-0018-3')).toContain('00:03');
    expect(cells('Q-0018-1')).toContain('00:01');
    expect(cells('Q-0018-2')).toContain('00:02');
    // A run with no recorded duration says so rather than rendering a zero.
    const { view: nodur } = await mount({ runs: [row({ id: 'Q-0018-9', duration_ms: null })], warnings: [] });
    expect(nodur.textContent, 'a run with no duration rendered a figure').toContain(NO_DURATION_TEXT);
  });

  test('the heading, the refresh label and the retry label are the ones the register names', async () => {
    const { view } = await mount({ runs: [], warnings: [] });
    expect(view.textContent, 'the heading the register names is not rendered').toContain(HISTORY_HEADING);
    expect([...view.querySelectorAll('button')].map((node) => node.textContent))
      .toContain(HISTORY_REFRESH_LABEL);
    const failed = await mount({}, {}, 500);
    expect([...failed.view.querySelectorAll('button')].map((node) => node.textContent))
      .toContain(HISTORY_RETRY_LABEL);
  });
});

describe('Q-0018 AC-9 — cost is per vendor, never blended, and no name is known here', () => {
  test('a priced vendor, an unpriced one, a genuine zero and a partly-priced one, under unseen names', async () => {
    const { view } = await mount({
      runs: [row({
        id: 'Q-0018-1',
        rollup: [
          rollupRow({ vendor: 'zeta', cost_usd: 78.675, step_count: 4 }),
          rollupRow({ vendor: 'omega', cost_usd: null, step_count: 3, unpriced_steps: 2 }),
          rollupRow({ vendor: 'kappa', cost_usd: 0, step_count: 1 }),
          rollupRow({ vendor: 'iota', cost_usd: 1.5, step_count: 5, unpriced_steps: 1 }),
        ],
      })],
      warnings: [],
    });
    const cell = (vendor: string): string =>
      view.querySelector(`[data-vendor-row="${vendor}"]`)?.textContent ?? '';
    expect(cell('zeta'), 'a priced vendor did not render its figure').toContain('$78.675');
    // **`n/a` and never `$0.00`**, and the listing's own sentence rather than the detail's: a row
    // carries no token total, so a sentence naming one would be a claim made out of a gap.
    expect(cell('omega'), 'an unpriced vendor was rendered as free').toContain(LISTING_UNPRICED_TEXT);
    expect(cell('omega'), 'an unpriced vendor rendered a zero').not.toContain('$0.00');
    // A genuine zero is a different claim and survives as one.
    expect(cell('kappa'), 'a genuinely reported zero was rendered as unpriced').toContain('$0.000');
    expect(cell('kappa')).not.toContain(LISTING_UNPRICED_TEXT);
    // A partly-priced vendor says how much of its own figure it cannot see.
    expect(cell('iota'), 'a partly-priced vendor did not say what it cannot see')
      .toContain(unpricedStepsText(1));
    expect(cell('zeta'), 'a fully-priced vendor claimed unpriced steps').not.toContain(unpricedStepsText(1));
    // **No figure is summed across vendors.** `78.675 + 1.5` and `78.675 + 0 + 1.5` are the two
    // totals a blending implementation would render, and neither is anywhere on the screen.
    for (const total of ['80.175', '$80.18', '80.18']) {
      expect(view.textContent, `a figure summed across vendors (${total}) was rendered`).not.toContain(total);
    }
  });

  test('a run with no billed step says so, rather than rendering an empty space or a zero', async () => {
    // A roll-up row exists only for a vendor that has FINISHED a billed occurrence, so an empty
    // roll-up is a third thing beside *priced* and *unpriced* and is not *free*.
    const { view } = await mount({ runs: [row({ id: 'Q-0018-1', rollup: [] })], warnings: [] });
    expect(view.textContent, 'an empty roll-up rendered nothing at all').toContain(NO_ROLLUP_ROWS_TEXT);
    expect(view.querySelector('[data-vendor-row]'), 'an empty roll-up invented a vendor row').toBeNull();
    expect(view.textContent, 'an empty roll-up rendered a zero').not.toContain('$0.00');
  });
});

describe('Q-0018 AC-11 — a run in flight is shown as one, and is linked nowhere', () => {
  test('the row stays, carries both facts, and the screen holds no anchor to a run', async () => {
    // Not relabelled, not omitted, not reordered. The status and the incomplete indication are two
    // facts that can disagree — a run killed outright records a terminal-looking status and no end —
    // so collapsing them would throw away the half that says so.
    const { view } = await mount({
      runs: [
        row({ id: 'Q-0018-1', status: 'running', incomplete: true, ended_at: null, duration_ms: null }),
        row({ id: 'Q-0018-2' }),
      ],
      warnings: [],
    });
    const live = view.querySelector('[data-history-row="Q-0018-1"]');
    expect(live, 'a run in flight was dropped from the table').not.toBeNull();
    expect(live?.textContent, 'the recorded status was relabelled').toContain(runStatusText('running'));
    expect(live?.textContent, 'the row does not say it never recorded an end').toContain(INCOMPLETE_TEXT);
    expect(live?.querySelector('[data-run-incomplete]'), 'the incomplete indication is not marked').not.toBeNull();
    // Where a live run is watched is a SENTENCE, because a handle is not a name this screen can
    // compose: the two id spaces are unrelated and a match would be inference rather than identity.
    expect(live?.textContent, 'the row says nothing about where a live run is watched').toContain(LIVE_RUN_TEXT);
    // …and the finished row carries neither, so the two clauses discriminate.
    const done = view.querySelector('[data-history-row="Q-0018-2"]');
    expect(done?.textContent, 'a finished run was reported incomplete').not.toContain(INCOMPLETE_TEXT);
    // **No anchor anywhere**: this screen links to nothing, which is the one place it is quieter
    // than the board and the runs landing, and it is what stops a handle being composed from an id.
    expect(view.querySelectorAll('a').length, 'the screen rendered a link').toBe(0);
  });
});

describe('Q-0018 AC-12 — one row opens inline to what ran, in `seq` order', () => {
  /** A listing of one run, and the detail answered for it. */
  const opened = async (over: Partial<WireRunHistory>) => mount(
    { runs: [row({ id: 'Q-0018-1' })], warnings: [] },
    { [historyDetailPath('Q-0018-1')]: detail(over) },
  );

  test('opening issues one detail read and one retained read, and collapsing issues none', async () => {
    // **Q-0137 AC-12 moved this from one request to two and the clause is stronger for it**: the
    // assertion is an identity over both paths rather than a count, so a third request — one per
    // occurrence as they render, which is what this screen must never do — fails by name.
    const { view, calls } = await opened({});
    expect(calls).toHaveLength(1);
    await act(async () => toggleFor(view, 'Q-0018-1').click());
    expect([...calls].sort(), 'opening a row did not read that run and what it retained')
      .toStrictEqual([DAEMON_ENDPOINTS.history, historyDetailPath('Q-0018-1'), historyRetainedPath('Q-0018-1')].sort());
    expect(view.querySelector('[data-opened-run]'), 'the opened region did not render').not.toBeNull();
    await act(async () => toggleFor(view, 'Q-0018-1').click());
    expect(calls, 'collapsing issued a request').toHaveLength(3);
    expect(view.querySelector('[data-opened-run]'), 'collapsing left the region open').toBeNull();
  });

  test('at most one row is open at a time', async () => {
    const { view } = await mount(
      { runs: [row({ id: 'Q-0018-1' }), row({ id: 'Q-0018-2' })], warnings: [] },
      {
        [historyDetailPath('Q-0018-1')]: detail({}),
        [historyDetailPath('Q-0018-2')]: detail({}),
      },
    );
    await act(async () => toggleFor(view, 'Q-0018-1').click());
    await act(async () => toggleFor(view, 'Q-0018-2').click());
    expect(view.querySelectorAll('[data-opened-run]').length, 'two rows were open at once').toBe(1);
    expect(view.querySelector('[data-history-row="Q-0018-2"] [data-opened-run]'),
      'the second row did not open').not.toBeNull();
  });

  test('the occurrences render in `seq` order, whatever order the array is in', async () => {
    // The array's own order is the order a manifest happens to have been appended in; `seq` is what
    // the route derives from the occurrence directory's NAME, and it is the only ordering key here.
    const step = (seq: number, stepId: string, over: Record<string, unknown> = {}) => ({
      step_id: stepId, kind: 'agent', status: 'completed',
      started_at: '2026-09-18T01:00:01.000Z', duration_ms: 1200, adapter: 'zeta', seq, ...over,
    });
    const { view } = await opened({
      steps: [step(3, 'integrate'), step(1, 'implement'), step(2, 'review')] as WireRunHistory['steps'],
    });
    await act(async () => toggleFor(view, 'Q-0018-1').click());
    expect([...view.querySelectorAll('[data-occurrence]')].map((node) => node.getAttribute('data-occurrence')),
      'the occurrences were rendered in array order rather than in `seq` order')
      .toStrictEqual(['implement', 'review', 'integrate']);
  });

  test('a running occurrence says so, and one no vendor ran names its kind', async () => {
    const { view } = await opened({
      steps: [
        { step_id: 'implement', kind: 'agent', status: 'running', started_at: '2026-09-18T01:00:01.000Z', duration_ms: null, adapter: 'zeta', seq: 1 },
        { step_id: 'integrate', kind: 'integrate', status: 'completed', started_at: '2026-09-18T01:05:00.000Z', duration_ms: 4000, adapter: null, seq: 2 },
      ],
    });
    await act(async () => toggleFor(view, 'Q-0018-1').click());
    const cell = (stepId: string): string =>
      view.querySelector(`[data-occurrence="${stepId}"]`)?.textContent ?? '';
    // A step still going and one that ended recording no figure are two different facts, and only
    // one of them is going to change.
    expect(cell('implement'), 'a running occurrence was rendered as one with no duration')
      .toContain('Still running');
    expect(cell('integrate'), 'a finished occurrence did not render its duration').toContain('00:04');
    // **What it retained is not claimed from the manifest.** What is said here is the manifest's own
    // `kind`, established by the `adapter` field rather than by an inference about what is on disk.
    expect(cell('integrate'), 'an occurrence no vendor ran did not name its kind')
      .toContain(notAnAdapterCallText('integrate'));
    expect(cell('implement'), 'an adapter call was reported as not being one')
      .not.toContain(notAnAdapterCallText('agent'));
    // **And a retained file is named from the RETAINED LISTING and from nowhere else** (Q-0137).
    // This fixture answers no retained read at all, so the screen knows nothing about what these
    // two occurrences hold — and says nothing, rather than deriving a name from the two constants
    // this product writes. A screen that hard-coded `prompt.txt` and `output.txt` off the manifest
    // would render both names here with no directory ever having been read.
    for (const name of ['prompt.txt', 'output.txt']) {
      expect(view.textContent, `the opened region names ${name} without a listing having answered`)
        .not.toContain(name);
    }
  });

  test('the opened region renders the per-vendor split, including the token total a row lacks', async () => {
    // This is the half that reads the detail, and it is why the listing discloses rather than
    // approximating: an unpriced vendor's token total is on the run and not on its row.
    const { view } = await opened({
      manifest: {
        started_at: '2026-09-18T01:00:00.000Z', ended_at: '2026-09-18T01:10:00.000Z',
        duration_ms: 600_000, status: 'completed',
        rollup: [rollupRow({ vendor: 'omega', cost_usd: null, step_count: 2, unpriced_steps: 2 })],
      },
      tokensByVendor: { omega: 714_125 },
    });
    await act(async () => toggleFor(view, 'Q-0018-1').click());
    const region = view.querySelector('[data-opened-run]')?.textContent ?? '';
    expect(region, 'the opened split did not render the token total').toContain(unpricedVendorText(714_125));
    expect(region, 'the opened split rendered a zero for an unpriced vendor').not.toContain('$0.00');
  });

  test('an occurrence array a timeline could not order is REFUSED, not rendered', async () => {
    // The screen-level half of what declaring `steps` bought, and the honest form of AC-5's own
    // mutation clause: that clause asks for a mutation removing the field from the schema to turn an
    // assertion here red, and `packages/shared/src/wire.test.ts` measures that it would not —
    // `z.looseObject` preserves an undeclared key, so the array would cross either way. What the
    // declaration changes is this: an occurrence with no `seq` is a body this page cannot read,
    // reported as one, rather than a row rendered in whatever order the array happened to be in.
    const { view } = await mount(
      { runs: [row({ id: 'Q-0018-1' })], warnings: [] },
      {
        [historyDetailPath('Q-0018-1')]: {
          manifest: { started_at: '2026-09-18T01:00:00.000Z', ended_at: null, duration_ms: null, status: 'running', rollup: [] },
          incomplete: true,
          tokensByVendor: {},
          steps: [{ step_id: 'implement', kind: 'agent', status: 'completed', started_at: '2026-09-18T01:00:01.000Z', duration_ms: 1, adapter: null }],
        },
      },
    );
    await act(async () => toggleFor(view, 'Q-0018-1').click());
    expect(view.querySelector('[data-opened-run]'), 'an unorderable occurrence array was rendered anyway').toBeNull();
    expect(view.querySelector('[data-history-row="Q-0018-1"] [data-request-state]')?.getAttribute('data-request-state'),
      'a body this page cannot read was not reported as one').toBe('unparseable');
  });

  test('collapsing a row whose read is still out discards it, and its answer does not reopen the row', async () => {
    // **Review round 1's second finding.** A detail already out carries the generation it was issued
    // under, and collapsing without spending that number left its answer able to land afterwards —
    // so a row the reader had closed re-opened itself, with nothing on screen having asked for it.
    // Staged rather than reasoned about: the detail body is a promise this test settles, so the
    // collapse genuinely happens while the read is outstanding.
    let settle: (body: unknown) => void = () => {};
    const outstanding = new Promise<unknown>((resolve) => { settle = resolve; });
    const fetcher = (path: string) => Promise.resolve({
      ok: true,
      status: 200,
      json: () => (path === DAEMON_ENDPOINTS.history
        ? Promise.resolve({ runs: [row({ id: 'Q-0018-1' })], warnings: [] })
        : outstanding),
    });
    const view = document.createElement('div');
    document.body.append(view);
    const root = createRoot(view);
    roots.push(() => root.unmount());
    await act(async () => root.render(createElement(HistoryScreen, { fetcher, now: CLOCK })));

    await act(async () => toggleFor(view, 'Q-0018-1').click());
    const region = (): string | null | undefined =>
      view.querySelector('[data-history-row="Q-0018-1"] [data-request-state]')?.getAttribute('data-request-state');
    expect(region(), 'the read was not still out, so this clause has no subject').toBe('in-flight');

    await act(async () => toggleFor(view, 'Q-0018-1').click());
    expect(view.querySelector('[data-opened-run]'), 'collapsing left the region open').toBeNull();
    expect(region(), 'a collapsed row kept the state of the read it discarded').toBeUndefined();

    await act(async () => { settle(detail({})); await outstanding; });
    expect(view.querySelector('[data-opened-run]'),
      'a detail that arrived after the row was closed re-opened it').toBeNull();
    expect(region(), 'a discarded read reported itself under a row the reader had closed').toBeUndefined();
  });

  test('Retry beside a failed detail reads that run again, rather than collapsing the row', async () => {
    // **Review round 1's third finding.** The Retry is offered on a row that is already open, so a
    // retry routed through the row's toggle takes its collapse branch: a control naming a remedy and
    // performing none. Asserted on the REQUEST COUNT and then on the answer, because a clause over
    // the rendering alone passes for an implementation that merely re-renders the failure.
    const calls: string[] = [];
    let attempt = 0;
    const fetcher = (path: string) => {
      calls.push(path);
      if (path === DAEMON_ENDPOINTS.history) {
        return Promise.resolve({
          ok: true, status: 200,
          json: () => Promise.resolve({ runs: [row({ id: 'Q-0018-1' })], warnings: [] }),
        });
      }
      attempt += 1;
      // The first read answers a body this page cannot read; the second answers the run.
      const body = attempt === 1 ? { nope: true } : detail({});
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
    };
    const view = document.createElement('div');
    document.body.append(view);
    const root = createRoot(view);
    roots.push(() => root.unmount());
    await act(async () => root.render(createElement(HistoryScreen, { fetcher, now: CLOCK })));

    await act(async () => toggleFor(view, 'Q-0018-1').click());
    // Three: the listing, the detail, and Q-0137's retained read. The retained one answers the same
    // unreadable body here, which is deliberate — a Retry offered under a failed DETAIL must read
    // the detail, and a screen whose two failures shared one control could not be shown to.
    expect(calls, 'opening the row did not read that run').toHaveLength(3);
    const retry = (): HTMLButtonElement | undefined =>
      [...view.querySelectorAll('[data-history-row="Q-0018-1"] button')]
        .find((node): node is HTMLButtonElement => node.textContent === HISTORY_RETRY_LABEL);
    expect(retry(), 'a failed detail offered no retry, so this clause has no subject').toBeDefined();

    await act(async () => (retry() as HTMLButtonElement).click());
    expect(calls, 'Retry issued no request at all').toHaveLength(4);
    expect(calls[3], 'Retry read something other than the run it was offered on')
      .toBe(historyDetailPath('Q-0018-1'));
    expect(view.querySelector('[data-opened-run]'), 'Retry collapsed the row instead of reading it again')
      .not.toBeNull();
  });

  test('a run that recorded no occurrences says so, and a failed detail read renders its own state', async () => {
    const { view } = await opened({ steps: [] });
    await act(async () => toggleFor(view, 'Q-0018-1').click());
    expect(view.querySelector('[data-opened-run]')?.textContent, 'an empty occurrence list rendered nothing')
      .toContain('recorded no occurrences');
    // And a detail the daemon could not answer is the request's own state rather than an empty
    // region: the listing stays, and only the opened row says what happened.
    const failed = await mount(
      { runs: [row({ id: 'Q-0018-1' })], warnings: [] },
      { [historyDetailPath('Q-0018-1')]: undefined },
    );
    await act(async () => toggleFor(failed.view, 'Q-0018-1').click());
    const region = failed.view.querySelector('[data-history-row="Q-0018-1"] [data-request-state]');
    expect(region?.getAttribute('data-request-state'), 'a detail that did not parse rendered as loaded')
      .toBe('unparseable');
    expect(failed.view.textContent, 'the listing was lost with the detail').toContain('Q-0018-1');
  });
});

describe('Q-0018 AC-3/AC-13 — what the daemon could not read, and a store that holds nothing', () => {
  test('an unreadable run is NAMED beside the ones that were read', async () => {
    // `failSoftly`'s distinction rendered: a screen showing only the readable runs would present a
    // partial listing as the whole store.
    const { view } = await mount({
      runs: [row({ id: 'Q-0018-1' })],
      warnings: [{ runId: 'Q-0018-2', message: 'malformed manifest.json (Unexpected token n)' }],
    });
    expect(view.textContent, 'the unreadable region has no heading').toContain(UNREADABLE_HEADING);
    const named = view.querySelector('[data-history-warning="Q-0018-2"]');
    expect(named, 'a run the daemon could not read was dropped from the screen').not.toBeNull();
    expect(named?.textContent, "the reason the daemon gave was not rendered").toContain('malformed manifest.json');
    // …and the readable run is still there, so the clause discriminates rather than failing over.
    expect(view.querySelector('[data-history-row="Q-0018-1"]'), 'the readable run was lost').not.toBeNull();
    // A listing with nothing to warn about renders no region at all rather than an empty heading.
    const clean = await mount({ runs: [row({ id: 'Q-0018-1' })], warnings: [] });
    expect(clean.view.querySelector('[data-history-warnings]'), 'an empty warning region rendered')
      .toBeNull();
  });

  test('a store that answered and holds nothing says what would put a run there', async () => {
    const { view } = await mount({ runs: [], warnings: [] });
    expect(view.querySelector('[data-history-empty]')?.textContent, 'the empty store rendered nothing')
      .toBe(EMPTY_HISTORY_TEXT);
    // It is the ANSWER having arrived, so it is not one of the five request states: the loaded
    // sentence is rendered beside it rather than replaced by it.
    expect(view.querySelector('[data-request-state]')?.getAttribute('data-request-state')).toBe('loaded');
  });

  test('a store whose every run was unreadable is not reported as a store nobody has written to', async () => {
    // **Review round 1's fourth finding.** `runs: []` arrives for two opposite reasons, and the
    // empty-store sentence said over this one tells a reader that nothing has ever run here while
    // the region below names the runs that did — reporting a probe that could not answer as a
    // negative, and sending somebody to start a flow rather than at the reasons underneath.
    const { view } = await mount({
      runs: [],
      warnings: [
        { runId: 'Q-0018-1', message: 'malformed manifest.json (Unexpected token n)' },
        { runId: 'Q-0018-2', message: 'manifest.json rollup is not an array' },
      ],
    });
    expect(view.querySelector('[data-history-empty]'),
      'a store nobody could read was reported as one nobody had written to').toBeNull();
    expect(view.textContent, 'the empty-store sentence was rendered over runs that are there')
      .not.toContain(EMPTY_HISTORY_TEXT);
    expect(view.querySelector('[data-history-none-readable]')?.textContent,
      'a listing that could report none of its runs said nothing about why it was empty')
      .toBe(NO_READABLE_RUNS_TEXT);
    // …and every run it found is still named with its own reason, which is what that sentence points at.
    for (const id of ['Q-0018-1', 'Q-0018-2']) {
      expect(view.querySelector(`[data-history-warning="${id}"]`), `${id} was not named`).not.toBeNull();
    }
    // The clause discriminates rather than firing on any empty table: a store that answered and
    // holds nothing keeps its own sentence and renders neither of the other's markers.
    const truly = await mount({ runs: [], warnings: [] });
    expect(truly.view.querySelector('[data-history-none-readable]'),
      'a store nobody had written to was reported as one that could not be read').toBeNull();
    expect(truly.view.querySelector('[data-history-empty]')?.textContent).toBe(EMPTY_HISTORY_TEXT);
  });

  test.each([
    [new Error('down'), 'unreachable'],
    [{ code: 'no-project', condition: 'no harness/harness.yaml found', remedy: 'run quorum init' }, 'refused'],
    [{ nope: true }, 'unparseable'],
  ] as const)('a listing that failed renders a distinct state (%s)', async (answer, kind) => {
    const fetcher = answer instanceof Error
      ? () => Promise.reject(answer)
      : () => Promise.resolve({
        ok: kind !== 'refused', status: kind === 'refused' ? 404 : 200, json: () => Promise.resolve(answer),
      });
    const view = document.createElement('div');
    document.body.append(view);
    const root = createRoot(view);
    roots.push(() => root.unmount());
    await act(async () => root.render(createElement(HistoryScreen, { fetcher, now: CLOCK })));
    expect(view.querySelector('[data-request-state]')?.getAttribute('data-request-state')).toBe(kind);
    expect(view.textContent?.trim().length, 'a failed listing rendered nothing').toBeGreaterThan(0);
    // None of the three is presented as an empty history, which is the one confusion that would
    // send a reader looking for runs that are there.
    expect(view.textContent, 'a failed listing was presented as an empty store')
      .not.toContain(EMPTY_HISTORY_TEXT);
  });
});
