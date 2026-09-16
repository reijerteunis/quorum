// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, test } from 'vitest';
import { App } from './app.js';
import { MissionControlScreen } from './mission-control-screen.js';
import { STEP_DISPOSITION_TEXT } from './mission-control-text.js';
import { RUNS_PATH, runPath } from './routes.js';
import type { SocketTransport } from './run-connection.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
class FakeSocket implements SocketTransport { onopen: (() => void) | null = null; onmessage: ((e: { readonly data: unknown }) => void) | null = null; onerror: (() => void) | null = null; onclose: ((e: { readonly code: number; readonly reason: string }) => void) | null = null; closes = 0; close(): void { this.closes += 1; } }
const roots: (() => void)[] = []; afterEach(async () => { for (const close of roots.splice(0)) await act(async () => close()); document.body.innerHTML = ''; });
const body = (handle: string) => ({ handle, flow: 'development', ticketId: 'Q-0015', runId: null, state: 'running', pendingGates: 0, gates: [], refusal: null });
async function app(path: string): Promise<{ view: HTMLElement; sockets: FakeSocket[] }> { const sockets: FakeSocket[] = []; const view = document.createElement('div'); document.body.append(view); const root = createRoot(view); roots.push(() => root.unmount()); await act(async () => root.render(createElement(App, { initialPath: path, pageUrl: new URL(`https:${'/' + '/'}page.test`), socketFactory: () => { const socket = new FakeSocket(); sockets.push(socket); return socket; }, fetcher: (asked) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(asked === '/runs' ? { runs: [] } : body(path.split('/').at(-1) ?? '')) }), clock: () => 'now' }))); return { view, sockets }; }
async function screen(state: { readonly kind: 'no-such-run' } | { readonly kind: 'ended' }, events: readonly object[]): Promise<HTMLElement> { const view = document.createElement('div'); const root = createRoot(view); roots.push(() => root.unmount()); await act(async () => root.render(createElement(MissionControlScreen, { handle: 'a', snapshot: { state, events: events as never[], missedCount: null, browserDiscardedCount: null }, onRetryConnection: () => undefined, fetcher: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body('a')) }), now: () => 'now', onNavigate: () => undefined }))); return view; }

describe('Q-0015 AC-7/8/13/14 — composed mission control and app dispatch', () => {
  test('dispatches both registered screens and removes the mission-control placeholder', async () => { expect((await app(RUNS_PATH)).view.querySelector('[data-request-state]')).not.toBeNull(); const run = await app(runPath('a')); expect(run.view.textContent).not.toMatch(/waiting for/i); expect(run.sockets).toHaveLength(1); });
  test('retargets one controller, closes the old socket, and ignores its stale callback', async () => { const mounted = await app(runPath('a')); const first = mounted.sockets[0]!; const stale = first.onmessage; await act(async () => { window.history.pushState(null, '', runPath('b')); window.dispatchEvent(new PopStateEvent('popstate')); }); expect(first.closes).toBeGreaterThanOrEqual(1); expect(mounted.sockets).toHaveLength(2); stale?.({ data: JSON.stringify({ type: 'event', event: { type: 'step', stepId: 'stale', message: 'stale' } }) }); expect(mounted.view.textContent).not.toContain('stale'); });
  test('the sibling gate route constructs no socket', async () => { expect((await app(`${runPath('a')}/gate`)).sockets).toHaveLength(0); });
  test('a no-such-run state renders no trace columns', async () => { expect((await screen({ kind: 'no-such-run' }, [])).querySelectorAll('[data-trace-step-id]')).toHaveLength(0); });
  test('renders exact contracted timeline labels for observed dispositions', async () => { const view = await screen({ kind: 'ended' }, [{ type: 'step', stepId: 'a', message: 'start' }, { type: 'done', stepId: 'a', message: 'done' }, { type: 'step', stepId: 'b', message: 'start' }, { type: 'terminal', runId: 1, stageBefore: 'a', stageAfter: 'b', cost: 0, tokens: 0, status: 'completed' }]); expect([...view.querySelectorAll('[data-step-disposition]')].map((node) => node.textContent)).toStrictEqual([STEP_DISPOSITION_TEXT.ended, STEP_DISPOSITION_TEXT['started-with-no-end-reported']]); });
});
