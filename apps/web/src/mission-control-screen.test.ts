// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, test } from 'vitest';
import { App } from './app.js';
import type { DaemonRequest, DaemonResponse } from './daemon-client.js';
import { runDetailPath, runStopPath } from './daemon-endpoints.js';
import { MissionControlScreen } from './mission-control-screen.js';
import { STEP_DISPOSITION_TEXT } from './mission-control-text.js';
import { RUNS_PATH, runPath } from './routes.js';
import {
  CONFIRM_STOP_LABEL, LOOK_AGAIN_LABEL, STOP_DELIVERED, STOP_LABEL, STOP_REFUSAL_TEXT,
  stopConfirmation,
} from './run-lifecycle.js';
import type { RunConnectionSnapshot, SocketTransport } from './run-connection.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
class FakeSocket implements SocketTransport { onopen: (() => void) | null = null; onmessage: ((e: { readonly data: unknown }) => void) | null = null; onerror: (() => void) | null = null; onclose: ((e: { readonly code: number; readonly reason: string }) => void) | null = null; closes = 0; close(): void { this.closes += 1; } }
const roots: (() => void)[] = []; afterEach(async () => { for (const close of roots.splice(0)) await act(async () => close()); document.body.innerHTML = ''; });
const body = (handle: string) => ({ handle, flow: 'development', ticketId: 'Q-0015', runId: null, state: 'running', pendingGates: 0, gates: [], refusal: null });
async function app(path: string): Promise<{ view: HTMLElement; sockets: FakeSocket[] }> { const sockets: FakeSocket[] = []; const view = document.createElement('div'); document.body.append(view); const root = createRoot(view); roots.push(() => root.unmount()); await act(async () => root.render(createElement(App, { initialPath: path, pageUrl: new URL(`https:${'/' + '/'}page.test`), socketFactory: () => { const socket = new FakeSocket(); sockets.push(socket); return socket; }, fetcher: (asked) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(asked === '/runs' ? { runs: [] } : body(path.split('/').at(-1) ?? '')) }), clock: () => 'now' }))); return { view, sockets }; }
async function screen(state: { readonly kind: 'no-such-run' } | { readonly kind: 'ended' }, events: readonly object[]): Promise<HTMLElement> { const view = document.createElement('div'); const root = createRoot(view); roots.push(() => root.unmount()); await act(async () => root.render(createElement(MissionControlScreen, { handle: 'a', snapshot: { state, events: events as never[], missedCount: null, browserDiscardedCount: null }, onRetryConnection: () => undefined, fetcher: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body('a')) }), now: () => 'now', onNavigate: () => undefined }))); return view; }

