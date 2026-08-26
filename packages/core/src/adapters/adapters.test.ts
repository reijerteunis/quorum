// Q-0046 AC-2, AC-3, AC-4, AC-5 and AC-11 defects 2 and 3: the registry, the retry policy and the
// classification of a failure.
//
// Written fresh against the ported code rather than transcribed from spike/test/smoke.js, which
// stays where it is and keeps running (charter §3). Its subjects are covered here: the five
// retryable and four non-retryable strings at smoke.js:451-469, the accumulate-across-attempts and
// give-up cases at :477-503, and q0011-run-history.js:144-148's cache accounting.
//
// No test waits on a production default: every retry test names its own `baseDelayMs`, and the two
// that assert the SCHEDULE use single-digit milliseconds so the numbers are checkable without the
// 5s/10s/20s/40s the defaults would cost.
import os from 'node:os';

import { adapterEventSchema, retryEventSchema } from '@quorum/shared';
import type { AdapterEvent } from '@quorum/shared';
import { describe, expect, test } from 'vitest';

import { authError, getAdapter, transientError, withRetry } from './adapters.js';
import type { Adapter, AdapterError, AdapterResult, AdapterRunOptions, AdapterSchema } from './adapters.js';
import { mockAdapter } from './mock.js';
import { withEnv } from '../../test/env.js';

const PLAIN_SCHEMA: AdapterSchema = {
  type: 'object',
  properties: { summary: { type: 'string' } },
  required: ['summary'],
  additionalProperties: false,
};

const runOptions = (over: Partial<AdapterRunOptions> = {}): AdapterRunOptions => ({
  prompt: '# Role: tester', schema: PLAIN_SCHEMA, cwd: os.tmpdir(), allowWrite: false, ...over,
});

const answer = (over: Partial<AdapterResult> = {}): AdapterResult => ({
  output: { summary: 'ok' }, raw: '{}', usage: null, session: null, vendor: 'test', ms: 1, ...over,
});

/** A stub adapter that counts its own invocations, so "called exactly once" is observable. */
const stub = (run: (options: AdapterRunOptions) => Promise<AdapterResult>, vendor = 'test'): Adapter & { runs: number; checks: number } => {
  const self = {
    vendor,
    runs: 0,
    checks: 0,
    async check(): Promise<string> { self.checks += 1; return `${vendor} stub`; },
    async run(options: AdapterRunOptions): Promise<AdapterResult> { self.runs += 1; return run(options); },
  };
  return self;
};

const thrown = async (fn: () => Promise<unknown>): Promise<AdapterError> => {
  try {
    await fn();
  } catch (e) {
    return e as AdapterError;
  }
  throw new Error('expected a throw, and nothing was thrown');
};

describe('AC-2 — the contract is a type a contributor can implement against', () => {
  // Compile-time first: this object exists to be type-checked. It names a vendor that ships no
  // adapter, which is the point — `vendor` is an open string and a third adapter needs nothing in
  // this file or in `packages/shared` edited to exist (register row 22).
  const contributor: Adapter = {
    vendor: 'gemini',
    async check(): Promise<string> { return 'gemini 0.0.0'; },
    async run({ onEvent }): Promise<AdapterResult> {
      onEvent?.({ type: 'spawn', vendor: 'gemini', cmd: 'gemini -p' });
      onEvent?.({ type: 'stdout', line: 'one line of the CLI\'s own output' });
      onEvent?.({ type: 'retry', vendor: 'gemini', attempt: 1, of: 5, delayMs: 0, reason: 'a timeout', message: 'timed out' });
      return answer({ vendor: 'gemini' });
    },
  };

  test('an adapter written against the exported types alone emits only events shared describes', async () => {
    const events: AdapterEvent[] = [];
    await contributor.run(runOptions({ onEvent: (event) => events.push(event) }));
    expect(events.map((event) => event.type)).toStrictEqual(['spawn', 'stdout', 'retry']);
    for (const event of events) expect(adapterEventSchema.safeParse(event).success, JSON.stringify(event)).toBe(true);
  });

  test('an event kind nothing emits is not a member, at compile time and at run time', () => {
    // @ts-expect-error `tool` has no producer and is deliberately absent (docs/DECISIONS.md, 2026-08-25).
    const invented: AdapterEvent = { type: 'tool', name: 'Read' };
    expect(adapterEventSchema.safeParse(invented).success).toBe(false);
  });

  test('every event the mock emits parses as an adapter event', async () => {
    const events: AdapterEvent[] = [];
    await mockAdapter({ delayMs: 0 }).run(runOptions({ prompt: '# Role: ac2-mock-events', onEvent: (event) => events.push(event) }));
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) expect(adapterEventSchema.safeParse(event).success, JSON.stringify(event)).toBe(true);
  });
});

