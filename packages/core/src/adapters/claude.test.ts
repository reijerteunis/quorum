// Q-0047 AC-3 to AC-7 and AC-9, for claude.
//
// NO TEST HERE SPAWNS A VENDOR CLI, reads an API key or reaches a vendor. Every subject is a
// `#!/bin/sh` stub on disk, so the adapter's real spawn and parse path runs while the suite costs
// nothing — and every case that touches `check()` names all three key variables explicitly, so a
// developer whose own environment carries one cannot change what this file asserts.
//
// Written fresh against the ported code rather than transcribed from spike/test/smoke.js, which
// stays where it is and keeps running (charter §3). Its subjects are covered here: the BYOS refusal
// at smoke.js:100-107 and claude's three stdout failure shapes plus the failed-step cost at
// :150-178.
import path from 'node:path';

import type { AdapterEvent } from '@quorum/shared';
import { afterAll, describe, expect, test } from 'vitest';

import type { AdapterError, AdapterResult, AdapterRunOptions, AdapterSchema } from './adapters.js';
import { CLAUDE_CAPABILITIES } from './claude-capabilities.js';
import { claudeAdapter } from './claude.js';
import { cliStub } from '../../test/cli-stub.js';
import { withEnv } from '../../test/env.js';
import { removeTempDirs, tempDir } from '../../test/repo.js';

afterAll(removeTempDirs);

/** No key of any vendor is set, whatever the machine running this suite carries. */
const NO_KEYS = { ANTHROPIC_API_KEY: null, OPENAI_API_KEY: null, CODEX_API_KEY: null };

const SCHEMA: AdapterSchema = {
  type: 'object',
  properties: { summary: { type: 'string' } },
  required: ['summary'],
  additionalProperties: false,
};

const SCHEMA_JSON = JSON.stringify(SCHEMA);

/** A well-formed envelope: the shape every non-failure case starts from. */
const envelope = (over: Record<string, unknown> = {}): string => JSON.stringify({
  is_error: false,
  result: 'the final message',
  structured_output: { summary: 'ok' },
  session_id: 'session-1',
  total_cost_usd: 0.5,
  ...over,
});

const runOptions = (over: Partial<AdapterRunOptions> = {}): AdapterRunOptions => ({
  prompt: 'a prompt', schema: SCHEMA, cwd: tempDir('claude-cwd-'), allowWrite: false, ...over,
});

const thrown = async (fn: () => Promise<unknown>): Promise<AdapterError> => {
  try {
    await fn();
  } catch (e) {
    return e as AdapterError;
  }
  throw new Error('expected a throw, and nothing was thrown');
};

describe('AC-3 — the BYOS refusal, its order, and its asymmetry', () => {
  const REFUSAL = 'ANTHROPIC_API_KEY is set — unset it; Harness runs on subscription OAuth only';

  test('it refuses on its own vendor\'s variable', async () => {
    const error = await withEnv({ ...NO_KEYS, ANTHROPIC_API_KEY: 'sk-not-a-real-key' }, () =>
      thrown(() => claudeAdapter({ bin: cliStub().bin }).check()));
    expect(error.message).toBe(REFUSAL);
  });

  test('and on NO other vendor\'s — "all three variables" is a property of the pair, not of one adapter', async () => {
    // Refusing here as well would be a behaviour change, not extra safety: codex owns those two.
    const stub = cliStub({ stdout: 'claude 2.1.231\n' });
    const version = await withEnv({ ...NO_KEYS, OPENAI_API_KEY: 'sk-openai', CODEX_API_KEY: 'sk-codex' }, () =>
      claudeAdapter({ bin: stub.bin }).check());
    expect(version).toBe('claude 2.1.231');
  });

  test('it fires BEFORE the CLI is probed: the stub never ran', async () => {
    // Charter §2 names this as the row to watch — "a rewrite that probes first and refuses second
    // passes every test that checks only the refusal". The sentinel is what makes the order visible.
    const stub = cliStub({ stdout: 'claude 2.1.231\n' });
    const error = await withEnv({ ...NO_KEYS, ANTHROPIC_API_KEY: 'sk-not-a-real-key' }, () =>
      thrown(() => claudeAdapter({ bin: stub.bin }).check()));

    expect(error.message).toBe(REFUSAL);
    expect(stub.ran(), 'the CLI was probed before the key was refused').toBe(false);
  });

  test('a missing executable does not mask it', async () => {
    const missing = path.join(tempDir('claude-missing-'), 'no-such-claude');
    const masked = await withEnv({ ...NO_KEYS, ANTHROPIC_API_KEY: 'sk-not-a-real-key' }, () =>
      thrown(() => claudeAdapter({ bin: missing }).check()));
    expect(masked.message).toBe(REFUSAL);
    expect(masked.message).not.toMatch(/not runnable/);
  });

  test('and with no key set, the same missing executable reports what the spawn said', async () => {
    const missing = path.join(tempDir('claude-missing-'), 'no-such-claude');
    const error = await withEnv(NO_KEYS, () => thrown(() => claudeAdapter({ bin: missing }).check()));
    expect(error.message).toMatch(/^claude CLI not runnable: /);
    expect(error.message).toMatch(/ENOENT/);
  });

  test('on success it answers the trimmed version and makes no authenticated request', async () => {
    const stub = cliStub({ stdout: '  claude 2.1.231  \n' });
    const version = await withEnv(NO_KEYS, () => claudeAdapter({ bin: stub.bin }).check());

    expect(version).toBe('claude 2.1.231');
    expect(stub.invocations()).toHaveLength(1);
    // requirements/errata.md E-2: the version-probe argv is asserted against `check()`, which is the
    // only thing that reads it — it is inert data in the capabilities module, not a version probe.
    expect(stub.argv()).toStrictEqual([...CLAUDE_CAPABILITIES.versionArgs]);
  });

  test('a CLI that exits non-zero on --version is not runnable, and says so in its own words', async () => {
    const stub = cliStub({ stderr: 'dyld: library not loaded\n', exit: 1 });
    const error = await withEnv(NO_KEYS, () => thrown(() => claudeAdapter({ bin: stub.bin }).check()));
    expect(error.message).toBe('claude CLI not runnable: dyld: library not loaded\n');
  });
});

