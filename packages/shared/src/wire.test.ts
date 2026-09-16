import { describe, expect, test } from 'vitest';

import { repoFile, sharedSourceFiles } from '../test/corpus.js';
import {
  WIRE_RUN_STATES, wireFlowListSchema, wireFlowSchema, wireMessageSchema, wireRefusalSchema,
  wireRunListSchema, wireRunSchema, wireRunStateSchema, wireTicketListSchema, wireTicketSchema,
} from './wire.js';
import { ticketSchema } from './ticket.js';
import * as shared from './index.js';

/** One run row that every clause below starts from, so a refusal is the one field it changed. */
const RUN = {
  handle: 'run-7', flow: 'probe', ticketId: 'T-0001', runId: null, state: 'running', pendingGates: 1,
} as const;

/** The issue codes one refusal carried, which is what "distinguishably" is asserted over. */
const codesOf = (result: { error?: { issues: { code: string }[] } }): string[] =>
  (result.error?.issues ?? []).map((issue) => issue.code);

describe('AC-12/14 — browser-safe wire envelope', () => {
  test('accepts only the two envelope shapes and finite non-negative integer counts', () => {
    expect(wireMessageSchema.safeParse({ type: 'event', event: { anything: true } }).success).toBe(true);
    expect(wireMessageSchema.safeParse({ type: 'missed', count: 0 }).success).toBe(true);
    for (const count of ['7', -1, 1.5, Infinity]) expect(wireMessageSchema.safeParse({ type: 'missed', count }).success).toBe(false);
    expect(wireMessageSchema.safeParse({ type: 'heartbeat' }).success).toBe(false);
  });

  test('the web importer declares shared in the lockfile', () => {
    const lock = repoFile('pnpm-lock.yaml');
    const importer = lock.slice(lock.indexOf('  apps/web:'), lock.indexOf('\n  packages/', lock.indexOf('  apps/web:')));
    const scope = `@${'quorum'}/shared`;
    expect(importer).toContain(`'${scope}':`);
    expect(importer).toContain('workspace:*');
  });
});

describe('Q-0121 AC-10 — the run and refusal shapes are here, each with a schema', () => {
  test('the barrel publishes both names and all four schemas', () => {
    // The **names** are types and add no runtime key, so what a runtime check can see is the
    // schemas — which is the half that matters: a moved type with no schema recreates exactly the
    // half-measure Q-0120 had to repair, and the type is proven to be exported by this file
    // compiling against it below.
    const published = shared as unknown as Record<string, unknown>;
    for (const name of ['wireRefusalSchema', 'wireRunSchema', 'wireRunListSchema', 'wireRunStateSchema']) {
      expect(typeof published[name], `${name} is not on the barrel`).toBe('object');
    }
    expect(published.WIRE_RUN_STATES, 'the closed state set is not on the barrel').toStrictEqual(WIRE_RUN_STATES);
  });

  test('the state vocabulary is the closed three, as an identity rather than a count', () => {
    // A register, because a count passes while a member is swapped for another (Q-0073). The
    // direction the compiler owns is the other one — a fourth `RunState` is not assignable where
    // `wireRunOf` builds this field — and `http.test.ts` proves all three are states the host
    // actually produces, so neither union can gain a member alone without something failing.
    expect([...WIRE_RUN_STATES]).toStrictEqual(['refused', 'running', 'ended']);
    for (const state of WIRE_RUN_STATES) expect(wireRunStateSchema.safeParse(state).success).toBe(true);
    expect(wireRunStateSchema.safeParse('paused').success, 'a state the host cannot produce was accepted').toBe(false);
  });

  test('a run row is accepted, and its three refusal classes are told apart', () => {
    expect(wireRunSchema.safeParse(RUN).success).toBe(true);
    expect(wireRunSchema.safeParse({ ...RUN, ticketId: null, runId: 3, state: 'ended', pendingGates: 0 }).success).toBe(true);
    // One message per class: an unknown key, a missing required field and a state outside the
    // closed three each report a DIFFERENT code, so a client — and a reviewer reading a failure —
    // can tell which contract was broken rather than only that one was.
    const unknownKey = codesOf(wireRunSchema.safeParse({ ...RUN, watchers: 2 }));
    const missing = codesOf(wireRunSchema.safeParse({ handle: 'run-7', flow: 'probe' }));
    const badState = codesOf(wireRunSchema.safeParse({ ...RUN, state: 'paused' }));
    expect(unknownKey).toStrictEqual(['unrecognized_keys']);
    expect(missing, 'a row missing three required fields reported no missing field').toContain('invalid_type');
    expect(badState).toStrictEqual(['invalid_value']);
    expect(new Set([unknownKey[0], missing[0], badState[0]]).size, 'two of the three classes report one code').toBe(3);
  });

  test('a refusal is the three fields and nothing else', () => {
    expect(wireRefusalSchema.safeParse({ code: 'no-such-run', condition: 'x', remedy: null }).success).toBe(true);
    expect(wireRefusalSchema.safeParse({ code: 'no-such-run', condition: 'x', remedy: 'do y' }).success).toBe(true);
    expect(codesOf(wireRefusalSchema.safeParse({ code: 'c', condition: 'x', remedy: null, hint: 'z' })))
      .toStrictEqual(['unrecognized_keys']);
    expect(codesOf(wireRefusalSchema.safeParse({ code: 'c', condition: 'x' }))).toStrictEqual(['invalid_type']);
    // `remedy` is nullable and not optional: absent and `null` are different answers, and only one
    // of them says "this surface has nothing to add to the condition".
    expect(wireRefusalSchema.safeParse({ code: 'c', condition: 'x', remedy: undefined }).success).toBe(false);
  });

  test('a listing is an envelope, and an unknown envelope key is refused too', () => {
    expect(wireRunListSchema.safeParse({ runs: [] }).success, 'an empty listing is not a malformed one').toBe(true);
    expect(wireRunListSchema.safeParse({ runs: [RUN] }).success).toBe(true);
    expect(codesOf(wireRunListSchema.safeParse({ runs: [RUN], total: 1 }))).toStrictEqual(['unrecognized_keys']);
    expect(wireRunListSchema.safeParse([RUN]).success, 'a bare array satisfied the envelope').toBe(false);
    // And the rows are checked rather than the container, which is the distinction Q-0119's review
    // round 2 found the other way round: `Array.isArray` alone moves a throw rather than removing it.
    expect(wireRunListSchema.safeParse({ runs: [{ ...RUN, state: 'paused' }] }).success).toBe(false);
  });
});

