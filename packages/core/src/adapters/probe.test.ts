// Q-0046 AC-8, AC-9 and AC-11 defect 1: the schema Quorum sends a vendor, and the one round-trip
// that proves a login.
//
// NO TEST HERE MAKES A PAID REQUEST. Every subject is the mock or a local stub; nothing spawns a
// CLI, reads an API key or reaches a vendor. That is not a convenience — `probeAdapter` is the only
// authenticated request in the package, so a suite that could reach one would be charging the
// machine that runs `pnpm test`.
//
// Covers spike/test/smoke.js:150 and :173-176, and the PROBE_SCHEMA half of
// spike/test/q0034-probe-schema.js. The `schemaFor` half of that file stays with the spike until
// Q-0052 ports the generator — deferred with a named owner, not covered here.
import fs from 'node:fs';

import { afterAll, describe, expect, test } from 'vitest';

import { PROBE_SCHEMA, probeAdapter, withRetry } from './adapters.js';
import type { Adapter, AdapterResult, AdapterRunOptions } from './adapters.js';
import { mockAdapter } from './mock.js';
import { removeTempDirs, tempDir, walk } from '../../test/repo.js';
import { strictSchemaProblems } from '../../test/strict-schema.js';

afterAll(removeTempDirs);

const answer = (over: Partial<AdapterResult> = {}): AdapterResult => ({
  output: { ok: true, summary: 'subscription answered' },
  raw: '{"ok": true, "summary": "subscription answered"}',
  usage: { vendor: 'test', input_tokens: 40, output_tokens: 12, cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: 0.39 },
  session: 'session-1',
  vendor: 'test',
  ms: 1,
  ...over,
});

/** A stub that records what it was invoked with, so "exactly once" and "which cwd" are observable. */
const stub = (run: (options: AdapterRunOptions) => Promise<AdapterResult>): Adapter & { seen: AdapterRunOptions[]; checks: number } => {
  const self = {
    vendor: 'test',
    seen: [] as AdapterRunOptions[],
    checks: 0,
    async check(): Promise<string> { self.checks += 1; return 'test stub'; },
    async run(options: AdapterRunOptions): Promise<AdapterResult> { self.seen.push(options); return run(options); },
  };
  return self;
};

describe('AC-8 — the rule that broke the probe is executable', () => {
  test('PROBE_SCHEMA closes itself and requires every property it declares', () => {
    expect(strictSchemaProblems(PROBE_SCHEMA, 'PROBE_SCHEMA')).toStrictEqual([]);
    expect(PROBE_SCHEMA.additionalProperties).toBe(false);
    expect(Object.keys(PROBE_SCHEMA.properties ?? {})).toStrictEqual(['ok', 'summary']);
    expect(PROBE_SCHEMA.required).toStrictEqual(['ok', 'summary']);
  });

  test('and the rule can fire — the schema that shipped before Q-0034 fails it', () => {
    // Exactly the defect: `summary` declared, only `ok` required, so codex rejected the schema and
    // the error read as a broken login.
    const problems = strictSchemaProblems({ properties: { ok: {}, summary: {} }, required: ['ok'], additionalProperties: false }, 'the old one');
    expect(problems).toStrictEqual(['the old one: every property must appear in required (codex rejects the schema otherwise): summary']);
    expect(strictSchemaProblems({ properties: { ok: {} }, required: ['ok'] }, 'open')).toStrictEqual(['open: additionalProperties must be false']);
  });
});

