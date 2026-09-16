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
const states: ConnectionState[] = [{ kind: 'idle' }, { kind: 'connecting', requestedUrl: 'wss://x' }, { kind: 'live', requestedUrl: 'wss://x' }, { kind: 'no-daemon', requestedUrl: 'wss://x' }, { kind: 'no-such-run' }, { kind: 'ended' }, { kind: 'interrupted', code: 1006, reason: 'lost' }, { kind: 'dropped' }, { kind: 'protocol-error', refusal: 'bad' }];
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
    const words = (text: string) => new Set(text.toLowerCase().match(/[a-z]+/g)); expect([...words(daemonMissedText(7))].some((word) => !words(browserDiscardedText(7)).has(word))).toBe(true);
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
