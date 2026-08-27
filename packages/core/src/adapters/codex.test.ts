// Q-0047 AC-3 to AC-7 and AC-9, for codex.
//
// NO TEST HERE SPAWNS A VENDOR CLI, reads an API key or reaches a vendor, and none reads the
// developer's `~/.codex/config.toml` — every subject is a `#!/bin/sh` stub on disk, and every case
// touching `check()` names all three key variables explicitly.
//
// Written fresh against the ported code rather than transcribed from spike/test/smoke.js, which
// stays where it is and keeps running (charter §3). The BYOS half of smoke.js:100-107 is covered
// here; claude's failure shapes are covered in claude.test.ts.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { AdapterEvent } from '@quorum/shared';
import { afterAll, describe, expect, test } from 'vitest';

import type { AdapterError, AdapterResult, AdapterRunOptions, AdapterSchema } from './adapters.js';
import { CODEX_CAPABILITIES } from './codex-capabilities.js';
import { codexAdapter } from './codex.js';
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

/** One JSONL event per line, as the CLI streams them. */
const stream = (...events: Record<string, unknown>[]): string =>
  `${events.map((event) => JSON.stringify(event)).join('\n')}\n`;

/** The 0.149.0 usage event, verbatim from docs/03-adapter-contract.md:142-143. */
const TURN_COMPLETED = {
  type: 'turn.completed',
  usage: { input_tokens: 13970, cached_input_tokens: 9984, cache_write_input_tokens: 0, output_tokens: 6, reasoning_output_tokens: 0 },
};

const runOptions = (over: Partial<AdapterRunOptions> = {}): AdapterRunOptions => ({
  prompt: 'a prompt', schema: SCHEMA, cwd: tempDir('codex-cwd-'), allowWrite: false, ...over,
});

const thrown = async (fn: () => Promise<unknown>): Promise<AdapterError> => {
  try {
    await fn();
  } catch (e) {
    return e as AdapterError;
  }
  throw new Error('expected a throw, and nothing was thrown');
};

/** The temp directory the run created, read back off the argv it passed. */
const tempDirOf = (argv: string[]): string =>
  path.dirname(argv[argv.indexOf(CODEX_CAPABILITIES.flags.outputSchema) + 1]);

/**
 * Shell that copies `source` over whatever path follows `flag` in the stub's own argv.
 *
 * It is the only way to reach the temp directory: the run creates it, hands it to the CLI and
 * removes it again, so the moment it exists is the moment the stub is running.
 */
const copyOnto = (flag: string, source: string): string => [
  "prev=''",
  'for a in "$@"; do',
  `  if [ "$prev" = ${JSON.stringify(flag)} ]; then cp ${JSON.stringify(source)} "$a"; fi`,
  '  prev="$a"',
  'done',
].join('\n');

/** The reverse: copies whatever path follows `flag` to `target`, before the run deletes it. */
const copyFrom = (flag: string, target: string): string => [
  "prev=''",
  'for a in "$@"; do',
  `  if [ "$prev" = ${JSON.stringify(flag)} ]; then cp "$a" ${JSON.stringify(target)}; fi`,
  '  prev="$a"',
  'done',
].join('\n');