describe('AC-4 — argv is built from the capabilities module and is byte-identical to the spike', () => {
  const argvFor = async (options: Partial<AdapterRunOptions>, extraArgs?: string[]): Promise<string[]> => {
    const stub = cliStub({ stdout: envelope() });
    await claudeAdapter({ bin: stub.bin, extraArgs }).run(runOptions(options));
    return stub.argv();
  };

  test('read-only, no model, no extra directories, no extraArgs', async () => {
    expect(await argvFor({ allowWrite: false })).toStrictEqual([
      '-p', '--output-format', 'json', '--json-schema', SCHEMA_JSON, '--permission-mode', 'plan',
    ]);
  });

  test('a worktree step asks for the writing permission mode', async () => {
    expect(await argvFor({ allowWrite: true })).toStrictEqual([
      '-p', '--output-format', 'json', '--json-schema', SCHEMA_JSON, '--permission-mode', 'acceptEdits',
    ]);
  });

  test('a named model is passed, and an unnamed one leaves the flag off entirely', async () => {
    expect(await argvFor({ model: 'opus' })).toStrictEqual([
      '-p', '--output-format', 'json', '--json-schema', SCHEMA_JSON, '--permission-mode', 'plan', '--model', 'opus',
    ]);
    // No alias is pinned anywhere: absent means the CLI picks one its own login supports (Q-0001).
    expect(await argvFor({})).not.toContain('--model');
  });

  test('several extra directories each get their own flag, in order', async () => {
    expect(await argvFor({ extraDirs: ['/tmp/ticket', '/tmp/harness'] })).toStrictEqual([
      '-p', '--output-format', 'json', '--json-schema', SCHEMA_JSON, '--permission-mode', 'plan',
      '--add-dir', '/tmp/ticket', '--add-dir', '/tmp/harness',
    ]);
    expect(await argvFor({ extraDirs: [] })).not.toContain('--add-dir');
  });

  test('extraArgs land last, and may duplicate a flag the adapter already passed', async () => {
    // Duplication is preserved behaviour and not an invitation to add precedence logic: the CLI
    // decides, and `harness.yaml → adapters.claude.extraArgs` is documented as the override.
    expect(await argvFor({ model: 'opus', extraDirs: ['/tmp/ticket'] }, ['--model', 'sonnet', '--verbose'])).toStrictEqual([
      '-p', '--output-format', 'json', '--json-schema', SCHEMA_JSON, '--permission-mode', 'plan',
      '--model', 'opus', '--add-dir', '/tmp/ticket', '--model', 'sonnet', '--verbose',
    ]);
  });

  test('maxTurns is accepted and ignored: no turn-budget flag is passed', async () => {
    // Verified absent on 2.1.220 (docs/03-adapter-contract.md:127). Passing an unverified flag
    // instead would be a behaviour change.
    const argv = await argvFor({ maxTurns: 40 });
    expect(argv.some((token) => /turn/i.test(token))).toBe(false);
    expect(argv).toStrictEqual([
      '-p', '--output-format', 'json', '--json-schema', SCHEMA_JSON, '--permission-mode', 'plan',
    ]);
  });

  test('the prompt goes on stdin, whole', async () => {
    const stub = cliStub({ stdout: envelope() });
    await claudeAdapter({ bin: stub.bin }).run(runOptions({ prompt: 'x'.repeat(5000) }));
    expect(stub.stdin()).toBe('x'.repeat(5000));
  });
});

