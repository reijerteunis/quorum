import fs from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, test, vi } from 'vitest';

import type { Event } from '@quorum/shared';

import { removeTempDirs, tempDir, write } from '../../test/repo.js';
import { Backlog } from '../backlog/backlog.js';
import type { TicketRecord } from '../backlog/backlog.js';
import { formatCost, mergeFailure, resolveModel, runScript } from './steps.js';
import type { RoutingContext } from './types.js';

afterAll(removeTempDirs);

describe('Q-0052 AC-4a — a role\'s default model never crosses vendors', () => {
  // spike/test/smoke.js:620-626, the frozen coverage for register row 2's third clause, re-pointed
  // to this ticket by Q-0047 erratum E-1. `model: opus` reached a codex step once already (Q-0001).
  const role = { meta: { adapter: 'claude', model: 'opus' }, body: '' };

  test('a role default applies on its own vendor', () => {
    expect(resolveModel({}, role, 'claude')).toBe('opus');
  });

  test('a role default does not leak to another vendor, so the CLI picks its own', () => {
    expect(resolveModel({}, role, 'codex')).toBeUndefined();
  });

  test('an explicit step model always wins, across vendors included', () => {
    expect(resolveModel({ model: 'x' }, role, 'codex')).toBe('x');
    expect(resolveModel({ model: 'x' }, role, 'claude')).toBe('x');
  });

  test('a role naming no model passes none', () => {
    expect(resolveModel({}, { meta: { adapter: 'codex' }, body: '' }, 'codex')).toBeUndefined();
    expect(resolveModel({}, { meta: {}, body: '' }, 'claude')).toBeUndefined();
  });

  // The row the frozen coverage leaves out, and the one that discriminates between the two readings
  // of AC-4(a). `spike/src/engine.js:702-707` suppresses a role default on INEQUALITY and not on
  // ABSENCE, so there an adapter-less role's model reaches whichever adapter resolved. AC-4(a)
  // requires the strict form — inherit only on equality — and a role naming no adapter names no
  // vendor its model could be right for, so there is nothing to inherit from. Both assertions
  // return `'sonnet'` under the spike's guard, which is what makes them the discriminating ones.
  test('a role naming no adapter names no vendor, so it lends its model to none', () => {
    expect(resolveModel({}, { meta: { model: 'sonnet' }, body: '' }, 'codex')).toBeUndefined();
    expect(resolveModel({}, { meta: { model: 'sonnet' }, body: '' }, 'claude')).toBeUndefined();
  });
});

describe('Q-0052 AC-12a — an unpriced call is unpriced, not free', () => {
  // spike/test/smoke.js:612-618. Rounding a null price to $0.000 would state a price Quorum does
  // not know ("Codex cost is reported as tokens, never priced locally", 2026-08-22).
  test('a priced call shows money, to three decimal places', () => {
    expect(formatCost({ cost_usd: 2.2056, input_tokens: 1, output_tokens: 2 })).toBe('cost=$2.206');
  });

  test('an unpriced call shows tokens and is never displayed as free', () => {
    const unpriced = formatCost({ cost_usd: null, input_tokens: 71600, output_tokens: 4218 });
    expect(unpriced).toBe('cost=n/a (75818 tokens, vendor reports no price)');
    expect(unpriced).not.toContain('$0.000');
  });

  test('a call that reported nothing at all still renders, with no tokens', () => {
    expect(formatCost(null)).toBe('cost=n/a (0 tokens, vendor reports no price)');
    expect(formatCost(undefined)).toBe('cost=n/a (0 tokens, vendor reports no price)');
  });

  test('a genuine zero price is money, not the unpriced sentence', () => {
    // The one row that discriminates `!= null` from a truthiness test, and the reason the guard is
    // written the long way: a vendor that charged nothing reported a price.
    expect(formatCost({ cost_usd: 0, input_tokens: 5, output_tokens: 5 })).toBe('cost=$0.000');
  });
});