describe('AC-3 — the BYOS refusal, its order, and its asymmetry', () => {
  const REFUSAL = 'CODEX_API_KEY/OPENAI_API_KEY is set — unset it; Harness runs on subscription OAuth only';

  test('it refuses on either of its own vendor\'s two variables', async () => {
    for (const variable of ['CODEX_API_KEY', 'OPENAI_API_KEY']) {
      const error = await withEnv({ ...NO_KEYS, [variable]: 'sk-not-a-real-key' }, () =>
        thrown(() => codexAdapter({ bin: cliStub().bin }).check()));
      expect(error.message, variable).toBe(REFUSAL);
    }
  });

  test('and NOT on claude\'s — "all three variables" is a property of the pair, not of one adapter', async () => {
    const stub = cliStub({ stdout: 'codex-cli 0.149.1\n' });
    const version = await withEnv({ ...NO_KEYS, ANTHROPIC_API_KEY: 'sk-anthropic' }, () =>
      codexAdapter({ bin: stub.bin }).check());
    expect(version).toBe('codex-cli 0.149.1');
  });

  test('it fires BEFORE the CLI is probed: the stub never ran', async () => {
    const stub = cliStub({ stdout: 'codex-cli 0.149.1\n' });
    const error = await withEnv({ ...NO_KEYS, CODEX_API_KEY: 'sk-not-a-real-key' }, () =>
      thrown(() => codexAdapter({ bin: stub.bin }).check()));

    expect(error.message).toBe(REFUSAL);
    expect(stub.ran(), 'the CLI was probed before the key was refused').toBe(false);
  });

  test('a missing executable does not mask it', async () => {
    const missing = path.join(tempDir('codex-missing-'), 'no-such-codex');
    const masked = await withEnv({ ...NO_KEYS, OPENAI_API_KEY: 'sk-not-a-real-key' }, () =>
      thrown(() => codexAdapter({ bin: missing }).check()));
    expect(masked.message).toBe(REFUSAL);
    expect(masked.message).not.toMatch(/not runnable/);
  });

  test('and with no key set, the same missing executable reports what the spawn said', async () => {
    const missing = path.join(tempDir('codex-missing-'), 'no-such-codex');
    const error = await withEnv(NO_KEYS, () => thrown(() => codexAdapter({ bin: missing }).check()));
    expect(error.message).toMatch(/^codex CLI not runnable: /);
    expect(error.message).toMatch(/ENOENT/);
  });

  test('on success it answers the trimmed version and makes no authenticated request', async () => {
    const stub = cliStub({ stdout: '  codex-cli 0.149.1  \n' });
    const version = await withEnv(NO_KEYS, () => codexAdapter({ bin: stub.bin }).check());

    expect(version).toBe('codex-cli 0.149.1');
    expect(stub.invocations()).toHaveLength(1);
    // requirements/errata.md E-2: the version-probe argv is asserted against `check()`, the only
    // thing that reads it.
    expect(stub.argv()).toStrictEqual([...CODEX_CAPABILITIES.versionArgs]);
  });
});

