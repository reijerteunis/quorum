import { describe, expect, test } from 'vitest';

import { adapterEventSchema, eventSchema } from './events.js';
import { flowSchema } from './flow.js';
import { codeLines, sharedSourceFiles, spikeSource } from '../test/corpus.js';

describe('AC-8 — the union is derived from what the product emits', () => {
  test('the three adapter events, sampled verbatim from the lines that emit them', () => {
    const spawn = { type: 'spawn', vendor: 'claude', cmd: "claude -p --output-format json --json-schema '{…}'" };
    const stdout = { type: 'stdout', line: '[mock] product-manager:draft call #1 (model -, cwd repo, write=false)' };
    const retry = { type: 'retry', vendor: 'codex', attempt: 2, of: 5, delayMs: 10000, reason: 'a rate limit', message: '429 rate_limit_error' };
    for (const sample of [spawn, stdout, retry]) {
      const result = adapterEventSchema.safeParse(sample);
      expect(result.error?.issues ?? [], JSON.stringify(sample)).toEqual([]);
      expect(result.data).toEqual(sample);
    }
  });

  test('those three shapes are still what the spike emits', () => {
    // The samples above are only evidence while the emitting lines still look like this.
    expect(spikeSource('src/adapters/claude.js')).toContain("onEvent?.({ type: 'spawn', vendor: 'claude', cmd:");
    expect(spikeSource('src/adapters/claude.js')).toContain("onEvent?.({ type: 'stdout', line: l })");
    expect(spikeSource('src/adapters/codex.js')).toContain("onEvent?.({ type: 'spawn', vendor: 'codex', cmd:");
    expect(spikeSource('src/adapters/mock.js')).toContain("onEvent?.({ type: 'stdout', line:");
    expect(spikeSource('src/adapters/index.js')).toContain("opts.onEvent?.({ type: 'retry', vendor: adapter.vendor, attempt, of: attempts, delayMs, reason: why, message:");
  });

  test('an adapter emits no identity; a run supplies the step id', () => {
    // spike/src/engine.js:247 — `onEvent: (e) => ui.trace(step.id, e)`. That is the whole envelope.
    expect(spikeSource('src/engine.js')).toContain('onEvent: (e) => ui.trace(step.id, e)');
    expect(adapterEventSchema.safeParse({ type: 'spawn', vendor: 'claude', cmd: 'claude -p' }).success).toBe(true);
    expect(eventSchema.safeParse({ type: 'spawn', vendor: 'claude', cmd: 'claude -p' }).success).toBe(false);
    expect(eventSchema.safeParse({ type: 'spawn', stepId: 'implement', vendor: 'claude', cmd: 'claude -p' }).success).toBe(true);
  });

  test('the engine events, payloads taken from their call sites', () => {
    const samples = [
      { type: 'step', stepId: 'implement', message: 'claude/opus role=developer-generalist' },
      { type: 'done', stepId: 'review', message: 'verdict=approve cost=$1.234 4567ms' },
      { type: 'info', message: 'run #2  flow=chore  ticket=Q-0041  requirements → reviewed' },
      { type: 'warn', message: 'review: revise — blocker: a.ts:1 x' },
      { type: 'gate', gateId: 'g1', kind: 'human', reason: 'Chore owner approves the reviewed change', ticketDir: '/repo/backlog/Q-0041-…' },
      { type: 'gate', gateId: 'g2', kind: 'human-locked', reason: 'loop exhausted at review', ticketDir: '/repo/backlog/Q-0041-…', retry: 'implement' },
      { type: 'stdout', stepId: 'implement', line: 'thinking…' },
      { type: 'retry', stepId: 'review', vendor: 'codex', attempt: 1, of: 5, delayMs: 5000, reason: 'a timeout', message: 'socket hang up' },
    ];
    for (const sample of samples) {
      const result = eventSchema.safeParse(sample);
      expect(result.error?.issues ?? [], JSON.stringify(sample)).toEqual([]);
      expect(result.data).toEqual(sample);
    }
  });

  test('the six ui methods this union covers still exist, with these payloads', () => {
    const cli = spikeSource('bin/harness.js');
    expect(cli).toContain('info: (m) =>');
    expect(cli).toContain('warn: (m) =>');
    expect(cli).toContain('step: (id, m) =>');
    expect(cli).toContain('done: (id, m) =>');
    expect(cli).toContain('trace: (id, e) =>');
    expect(cli).toContain('gate: async ({ kind, reason, ticketDir, retry }) =>');
  });

  test('`tool` and `text` are not invented — nothing emits them', () => {
    for (const file of ['src/adapters/claude.js', 'src/adapters/codex.js', 'src/adapters/mock.js', 'src/adapters/index.js']) {
      expect(spikeSource(file), `${file}`).not.toContain("type: 'tool'");
      expect(spikeSource(file), `${file}`).not.toContain("type: 'text'");
    }
    expect(eventSchema.safeParse({ type: 'tool', stepId: 'x', name: 'Read' }).success).toBe(false);
    expect(eventSchema.safeParse({ type: 'text', stepId: 'x', text: 'hello' }).success).toBe(false);
  });
});

