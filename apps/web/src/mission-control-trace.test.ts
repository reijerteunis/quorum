// @vitest-environment jsdom
import { act, createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, test } from 'vitest';
import type { Event } from '@quorum/shared';
import { MissionControlTrace } from './mission-control-trace.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const cleanups: (() => void)[] = [];
afterEach(async () => { for (const clean of cleanups.splice(0)) await act(async () => clean()); document.body.innerHTML = ''; });
async function render(element: ReactElement): Promise<HTMLElement> { const at = document.createElement('div'); document.body.append(at); const root = createRoot(at); cleanups.push(() => root.unmount()); await act(async () => root.render(element)); return at; }

describe('Q-0015 AC-4/5/6 — trace rendering', () => {
  test('renders one exact-id column and one ordered run lane without cross-contamination', async () => {
    const events: Event[] = [{ type: 'info', message: 'first' }, { type: 'step', stepId: 'dev:a', message: 'a' }, { type: 'warn', message: 'last' }, { type: 'step', stepId: 'dev:b', message: 'b' }];
    const view = await render(createElement(MissionControlTrace, { events }));
    expect([...view.querySelectorAll('[data-trace-step-id]')].map((node) => node.getAttribute('data-trace-step-id'))).toStrictEqual(['dev:a', 'dev:b']);
    expect(view.querySelector('[data-run-activity]')?.textContent).toMatch(/first[\s\S]*last/);
  });

  test('renders output as escaped text and shows only a supplied vendor badge', async () => {
    const parseLike = ['role', 'model', 'branch', 'cost', 'verdict'].map((key) => `${key}${'='}secret`).join(' ');
    const events: Event[] = [{ type: 'spawn', stepId: 'x', vendor: 'codex', cmd: 'go' }, { type: 'stdout', stepId: 'x', line: `<script>${parseLike}</script>` }, { type: 'step', stepId: 'y', message: 'plain' }];
    const view = await render(createElement(MissionControlTrace, { events }));
    expect(view.querySelector('script')).toBeNull();
    expect(view.textContent).toContain(`<script>${parseLike}</script>`);
    expect(view.querySelector('[data-trace-step-id="x"]')?.textContent).toContain('codex');
    expect(view.querySelector('[data-trace-step-id="y"]')?.textContent).not.toContain('codex');
  });
});