describe('AC-4 — argv is built from the capabilities module and is byte-identical to the spike', () => {
  /**
   * The whole argv with the two temp paths asserted for shape and then spliced back in, because
   * they are a fresh `mkdtemp` on every run and cannot be written as literals.
   */
  const argvFor = async (options: Partial<AdapterRunOptions> = {}, extraArgs?: string[]): Promise<{ argv: string[]; cwd: string; tmp: string }> => {
    const cwd = options.cwd ?? tempDir('codex-cwd-');
    const stub = cliStub({ stdout: stream(TURN_COMPLETED, { type: 'item.completed' }) });
    await codexAdapter({ bin: stub.bin, extraArgs }).run(runOptions({ ...options, cwd }));
    const argv = stub.argv();
    const tmp = tempDirOf(argv);

    expect(path.basename(tmp).startsWith('harness-codex-'), `${tmp} keeps the prefix verbatim`).toBe(true);
    expect(path.dirname(tmp)).toBe(os.tmpdir());
    return { argv, cwd, tmp };
  };

  const expected = (tmp: string, cwd: string, sandbox: string, tail: string[] = []): string[] => [
    'exec', '--json',
    '--output-schema', path.join(tmp, 'schema.json'),
    '-o', path.join(tmp, 'last.txt'),
    '-C', cwd,
    '--sandbox', sandbox,
    '--skip-git-repo-check', '--ephemeral', '--ignore-user-config',
    ...tail,
    '-',
  ];

  test('read-only, no model, no extra directories, no extraArgs', async () => {
    const { argv, cwd, tmp } = await argvFor({ allowWrite: false });
    expect(argv).toStrictEqual(expected(tmp, cwd, 'read-only'));
  });

  test('a worktree step asks for the writing sandbox', async () => {
    const { argv, cwd, tmp } = await argvFor({ allowWrite: true });
    expect(argv).toStrictEqual(expected(tmp, cwd, 'workspace-write'));
  });

  test('--ignore-user-config is unconditional, on every combination', async () => {
    // The flow file is the source of truth, not the machine Quorum happens to run on: a personal
    // `~/.codex/config.toml` pin outranked it until Q-0001, including when no model was passed.
    for (const options of [{}, { allowWrite: true }, { model: 'a-model' }, { extraDirs: ['/tmp/ticket'] }]) {
      const { argv } = await argvFor(options);
      expect(argv, JSON.stringify(options)).toContain('--ignore-user-config');
    }
  });

  test('a named model is passed, and an unnamed one leaves the flag off entirely', async () => {
    const named = await argvFor({ model: 'a-model' });
    expect(named.argv).toStrictEqual(expected(named.tmp, named.cwd, 'read-only', ['-m', 'a-model']));
    // No alias is pinned anywhere: every one the templates shipped was rejected on a ChatGPT
    // subscription, so absent means the CLI picks one its own login supports (Q-0001).
    expect((await argvFor({})).argv).not.toContain('-m');
  });

  test('several extra directories each get their own flag, in order', async () => {
    const { argv, cwd, tmp } = await argvFor({ extraDirs: ['/tmp/ticket', '/tmp/harness'] });
    expect(argv).toStrictEqual(expected(tmp, cwd, 'read-only', ['--add-dir', '/tmp/ticket', '--add-dir', '/tmp/harness']));
  });

  test('extraArgs land after the flags and before the trailing dash, and may duplicate one', async () => {
    const { argv, cwd, tmp } = await argvFor({ model: 'a-model' }, ['--sandbox', 'danger-full-access']);
    expect(argv).toStrictEqual(expected(tmp, cwd, 'read-only', ['-m', 'a-model', '--sandbox', 'danger-full-access']));
    expect(argv[argv.length - 1], 'the trailing dash stays last').toBe('-');
  });

  test('the schema is written to the temp directory, and the prompt goes on stdin', async () => {
    const seen = path.join(tempDir('codex-schema-'), 'schema-seen.json');
    const stub = cliStub({
      stdout: stream(TURN_COMPLETED),
      body: copyFrom(CODEX_CAPABILITIES.flags.outputSchema, seen),
    });
    await codexAdapter({ bin: stub.bin }).run(runOptions({ prompt: 'x'.repeat(5000) }));

    expect(JSON.parse(fs.readFileSync(seen, 'utf8'))).toStrictEqual(SCHEMA);
    expect(stub.stdin()).toBe('x'.repeat(5000));
  });
});