describe('Q-0015 AC-7/8/13/14 — composed mission control and app dispatch', () => {
  test('dispatches both registered screens and removes the mission-control placeholder', async () => { expect((await app(RUNS_PATH)).view.querySelector('[data-request-state]')).not.toBeNull(); const run = await app(runPath('a')); expect(run.view.textContent).not.toMatch(/waiting for/i); expect(run.sockets).toHaveLength(1); });
  test('retargets one controller, closes the old socket, and ignores its stale callback', async () => { const mounted = await app(runPath('a')); const first = mounted.sockets[0]!; const stale = first.onmessage; await act(async () => { window.history.pushState(null, '', runPath('b')); window.dispatchEvent(new PopStateEvent('popstate')); }); expect(first.closes).toBeGreaterThanOrEqual(1); expect(mounted.sockets).toHaveLength(2); stale?.({ data: JSON.stringify({ type: 'event', event: { type: 'step', stepId: 'stale', message: 'stale' } }) }); expect(mounted.view.textContent).not.toContain('stale'); });
  test('a handle-to-handle navigation paints none of the previous run under the new handle', async () => {
    // **Observed at the disputed commit, not after it.** The defect is one commit wide — `handle`
    // moves with the route while the controller and the screen's metadata reset in post-commit
    // effects — so an assertion made after `act` has flushed cannot see it, and a test written that
    // way passes with the fix reverted. The screen's metadata read fires FROM one of those effects,
    // so the fetcher is called with the DOM in exactly the state under dispute. Review round 1, M3.
    const seen: string[] = [];
    const sockets: FakeSocket[] = [];
    const view = document.createElement('div'); document.body.append(view);
    const root = createRoot(view); roots.push(() => root.unmount());
    const render = (path: string): Promise<void> => act(async () => root.render(createElement(App, {
      initialPath: path, pageUrl: new URL(`https:${'/' + '/'}page.test`),
      socketFactory: () => { const socket = new FakeSocket(); sockets.push(socket); return socket; },
      fetcher: (asked) => {
        if (asked.includes(runPath('b'))) seen.push(view.textContent ?? '');
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(asked === '/runs' ? { runs: [] } : body(asked.split('/').at(-1) ?? '')) });
      },
      clock: () => 'now',
    })));
    await render(runPath('a'));
    sockets[0]!.onmessage?.({ data: JSON.stringify({ type: 'event', event: { type: 'step', stepId: 'only-on-a', message: 'only-on-a' } }) });
    await act(async () => undefined);
    expect(view.textContent, 'A never rendered its own event, so this clause has no subject').toContain('only-on-a');
    await act(async () => { window.history.pushState(null, '', runPath('b')); window.dispatchEvent(new PopStateEvent('popstate')); });
    expect(seen.length, "B never read its metadata, so the commit under dispute was never observed").toBeGreaterThan(0);
    for (const text of seen) expect(text, "B's first commit carried A's trace").not.toContain('only-on-a');
  });

  test('the sibling gate route constructs no socket', async () => { expect((await app(`${runPath('a')}/gate`)).sockets).toHaveLength(0); });
  test('a no-such-run state renders no trace columns', async () => { expect((await screen({ kind: 'no-such-run' }, [])).querySelectorAll('[data-trace-step-id]')).toHaveLength(0); });
  test('renders exact contracted timeline labels for observed dispositions', async () => { const view = await screen({ kind: 'ended' }, [{ type: 'step', stepId: 'a', message: 'start' }, { type: 'done', stepId: 'a', message: 'done' }, { type: 'step', stepId: 'b', message: 'start' }, { type: 'terminal', runId: 1, stageBefore: 'a', stageAfter: 'b', cost: 0, tokens: 0, status: 'completed' }]); expect([...view.querySelectorAll('[data-step-disposition]')].map((node) => node.textContent)).toStrictEqual([STEP_DISPOSITION_TEXT.ended, STEP_DISPOSITION_TEXT['started-with-no-end-reported']]); });
});