/** One ticket row every clause below starts from, so a refusal is the one field it changed. */
const TICKET = {
  id: 'Q-0017',
  folder: 'Q-0017-backlog-board-and-ticket-page',
  title: 'Backlog board',
  stage: 'requirements',
  owner: 'ruud',
  branch: 'harness/Q-0017/integration',
  containment: { state: 'contained' },
  iterations: { review: 1 },
  billedCostUsd: 12.5,
} as const;

describe('Q-0017 AC-1 — the two listings the board reads, each with a schema', () => {
  test('the barrel publishes every schema this board executes', () => {
    const published = shared as unknown as Record<string, unknown>;
    for (const name of [
      'wireTicketSchema', 'wireTicketListSchema', 'wireFlowSchema', 'wireFlowListSchema',
      'containmentResultSchema', 'pushLagResultSchema',
    ]) {
      expect(typeof published[name], `${name} is not on the barrel`).toBe('object');
    }
  });

  test('a live-shaped ticket listing is accepted, containment states and all', () => {
    // The three containment states and the null, because the field was declared `unknown` until this
    // ticket and a browser switching on it is the whole reason it moved.
    for (const containment of [
      { state: 'contained' },
      { state: 'not-contained', ahead: 12 },
      { state: 'indeterminate', reason: 'no branch' },
      null,
    ]) {
      expect(wireTicketSchema.safeParse({ ...TICKET, containment }).success,
        `a ${JSON.stringify(containment)} answer was refused`).toBe(true);
    }
    expect(wireTicketListSchema.safeParse({ tickets: [TICKET], pushLag: null, baseBranch: 'main' }).success).toBe(true);
    expect(wireTicketListSchema.safeParse({
      tickets: [], pushLag: { state: 'unpushed', ahead: 2, upstream: 'origin/main' }, baseBranch: 'main',
    }).success, 'an empty backlog is not a malformed listing').toBe(true);
  });

  test('a containment answer carrying a shape git cannot produce is refused', () => {
    // `contained` carries no ahead count and `not-contained` carries no reason: the result union
    // makes those unrepresentable in the types, and `.strict()` is what makes them unrepresentable
    // on the wire, where the value arrived as JSON and no compiler saw it.
    expect(wireTicketSchema.safeParse({ ...TICKET, containment: { state: 'contained', ahead: 3 } }).success,
      'a contained answer carrying an ahead count was accepted — the field is not the closed union').toBe(false);
    expect(wireTicketSchema.safeParse({ ...TICKET, containment: { state: 'indeterminate', reason: 'no idea' } }).success,
      'a reason outside the closed set was accepted').toBe(false);
    expect(wireTicketSchema.safeParse({ ...TICKET, containment: { state: 'merged' } }).success,
      'a state this vocabulary does not have was accepted').toBe(false);
  });

  test('the folder is required, and an id the file did not supply is empty rather than invented', () => {
    // The identity that survives a `ticket.md` nothing could parse. `id` is then `''` — the answer
    // `title`, `owner` and `branch` already give for a value nobody wrote — so the schema has to
    // accept an empty one, and `folder` has to be there for anything to name the ticket by. A
    // schema that let `folder` be absent would let the daemon stop sending it and the board fall
    // back to rendering two damaged tickets as one nameless row twice.
    expect(wireTicketSchema.safeParse({ ...TICKET, id: '' }).success,
      'a ticket whose own file supplied no id makes the whole listing unparseable').toBe(true);
    const { folder: _dropped, ...withoutFolder } = TICKET;
    expect(codesOf(wireTicketSchema.safeParse(withoutFolder)),
      'a row with no folder was accepted, so the only identity a damaged ticket keeps is optional')
      .toContain('invalid_type');
    expect(wireTicketSchema.safeParse({ ...TICKET, folder: 42 }).success).toBe(false);
  });

  test('it refuses an unknown key and an absent stage, which is what a parser is FOR', () => {
    expect(codesOf(wireTicketSchema.safeParse({ ...TICKET, cost: 1 }))).toStrictEqual(['unrecognized_keys']);
    const { stage: _dropped, ...withoutStage } = TICKET;
    expect(codesOf(wireTicketSchema.safeParse(withoutStage))).toContain('invalid_type');
  });

  test('and it is NOT stricter than the schema the disk uses — the load-bearing half', () => {
    // Two values `ticketSchema` accepts on disk, or that the daemon actually sends, and which a
    // narrower wire schema would turn into a board that does not render at all.
    //
    // `stage` is a plain string because `GET /tickets` sends `String(ticket.meta.stage)`, which is
    // the literal "undefined" for a `ticket.md` `parseFrontmatter` fell open on (Q-0060, open and
    // untouched). Naming such a ticket is the SCREEN's job; refusing the whole listing because one
    // row is damaged is the opposite of what a board is for.
    expect(wireTicketSchema.safeParse({ ...TICKET, stage: 'undefined' }).success,
      'a damaged ticket makes the whole listing unparseable').toBe(true);
    // `iterations` is the same bare number record the disk schema declares, which permits a float
    // and a negative. Both sides are asserted, so this is a comparison rather than a claim.
    const odd = { review: 1.5, 'chore.review': -2 };
    expect(ticketSchema.safeParse({
      id: 'T-1', title: 't', stage: 'draft', owner: 'o', repos: [], branch: 'b', priority: 'p',
      created: '2026-09-16', iterations: odd,
    }).success, 'the disk schema refuses this, so the wire may too').toBe(true);
    expect(wireTicketSchema.safeParse({ ...TICKET, iterations: odd }).success,
      'the wire is stricter than the disk about a counter').toBe(true);
    // And it is not merely permissive: a counter that is not a number is still refused.
    expect(wireTicketSchema.safeParse({ ...TICKET, iterations: { review: 'one' } }).success).toBe(false);
  });

  test('a flow listing carries a refused flow with its problems', () => {
    // Q-0055 AC-16: a flow the linter refuses is NAMED rather than hidden, so the shape has to be
    // able to carry one — `consumes` and `produces` are null on a record that never parsed.
    const refused = { name: 'broken', runnable: false, consumes: null, produces: null, problems: ['no steps'] };
    expect(wireFlowSchema.safeParse(refused).success).toBe(true);
    expect(wireFlowSchema.safeParse({ name: 'chore', runnable: true, consumes: 'requirements', produces: 'reviewed', problems: [] }).success).toBe(true);
    expect(wireFlowListSchema.safeParse({ flows: [refused] }).success).toBe(true);
    expect(codesOf(wireFlowListSchema.safeParse({ flows: [], count: 0 }))).toStrictEqual(['unrecognized_keys']);
  });
});