describe('AC-5 — failure is read from stdout as JSONL, unwrapped, and carries what it cost', () => {
  test('the vendor\'s own JSON nested inside message is dug out', async () => {
    const nested = JSON.stringify({ error: { type: 'invalid_request_error', message: 'the vendor said no' } });
    const stub = cliStub({ stdout: stream({ type: 'error', message: nested }), exit: 1 });
    const error = await thrown(() => codexAdapter({ bin: stub.bin }).run(runOptions()));
    expect(error.message).toBe('codex exited 1: the vendor said no');
  });

  test('all three error shapes are collected, de-duplicated, and joined', async () => {
    const stub = cliStub({
      stdout: stream(
        { type: 'error', message: 'first' },
        { type: 'turn.failed', error: { message: 'second' } },
        { type: 'item.completed', item: { type: 'error', message: 'third' } },
        { type: 'error', message: 'first' },
      ),
      exit: 1,
    });
    const error = await thrown(() => codexAdapter({ bin: stub.bin }).run(runOptions()));
    expect(error.message).toBe('codex exited 1: first; second; third');
  });

  test('nothing reported at all falls back to the streams, then to saying so', async () => {
    const tail = cliStub({ stdout: 'not jsonl at all', exit: 2 });
    expect((await thrown(() => codexAdapter({ bin: tail.bin }).run(runOptions()))).message)
      .toBe('codex exited 2: not jsonl at all');

    const silent = cliStub({ exit: 2 });
    expect((await thrown(() => codexAdapter({ bin: silent.bin }).run(runOptions()))).message)
      .toBe('codex exited 2: no output on stderr or stdout');
  });

  test('an expired refresh token becomes the one actionable sentence', async () => {
    const real = 'ERROR codex_login::auth::manager: Failed to refresh token: Your access token could not be refreshed because your refresh token was already used. Please log out and sign in again.';
    const stub = cliStub({ stdout: stream({ type: 'error', message: real }), exit: 1 });
    const error = await thrown(() => codexAdapter({ bin: stub.bin }).run(runOptions()));
    expect(error.message).toBe('codex login expired or missing — run: codex logout && codex login');
  });

  test('and a compile error is not translated', async () => {
    const stub = cliStub({ stdout: stream({ type: 'error', message: 'compile error in foo.ts' }), exit: 1 });
    const error = await thrown(() => codexAdapter({ bin: stub.bin }).run(runOptions()));
    expect(error.message).toBe('codex exited 1: compile error in foo.ts');
  });

  test('a stream that dies mid-turn still reports the tokens it had already spent', async () => {
    const stub = cliStub({ stdout: stream(TURN_COMPLETED, { type: 'error', message: 'died' }), exit: 1 });
    const error = await thrown(() => codexAdapter({ bin: stub.bin }).run(runOptions()));
    expect(error.usage).toStrictEqual({
      vendor: 'codex', input_tokens: 13970, output_tokens: 6,
      cached_input_tokens: 9984, cache_write_input_tokens: null, cost_usd: null,
    });
  });

  test('the temp directory is removed on every terminal path — success, non-zero exit, and a spawn failure', async () => {
    const ok = cliStub({ stdout: stream(TURN_COMPLETED) });
    await codexAdapter({ bin: ok.bin }).run(runOptions());
    expect(fs.existsSync(tempDirOf(ok.argv()))).toBe(false);

    const failed = cliStub({ stdout: stream({ type: 'error', message: 'died' }), exit: 1 });
    await thrown(() => codexAdapter({ bin: failed.bin }).run(runOptions()));
    expect(fs.existsSync(tempDirOf(failed.argv()))).toBe(false);

    // A spawn failure never reaches the stub, so the directory is found by counting what the run
    // left behind: `exec` resolves it as code -1, which takes the non-zero branch.
    const before = new Set(fs.readdirSync(os.tmpdir()).filter((entry) => entry.startsWith('harness-codex-')));
    const missing = path.join(tempDir('codex-missing-'), 'no-such-codex');
    const error = await thrown(() => codexAdapter({ bin: missing }).run(runOptions()));
    const after = fs.readdirSync(os.tmpdir()).filter((entry) => entry.startsWith('harness-codex-') && !before.has(entry));

    expect(error.message).toMatch(/^codex exited -1: /);
    expect(after, 'a spawn failure leaves no temp directory behind').toStrictEqual([]);
  });
});