describe('Q-0052 AC-12b — a sync failure always says why', () => {
  // spike/test/smoke.js:273-274. Reporting only the conflicts printed "could not sync to <base> —"
  // with nothing after it, which says a failure happened and withholds the one thing a reader needs.
  test('conflicts are listed when there are any', () => {
    expect(mergeFailure({ conflicts: ['a.md', 'b.md'] })).toBe('conflicts: a.md, b.md');
  });

  test('git\'s own first non-empty line is used when nothing conflicted', () => {
    expect(mergeFailure({ conflicts: [], error: '\nfatal: invalid reference: main\n' })).toBe('git: fatal: invalid reference: main');
  });

  test('a failure with no reason says so instead of trailing off', () => {
    expect(mergeFailure({ conflicts: [] })).toBe('git reported no reason');
    expect(mergeFailure(undefined)).toBe('git reported no reason');
    expect(mergeFailure(null)).toBe('git reported no reason');
  });
});

/** Everything one script step's context needs, over a real directory it can run a command in. */
function scriptContext(overrides: Partial<RoutingContext> = {}): {
  context: RoutingContext;
  events: Event[];
  ticketDir: string;
  repoDir: string;
} {
  const repoDir = tempDir('script-');
  const ticketDir = path.join(repoDir, 'backlog', 'Q-0052-agent-gate-script');
  write(path.join(ticketDir, 'ticket.md'), '---\nid: Q-0052\n---\nbody\n');
  const events: Event[] = [];
  const ticket = {
    dir: ticketDir, folder: 'Q-0052-agent-gate-script', body: 'body\n',
    meta: { id: 'Q-0052', title: 'script', stage: 'requirements', branch: 'harness/Q-0052/integration' },
  } as unknown as TicketRecord;
  const context = {
    ticket, repoDir, harnessDir: path.join(repoDir, 'harness'),
    flow: { name: 'chore', consumes: 'requirements', produces: 'reviewed', steps: [] },
    config: {}, backlog: new Backlog(path.join(repoDir, 'backlog')), runId: 4,
    counters: {}, vars: { id: 'Q-0052', iter: 1, run: 4 }, stats: { cost: 0, tokens: 0, unpriced: 0 },
    dry: false, auto: false,
    emit: (event: Event) => events.push(event),
    persistence: {
      writeTicket: vi.fn(), appendLog: vi.fn(), recordOccurrenceEvent: vi.fn(),
      allocateOccurrence: vi.fn(() => ({ step_id: 's', occurrence_dir: 'steps/001-s' })),
      persistArtifact: vi.fn(), terminalOccurrence: vi.fn(),
      finaliseManifest: vi.fn(), finaliseActiveOccurrences: vi.fn(),
    },
    nextGateId: () => '4:1', loadNamedFlow: vi.fn(), finishRun: vi.fn(),
    diffInputs: new Map(), deferredDiffs: new Map(), baseOverride: null,
    ...overrides,
  } as unknown as RoutingContext;
  return { context, events, ticketDir, repoDir };
}