describe('Q-0130 AC-8/AC-9/AC-10 — the stop control, and what decides whether it is offered', () => {
  const HANDLE = 'run-9';

  /** What one request carried, so *what was sent* is asserted rather than assumed. */
  interface Sent { readonly path: string; readonly request?: DaemonRequest }

  /** The three ways a read can come back carrying no report of the run at all. */
  type ReadFailure = 'unreachable' | 'refused' | 'unparseable';

  /** How the NEXT read answers: with a run in some state, with a failure, or not at all. */
  type Read =
    | { readonly kind: 'answers'; readonly state: string }
    | { readonly kind: 'held' }
    | { readonly kind: 'fails'; readonly as: ReadFailure };

  /** One read, staged — the three failures told apart the way `requestJson` tells them apart. */
  const answerRead = (read: Read): Promise<DaemonResponse> => {
    if (read.kind === 'held') return new Promise<DaemonResponse>(() => undefined);
    if (read.kind === 'answers') {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ...body(HANDLE), state: read.state }) });
    }
    switch (read.as) {
      case 'unreachable':
        return Promise.reject(new Error('nothing answered'));
      case 'refused':
        return Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ code: 'no-such-run', condition: 'no run is registered under that handle', remedy: null }),
        });
      case 'unparseable':
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ not: 'a run' }) });
    }
  };

  /**
   * The screen over a daemon whose reads answer at once and whose STOP is held until a test settles
   * it — the staging every clause about an outstanding act needs.
   */
  async function control(over: {
    runState?: string;
    connection?: RunConnectionSnapshot['state'];
  } = {}): Promise<{
    view: HTMLElement;
    sent: Sent[];
    settle: (status: number, body: unknown) => Promise<void>;
    /** What the NEXT read answers — the staging a clause about a run changing under a reader needs. */
    setRunState: (state: string) => void;
    /** Leave every further read outstanding, which is a refresh started and not an answer. */
    holdReads: () => void;
    /** Make every further read come back carrying no report, one failure at a time. */
    failReads: (as: ReadFailure) => void;
  }> {
    const sent: Sent[] = [];
    const held: ((answer: DaemonResponse) => void)[] = [];
    let read: Read = { kind: 'answers', state: over.runState ?? 'running' };
    const fetcher = (path: string, request?: DaemonRequest): Promise<DaemonResponse> => {
      sent.push({ path, request });
      if (request?.method === 'POST') return new Promise<DaemonResponse>((resolve) => { held.push(resolve); });
      return answerRead(read);
    };
    const view = document.createElement('div');
    document.body.append(view);
    const root = createRoot(view);
    roots.push(() => root.unmount());
    await act(async () => root.render(createElement(MissionControlScreen, {
      handle: HANDLE,
      snapshot: {
        state: over.connection ?? { kind: 'live', requestedUrl: 'x' },
        events: [], missedCount: null, browserDiscardedCount: null,
      },
      onRetryConnection: () => undefined,
      fetcher,
      now: () => 'now',
      onNavigate: () => undefined,
    })));
    return {
      view,
      sent,
      setRunState: (state: string) => { read = { kind: 'answers', state }; },
      holdReads: () => { read = { kind: 'held' }; },
      failReads: (as: ReadFailure) => { read = { kind: 'fails', as }; },
      settle: async (status: number, payload: unknown) => {
        const resolve = held.shift();
        if (resolve === undefined) throw new Error('no stop is waiting');
        await act(async () => {
          resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(payload) });
        });
      },
    };
  }

  const stopButton = (view: HTMLElement): HTMLButtonElement | null => view.querySelector('button[data-stop]');
  const posts = (sent: Sent[]): Sent[] => sent.filter((each) => each.request?.method === 'POST');
  const click = async (button: HTMLButtonElement | null): Promise<void> => {
    if (button === null) throw new Error('the control this clause is about is not there');
    await act(async () => { button.click(); });
  };

  test('AC-8 — it is offered while the DAEMON last reported the run running, and for no other state', async () => {
    expect(stopButton((await control({ runState: 'running' })).view), 'a running run offers no way to stop it').not.toBeNull();
    for (const state of ['refused', 'ended']) {
      expect(stopButton((await control({ runState: state })).view), `a ${state} run offered a stop`).toBeNull();
    }
  });

  test('AC-8 — and connection state does not decide it, which is what the glossary already says', async () => {
    // *"It is not run state"* — a transport can drop, end or be interrupted without the run
    // changing. A screen that hid the control when its socket failed would be withholding the one
    // act a reader wants precisely when they can no longer watch what is happening.
    for (const connection of [
      { kind: 'ended' } as const,
      { kind: 'dropped' } as const,
      { kind: 'interrupted', code: 1006, reason: '' } as const,
      { kind: 'no-daemon', requestedUrl: 'x' } as const,
    ]) {
      const { view } = await control({ runState: 'running', connection });
      expect(stopButton(view), `a ${connection.kind} connection hid the control for a running run`).not.toBeNull();
    }
    // …and the other direction: a LIVE socket over a run the daemon says is over offers nothing, so
    // the clause above is about the metadata rather than about the control always being there.
    const over = await control({ runState: 'ended', connection: { kind: 'live', requestedUrl: 'x' } });
    expect(stopButton(over.view), 'a live socket alone put a stop on a run that is over').toBeNull();
  });

  test('AC-8 — nothing this control renders is worded with one of the three gate answers', async () => {
    // A stop cancels a run through its `AbortSignal` and is not one of the three words a gate takes.
    const { view, settle } = await control();
    await click(stopButton(view));
    const asking = view.querySelector('[data-confirm="stop"]')?.textContent ?? '';
    await click(view.querySelector('button[data-confirm-stop]'));
    await settle(204, null);
    const said = [asking, view.querySelector('[data-stop-region]')?.textContent ?? '', STOP_LABEL, CONFIRM_STOP_LABEL];
    for (const text of said) {
      for (const answer of ['advance', 'retry', 'abort']) {
        expect(new RegExp(`\\b${answer}`, 'i').test(text), `the stop control is worded with ${answer}`).toBe(false);
      }
    }
    // The needle discriminates, over the gate screen's own label for the answer it does offer.
    expect(/\babort/i.test('Abort the run')).toBe(true);
  });

  test('AC-9 — it confirms first, names the handle, and Cancel sends nothing', async () => {
    const { view, sent } = await control();
    await click(stopButton(view));
    expect(posts(sent), 'a stop was sent before it was confirmed').toStrictEqual([]);
    expect(view.querySelector('[data-confirm="stop"] p')?.textContent, 'the confirmation does not name the run')
      .toBe(stopConfirmation(HANDLE));
    await click(view.querySelector('button[data-withdraw]'));
    expect(posts(sent), 'withdrawing the confirmation sent a stop').toStrictEqual([]);
    expect(view.querySelector('[data-confirm="stop"]'), 'the confirmation survived being withdrawn').toBeNull();
  });

  test('AC-8/AC-9 — a read that moves the run off running WITHDRAWS a pending confirmation', async () => {
    // Review round 1: the control was drawn from the daemon's last answer and the confirmation
    // beside it was not, so a read landing between asking and confirming took the control away and
    // left the question — a reader could still answer it, and the stop went to a run the daemon had
    // already said there was nothing to stop.
    const { view, sent, setRunState } = await control();
    await click(stopButton(view));
    expect(view.querySelector('[data-confirm="stop"]'),
      'nothing is confirming — this clause has lost its subject').not.toBeNull();

    // The daemon's next answer says the run is over. The read is the screen's own *Check again*,
    // which is the first control the status region renders above the stop.
    setRunState('ended');
    const before = sent.length;
    await click(view.querySelector('button'));
    expect(sent.length, 'the read this clause stages never happened').toBeGreaterThan(before);
    expect(stopButton(view), 'a run the daemon says is over still offered a stop').toBeNull();
    expect(view.querySelector('[data-confirm="stop"]'),
      'the confirmation outlived the control that offered it').toBeNull();
    expect(posts(sent), 'a stop was sent, so the question was still answerable').toStrictEqual([]);

    // **Withdrawn rather than hidden**, which is what this second half discriminates: a
    // confirmation merely gated on the run's state comes back the moment a later read says
    // `running` again, putting an offer on the screen that nobody made twice.
    setRunState('running');
    await click(view.querySelector('button'));
    expect(stopButton(view), 'the control did not come back for a run that is running again').not.toBeNull();
    expect(view.querySelector('[data-confirm="stop"]'),
      'a withdrawn confirmation was put back by a later read').toBeNull();
  });

  test('AC-8 — a refresh started and a read that failed are not reports, so neither withdraws anything', async () => {
    // Review round 3: the predicate read the REQUEST state, which `readMetadata` replaces with
    // `in-flight` the instant a refresh starts and with a failure where one never answers — so
    // asking for a fresh answer about a run took away the one act a reader has on it, and so did a
    // daemon that could not be reached. AC-8 is written on what the daemon LAST REPORTED, and none
    // of these four is a report that the run is not running.
    const refresh = async (staged: { view: HTMLElement; sent: Sent[] }): Promise<void> => {
      const before = staged.sent.length;
      // The metadata region's own control, which is the first button the status region renders
      // above the stop while that read is loaded — the read the existing withdrawal clause uses.
      await click(staged.view.querySelector('button'));
      expect(staged.sent.length, 'the read this clause stages never happened').toBeGreaterThan(before);
    };
    const readState = (view: HTMLElement): string | null =>
      view.querySelector('[data-request-state]')?.getAttribute('data-request-state') ?? null;

    // (a) a refresh that has not come back yet.
    const pending = await control();
    await click(stopButton(pending.view));
    pending.holdReads();
    await refresh(pending);
    expect(readState(pending.view), 'the refresh this clause stages is not outstanding').toBe('in-flight');
    expect(stopButton(pending.view),
      'a refresh in flight withdrew the control for a run the daemon last reported running').not.toBeNull();
    expect(pending.view.querySelector('[data-confirm="stop"]'),
      'a refresh in flight withdrew a confirmation the daemon had said nothing about').not.toBeNull();

    // (b) each of the three ways a read comes back carrying no report — asserted over the set
    // rather than over one example, because what they have in common is what the criterion is
    // about: the daemon did not say the run is not running.
    for (const as of ['unreachable', 'refused', 'unparseable'] as const) {
      const staged = await control();
      await click(stopButton(staged.view));
      staged.failReads(as);
      await refresh(staged);
      expect(readState(staged.view), `the read this clause stages did not come back ${as}`).toBe(as);
      expect(stopButton(staged.view),
        `a read that came back ${as} withdrew the control for a run last reported running`).not.toBeNull();
      expect(staged.view.querySelector('[data-confirm="stop"]'),
        `a read that came back ${as} withdrew a confirmation the daemon had said nothing about`).not.toBeNull();
    }
  });

  test('AC-8 — a report is about one handle, and never decides the control on another', async () => {
    // The other half of keeping a report: it is kept until a LATER one replaces it, so it has to
    // carry the handle it is about. `app.tsx` keys this screen by handle and a remount would clear
    // it, but a screen whose subject moves under one instance must not draw an irreversible control
    // on the run that was left — and a read that then fails at the new handle would leave the
    // previous run's `running` standing indefinitely rather than for one commit.
    const view = document.createElement('div');
    document.body.append(view);
    const root = createRoot(view);
    roots.push(() => root.unmount());
    const render = (handle: string, answer: () => Promise<DaemonResponse>): Promise<void> =>
      act(async () => root.render(createElement(MissionControlScreen, {
        handle,
        snapshot: {
          state: { kind: 'live', requestedUrl: 'x' },
          events: [], missedCount: null, browserDiscardedCount: null,
        },
        onRetryConnection: () => undefined,
        fetcher: () => answer(),
        now: () => 'now',
        onNavigate: () => undefined,
      })));

    await render('run-1', () => Promise.resolve({
      ok: true, status: 200, json: () => Promise.resolve({ ...body('run-1'), state: 'running' }),
    }));
    expect(stopButton(view), 'run-1 offered no stop, so this clause has lost its subject').not.toBeNull();

    // The same instance, a different run, and a read that cannot answer for it.
    await render('run-2', () => Promise.reject(new Error('nothing answered')));
    expect(stopButton(view), 'a report about the run that was left offered a stop on the run arrived at').toBeNull();
  });

  test('AC-9 — two activations in one turn issue one request, and a read does not release the guard', async () => {
    const { view, sent, settle } = await control();
    await click(stopButton(view));
    const confirm = view.querySelector<HTMLButtonElement>('button[data-confirm-stop]');
    // Both inside ONE act, which is what makes it two activations in one turn: state has not
    // flushed between them, so a guard held in state would let the second through.
    await act(async () => { confirm?.click(); confirm?.click(); });
    expect(posts(sent).length, 'two activations in one turn issued two stops').toBe(1);
    expect(stopButton(view)?.disabled, 'the control stayed live while a stop was out').toBe(true);
    const outstanding = view.querySelector('[data-stop-outcome]')?.textContent ?? '';
    expect(outstanding, 'nothing says a stop is on its way').toContain(runStopPath(HANDLE));

    // A metadata read lands in between — Q-0016's blocker, on the screen that also holds a socket —
    // and changes neither the guard nor the sentence.
    const before = sent.length;
    await click(view.querySelector('button'));
    expect(sent.length, 'the read this clause stages never happened').toBeGreaterThan(before);
    expect(stopButton(view)?.disabled, 'a read re-enabled the stop control').toBe(true);
    expect(view.querySelector('[data-stop-outcome]')?.textContent,
      'a read cleared the sentence saying a stop was on its way').toBe(outstanding);
    expect(posts(sent).length, 'a read issued a second stop').toBe(1);
    await settle(204, null);
    expect(stopButton(view)?.disabled, 'the control stayed inert after its own request resolved').toBe(false);
  });

  test('AC-10 — a 204 reports the cancellation DELIVERED and never that the run ended', async () => {
    const { view, settle } = await control();
    await click(stopButton(view));
    await click(view.querySelector('button[data-confirm-stop]'));
    await settle(204, null);
    const outcome = view.querySelector('[data-stop-outcome="loaded"]')?.textContent ?? '';
    expect(outcome, 'the delivered cancellation renders no sentence at all').toBe(STOP_DELIVERED);
    // **What is asserted is the identity above plus one property of that sentence, and NOT a scan
    // for the word "ended".** The first draft of this clause forbade the phrase *has ended* as a
    // needle and went red on the real text — because the sentence carries it in order to DENY it
    // (*"Whether it has ended is a read…"*), and no needle can tell a claim from its denial without
    // parsing prose as a contract, which is what this repository refuses everywhere else. So the
    // claim is pinned by the equality, and what is checked about the sentence is that it defers the
    // question to a read rather than answering it.
    expect(STOP_DELIVERED, 'the delivered sentence does not defer the question to a read')
      .toMatch(/\bis a read\b/);
    // …and it is not the other outcome's sentence, so the equality is a discrimination rather than
    // one string compared with itself.
    expect(outcome, 'a delivered cancellation rendered a refusal\'s sentence')
      .not.toContain(STOP_REFUSAL_TEXT['not-running']);
  });

  test('AC-10 — a not-running refusal is rendered as what it is, and claims no completion', async () => {
    const { view, settle } = await control();
    await click(stopButton(view));
    await click(view.querySelector('button[data-confirm-stop]'));
    await settle(409, { code: 'not-running', condition: 'that run is not running', remedy: null });
    const outcome = view.querySelector('[data-stop-outcome="refused"]')?.textContent ?? '';
    expect(outcome, 'this surface says nothing of its own about the refusal')
      .toContain(STOP_REFUSAL_TEXT['not-running']);
    expect(outcome, 'the daemon\'s own condition did not reach the page').toContain('that run is not running');
    expect(outcome, 'a refused stop was relabelled a successful one').not.toContain(STOP_DELIVERED);
    // The other half of AC-10, and it is a property of the sentence rather than a word scan for the
    // reason the clause above gives: `not-running` does not prove the run completed either, and the
    // register's sentence says so in as many words instead of leaving a reader to conclude it.
    expect(STOP_REFUSAL_TEXT['not-running'], 'the refusal sentence lets a reader read completion into it')
      .toMatch(/not a claim that the run completed/);
  });

  test('AC-10 — the action beside a refused stop reads the run and re-sends nothing', async () => {
    const { view, sent, settle } = await control();
    await click(stopButton(view));
    await click(view.querySelector('button[data-confirm-stop]'));
    await settle(404, { code: 'no-such-run', condition: 'no run is registered under that handle', remedy: null });
    const before = sent.length;
    const action = [...view.querySelectorAll('button')].find((button) => button.textContent === LOOK_AGAIN_LABEL);
    await click(action ?? null);
    expect(posts(sent).length, 'the action beside a refused stop sent another one').toBe(1);
    expect(sent.slice(before).every((each) => each.request === undefined), 'the action was not a GET').toBe(true);
    expect(sent.slice(before).map((each) => each.path), 'the action read something other than the run')
      .toStrictEqual([runDetailPath(HANDLE)]);
  });
});