describe('AC-6 — tokens include reasoning, cost is always null, and no rate table exists', () => {
  const usageOf = async (stdout: string): Promise<AdapterResult['usage']> =>
    (await codexAdapter({ bin: cliStub({ stdout }).bin }).run(runOptions())).usage;

  test('the exact 0.149.0 envelope from the contract document', async () => {
    expect(await usageOf(stream(TURN_COMPLETED))).toStrictEqual({
      vendor: 'codex', input_tokens: 13970, output_tokens: 6,
      cached_input_tokens: 9984, cache_write_input_tokens: null, cost_usd: null,
    });
  });

  test('reasoning tokens are billed as output and added to it', async () => {
    const usage = await usageOf(stream({ type: 'turn.completed', usage: { input_tokens: 100, output_tokens: 20, reasoning_output_tokens: 300 } }));
    expect(usage?.output_tokens).toBe(320);
  });

  test('usage is read from the event, from its payload, and from its item', async () => {
    for (const event of [
      { type: 'turn.completed', usage: { input_tokens: 7 } },
      { type: 'turn.completed', payload: { usage: { input_tokens: 7 } } },
      { type: 'item.completed', item: { usage: { input_tokens: 7 } } },
    ]) {
      expect((await usageOf(stream(event)))?.input_tokens, JSON.stringify(event)).toBe(7);
    }
  });

  test('cost is null and never zero, on a measured run and on an unmeasured one', async () => {
    // "Codex cost is reported as tokens, never priced locally" (docs/DECISIONS.md, 2026-08-22): a
    // null is displayed as n/a beside its token count, never rounded to $0.000.
    expect((await usageOf(stream(TURN_COMPLETED)))?.cost_usd).toBeNull();
    expect((await usageOf(stream({ type: 'thread.started', thread_id: 't-1' })))?.cost_usd).toBeNull();
  });

  test('nothing reported leaves every measure null, and cache writes are never reported at all', async () => {
    expect(await usageOf(stream({ type: 'thread.started', thread_id: 't-1' }))).toStrictEqual({
      vendor: 'codex', input_tokens: null, output_tokens: null,
      cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: null,
    });
  });

  test('a zero output count keeps whatever was reported before it', async () => {
    // The `|| previous` fallback, preserved verbatim: a later event reporting nothing must not
    // erase an earlier one that reported something.
    const usage = await usageOf(stream(
      { type: 'turn.completed', usage: { output_tokens: 40 } },
      { type: 'turn.completed', usage: { output_tokens: 0, reasoning_output_tokens: 0 } },
    ));
    expect(usage?.output_tokens).toBe(40);
  });

  test('the session id comes from thread_id, session_id or the payload, and lines that are not JSON are ignored', async () => {
    const withThread = await codexAdapter({ bin: cliStub({ stdout: `not json\n${stream({ type: 'thread.started', thread_id: 'th-1' })}` }).bin }).run(runOptions());
    expect(withThread.session).toBe('th-1');

    const withSession = await codexAdapter({ bin: cliStub({ stdout: stream({ session_id: 'se-1' }) }).bin }).run(runOptions());
    expect(withSession.session).toBe('se-1');

    const withPayload = await codexAdapter({ bin: cliStub({ stdout: stream({ payload: { thread_id: 'pa-1' } }) }).bin }).run(runOptions());
    expect(withPayload.session).toBe('pa-1');

    const none = await codexAdapter({ bin: cliStub({ stdout: stream(TURN_COMPLETED) }).bin }).run(runOptions());
    expect(none.session).toBeNull();
  });
});

describe('AC-6 — a vendor field is transcribed, never corrected', () => {
  // The codex half of the review finding on iteration 1: the port had narrowed each measure to a
  // `number` test and the session id to a `string` test. Both read as tidying and both are
  // behaviour changes (charter §2). The values below are the spike's own answers, taken from a
  // differential run of both adapters over the same stubs (Q-0047, implement iteration 2).
  const runWith = async (stdout: string): Promise<AdapterResult> =>
    codexAdapter({ bin: cliStub({ stdout }).bin }).run(runOptions());

  test('a measure that is not a number is handed on as the stream reported it', async () => {
    const usage = (await runWith(stream({ type: 'turn.completed', usage: { input_tokens: '5', cached_input_tokens: '1' } }))).usage;
    expect(usage?.input_tokens as unknown).toBe('5');
    expect(usage?.cached_input_tokens as unknown).toBe('1');
  });

  test('a usage field that is not an object leaves every measure where it was', async () => {
    // The truthiness check is the spike's: `usage: 'lots'` enters the branch, every key reads
    // `undefined`, and each measure falls back to its previous value rather than to zero.
    expect(await runWith(stream({ type: 'turn.completed', usage: 'lots' })).then((r) => r.usage)).toStrictEqual({
      vendor: 'codex', input_tokens: null, output_tokens: null,
      cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: null,
    });
  });

  test('a thread id that is not a string is handed on as the vendor sent it', async () => {
    expect((await runWith(stream({ type: 'thread.started', thread_id: 9 }))).session as unknown).toBe(9);
  });

  test('and an event carrying no id at all leaves the previous one standing', async () => {
    const result = await runWith(stream(
      { type: 'thread.started', thread_id: 'th-1' },
      { type: 'turn.completed', usage: { input_tokens: 1 } },
    ));
    expect(result.session).toBe('th-1');
  });
});