describe('Q-0052 AC-8 — the script step runs the project\'s command with three outcomes', () => {
  test('AC-8a/8d/8e — exit 0 completes the occurrence, writes its output twice, and returns null', async () => {
    const { context, events, ticketDir } = scriptContext();
    const step = { id: 'red', type: 'script', run: 'printf "run {run} iter {iter}"', output: { write: 'qa/report-{run}.md' } };

    await expect(runScript(step, context)).resolves.toBeNull();

    // (a) the command is interpolated, and the step event names it exactly as the spike does.
    expect(events[0]).toStrictEqual({ type: 'step', stepId: 'red', message: 'script: printf "run 4 iter 1"' });
    // (d) the occurrence's artifact and the ticket-relative path both receive the same output.
    expect(vi.mocked(context.persistence.persistArtifact)).toHaveBeenCalledWith(expect.anything(), 'output.txt', 'run 4 iter 1');
    expect(fs.readFileSync(path.join(ticketDir, 'qa/report-4.md'), 'utf8')).toBe('run 4 iter 1\n');
    // (e) exit 0: completed, and the `done` event carries the spike's own two words.
    expect(vi.mocked(context.persistence.terminalOccurrence)).toHaveBeenCalledWith(expect.anything(), 'completed');
    expect(events.at(-1)).toStrictEqual({ type: 'done', stepId: 'red', message: 'exit 0' });
  });

  test('AC-8e — a non-zero exit warns, fails the occurrence and aborts when no bound is declared', async () => {
    const { context, events } = scriptContext();
    await expect(runScript({ id: 'red', type: 'script', run: 'exit 3' }, context)).resolves.toStrictEqual({ abort: true });
    expect(events).toContainEqual({ type: 'warn', message: 'red: exit 3' });
    expect(vi.mocked(context.persistence.terminalOccurrence)).toHaveBeenCalledWith(expect.anything(), 'failed', {
      error: { category: 'script', message: 'red: script exited 3' },
    });
    expect(events.some((event) => event.type === 'done')).toBe(false);
  });

  test('AC-8e — a non-zero exit under on_fail takes the declared backward edge instead', async () => {
    const { context } = scriptContext();
    const step = { id: 'red', type: 'script', run: 'exit 1', on_fail: { goto: 'implement', max_iterations: 2 } };
    await expect(runScript(step, context)).resolves.toStrictEqual({ goto: 'implement', counter: 'chore.red', limit: 2 });
  });

  test('AC-8c/8e — a timeout is the PROJECT\'s, and it is never a backward edge', async () => {
    // Red against `runCommand`'s own fifteen-minute default: with the configured value ignored, a
    // command sleeping for two seconds exits normally and this test reports a completed step.
    const { context } = scriptContext({ config: { commands: { timeout_ms: 250 } } });
    const step = { id: 'red', type: 'script', run: 'sleep 5', on_fail: { goto: 'implement', max_iterations: 2 } };

    const error = await runScript(step, context).then(() => undefined, (cause: unknown) => cause);

    expect(error).toBeInstanceOf(Error);
    // The message names the budget in minutes and what to do about it — it is not a result, so
    // looping back cannot fix it, and `on_fail` is declared above precisely so that is testable.
    expect((error as Error).message).toBe(
      'red: script did not finish within 0 minutes and was killed — that is not a result,'
      + ' fix the command or raise commands.timeout_ms',
    );
    expect(vi.mocked(context.persistence.terminalOccurrence)).toHaveBeenCalledWith(expect.anything(), 'failed', {
      error: { category: 'script', message: 'red: script timed out' },
    });
  });

  test('AC-8b — a dry run announces the step and allocates nothing', async () => {
    const { context, events } = scriptContext({ dry: true });
    await expect(runScript({ id: 'red', type: 'script', run: 'exit 3' }, context)).resolves.toBeNull();
    expect(events).toStrictEqual([{ type: 'step', stepId: 'red', message: 'script: exit 3' }]);
    expect(vi.mocked(context.persistence.allocateOccurrence)).not.toHaveBeenCalled();
  });

  test('a run keeping no history runs no command', async () => {
    // The `null` the widened seam answers where there is no manifest. Both callers short-circuit
    // under `dry` above it, so this is the branch that makes the case representable rather than a
    // crash on an absent history — and it is asserted rather than assumed to be unreachable.
    const { context, events } = scriptContext();
    vi.mocked(context.persistence.allocateOccurrence).mockReturnValue(null);
    await expect(runScript({ id: 'red', type: 'script', run: 'exit 3' }, context)).resolves.toBeNull();
    expect(events.some((event) => event.type === 'warn')).toBe(false);
  });
});