describe('AC-3 — getAdapter resolves a name, and its registry is honest about being incomplete', () => {
  test('a known name returns a WRAPPED adapter, not the factory\'s own object', () => {
    const resolved = getAdapter('mock');
    expect(resolved.vendor).toBe('mock');
    expect(resolved.run).not.toBe(mockAdapter().run);
  });

  test('an unknown name names itself and lists what the registry actually holds', () => {
    let message = '';
    try {
      getAdapter('nope');
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/^unknown adapter "nope" \(known: .+\)$/);
    // Membership is NOT pinned here — it changes when Q-0047 lands its two adapters. What is pinned
    // is that the list is the registry's own keys: every name it prints must resolve.
    const listed = /\(known: (.+)\)$/.exec(message)?.[1].split(', ') ?? [];
    expect(listed.length).toBeGreaterThan(0);
    for (const name of listed) expect(getAdapter(name).vendor).toBe(name);
  });

  test('the entry for the named adapter reaches the factory', async () => {
    const started = Date.now();
    await getAdapter('mock', { mock: { delayMs: 60 } }).run(runOptions({ prompt: '# Role: ac3-factory-config' }));
    expect(Date.now() - started).toBeGreaterThanOrEqual(50);
  });

  test('and its `retry` reaches the wrapper', async () => {
    // MOCK_FAIL_WRITE makes the mock throw a message the caller chooses, so the thrown text can be
    // one `transientError` recognises — the only way to make the mock exercise the retry loop.
    const error = await withEnv({ MOCK_FAIL_WRITE: 'socket hang up' }, () => thrown(() => getAdapter('mock', {
      mock: { delayMs: 0, retry: { attempts: 2, baseDelayMs: 0 } },
    }).run(runOptions({ prompt: '# Role: ac3-wrapper-config — socket hang up' }))));
    expect(error.attempts).toBe(2);
    expect(error.message).toMatch(/\(gave up after 2 attempts\)$/);
  });
});

