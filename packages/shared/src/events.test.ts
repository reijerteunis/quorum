import { describe, expect, test } from 'vitest';

import { adapterEventSchema, eventSchema } from './events.js';
import { flowSchema } from './flow.js';
import { codeLines, repoFile, sharedSourceFiles } from '../test/corpus.js';

/**
 * The four files the product emits events from, read as text.
 *
 * Q-0107 AC-9/AC-10 — `re-aimed`. These assertions read `spike/src/adapters/*.js` until then,
 * because *"the event union is derived from what the product emits"* (2026-08-25) needs a witness
 * that emits, and the spike was the only one. `packages/core` is now that witness and the spike is
 * about to stop being one, so the derivation is aimed at the tree it will still be true of.
 *
 * Read as **text** rather than imported: the dependency direction is `core → shared` and never the
 * reverse (04-architecture.md), and this is the same read `project.test.ts` already makes of
 * `packages/core/src/adapters/adapters.ts` and `packages/core/src/backlog/project.ts`. All four are
 * declared inputs of this package's `test` task and registered in
 * `packages/core/src/turbo-inputs.test.ts`, so a cache hit still names what this suite opens.
 *
 * Named in full, one constant each, rather than through a shared directory prefix: that guard
 * classifies a quoted string naming a directory as a walk the task must declare, and this suite
 * opens four files rather than walking a folder. Four literals say what happens; a prefix would
 * have claimed the other thing.
 */
const CLAUDE = 'packages/core/src/adapters/claude.ts';
const CODEX = 'packages/core/src/adapters/codex.ts';
const MOCK = 'packages/core/src/adapters/mock.ts';
const CONTRACT_LAYER = 'packages/core/src/adapters/adapters.ts';

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

  test('those three shapes are still what the product emits', () => {
    // The samples above are only evidence while the emitting lines still look like this.
    expect(repoFile(CLAUDE)).toContain("onEvent?.({ type: 'spawn', vendor: 'claude', cmd:");
    expect(repoFile(CLAUDE)).toContain("onEvent?.({ type: 'stdout', line })");
    expect(repoFile(CODEX)).toContain("onEvent?.({ type: 'spawn', vendor: 'codex', cmd:");
    expect(repoFile(CODEX)).toContain("onEvent?.({ type: 'stdout', line })");
    expect(repoFile(MOCK)).toContain("onEvent?.({ type: 'stdout', line:");
    // The retry event is the contract layer's rather than an adapter's, and it is the one shape
    // spelled across several lines, so it is matched as the fields it carries rather than as one
    // literal — a reformat must not read as a missing emit.
    const retry = /onEvent\?\.\(\{\s*type: 'retry',\s*vendor: adapter\.vendor,\s*attempt,\s*of: attempts,\s*delayMs,\s*reason: why,\s*message:/;
    expect(repoFile(CONTRACT_LAYER)).toMatch(retry);
  });

  test('an adapter emits no identity; a run supplies the step id', () => {
    // Q-0107 AC-9/AC-10 — `retired`. `spike/src/engine.js:247`'s `onEvent: (e) => ui.trace(step.id,
    // e)` stood here as the whole envelope. Its counterpart is
    // `packages/core/src/engine/steps.ts:262`, and the property — an adapter event acquires the id
    // on its way out — is asserted where it can be EXECUTED rather than read:
    // `packages/core/src/engine/engine.test.ts:528–530` runs a flow and reads the `stepId` off a
    // `stdout` event, and `:563–571` covers the parallel case a text match could never see. What
    // stays here is the half that is this package's own: the two schemas disagree about identity.
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

  // Q-0107 AC-9/AC-10 — `retired`. A test stood here reading the six `ui` methods out of
  // `spike/bin/harness.js`, which is what consumed this union before `packages/cli` existed. The
  // spike's `ui` object is not ported and has no counterpart to re-aim at: Q-0050 replaced the
  // interface the engine drove with a stream the caller drives, and Q-0090's `trace.ts` is the
  // renderer. So the property — every member of this union is rendered by somebody — is carried by
  // `packages/cli/src/trace.test.ts`'s *"the switch is exhaustive over the shipped union"*, which
  // derives the kinds from `eventSchema` itself and is strictly stronger than six method names:
  // it fails to COMPILE when a tenth member is added here, where the retired test could only fail
  // when the spike's CLI was edited.

  test('`tool` and `text` are not invented — nothing emits them', () => {
    for (const file of [CLAUDE, CODEX, MOCK, CONTRACT_LAYER]) {
      expect(repoFile(file), file).not.toContain("type: 'tool'");
      expect(repoFile(file), file).not.toContain("type: 'text'");
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
    expect(repoFile(CONTRACT_LAYER)).toContain('throw new Error(`unknown adapter "${name}"');
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
