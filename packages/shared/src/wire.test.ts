import { describe, expect, test } from 'vitest';
import { z } from 'zod';

import { repoFile, sharedSourceFiles } from '../test/corpus.js';
import { gateQuestionEventSchema } from './events.js';
import {
  containmentResultSchema, pushLagResultSchema, WIRE_RUN_STATES, wireExcludedFilesSchema,
  wireFlowListSchema, wireFlowSchema, wireMessageSchema, wireRefusalSchema, wireRunHistorySchema,
  wireRunListSchema,
  wireRunSchema, wireRunStateSchema, wireTicketDetailSchema, wireTicketFileEntrySchema,
  wireTicketFileSchema, wireTicketListSchema, wireTicketSchema, WIRE_START_FIELDS,
  wireStartRequestSchema, type WireRun, type WireStartRequest,
} from './wire.js';
import { ticketSchema } from './ticket.js';
import * as shared from './index.js';

/** One gate question, in the shape `askGate` emits — the element `WireRun.gates` carries. */
const QUESTION = {
  type: 'gate', gateId: '3:1', kind: 'human', reason: 'chore: approve to advance ticket to "reviewed"',
  ticketDir: '/repo/backlog/Q-0016-a-ticket',
} as const;

/** One run row that every clause below starts from, so a refusal is the one field it changed. */
const RUN = {
  handle: 'run-7', flow: 'probe', ticketId: 'T-0001', runId: null, dry: false, state: 'running',
  pendingGates: 1, gates: [QUESTION], refusal: null,
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
    expect(wireRunSchema.safeParse({ ...RUN, ticketId: null, runId: 3, state: 'ended', pendingGates: 0, gates: [] }).success).toBe(true);
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

describe('Q-0130 AC-1 — the start request is declared here, once, with a schema', () => {
  test('the barrel publishes the tuple and the schema', () => {
    // The **type** adds no runtime key, so what a runtime check can see is these two — which is the
    // half that matters, a moved type with no schema being exactly the half-measure Q-0120 had to
    // repair. That the type is exported is proven by this file compiling against it below.
    const published = shared as unknown as Record<string, unknown>;
    expect(published.WIRE_START_FIELDS, 'the field tuple is not on the barrel').toStrictEqual(WIRE_START_FIELDS);
    expect(typeof published.wireStartRequestSchema, 'the schema is not on the barrel').toBe('object');
  });

  test('the five field names are an identity in the route\'s own order', () => {
    // An identity rather than a count, and ORDERED rather than a set: `startRequestOf`'s
    // `unknown-field` remedy spells this out for a human — *"this route accepts flow, ticket, dry,
    // auto, base"* — so a reordering changes a sentence somebody reads. `http.test.ts` is what
    // holds that sentence against this tuple from the other side.
    expect([...WIRE_START_FIELDS]).toStrictEqual(['flow', 'ticket', 'dry', 'auto', 'base']);
    // …and the tuple names exactly the schema's own keys, in both directions, so a sixth field
    // added to one of them cannot be silently absent from the other.
    const declared = Object.keys((wireStartRequestSchema as unknown as { shape: Record<string, unknown> }).shape);
    expect(declared.slice().sort(), 'the tuple and the schema declare different fields')
      .toStrictEqual([...WIRE_START_FIELDS].sort());
  });

  test('the two required fields are required, the other three optional, and nothing else accepted', () => {
    const minimal: WireStartRequest = { flow: 'chore', ticket: 'Q-0130' };
    expect(wireStartRequestSchema.safeParse(minimal).success).toBe(true);
    expect(wireStartRequestSchema.safeParse({ ...minimal, dry: true, auto: false, base: 'main' }).success).toBe(true);
    expect(codesOf(wireStartRequestSchema.safeParse({ flow: 'chore' }))).toStrictEqual(['invalid_type']);
    expect(codesOf(wireStartRequestSchema.safeParse({ ...minimal, dry: 'yes' }))).toStrictEqual(['invalid_type']);
    // `.strict()`, for the reason the route already gives: a client that misspells `ticket` is told
    // so rather than given a run it did not ask for.
    expect(codesOf(wireStartRequestSchema.safeParse({ ...minimal, tickett: 'x' })))
      .toStrictEqual(['unrecognized_keys']);
  });

  test('and it checks the SHAPE rather than the route\'s own predicate, deliberately', () => {
    // An empty `ticket` parses here and is refused `missing-field` by `startRequestOf`, which is
    // the split the schema's own docblock states: the route composes a refusal a caller reads, and
    // a second non-emptiness rule here would answer the same question in a different vocabulary and
    // be free to disagree. Stated as a property so a later edit that "tightens" it is a visible act.
    expect(wireStartRequestSchema.safeParse({ flow: 'chore', ticket: '   ' }).success,
      'the wire schema took over the route\'s own emptiness predicate').toBe(true);
  });
});

describe('Q-0016 AC-1 — a run row carries the questions its gates are asking', () => {
  test('one question crosses whole, and two cross in the order they were asked', () => {
    // The field is what makes a gate ANSWERABLE from a browser: `gateId` is the token an answer has
    // to echo, and `retry` is what says whether the third answer is one this gate will honour.
    const parsed = wireRunSchema.safeParse(RUN);
    expect(parsed.error?.issues, 'a row carrying a gate question was refused').toBeUndefined();
    if (!parsed.success) return;
    expect(parsed.data.gates).toStrictEqual([QUESTION]);

    const second = { ...QUESTION, gateId: '3:2', kind: 'human-locked', retry: 'implement' };
    const two = wireRunSchema.safeParse({ ...RUN, pendingGates: 2, gates: [QUESTION, second] });
    expect(two.error?.issues).toBeUndefined();
    if (!two.success) return;
    expect(two.data.gates.map((gate) => gate.gateId), 'the questions did not keep their order')
      .toStrictEqual(['3:1', '3:2']);
    expect(two.data.gates[1]?.retry, 'the retry target did not cross').toBe('implement');
    // …and a run with nothing waiting carries the empty array rather than omitting the field, which
    // is what lets a screen switch on it without asking whether it is there.
    expect(wireRunSchema.safeParse({ ...RUN, pendingGates: 0, gates: [] }).success).toBe(true);
    expect(wireRunSchema.safeParse({ handle: 'r', flow: 'f', ticketId: null, runId: null, state: 'ended', pendingGates: 0 }).success,
      'a row omitting the field entirely was accepted').toBe(false);
  });

  test('Q-0135 AC-8 — a row says whether it is a dry walk, and omitting the field is refused', () => {
    // **Required and not optional**, which is the half a default would take away: an omitted field
    // reads as *nothing was said*, and `false` is the value that composes a history id. The hazard
    // is a wrong answer rather than a missing one — a walk and the next real run of the same ticket
    // are allocated the same number, `nextRunId` reserving nothing — so a reader that inferred
    // dryness from a 404 would be right about the case it can already see and wrong about the other.
    const walk = wireRunSchema.safeParse({ ...RUN, dry: true });
    expect(walk.error?.issues, 'a row reporting a dry walk was refused').toBeUndefined();
    expect(walk.success && walk.data.dry, 'the field did not cross').toBe(true);
    const { dry: _omitted, ...withoutDry } = RUN;
    expect(wireRunSchema.safeParse(withoutDry).success, 'a row omitting the field entirely was accepted')
      .toBe(false);
    expect(wireRunSchema.safeParse({ ...RUN, dry: 'true' }).success, 'a row carrying a string was accepted')
      .toBe(false);
    // …and the name is permitted by Q-0121 GO-3's rule rather than in spite of it: it narrows no
    // `RunView` field, `RunView.dry` being the same boolean under the same name.
    expect(WIRE_START_FIELDS, 'the word crosses in one direction only').toContain('dry');
  });

  test('the element is the event union\'s own schema, not a second declaration of those six fields', () => {
    // A re-declaration is free to drift the moment either end gains a field, and the question a
    // browser echoes back has to be the question `askGate` emitted. Asserted two ways: the same
    // schema refuses what the element refuses, and this file declares no gate shape of its own.
    const notAQuestion = { ...QUESTION, type: 'info' };
    expect(gateQuestionEventSchema.safeParse(notAQuestion).success, 'the element schema accepts a non-gate').toBe(false);
    expect(wireRunSchema.safeParse({ ...RUN, gates: [notAQuestion] }).success,
      'a row carried an event that is not a gate question').toBe(false);
    expect(wireRunSchema.safeParse({ ...RUN, gates: [{ ...QUESTION, surprise: true }] }).success,
      'a question carrying a field the union does not declare was accepted').toBe(false);
    const source = sharedSourceFiles().find(([name]) => name === 'wire.ts')?.[1] ?? '';
    expect(source, 'wire.ts is not in the corpus — this clause has lost its subject').not.toBe('');
    // The needle is a DECLARATION rather than the name, in the shape `apps/web`'s own scan uses:
    // `type GateQuestionEvent }` in an import list is a reference, and reporting it would make this
    // clause fail on the very line that proves the shape is imported rather than re-declared.
    const declares = /\b(?:interface|type)\s+GateQuestion\w*\s*[={]/;
    expect(declares.test(source), 'wire.ts declares a gate shape of its own').toBe(false);
    expect(declares.test(`export interface ${'GateQuestion'}Event { gateId: string }`),
      'the needle matches no declaration at all').toBe(true);
    expect(source, 'wire.ts builds a gate shape rather than reusing the event union\'s')
      .toContain('gateQuestionEventSchema');
  });

  test('a refused row carries the daemon\'s own reason, and it is not a WireRefusal', () => {
    // AC-10's `refused` state has to report the daemon's own condition, and until this field a row
    // carried none — so the screen said it carried none, which is a surface admitting a gap with
    // the sentence one field away. What crosses is the host's `refusal` WHOLE: the condition in the
    // failing library's words and the remedy this transport composed.
    const refused = {
      ...RUN, state: 'refused', pendingGates: 0, gates: [],
      refusal: { condition: 'no ticket T-0404 in this backlog', remedy: 'point the server at a directory holding harness/harness.yaml' },
    };
    const parsed = wireRunSchema.safeParse(refused);
    expect(parsed.error?.issues, 'a refused row carrying its reason was refused').toBeUndefined();
    if (!parsed.success) return;
    expect(parsed.data.refusal?.condition).toBe('no ticket T-0404 in this backlog');
    expect(parsed.data.refusal?.remedy, 'the remedy the daemon composed did not cross').toContain('harness/harness.yaml');
    // A remedy of `null` is the ordinary case — this surface has nothing to add to the condition —
    // and it is nullable rather than optional for `wireRefusalSchema`'s own reason one level down.
    expect(wireRunSchema.safeParse({ ...refused, refusal: { condition: 'x', remedy: null } }).success).toBe(true);
    expect(wireRunSchema.safeParse({ ...refused, refusal: { condition: 'x' } }).success,
      'a refusal omitting the remedy was accepted').toBe(false);
    // And it is NOT a `WireRefusal`: that shape carries a `code` the transport picks a STATUS from,
    // and a run row is answered 200 — so a code here would attach a classification to a response
    // that never made one. Refused by `.strict()` rather than left to be added later by habit.
    expect(codesOf(wireRunSchema.safeParse({ ...refused, refusal: { code: 'no-such-ticket', condition: 'x', remedy: null } })))
      .toStrictEqual(['unrecognized_keys']);
    // The field is required and nullable, so *absent* is not a third answer beside *no refusal*.
    const { refusal: _dropped, ...withoutRefusal } = refused;
    expect(wireRunSchema.safeParse(withoutRefusal).success, 'a row omitting the field entirely was accepted').toBe(false);
  });

  test('the annotation is load-bearing in the direction it can be, and this says which', () => {
    // `wireRunSchema` is declared `z.ZodType<WireRun>` rather than inferred, so an interface field
    // with no schema field fails AT THE DECLARATION and not at whichever consumer reads it first.
    //
    // **What it does NOT catch is a schema field with no interface field**, and the first draft of
    // this clause asserted that it did — `tsc` refused the `@ts-expect-error` as unused, which is
    // the whole reason the claim is written out here rather than left as an impression: `ZodType`
    // is covariant in its output, so an object schema carrying an extra key is still assignable.
    // The half that refuses an undeclared key is `.strict()`, at run time, which the clause above
    // exercises over a real body. Two mechanisms, and neither is the other.
    const refusalField = z.object({ condition: z.string(), remedy: z.string().nullable() }).strict().nullable();
    const dropped = z.object({
      handle: z.string(), flow: z.string(), ticketId: z.string().nullable(),
      runId: z.number().int().nullable(), state: wireRunStateSchema,
      pendingGates: z.number().int().nonnegative(), refusal: refusalField,
    }).strict();
    // @ts-expect-error a schema omitting `gates` does not produce a WireRun, and fails at this line
    const refused: z.ZodType<WireRun> = dropped;
    expect(refused, 'the narrowed schema was not built — this demonstration has no subject').toBeDefined();
    const mistyped = z.object({
      handle: z.string(), flow: z.string(), ticketId: z.string().nullable(),
      runId: z.number().int().nullable(), state: wireRunStateSchema, refusal: refusalField,
      pendingGates: z.number().int().nonnegative(), gates: z.array(z.string()),
    }).strict();
    // @ts-expect-error and one whose `gates` is not the event union's own shape fails at it too
    const wrongElement: z.ZodType<WireRun> = mistyped;
    expect(wrongElement).toBeDefined();
    // And the shipped pair really does agree, which is what makes the two lines above refusals
    // rather than a claim that no schema is assignable at all.
    const accepted: z.ZodType<WireRun> = wireRunSchema;
    expect(accepted.safeParse(RUN).success).toBe(true);
  });
});

/** One ticket row every clause below starts from, so a refusal is the one field it changed. */
/**
 * One history response, in the shape `GET /history/:id` answers with — a whole manifest and all.
 *
 * Written out rather than read from `.quorum/runs`, and that is a rule rather than convenience:
 * that directory is gitignored and created by use, so a fixture taken from it would make this
 * clause's verdict a property of the checkout — which *"A test's verdict is a property of the
 * commit"* (2026-08-30) forbids. The route's OWN bytes are run through this schema in
 * `packages/server/src/read.test.ts`, over a run directory that suite builds.
 */
const HISTORY = {
  id: 'Q-0135-1',
  manifest: {
    schema_version: 1, run_id: 'Q-0135-1', ticket_id: 'Q-0135', ticket_path: 'backlog/Q-0135',
    flow: 'chore', flow_file: 'chore.yaml', stage: { before: 'requirements', after: null },
    started_at: '2026-09-18T01:00:00.000Z', ended_at: null, duration_ms: null, status: 'running',
    steps: [],
    rollup: [
      { vendor: 'claude', input_tokens: 10, output_tokens: 5, cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: 1.25, step_count: 2, unpriced_steps: 0 },
      { vendor: 'codex', input_tokens: 7, output_tokens: 3, cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: null, step_count: 1, unpriced_steps: 1 },
    ],
  },
  incomplete: true,
  tokensByVendor: { claude: 15, codex: 10 },
} as const;

describe('Q-0135 AC-9 — one shared schema for the history detail read', () => {
  test('the barrel publishes it, and it accepts a whole response including keys it does not name', () => {
    const published = shared as unknown as Record<string, unknown>;
    expect(typeof published.wireRunHistorySchema, 'the schema is not on the barrel').toBe('object');
    const parsed = wireRunHistorySchema.safeParse(HISTORY);
    expect(parsed.error?.issues, 'a whole history response was refused').toBeUndefined();
    if (!parsed.success) return;
    expect(parsed.data.manifest.rollup.map((row) => row.vendor), 'the roll-up did not cross in order')
      .toStrictEqual(['claude', 'codex']);
    expect(parsed.data.tokensByVendor.codex, 'a vendor token total did not cross').toBe(10);
  });

  test('every level is LOOSE, because this is a projection of a document core may widen', () => {
    // *"Unknown keys are refused where Quorum owns the key set, and preserved where it does not"*
    // (2026-08-25). A `.strict()` shape here would turn a manifest this product wrote into a
    // response a browser refuses — `readRun`'s own JSDoc calls the parsed document *"a cast, never
    // a check"*, and `steps` alone is fifteen keys per occurrence that nothing here reads.
    const wider = {
      ...HISTORY, warnings: [],
      manifest: { ...HISTORY.manifest, interrupted_by: 'SIGTERM' },
    };
    expect(wireRunHistorySchema.safeParse(wider).success, 'a response carrying an unknown key was refused')
      .toBe(true);
    const row = { ...HISTORY.manifest.rollup[0], vendor_display_name: 'Claude' };
    expect(wireRunHistorySchema.safeParse({ ...HISTORY, manifest: { ...HISTORY.manifest, rollup: [row] } }).success,
      'a roll-up row carrying an unknown key was refused').toBe(true);
  });

  test('the ELEMENTS are guarded and not only the array, which is the half read.ts needed twice', () => {
    // `Array.isArray` alone lets `[1, 2, 3]` through, and a number has no `vendor` — the guard that
    // route's review moved from the `.map` to inside it. Met here rather than rediscovered.
    for (const rollup of [null, {}, 'claude', [1, 2, 3], [{ vendor: 7 }], [{ ...HISTORY.manifest.rollup[0], vendor: null }]]) {
      expect(wireRunHistorySchema.safeParse({ ...HISTORY, manifest: { ...HISTORY.manifest, rollup } }).success,
        `a roll-up of ${JSON.stringify(rollup)} was accepted`).toBe(false);
    }
  });

  test('a count cannot be negative, a cost may be null and may not be a string, and a start is never empty', () => {
    const row = HISTORY.manifest.rollup[0];
    const withRow = (over: Record<string, unknown>): unknown =>
      ({ ...HISTORY, manifest: { ...HISTORY.manifest, rollup: [{ ...row, ...over }] } });
    expect(wireRunHistorySchema.safeParse(withRow({ step_count: -1 })).success, 'a negative step count was accepted').toBe(false);
    expect(wireRunHistorySchema.safeParse(withRow({ unpriced_steps: 1.5 })).success, 'a fractional count was accepted').toBe(false);
    expect(wireRunHistorySchema.safeParse(withRow({ cost_usd: null })).success, 'an unpriced row was refused').toBe(true);
    expect(wireRunHistorySchema.safeParse(withRow({ cost_usd: '1.25' })).success, 'a string cost was accepted').toBe(false);
    const withManifest = (over: Record<string, unknown>): unknown => ({ ...HISTORY, manifest: { ...HISTORY.manifest, ...over } });
    expect(wireRunHistorySchema.safeParse(withManifest({ started_at: '' })).success, 'an empty start instant was accepted').toBe(false);
    expect(wireRunHistorySchema.safeParse(withManifest({ duration_ms: -1 })).success, 'a negative duration was accepted').toBe(false);
    expect(wireRunHistorySchema.safeParse(withManifest({ duration_ms: null, ended_at: null })).success,
      'a run still going was refused').toBe(true);
    // **`status` is a plain string and not an enum**, on `WireTicket`'s rule: refusing a value this
    // vocabulary does not know would refuse a document this product itself wrote.
    expect(wireRunHistorySchema.safeParse(withManifest({ status: 'a-status-nobody-declared' })).success,
      'an unfamiliar status was refused').toBe(true);
    // …and a token total may be `null`, which is the `n/a`-never-`0` rule on the wire.
    expect(wireRunHistorySchema.safeParse({ ...HISTORY, tokensByVendor: { codex: null } }).success,
      'a vendor reporting no token measure was refused').toBe(true);
    expect(wireRunHistorySchema.safeParse({ ...HISTORY, tokensByVendor: { codex: -1 } }).success,
      'a negative token total was accepted').toBe(false);
  });
});

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

describe('Q-0127 AC-7 — the two shapes a ticket page reads, each with a schema', () => {
  /** One detail body, so a refusal below is the one thing it changed. */
  const DETAIL = {
    ticket: TICKET,
    files: [
      { rel: 'dev/chore/run-2/implement-iter-1.md', bytes: 4096 },
      { rel: 'ticket.md', bytes: 812 },
    ],
    excluded: { count: 4, bytes: 9001 },
  };

  /** One file body. */
  const FILE = { rel: 'ticket.md', bytes: 6, text: 'body\n\n' };

  test('the barrel publishes both schemas, executable by a browser', () => {
    const published = shared as unknown as Record<string, unknown>;
    for (const name of [
      'wireTicketDetailSchema', 'wireTicketFileSchema', 'wireTicketFileEntrySchema',
      'wireExcludedFilesSchema',
    ]) {
      expect(typeof published[name], `${name} is not on the barrel`).toBe('object');
    }
  });

  test('a live-shaped detail is accepted, a folder holding nothing else included', () => {
    expect(wireTicketDetailSchema.safeParse(DETAIL).success).toBe(true);
    expect(wireTicketDetailSchema.safeParse({ ...DETAIL, files: [], excluded: { count: 0, bytes: 0 } }).success,
      'a ticket whose folder the route could name nothing in is not a malformed answer').toBe(true);
    expect(wireTicketFileSchema.safeParse(FILE).success).toBe(true);
    expect(wireTicketFileSchema.safeParse({ ...FILE, bytes: 0, text: '' }).success, 'an empty file was refused').toBe(true);
  });

  test('each refuses an unknown key, a missing field and a wrong type, distinguishably', () => {
    // Three refusals rather than one, because a client that cannot tell them apart cannot tell
    // "this daemon is newer than this page" from "that answer is not the shape it claims".
    expect(codesOf(wireTicketDetailSchema.safeParse({ ...DETAIL, pushLag: null })))
      .toStrictEqual(['unrecognized_keys']);
    const { excluded: _excluded, ...withoutExcluded } = DETAIL;
    expect(codesOf(wireTicketDetailSchema.safeParse(withoutExcluded))).toContain('invalid_type');
    expect(codesOf(wireTicketDetailSchema.safeParse({ ...DETAIL, files: 'two' }))).toContain('invalid_type');

    expect(codesOf(wireTicketFileSchema.safeParse({ ...FILE, encoding: 'utf8' })))
      .toStrictEqual(['unrecognized_keys']);
    const { text: _text, ...withoutText } = FILE;
    expect(codesOf(wireTicketFileSchema.safeParse(withoutText))).toContain('invalid_type');
    expect(codesOf(wireTicketFileSchema.safeParse({ ...FILE, bytes: '6' }))).toContain('invalid_type');
  });

  test('a byte count is a non-negative integer, and a listed file carries no text', () => {
    // The entry is where a cap would otherwise live: a size a reader is shown before asking for the
    // file. A negative or fractional one is not a size any `stat` produced.
    for (const bytes of [-1, 1.5, '4096']) {
      expect(wireTicketFileEntrySchema.safeParse({ rel: 'ticket.md', bytes }).success,
        `a size of ${JSON.stringify(bytes)} was accepted`).toBe(false);
    }
    expect(codesOf(wireTicketFileEntrySchema.safeParse({ rel: 'ticket.md', bytes: 1, text: 'x' })),
      'a listed file carried its own text, which is the payload this shape exists to keep off the wire')
      .toStrictEqual(['unrecognized_keys']);
    for (const count of [-1, 2.5]) {
      expect(wireExcludedFilesSchema.safeParse({ count, bytes: 0 }).success,
        `an excluded count of ${String(count)} was accepted`).toBe(false);
    }
  });

  test('the detail carries the listing\'s ticket shape rather than a second one', () => {
    // The whole point of the field: one projection, so a board row and a page header cannot report
    // one ticket two ways. A row the LISTING schema refuses is refused here too.
    expect(wireTicketDetailSchema.safeParse({ ...DETAIL, ticket: { ...TICKET, cost: 1 } }).success,
      'the nested ticket is not the listing\'s own shape').toBe(false);
    expect(wireTicketDetailSchema.safeParse({
      ...DETAIL, ticket: { ...TICKET, containment: { state: 'contained', ahead: 3 } },
    }).success, 'a containment answer git cannot produce was accepted inside a detail').toBe(false);
  });

  test('and both are declared here, which is the half a re-export alone does not say', () => {
    // The other direction — that no consumer declares one of its own — is asserted in each consumer
    // over its own corpus: `packages/server/src/package.test.ts` and `apps/web/test/source.test.ts`.
    // It sits there rather than here because a scan reaching into another package would earn this
    // task two turbo inputs for one assertion each of those suites can make from files it already
    // reads.
    const declaration = sharedSourceFiles().find(([name]) => name === 'wire.ts')?.[1] ?? '';
    expect(declaration, 'wire.ts is not in the corpus — this check has lost its subject').not.toBe('');
    for (const shape of ['WireTicketDetail', 'WireTicketFile', 'WireTicketFileEntry', 'WireExcludedFiles']) {
      expect(declaration, `${shape} is not declared here`).toMatch(new RegExp(`export interface ${shape} \\{`));
    }
  });
});

describe('Q-0127 AC-14(a) — a commit count on the wire cannot be negative', () => {
  test('both ahead counts refuse -1 and accept 0, as their two siblings in this file already did', () => {
    // `rev-list --count` answers a count of commits, and this schema is the only thing between a
    // misread probe and a rendered figure. `count` and `pendingGates` carried `.nonnegative()` and
    // these two did not, so a reader comparing the four learnt the wrong rule about which of them
    // are constrained.
    expect(containmentResultSchema.safeParse({ state: 'not-contained', ahead: 0 }).success).toBe(true);
    expect(containmentResultSchema.safeParse({ state: 'not-contained', ahead: -1 }).success,
      'a containment answer claiming a negative count of commits was accepted').toBe(false);
    expect(pushLagResultSchema.safeParse({ state: 'unpushed', ahead: 0, upstream: 'origin/main' }).success).toBe(true);
    expect(pushLagResultSchema.safeParse({ state: 'unpushed', ahead: -1, upstream: 'origin/main' }).success,
      'a push-lag answer claiming a negative count of commits was accepted').toBe(false);
    // …and the refusal names the field, so the two are told apart in a message rather than by
    // position.
    const refusal = containmentResultSchema.safeParse({ state: 'not-contained', ahead: -1 });
    expect((refusal.error?.issues ?? []).flatMap((issue) => issue.path)).toContain('ahead');
  });

  test('the annotations still hold, which is what makes this a narrowing rather than a rewrite', () => {
    // The two schemas are annotated `z.ZodType<ContainmentResult>` and `z.ZodType<PushLagResult>`,
    // so a narrowing that changed the SHAPE would fail to compile at its own declaration. This is
    // the runtime half: every state either union can produce is still accepted.
    for (const answer of [{ state: 'contained' }, { state: 'indeterminate', reason: 'no branch' }]) {
      expect(containmentResultSchema.safeParse(answer).success, `${JSON.stringify(answer)} was refused`).toBe(true);
    }
    for (const answer of [{ state: 'pushed' }, { state: 'indeterminate', reason: 'no remote' }]) {
      expect(pushLagResultSchema.safeParse(answer).success, `${JSON.stringify(answer)} was refused`).toBe(true);
    }
  });
});

describe("Q-0135 GO-4 hand pass — a vendor's billed cost on the wire cannot be negative", () => {
  test('cost_usd refuses -1 while keeping null and a genuine 0, as its two siblings already did', () => {
    // Found by the hand pass GO-4 requires over the files the review diff omitted: `wire.ts` and
    // `wire.test.ts` were cut whole from rounds 3 and 4, and this schema is what the cut hid. Inside
    // ONE object `unpriced_steps` and `step_count` carried `.int().nonnegative()` and `duration_ms`
    // beside them `.nonnegative().nullable()`, while `cost_usd` carried no range at all — so a
    // reader comparing the four learnt the wrong rule about which are constrained. Q-0017's hand
    // pass found the same asymmetry in the two `ahead` counts and Q-0127 AC-14(a) above closed it.
    const row = (cost_usd: unknown): unknown => ({
      manifest: {
        started_at: '2026-09-18T01:00:00.000Z', ended_at: null, duration_ms: null, status: 'running',
        rollup: [{ vendor: 'zeta', cost_usd, unpriced_steps: 0, step_count: 1 }],
      },
      incomplete: true,
      tokensByVendor: { zeta: 10 },
    });
    expect(wireRunHistorySchema.safeParse(row(-1)).success,
      'a roll-up row claiming a negative billed cost was accepted').toBe(false);
    // **Both survivors matter and neither is incidental.** `null` is *the vendor reported no price*
    // and `0` is *it reported zero*, which `rollup()`'s own JSDoc keeps apart — so a narrowing that
    // took either would be the `n/a`-never-`0` rule broken from the other side.
    expect(wireRunHistorySchema.safeParse(row(null)).success, 'an unpriced vendor was refused').toBe(true);
    expect(wireRunHistorySchema.safeParse(row(0)).success, 'a genuinely reported zero was refused').toBe(true);
    expect(wireRunHistorySchema.safeParse(row(1.25)).success, 'an ordinary priced row was refused').toBe(true);
    // …and the refusal names the field, so it is told from its siblings in a message.
    expect((wireRunHistorySchema.safeParse(row(-1)).error?.issues ?? []).flatMap((issue) => issue.path))
      .toContain('cost_usd');
  });
});