describe('AC-4 — withRetry is the whole retry policy, in one place', () => {
  test('a transient failure is retried until it succeeds, and every attempt is billed', async () => {
    const usage = { vendor: 'test', input_tokens: 10, output_tokens: 1, cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: 0.1 };
    const flaky = stub(async () => {
      if (flaky.runs < 3) {
        const error: AdapterError = new Error('API Error: Connection closed mid-response. The response above may be incomplete.');
        error.usage = usage;
        throw error;
      }
      return answer({ usage });
    });
    const events: AdapterEvent[] = [];
    const res = await withRetry(flaky, { attempts: 3, baseDelayMs: 0 }).run(runOptions({ onEvent: (event) => events.push(event) }));

    expect(flaky.runs).toBe(3);
    expect(res.attempts).toBe(3);
    expect(res.usage?.cost_usd).toBeCloseTo(0.3, 9);
    const retries = events.filter((event) => event.type === 'retry');
    expect(retries).toHaveLength(2);
    for (const event of retries) expect(retryEventSchema.safeParse(event).success, JSON.stringify(event)).toBe(true);
    expect(retries.map((event) => event.attempt)).toStrictEqual([1, 2]);
  });

  test('cache measures accumulate on their own and are never folded into input a second time', async () => {
    // spike/test/q0011-run-history.js:144-148, whose numbers are the point: three attempts of
    // {10, 2, 3, 1, 0.5} are 30/6/9/3, not 30 plus the nine cached tokens all over again.
    const usage = { vendor: 'claude', input_tokens: 10, output_tokens: 2, cached_input_tokens: 3, cache_write_input_tokens: 1, cost_usd: 0.5 };
    const flaky = stub(async () => {
      if (flaky.runs < 3) {
        const error: AdapterError = new Error('socket hang up');
        error.usage = usage;
        error.vendor = 'claude';
        throw error;
      }
      return answer({ vendor: 'claude', usage });
    }, 'claude');
    const res = await withRetry(flaky, { attempts: 3, baseDelayMs: 0, maxDelayMs: 0 }).run(runOptions());

    expect(res.attempts).toBe(3);
    expect(res.usage).toStrictEqual({ vendor: 'claude', input_tokens: 30, output_tokens: 6, cached_input_tokens: 9, cache_write_input_tokens: 3, cost_usd: 1.5 });
  });

  test('retries are bounded, the give-up is explicit, and the error carries what was spent', async () => {
    const usage = { vendor: 'claude', input_tokens: 10, output_tokens: 2, cached_input_tokens: 3, cache_write_input_tokens: 1, cost_usd: 0.5 };
    const dead = stub(async () => {
      const error: AdapterError = new Error('Error: socket hang up');
      error.usage = usage;
      error.vendor = 'claude';
      throw error;
    }, 'claude');
    const error = await thrown(() => withRetry(dead, { attempts: 3, baseDelayMs: 0, maxDelayMs: 0 }).run(runOptions()));

    expect(dead.runs).toBe(3);
    expect(error.message).toBe('Error: socket hang up (gave up after 3 attempts)');
    expect(error.attempts).toBe(3);
    expect(error.vendor).toBe('claude');
    expect(error.usage).toStrictEqual({ vendor: 'claude', input_tokens: 30, output_tokens: 6, cached_input_tokens: 9, cache_write_input_tokens: 3, cost_usd: 1.5 });
  });

  test('a deterministic failure is not retried once, and its message is left alone', async () => {
    const badLogin = stub(async () => { throw new Error('401 Unauthorized'); });
    const events: AdapterEvent[] = [];
    const error = await thrown(() => withRetry(badLogin, { attempts: 3, baseDelayMs: 0 }).run(runOptions({ onEvent: (event) => events.push(event) })));

    expect(badLogin.runs).toBe(1);
    expect(error.message).toBe('401 Unauthorized');
    expect(error.attempts).toBe(1);
    expect(events).toStrictEqual([]);
  });

  test('the last permitted attempt emits no retry event — there is nothing left to announce', async () => {
    const dead = stub(async () => { throw new Error('Error: socket hang up'); });
    const events: AdapterEvent[] = [];
    await thrown(() => withRetry(dead, { attempts: 2, baseDelayMs: 0 }).run(runOptions({ onEvent: (event) => events.push(event) })));
    expect(events.filter((event) => event.type === 'retry')).toHaveLength(1);
  });

  test('an unmeasured call reports usage: null rather than an object of five nulls', async () => {
    const quiet = stub(async () => answer({ usage: null }));
    const res = await withRetry(quiet, { attempts: 2, baseDelayMs: 0 }).run(runOptions());
    expect(res.usage).toBeNull();
    expect(res.attempts).toBe(1);
  });

  test('an unmeasured failure carries no usage and no vendor either', async () => {
    const quiet = stub(async () => { throw new Error('401 Unauthorized'); });
    const error = await thrown(() => withRetry(quiet, { attempts: 2, baseDelayMs: 0 }).run(runOptions()));
    expect(error.usage).toBeUndefined();
    expect(error.vendor).toBeUndefined();
  });

  test('one reported measure fills that one and leaves the other four null', async () => {
    const partial = stub(async () => answer({ usage: { vendor: 'test', input_tokens: 7, output_tokens: null, cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: null } }));
    const res = await withRetry(partial, { attempts: 2, baseDelayMs: 0 }).run(runOptions());
    expect(res.usage).toStrictEqual({ vendor: 'test', input_tokens: 7, output_tokens: null, cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: null });
  });

  test('a per-call vendor wins, and the adapter\'s own name is used only when a call omits one', async () => {
    const declaring = stub(async () => answer({ vendor: 'billed-elsewhere' }), 'adapter-name');
    expect((await withRetry(declaring, { baseDelayMs: 0 }).run(runOptions())).vendor).toBe('billed-elsewhere');

    // A contributor's adapter that omits the per-call declaration, which is the only case the
    // fallback exists for — both shipped adapters always declare one.
    const silent = stub(async () => {
      const { vendor: _undeclared, ...rest } = answer();
      return rest as AdapterResult;
    }, 'adapter-name');
    expect((await withRetry(silent, { baseDelayMs: 0 }).run(runOptions())).vendor).toBe('adapter-name');

    // And the usage's own declaration sits between the two.
    const viaUsage = stub(async () => {
      const { vendor: _undeclared, ...rest } = answer({ usage: { vendor: 'from-usage', input_tokens: 1, output_tokens: null, cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: null } });
      return rest as AdapterResult;
    }, 'adapter-name');
    expect((await withRetry(viaUsage, { baseDelayMs: 0 }).run(runOptions())).vendor).toBe('from-usage');
  });

  test('the retry event names the UNWRAPPED adapter, while the error names who was billed', async () => {
    const flaky = stub(async () => {
      const error: AdapterError = new Error('Error: socket hang up');
      error.vendor = 'billed-elsewhere';
      error.usage = { vendor: 'billed-elsewhere', cost_usd: 0.2 };
      throw error;
    }, 'adapter-name');
    const events: AdapterEvent[] = [];
    const error = await thrown(() => withRetry(flaky, { attempts: 2, baseDelayMs: 0 }).run(runOptions({ onEvent: (event) => events.push(event) })));

    const retry = events.find((event) => event.type === 'retry');
    expect(retry?.type === 'retry' && retry.vendor).toBe('adapter-name');
    expect(error.usage?.vendor).toBe('billed-elsewhere');
  });

  test('the announced message is truncated to 160 characters', async () => {
    const noisy = stub(async () => { throw new Error(`socket hang up ${'y'.repeat(400)}`); });
    const events: AdapterEvent[] = [];
    await thrown(() => withRetry(noisy, { attempts: 2, baseDelayMs: 0 }).run(runOptions({ onEvent: (event) => events.push(event) })));
    const retry = events.find((event) => event.type === 'retry');
    expect(retry?.type === 'retry' && retry.message.length).toBe(160);
  });

  test('the delay doubles per attempt and is capped', async () => {
    // Single-digit milliseconds: the SHAPE is the criterion and the production numbers would cost
    // 75 seconds to observe.
    const dead = stub(async () => { throw new Error('Error: socket hang up'); });
    const events: AdapterEvent[] = [];
    await thrown(() => withRetry(dead, { attempts: 5, baseDelayMs: 1, maxDelayMs: 3 }).run(runOptions({ onEvent: (event) => events.push(event) })));
    expect(events.filter((event) => event.type === 'retry').map((event) => event.delayMs)).toStrictEqual([1, 2, 3, 3]);
  });

  test('everything else about the adapter passes through, check() included', async () => {
    const raw = stub(async () => answer());
    const extended = { ...raw, capabilities: { jsonSchema: true } };
    const wrapped = withRetry(extended, { baseDelayMs: 0 });

    expect(wrapped.vendor).toBe('test');
    expect(await wrapped.check()).toBe('test stub');
    expect(raw.checks).toBe(1);
    expect((wrapped as unknown as { capabilities: { jsonSchema: boolean } }).capabilities).toStrictEqual({ jsonSchema: true });
  });
});