describe('AC-5 — failure is read from stdout, translated, and carries what it cost', () => {
  const failing = (exit: number, stdout: string, stderr = ''): ReturnType<typeof claudeAdapter> =>
    claudeAdapter({ bin: cliStub({ stdout, stderr, exit }).bin });

  test('exit 1 with the reason only in the envelope', async () => {
    const error = await thrown(() => failing(1, JSON.stringify({
      is_error: true, subtype: 'error_max_turns', result: 'reached the turn limit', total_cost_usd: 4.54,
    })).run(runOptions()));

    expect(error.message).toBe('claude failed (exit 1, error_max_turns): reached the turn limit');
    expect(error.usage?.cost_usd, 'a failed step records what it cost').toBe(4.54);
  });

  test('is_error: true while exiting 0 — the envelope is parsed before the exit code is judged', async () => {
    const error = await thrown(() => failing(0, JSON.stringify({
      is_error: true, result: 'overloaded', total_cost_usd: 4.54,
    })).run(runOptions()));

    expect(error.message).toBe('claude failed (exit 0): overloaded');
    expect(error.usage?.cost_usd).toBe(4.54);
  });

  test('nothing on either stream reads as nothing, not as an empty message', async () => {
    const error = await thrown(() => failing(1, '').run(runOptions()));
    expect(error.message).toBe('claude failed (exit 1): no output on stderr or stdout');
  });

  test('the detail falls back through error.message, then subtype, then the tail of both streams', async () => {
    const nested = await thrown(() => failing(1, JSON.stringify({ error: { message: 'the vendor said no' } })).run(runOptions()));
    expect(nested.message).toBe('claude failed (exit 1): the vendor said no');

    const subtypeOnly = await thrown(() => failing(1, JSON.stringify({ subtype: 'error_during_execution' })).run(runOptions()));
    expect(subtypeOnly.message).toBe('claude failed (exit 1, error_during_execution): error_during_execution');

    const streams = await thrown(() => failing(1, 'not json at all', 'and a line of stderr\n').run(runOptions()));
    expect(streams.message).toBe('claude failed (exit 1): and a line of stderr\n\nnot json at all');
  });

  test('the detail is truncated to 2000 characters', async () => {
    const error = await thrown(() => failing(1, JSON.stringify({ result: 'y'.repeat(3000) })).run(runOptions()));
    expect(error.message).toBe(`claude failed (exit 1): ${'y'.repeat(2000)}`);
  });

  test('an auth failure becomes the one actionable sentence instead', async () => {
    const error = await thrown(() => failing(1, JSON.stringify({ result: 'Error: 401 Unauthorized' })).run(runOptions()));
    expect(error.message).toBe('claude login expired or missing — run: claude  (then /login)');
  });

  test('and a compile error is left in the vendor\'s own words', async () => {
    const error = await thrown(() => failing(1, JSON.stringify({ result: 'compile error in foo.ts' })).run(runOptions()));
    expect(error.message).toBe('claude failed (exit 1): compile error in foo.ts');
  });

  test('a failure with no usage at all still carries a usage object of nulls', async () => {
    // `withRetry` reads the three fields off whatever is thrown; the measures are null because
    // nothing was reported, which is not the same as zero.
    const error = await thrown(() => failing(1, JSON.stringify({ result: 'no envelope usage here' })).run(runOptions()));
    expect(error.usage).toStrictEqual({
      vendor: 'claude', input_tokens: null, output_tokens: null,
      cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: null,
    });
  });
});