describe('AC-7 — the structured tail comes from the vendor\'s own channel first, and nothing is repaired', () => {
  /** A stub that leaves `text` where the CLI is told to write its final message. */
  const writingLast = (text: string): ReturnType<typeof cliStub> => {
    const source = path.join(tempDir('codex-last-'), 'last.txt');
    fs.writeFileSync(source, text);
    return cliStub({ stdout: stream(TURN_COMPLETED), body: copyOnto(CODEX_CAPABILITIES.flags.lastMessage, source) });
  };

  test('last.txt present and holding JSON wins over stdout', async () => {
    const stub = writingLast('{"summary": "from last.txt"}');
    const result = await codexAdapter({ bin: stub.bin }).run(runOptions());

    expect(result.output).toStrictEqual({ summary: 'from last.txt' });
    expect(result.raw).toBe('{"summary": "from last.txt"}');
  });

  test('last.txt present but malformed falls through to the fenced-block extraction', async () => {
    const stub = writingLast('here you go\n\n```json\n{"summary": "from the fence"}\n```\n');
    expect((await codexAdapter({ bin: stub.bin }).run(runOptions())).output).toStrictEqual({ summary: 'from the fence' });
  });

  test('last.txt missing falls back to stdout, and an unparseable tail is null', async () => {
    const stub = cliStub({ stdout: stream(TURN_COMPLETED) });
    const result = await codexAdapter({ bin: stub.bin }).run(runOptions());

    expect(result.raw).toBe(stream(TURN_COMPLETED));
    // The last `{…}` block of the stream happens to parse, which is `extractJson`'s documented
    // tolerance rather than a repair; what matters is that nothing was invented.
    expect(result.output).toStrictEqual(TURN_COMPLETED);

    const unparseable = cliStub({ stdout: 'no json here at all\n' });
    expect((await codexAdapter({ bin: unparseable.bin }).run(runOptions())).output).toBeNull();
  });

  test('the answer carries the six fields the contract names and nothing else', async () => {
    const result = await codexAdapter({ bin: cliStub({ stdout: stream(TURN_COMPLETED) }).bin }).run(runOptions());
    expect(Object.keys(result).sort()).toStrictEqual(['ms', 'output', 'raw', 'session', 'usage', 'vendor']);
    expect(result.vendor).toBe('codex');
  });
});

describe('AC-9 — the adapter emits spawn and stdout, and its cmd is joined raw', () => {
  const eventsOf = async (options: Partial<AdapterRunOptions> = {}, stdout = stream(TURN_COMPLETED)): Promise<AdapterEvent[]> => {
    const events: AdapterEvent[] = [];
    await codexAdapter({ bin: cliStub({ stdout }).bin })
      .run(runOptions({ ...options, onEvent: (event) => events.push(event) }));
    return events;
  };

  test('spawn once, then one stdout event per complete line, in order', async () => {
    const events = await eventsOf({}, stream({ type: 'thread.started', thread_id: 't-1' }, TURN_COMPLETED));
    expect(events.map((event) => event.type)).toStrictEqual(['spawn', 'stdout', 'stdout']);
  });

  test('it never emits a retry — the union permits it and withRetry owns it', async () => {
    expect((await eventsOf()).filter((event) => event.type === 'retry')).toStrictEqual([]);
  });

  test('a path containing a space is left UNQUOTED, which is codex\'s half of the asymmetry', async () => {
    // claude maps every argument through its own quoting and codex joins raw. Unifying the two
    // changes what a run prints, so both halves are pinned. Its twin is in claude.test.ts.
    const events = await eventsOf({ extraDirs: ['/tmp/a dir'] });
    const spawn = events[0];
    expect(spawn.type === 'spawn' && spawn.vendor).toBe('codex');
    expect(spawn.type === 'spawn' && spawn.cmd).toContain('--add-dir /tmp/a dir');
    expect(spawn.type === 'spawn' && spawn.cmd).not.toContain(`'/tmp/a dir'`);
  });
});
