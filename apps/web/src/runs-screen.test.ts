// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { EMPTY_RUNS_TEXT, NO_TICKET_ID_TEXT } from './mission-control-text.js';
import { REQUEST_STATE_KINDS } from './request-state.js';
import { runPath } from './routes.js';
import { REFRESH_LABEL, RETRY_LABEL, RUNS_HEADING, RunsScreen } from './runs-screen.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const roots: (() => void)[] = [];
afterEach(async () => { vi.useRealTimers(); for (const close of roots.splice(0)) await act(async () => close()); document.body.innerHTML = ''; });
const CLOCK = (): string => '2026-09-16T09:00:00.000Z';
const row = (handle: string, ticketId: string | null) => ({ handle, flow: 'development', ticketId, runId: null, dry: false, state: 'running', pendingGates: 2, gates: [], refusal: null });
async function mount(body: unknown, status = 200): Promise<{ view: HTMLElement; calls: string[] }> { const calls: string[] = []; const fetcher = (path: string) => { calls.push(path); return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) }); }; const view = document.createElement('div'); document.body.append(view); const root = createRoot(view); roots.push(() => root.unmount()); await act(async () => root.render(createElement(RunsScreen, { fetcher, now: CLOCK, onNavigate: () => undefined }))); return { view, calls }; }

describe('Q-0015 AC-1/2/3 — runs landing', () => {
  test('reads once, never polls, and refresh alone repeats the read', async () => {
    vi.useFakeTimers(); const { view, calls } = await mount({ runs: [] }); expect(calls).toHaveLength(1);
    await act(async () => vi.advanceTimersByTimeAsync(60_000)); expect(calls).toHaveLength(1);
    await act(async () => (view.querySelector('button') as HTMLButtonElement).click()); expect(calls).toHaveLength(2);
  });

  test('preserves daemon order and renders every row field, ticket absence, and registered link', async () => {
    const { view } = await mount({ runs: [row('z-run', null), row('a-run', 'Q-0015')] });
    const links = [...view.querySelectorAll('a')]; expect(links.map((a) => a.getAttribute('href'))).toStrictEqual([runPath('z-run'), runPath('a-run')]);
    expect(view.textContent?.indexOf('z-run')).toBeLessThan(view.textContent?.indexOf('a-run') ?? -1);
    expect(links[0]?.parentElement?.textContent).toContain(NO_TICKET_ID_TEXT); expect(links[1]?.parentElement?.textContent).toContain('Q-0015');
  });

  test('renders the contracted honest empty state without inventing a request kind', async () => {
    const { view } = await mount({ runs: [] }); expect(view.textContent).toContain(EMPTY_RUNS_TEXT); expect(REQUEST_STATE_KINDS).toHaveLength(5);
  });

  test.each([[new Error('down'), 'unreachable'], [{ code: 'no-project', condition: 'missing', remedy: null }, 'refused'], [{ nope: true }, 'unparseable']] as const)('renders distinct failure state %s', async (answer, kind) => {
    const fetcher = answer instanceof Error ? () => Promise.reject(answer) : () => Promise.resolve({ ok: kind !== 'refused', status: kind === 'refused' ? 404 : 200, json: () => Promise.resolve(answer) });
    const view = document.createElement('div'); const root = createRoot(view); roots.push(() => root.unmount()); await act(async () => root.render(createElement(RunsScreen, { fetcher, now: CLOCK, onNavigate: () => undefined })));
    expect(view.querySelector('[data-request-state]')?.getAttribute('data-request-state')).toBe(kind); expect(view.textContent?.trim().length).toBeGreaterThan(0);
  });
  test('the three exported labels are the ones the screen renders', async () => {
    // Their JSDoc says they exist "so a test and the view cannot disagree about what this screen
    // is", and no test imported any of them — while the board, gate and ticket screens each assert
    // over theirs. A label nothing asserts is a claim the export does not back. Round 3, N-3.
    const { view } = await mount({ runs: [] });
    expect(view.textContent, 'the heading the register names is not rendered').toContain(RUNS_HEADING);
    expect([...view.querySelectorAll('button')].map((node) => node.textContent),
      'the refresh label the register names is not rendered').toContain(REFRESH_LABEL);
    const failed = await mount({}, 500);
    expect([...failed.view.querySelectorAll('button')].map((node) => node.textContent),
      'the retry label the register names is not rendered').toContain(RETRY_LABEL);
  });
});