describe('AC-6 — tokens are cache-inclusive, and an unmeasured envelope reports null', () => {
  const usageOf = async (over: Record<string, unknown>): Promise<AdapterResult['usage']> => {
    const stub = cliStub({ stdout: envelope(over) });
    return (await claudeAdapter({ bin: stub.bin }).run(runOptions())).usage;
  };

  test('the M0 probe: 65 uncached tokens against a real $0.39, and 74264 once the cache is counted', async () => {
    // The numbers are the point. All three input components are non-zero, so a double count and an
    // omission fail differently — which is how the fiction was found in the first place (Q-0001).
    expect(await usageOf({
      usage: { input_tokens: 65, cache_creation_input_tokens: 24199, cache_read_input_tokens: 50000, output_tokens: 12 },
      total_cost_usd: 0.3919,
    })).toStrictEqual({
      vendor: 'claude',
      input_tokens: 74264,
      output_tokens: 12,
      cached_input_tokens: 50000,
      cache_write_input_tokens: 24199,
      cost_usd: 0.3919,
    });
  });

  test('a missing cache field counts as zero rather than voiding the sum', async () => {
    expect(await usageOf({ usage: { input_tokens: 65 }, total_cost_usd: null })).toStrictEqual({
      vendor: 'claude',
      input_tokens: 65,
      output_tokens: null,
      cached_input_tokens: null,
      cache_write_input_tokens: null,
      cost_usd: null,
    });
  });

  test('an envelope carrying no usage at all reports null for every measure — never zero', async () => {
    expect(await usageOf({ usage: undefined, total_cost_usd: undefined })).toStrictEqual({
      vendor: 'claude', input_tokens: null, output_tokens: null,
      cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: null,
    });
  });

  test('the session id comes from the envelope, and is null when there is none', async () => {
    const stub = cliStub({ stdout: envelope({ session_id: undefined }) });
    expect((await claudeAdapter({ bin: stub.bin }).run(runOptions())).session).toBeNull();

    const named = cliStub({ stdout: envelope({ session_id: 'abc-123' }) });
    expect((await claudeAdapter({ bin: named.bin }).run(runOptions())).session).toBe('abc-123');
  });
});

describe('AC-7 — the structured tail comes from the vendor\'s own channel first, and nothing is repaired', () => {
  const runWith = async (stdout: string): Promise<AdapterResult> =>
    claudeAdapter({ bin: cliStub({ stdout }).bin }).run(runOptions());

  test('native structured output wins, and raw is the final message', async () => {
    const result = await runWith(envelope({ structured_output: { summary: 'from the vendor' }, result: 'the final message' }));
    expect(result.output).toStrictEqual({ summary: 'from the vendor' });
    expect(result.raw).toBe('the final message');
    expect(result.vendor).toBe('claude');
    expect(Object.keys(result).sort()).toStrictEqual(['ms', 'output', 'raw', 'session', 'usage', 'vendor']);
  });

  test('absent, it falls back to a fenced block in the message', async () => {
    const result = await runWith(envelope({
      structured_output: undefined,
      result: 'here you go\n\n```json\n{"summary": "from the fence"}\n```\n',
    }));
    expect(result.output).toStrictEqual({ summary: 'from the fence' });
  });

  test('absent with nothing parseable, the answer is null — never a repaired object', async () => {
    // `checkAgainstSchema` turns that null into "output is not an object" and the run stops with a
    // message instead of proceeding on a default (register row 21).
    const result = await runWith(envelope({ structured_output: undefined, result: 'no json here at all' }));
    expect(result.output).toBeNull();
  });

  test('an unparseable envelope leaves raw as the whole of stdout', async () => {
    const result = await runWith('this is not an envelope\n');
    expect(result.raw).toBe('this is not an envelope\n');
    expect(result.output).toBeNull();
  });
});

