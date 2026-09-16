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

  test('every entry names its event type, in the column and in the run lane', async () => {
    // AC-6's first clause — *"Each entry names its event type"* — which `eventLine` never carried
    // and which the frozen contract's Trace-and-timeline section omits, so the implementer and QA
    // coded past it together. Without it `info`, `warn` and `gate` are three identical grey lines
    // in the lane and a reader cannot tell a step's narration from its warning. Review round 1, M1.
    const events: Event[] = [
      { type: 'info', message: 'same words' }, { type: 'warn', message: 'same words' },
      { type: 'step', stepId: 'dev:a', message: 'same words' }, { type: 'done', stepId: 'dev:a', message: 'same words' },
    ];
    const view = await render(createElement(MissionControlTrace, { events }));
    const lane = view.querySelector('[data-run-activity]')!.textContent ?? '';
    for (const type of ['info', 'warn']) {
      expect(lane, `the run lane does not name the ${type} event's type`).toContain(type);
    }
    const column = view.querySelector('[data-trace-step-id="dev:a"]')!.textContent ?? '';
    for (const type of ['step', 'done']) {
      expect(column, `the column does not name the ${type} event's type`).toContain(type);
    }
    // …and the payload is still rendered beside it rather than replaced by it.
    expect(lane, 'the run lane lost the payload').toContain('same words');
    expect(column, 'the column lost the payload').toContain('same words');
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
