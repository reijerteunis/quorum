import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { ticketHistoryEntrySchema, ticketSchema } from './ticket.js';
import { frontmatterRegexMatchesSpike, parseFrontmatter, read, ticketFiles } from '../test/corpus.js';

describe('AC-5 — the ticket schema parses every ticket.md in this repository', () => {
  test('the corpus is read the way the spike reads it', () => {
    expect(frontmatterRegexMatchesSpike(), 'spike/src/backlog.js:12 no longer matches the copy in test/corpus.ts').toBe(true);
  });

  test('every backlog/*/ticket.md parses', () => {
    // Not a loop over whatever happens to be there: ticketFiles() throws when backlog/ is missing
    // or holds no ticket, because a pass over nothing is the failure this ticket is named after.
    const files = ticketFiles();
    expect(files.length).toBeGreaterThanOrEqual(27);
    for (const file of files) {
      const { meta } = parseFrontmatter(read(file));
      const result = ticketSchema.safeParse(meta);
      expect(result.error?.issues ?? [], `${path.basename(path.dirname(file))} must parse`).toEqual([]);
    }
  });

  test('the corpus really does exercise both iteration key forms and both history shapes', () => {
    // Without this the criterion above could pass over a corpus that happens to contain neither.
    const iterationKeys = new Set<string>();
    const historyShapes = new Set<string>();
    for (const file of ticketFiles()) {
      const meta = ticketSchema.parse(parseFrontmatter(read(file)).meta);
      Object.keys(meta.iterations ?? {}).forEach((key) => iterationKeys.add(key));
      for (const entry of meta.history ?? []) historyShapes.add(Object.keys(entry).sort().join(','));
    }
    expect([...iterationKeys].some((key) => key.includes('.')), 'a dotted <flow>.<step> counter').toBe(true);
    expect([...iterationKeys].some((key) => !key.includes('.')), 'a bare on_fail.counter key').toBe(true);
    expect(historyShapes).toContain('at,cost,flow,run,stage');
    expect(historyShapes).toContain('at,cost,flow,run,stage,stage_after,stage_before,status');
  });

  test('a history entry carries the eight fields outcome() writes, cost nullable', () => {
    const eight = {
      stage: 'reviewed', run: 4, flow: 'chore', status: 'completed',
      stage_before: 'requirements', stage_after: 'reviewed',
      at: '2026-08-25T16:35:36.130Z', cost: 23.254,
    };
    expect(ticketHistoryEntrySchema.parse(eight)).toEqual(eight);
    expect(ticketHistoryEntrySchema.safeParse({ ...eight, cost: null }).success).toBe(true);
    // The shorter entries that exist on disk. Rejecting them would be a migration, not a port.
    expect(ticketHistoryEntrySchema.safeParse({ stage: 'requirements', run: 1, flow: 'requirements', at: '2026-08-22T16:51:48.368Z', cost: 4.146 }).success).toBe(true);
  });

  test('`created` is a date string, and `iterations`/`history` are optional because the engine supplies its own fallback', () => {
    const minimal = {
      id: 'Q-9999', title: 'A ticket', stage: 'draft', owner: 'ruud', repos: [],
      branch: 'harness/Q-9999/integration', priority: 'p2', created: '2026-08-25',
    };
    expect(ticketSchema.parse(minimal)).toEqual(minimal);
    expect(ticketSchema.safeParse({ ...minimal, created: new Date('2026-08-25') }).success).toBe(false);
    expect(ticketSchema.safeParse({ ...minimal, stage: 'shipped' }).success).toBe(false);
  });

  test('a hand-added key nobody reads survives parsing', () => {
    // backlog/Q-0033-…/ticket.md already carries one of these.
    const withExtra = {
      id: 'Q-0033', title: 'x', stage: 'green', owner: 'ruud', repos: [],
      branch: 'harness/Q-0033/integration', priority: 'p1', created: '2026-08-22',
      iterations: { 'chore.review': 1 }, history: [], depends_on: 'Q-0006',
    };
    expect(ticketSchema.parse(withExtra)).toEqual(withExtra);
  });
});