describe('AC-9 — probeAdapter is the only proof of a login, and it is the same probe', () => {
  test('one call, with the probe prompt, no writes, and nothing to read', async () => {
    const adapter = stub(async () => answer());
    const result = await probeAdapter(adapter);

    expect(adapter.seen).toHaveLength(1);
    expect(adapter.checks).toBe(0);
    const [options] = adapter.seen;
    expect(options.schema).toBe(PROBE_SCHEMA);
    expect(options.prompt).toContain('Reply with exactly this JSON and nothing else');
    expect(options.allowWrite).toBe(false);
    expect(options.extraDirs).toStrictEqual([]);
    expect(options.onEvent).toBeUndefined();
    expect(options.maxTurns).toBeUndefined();
    expect(result).toStrictEqual({ ok: true, vendor: 'test', ms: expect.any(Number), cost_usd: 0.39, tokens: 52, session: 'session-1' });
  });

  test('an unreported measure counts as zero tokens rather than as a missing answer', async () => {
    const result = await probeAdapter(stub(async () => answer({
      usage: { vendor: 'test', input_tokens: null, output_tokens: 12, cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: null },
    })));
    expect(result).toMatchObject({ ok: true, cost_usd: null, tokens: 12 });
  });

  test('the probe runs the mock end to end', async () => {
    // spike/test/smoke.js:150 — the one case that exercises a whole adapter rather than a stub.
    expect((await probeAdapter(mockAdapter({ delayMs: 0 }))).ok).toBe(true);
  });

  test('an invalid structured tail is reported as invalid output, with the answer kept', async () => {
    const result = await probeAdapter(stub(async () => answer({ output: { ok: true }, raw: 'x'.repeat(600) })));
    expect(result).toMatchObject({ ok: false, error: 'structured output invalid (missing "summary")' });
    expect(result.ok === false && result.raw).toHaveLength(400);
  });

  test('a dead login is translated, not reported as a stack trace', async () => {
    // spike/test/smoke.js:173-176, with the real codex sentence.
    const real = 'ERROR codex_login::auth::manager: Failed to refresh token: Your access token could not be refreshed because your refresh token was already used. Please log out and sign in again.';
    const broken: Adapter = { vendor: 'codex', async check() { return 'x'; }, async run() { throw new Error(real); } };
    const result = await probeAdapter(broken);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain('logout');
  });

  test('a failure it cannot translate is passed through in the vendor\'s own words', async () => {
    const result = await probeAdapter(stub(async () => { throw new Error('codex exited 1: compile error in foo.ts'); }));
    expect(result).toMatchObject({ ok: false, error: 'codex exited 1: compile error in foo.ts' });
  });

  test('a directory it created is removed on the success path, and a supplied one is left alone', async () => {
    const supplied = tempDir('probe-supplied-');
    const adapter = stub(async () => answer());

    await probeAdapter(adapter, { cwd: supplied });
    expect(fs.existsSync(supplied)).toBe(true);
    expect(walk(supplied)).toStrictEqual([]);
    expect(adapter.seen[0].cwd).toBe(supplied);

    await probeAdapter(adapter);
    expect(fs.existsSync(adapter.seen[1].cwd)).toBe(false);
    expect(adapter.seen[1].cwd).not.toBe(supplied);
  });

  test('and on the throw path too', async () => {
    const supplied = tempDir('probe-supplied-throw-');
    const adapter = stub(async () => { throw new Error('401 Unauthorized'); });

    await probeAdapter(adapter, { cwd: supplied });
    expect(fs.existsSync(supplied)).toBe(true);

    await probeAdapter(adapter);
    expect(fs.existsSync(adapter.seen[1].cwd)).toBe(false);
  });

  test('a named model is forwarded, and an unnamed one is left for the CLI to choose', async () => {
    const adapter = stub(async () => answer());
    await probeAdapter(adapter, { model: 'opus' });
    await probeAdapter(adapter);
    expect(adapter.seen.map((options) => options.model)).toStrictEqual(['opus', undefined]);
  });
});

describe('AC-11 defect 1 — the probe blames the login for its own crash', () => {
  test('an adapter whose login is perfect, and which reports no usage, reads as unusable', async () => {
    // `withRetry` answers `usage: null` when no attempt reported a measure (AC-4), and the three
    // reads in `probeAdapter` are unguarded. The two behaviours are each correct and compose into
    // this. Preserved on purpose: the spike still does it, and a quiet fix here would leave both
    // suites green over a product that disagrees with itself. Proposed as its own ticket.
    const quiet = withRetry(stub(async () => answer({ usage: null })), { baseDelayMs: 0 });
    const result = await probeAdapter(quiet);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toBe("Cannot read properties of null (reading 'cost_usd')");
  });

  test('and the sandbox is still cleaned up when it crashes that way', async () => {
    const adapter = stub(async () => answer({ usage: null }));
    await probeAdapter(withRetry(adapter, { baseDelayMs: 0 }));
    expect(fs.existsSync(adapter.seen[0].cwd)).toBe(false);
  });
});
