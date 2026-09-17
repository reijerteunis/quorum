// @vitest-environment jsdom
import { act, createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { WireRun } from '@quorum/shared';
import type { ConnectionState } from './connection-state.js';
import { MissionControlStatus, type MissionControlStatusProps } from './mission-control-status.js';
import { MISSION_CONTROL_DISCLOSURES, browserDiscardedText, daemonMissedText } from './mission-control-text.js';
import { gatePath } from './routes.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const roots: (() => void)[] = [];
afterEach(async () => { for (const close of roots.splice(0)) await act(async () => close()); document.body.innerHTML = ''; });
const run = (pendingGates = 0, runId: number | null = null): WireRun => ({ handle: 'h', flow: 'development', ticketId: 'Q-0015', runId, state: 'running', pendingGates, gates: [], refusal: null });
const socketUrl = ['wss', '://x'].join('');
const states: ConnectionState[] = [{ kind: 'idle' }, { kind: 'connecting', requestedUrl: socketUrl }, { kind: 'live', requestedUrl: socketUrl }, { kind: 'no-daemon', requestedUrl: socketUrl }, { kind: 'no-such-run' }, { kind: 'ended' }, { kind: 'interrupted', code: 1006, reason: 'lost' }, { kind: 'dropped' }, { kind: 'protocol-error', refusal: 'bad' }];
async function renderStatus(state: ConnectionState, over: Partial<MissionControlStatusProps> = {}): Promise<HTMLElement> { const view = document.createElement('div'); const root = createRoot(view); roots.push(() => root.unmount()); const props: MissionControlStatusProps = { handle: 'h', snapshot: { state, events: [], missedCount: null, browserDiscardedCount: null }, metadata: { kind: 'loaded', value: run(), fetchedAt: 'now' }, onRetryConnection: () => undefined, onRetryMetadata: () => undefined, onNavigate: () => undefined, ...over }; await act(async () => root.render(createElement(MissionControlStatus, props))); return view; }

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

  test('a terminal-bearing snapshot renders the run number and drops the sentence saying it has none', async () => {
    // **Both regions on ONE fixture**, which is the instrument failure behind major 2: AC-11's two
    // clauses were each satisfied by a different snapshot — disclosures on `live`, identity on
    // `ended` — so the contradiction between them was asserted by neither. Review round 2, major 2.
    const terminal = { type: 'terminal', runId: 42, stageBefore: 'red', stageAfter: 'green', cost: 0, tokens: 0, status: 'completed' };
    const view = await renderStatus(states[5]!, { snapshot: { state: states[5], events: [terminal] as never[], missedCount: null, browserDiscardedCount: null } });
    expect(view.querySelector('[data-run-identity]')?.textContent, 'the terminal run number did not reach the identity region').toContain('42');
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
    const view = await renderStatus(states[2]!); const region = view.querySelector('[data-mission-control-disclosures]')!; let at = -1;
    for (const disclosure of MISSION_CONTROL_DISCLOSURES) { expect(region.textContent).toContain(disclosure); const next = region.textContent!.indexOf(disclosure); expect(next).toBeGreaterThan(at); at = next; }
    expect(view.querySelector('[data-mission-control-header]')?.textContent).not.toMatch(/—|\$|0:00|n\/a/);
  });

  test('uses the handle until a terminal event supplies the run number, ignoring metadata runId', async () => {
    const metadataNumber = await renderStatus(states[2]!, { metadata: { kind: 'loaded', value: run(0, 99), fetchedAt: 'now' } }); expect(metadataNumber.querySelector('[data-run-identity]')?.textContent).toContain('h'); expect(metadataNumber.querySelector('[data-run-identity]')?.textContent).not.toContain('99');
    const terminal = { type: 'terminal' as const, runId: 42, stageBefore: 'a', stageAfter: 'b', cost: 0, tokens: 0, status: 'completed' as const };
    const ended = await renderStatus(states[5]!, { snapshot: { state: states[5], events: [terminal], missedCount: null, browserDiscardedCount: null } }); expect(ended.querySelector('[data-run-identity]')?.textContent).toContain('42');
  });

  test('derives the gate link only from loaded pendingGates, even with no gate event retained', async () => {
    const yes = await renderStatus(states[2]!, { metadata: { kind: 'loaded', value: run(1), fetchedAt: 'now' } }); expect(yes.querySelector(`a[href="${gatePath('h')}"]`)).not.toBeNull();
    const no = await renderStatus(states[2]!); expect(no.querySelector(`a[href="${gatePath('h')}"]`)).toBeNull();
  });
});