describe('AC-6 and AC-7 — a vendor field is transcribed, never corrected', () => {
  // The review finding on iteration 1: the port narrowed `env.result ?? stdout` to a `typeof`
  // check, `env.session_id ?? null` to a string test, and each measure to a `number` test. Every
  // one of those reads as tidying and each is a behaviour change (charter §2) — and NOT ONE of the
  // 551 tests in this package failed when they were present, which is exactly why they are pinned
  // here. The values below are the spike's own answers, taken from a differential run of both
  // adapters over the same stubs (Q-0047, implement iteration 2).
  const runWith = async (stdout: string): Promise<AdapterResult> =>
    claudeAdapter({ bin: cliStub({ stdout }).bin }).run(runOptions());

  test('a final message that is not a string is still the vendor\'s answer, not a reason to use stdout', async () => {
    const result = await runWith(envelope({ result: 42, structured_output: { summary: 'ok' } }));
    expect(result.raw as unknown).toBe(42);
  });

  test('and only an ABSENT one falls back to stdout', async () => {
    const stdout = envelope({ result: undefined, structured_output: { summary: 'ok' } });
    expect((await runWith(stdout)).raw).toBe(stdout);
  });

  test('an empty final message is present, so it does NOT fall back', async () => {
    expect((await runWith(envelope({ result: '', structured_output: { summary: 'ok' } }))).raw).toBe('');
  });

  test('a session id that is not a string is handed on as the vendor sent it', async () => {
    expect((await runWith(envelope({ session_id: 7 }))).session as unknown).toBe(7);
  });

  test('a measure that is not a number is handed on too — judging it is not the adapter\'s job', async () => {
    // `'5' + 0 + 0` is the sum the spike computes, string concatenation and all. It looks wrong
    // because it IS wrong, and correcting it here would be a silent divergence rather than a fix:
    // the spike would keep the old arithmetic, both suites would stay green, and only a roll-up
    // would ever know. Reported in dev/implement-report.md instead.
    const usage = (await runWith(envelope({ usage: { input_tokens: '5', output_tokens: '9' } }))).usage;
    expect(usage?.input_tokens as unknown).toBe('500');
    expect(usage?.output_tokens as unknown).toBe('9');
  });

  test('a usage field that is not an object reports zero tokens, not "unmeasured"', async () => {
    // The truthiness check is the spike's: `usage: 'lots'` takes the summing branch, every key
    // reads `undefined`, and the sum is 0. Treating it as absent would answer `null` instead, and
    // `null` means something different to a roll-up — it means nobody measured this call.
    expect((await runWith(envelope({ usage: 'lots' }))).usage?.input_tokens).toBe(0);
  });

  test('PRESERVED DEFECT: a non-string message with no structured output crashes the run', async () => {
    // Why: preserved defect — the spike does the same, verified by running both adapters over this
    // stub. `extractJson` is typed `string | null` and reached with whatever `result` held, so
    // `text.matchAll` throws a TypeError and the vendor's answer is replaced by a Node stack trace
    // — the shape Q-0063 removed from `exec()`. Iteration 1's narrowing hid it by substituting
    // stdout, which is how the divergence got in. Fixing it belongs in both trees at once, like
    // Q-0066 and Q-0068; reported in dev/implement-report.md, not fixed here.
    await expect(runWith(envelope({ result: 42, structured_output: undefined })))
      .rejects.toThrow(TypeError);
  });
});

describe('AC-9 — the adapter emits spawn and stdout, and nothing else', () => {
  const eventsOf = async (options: Partial<AdapterRunOptions> = {}, stdout = envelope()): Promise<AdapterEvent[]> => {
    const events: AdapterEvent[] = [];
    await claudeAdapter({ bin: cliStub({ stdout }).bin })
      .run(runOptions({ ...options, onEvent: (event) => events.push(event) }));
    return events;
  };

  test('spawn once, then one stdout event per complete line, in order', async () => {
    const events = await eventsOf({}, `line one\nline two\n${envelope()}`);
    expect(events[0].type).toBe('spawn');
    expect(events.slice(1).map((event) => event.type)).toStrictEqual(['stdout', 'stdout', 'stdout']);
    expect(events.map((event) => (event.type === 'stdout' ? event.line : null)).slice(1, 3))
      .toStrictEqual(['line one', 'line two']);
  });

  test('it never emits a retry — the union permits it and withRetry owns it', async () => {
    // The type allows what the behaviour forbids, so this needs its own assertion.
    const events = await eventsOf();
    expect(events.filter((event) => event.type === 'retry')).toStrictEqual([]);
  });

  test('the spawn event names the vendor and quotes every argument that needs it', async () => {
    const events = await eventsOf();
    const spawn = events[0];
    expect(spawn.type === 'spawn' && spawn.vendor).toBe('claude');
    // The schema argument holds quotes and so is wrapped; the plain flags are not.
    expect(spawn.type === 'spawn' && spawn.cmd).toContain(' -p --output-format json --json-schema ');
    expect(spawn.type === 'spawn' && spawn.cmd).toContain(`'${SCHEMA_JSON.slice(0, 80)}…'`);
  });

  test('a long argument is truncated at 80 characters, and a short one is left alone', async () => {
    const long = `/tmp/${'d'.repeat(120)} and a space`;
    const events = await eventsOf({ extraDirs: [long, '/tmp/no-spaces-here'] });
    const spawn = events[0];

    expect(spawn.type === 'spawn' && spawn.cmd).toContain(`--add-dir '${long.slice(0, 80)}…'`);
    expect(spawn.type === 'spawn' && spawn.cmd).toContain('--add-dir /tmp/no-spaces-here');
  });

  test('a directory whose name contains a space IS quoted, which is claude\'s half of the asymmetry', async () => {
    // codex joins its argv raw and this one quotes: unifying the two would change what a run
    // prints, so both halves are asserted (AC-9). Its twin is in codex.test.ts.
    const events = await eventsOf({ extraDirs: ['/tmp/a dir'] });
    const spawn = events[0];
    expect(spawn.type === 'spawn' && spawn.cmd).toContain(`--add-dir '/tmp/a dir'`);
  });
});