describe('Q-0017 AC-2 — what a ticket row may carry, and what it may not', () => {
  test('a cost of null is a legal answer and is not zero', () => {
    expect(wireTicketSchema.safeParse({ ...TICKET, billedCostUsd: null }).success).toBe(true);
    expect(wireTicketSchema.safeParse({ ...TICKET, billedCostUsd: 0 }).success).toBe(true);
    expect(wireTicketSchema.safeParse({ ...TICKET, billedCostUsd: 'n/a' }).success).toBe(false);
  });

  test('the row names no vendor and counts no unpriced run', () => {
    // A ticket file records ONE figure and cannot see its own incompleteness — measured across this
    // repository, every history entry that carries a cost carries a number, so a count of null ones
    // is zero for every ticket here and would assert "nothing unpriced" beside a legend saying a
    // token-only vendor is excluded. What names the gap is the legend, and a field that could not
    // help doing it would be a second, contradictory claim on the same card.
    const declaration = sharedSourceFiles().find(([name]) => name === 'wire.ts')?.[1] ?? '';
    expect(declaration, 'wire.ts is not in the corpus — this check has lost its subject').not.toBe('');
    const body = /export interface WireTicket \{([\s\S]*?)\n\}/.exec(declaration)?.[1] ?? '';
    expect(body.length, 'the WireTicket declaration was not found').toBeGreaterThan(50);
    for (const forbidden of [/unpriced/i, /vendor/i, /perVendor/i, /tokens/i]) {
      expect(forbidden.test(body), `WireTicket declares a field matching ${String(forbidden)}`).toBe(false);
    }
    // The fields it does declare, as an identity: a count would be satisfied by a swap.
    const fields = [...body.matchAll(/^\s*readonly ([A-Za-z]+)[?:]/gm)].map((match) => match[1]);
    expect(fields).toStrictEqual([
      'id', 'folder', 'title', 'stage', 'owner', 'branch', 'containment', 'iterations', 'billedCostUsd',
    ]);
    // …and the needle finds one when it is there, so the emptiness above is an absence.
    expect(/unpriced/i.test('  readonly unpricedRuns: number;')).toBe(true);
  });
});