describe('AC-5 — the classification is what it is today, false positives included', () => {
  // spike/test/smoke.js:451-457. The last two are also the ordering proof: both 429 and 529 match
  // the bare status-code alternation further down the list, so a reordering that moved it up would
  // still retry them and would report "a server error" instead.
  test.each([
    ['API Error: Connection closed mid-response. The response above may be incomplete.', 'the connection closed mid-response'],
    ['Error: socket hang up', 'the socket hung up'],
    ['FetchError: request failed, reason: ECONNRESET', 'a network error'],
    ['529 overloaded_error: Overloaded', 'the vendor reporting overload'],
    ['429 rate_limit_error', 'a rate limit'],
  ])('worth retrying: %s', (message, description) => {
    expect(transientError(message)).toBe(description);
  });

  // spike/test/smoke.js:460-466. The first fixture is the message spike/src/adapters/claude.js:12
  // throws today, quoted verbatim so the classification is asserted over the real text; it calls the
  // product "Harness", which is the wording finding AC-12 reports and Q-0047 owns.
  test.each([
    'ANTHROPIC_API_KEY is set — unset it; Harness runs on subscription OAuth only',
    'codex: model "gpt-5" is not available on a ChatGPT subscription',
    'claude failed (exit 1, error_max_turns): reached the turn limit',
    'Invalid schema for response_format: additionalProperties is required',
  ])('not worth retrying: %s', (message) => {
    expect(transientError(message)).toBeNull();
  });

  test('an auth failure short-circuits before any transient pattern is tried', () => {
    // It contains "socket hang up", which would otherwise be retried five times over 75 seconds.
    expect(transientError('401 Unauthorized after socket hang up')).toBeNull();
  });

  test('no argument at all is not a failure worth retrying', () => {
    expect(transientError()).toBeNull();
  });

  test('the real codex refresh-token sentence becomes one actionable line', () => {
    const real = 'ERROR codex_login::auth::manager: Failed to refresh token: Your access token could not be refreshed because your refresh token was already used. Please log out and sign in again.';
    expect(authError('codex', real)).toBe('codex login expired or missing — run: codex logout && codex login');
  });

  test('a claude 401 is recognised, and a compile error is left alone', () => {
    expect(authError('claude', 'Error: 401 Unauthorized')).toBe('claude login expired or missing — run: claude  (then /login)');
    expect(authError('codex', 'codex exited 1: compile error in foo.ts')).toBeNull();
  });

  test('an unavailable model names the model and the subscription, and does not say to log in again', () => {
    const modelError = '{"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The \'gpt-5.2-codex\' model is not supported when using Codex with a ChatGPT account."}}';
    const translated = authError('codex', modelError) ?? '';
    expect(translated).toContain('gpt-5.2-codex');
    expect(translated).toContain('ChatGPT subscription');
    expect(translated).not.toMatch(/log ?out/i);
  });

  test('a vendor the map has never heard of still gets a next move — that is the inheritance', () => {
    expect(authError('gemini', '401 Unauthorized')).toBe('gemini login expired or missing — run: gemini login');
  });
});

describe('AC-11 — preserved defects, pinned so a later cleanup turns this suite red', () => {
  test('defect 2: a bare status code anywhere in a message is retried', () => {
    // A deterministic compile error, retried five times across 75 seconds because it mentions a line
    // number. The alternation is not narrowed here; it is Q-0046's to carry and somebody else's to fix.
    expect(transientError('TS2345: Type error in src/engine.ts:502:11')).toBe('a server error');
  });

  test('defect 3: the auth probe passes a placeholder vendor and throws the sentence away', () => {
    // `transientError` calls `authError('x', text)` and reads only its nullness. The sentence below is
    // reachable ONLY because that placeholder is a real argument.
    expect(authError('x', '401 Unauthorized')).toBe('x login expired or missing — run: x login');
  });
});