describe('AC-9 — vendor identity is one neutral, open label', () => {
  test('the label is open, so a new adapter needs no edit here', () => {
    expect(adapterEventSchema.safeParse({ type: 'spawn', vendor: 'gemini', cmd: 'gemini -p' }).success).toBe(true);
    expect(adapterEventSchema.safeParse({ type: 'retry', vendor: 'gemini', attempt: 1, of: 5, delayMs: 5000, reason: 'a timeout', message: 'x' }).success).toBe(true);
  });

  test('an unknown adapter name is already refused where it should be', () => {
    expect(spikeSource('src/adapters/index.js')).toContain('throw new Error(`unknown adapter "${name}"');
  });

  test('vendor names appear in this package only as documentation, never in code', () => {
    for (const [name, text] of sharedSourceFiles()) {
      const code = codeLines(text).join('\n');
      expect(code, `${name} must not name a vendor in code`).not.toMatch(/claude/i);
      expect(code, `${name} must not name a vendor in code`).not.toMatch(/codex/i);
    }
  });

  test('no event field could be populated by one vendor and not another', () => {
    const events = sharedSourceFiles().find(([name]) => name === 'events.ts');
    if (!events) throw new Error('packages/shared/src/events.ts is missing');
    const code = codeLines(events[1]).join('\n');
    for (const vendorField of ['session_id', 'thread_id', 'total_cost_usd', 'structured_output', 'is_error']) {
      expect(code, `events.ts must not carry ${vendorField}`).not.toContain(vendorField);
    }
  });

  test('a vendor-specific extra fails to parse — the variants are strict', () => {
    // requirements/errata.md E-3. Passing unknown keys through would widen the inferred type to
    // admit `{[k: string]: unknown}`, which is how a vendor-specific field enters the union without
    // anyone writing one down — AC-9 defeated by a type rather than by a line of code.
    expect(adapterEventSchema.safeParse({ type: 'spawn', vendor: 'claude', cmd: 'claude -p', session_id: 'abc' }).success).toBe(false);
    expect(adapterEventSchema.safeParse({ type: 'stdout', line: 'x', total_cost_usd: 0.12 }).success).toBe(false);
    expect(eventSchema.safeParse({ type: 'done', stepId: 'x', message: 'ok', is_error: false }).success).toBe(false);
    expect(eventSchema.safeParse({ type: 'gate', gateId: 'g1', kind: 'human', reason: 'r', ticketDir: '/d', thread_id: 't' }).success).toBe(false);
    // The label itself stays open, which is the field AC-9 requires rather than forbids.
    expect(adapterEventSchema.safeParse({ type: 'spawn', vendor: 'gemini', cmd: 'gemini -p' }).success).toBe(true);
  });

  test('an adapter event and a run event do not accept each other', () => {
    // `.extend` carries strictness, so the step id is an unknown key on the adapter shape and a
    // missing one on the run shape. Two interfaces, two schemas, neither silently the other.
    expect(adapterEventSchema.safeParse({ type: 'spawn', stepId: 'implement', vendor: 'claude', cmd: 'claude -p' }).success).toBe(false);
    expect(eventSchema.safeParse({ type: 'spawn', vendor: 'claude', cmd: 'claude -p' }).success).toBe(false);
  });

  test('the file-derived schemas still preserve what this one rejects', () => {
    // The other half of E-3's rule, asserted here so the asymmetry is deliberate rather than a
    // difference someone later "tidies up". flow.test.ts, ticket.test.ts and role.test.ts hold the
    // preservation side in full; this is the one place both sides are stated together.
    const flow = { name: 'x', consumes: 'draft', produces: 'requirements', steps: [], unknown_top_key: 1 };
    expect(flowSchema.parse(flow)).toEqual(flow);
  });

  test('register row 22\'s operative reading is written where a reviewer finds it', () => {
    const events = sharedSourceFiles().find(([name]) => name === 'events.ts');
    if (!events) throw new Error('packages/shared/src/events.ts is missing');
    expect(events[1]).toContain('row 22');
    expect(events[1]).toContain('NO VENDOR-SPECIFIC FIELD AND NO VENDOR BRANCHING OUTSIDE AN');
  });
});
