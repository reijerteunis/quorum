// Q-0046 AC-10 and AC-11 defect 4: the mock, switch by switch.
//
// EVERY TEST USES A ROLE NAME OF ITS OWN, or one of the always-switches. The call counter is
// module-scoped and Vitest shares this module across the file, so a test that shared a key with
// another would depend on the order they run in — which is the flakiness AC-10's discipline exists
// to prevent, and which Q-0054 inherits.
//
// Every test restores the environment it changed, through `withEnv`.
import fs from 'node:fs';
import path from 'node:path';

import { adapterEventSchema } from '@quorum/shared';
import type { AdapterEvent } from '@quorum/shared';
import { afterAll, describe, expect, test } from 'vitest';

import type { AdapterError, AdapterResult, AdapterRunOptions, AdapterSchema } from './adapters.js';
import { mockAdapter } from './mock.js';
import { withEnv } from '../../test/env.js';
import { removeTempDirs, tempDir, walk } from '../../test/repo.js';

afterAll(removeTempDirs);

const PLAIN: AdapterSchema = { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'], additionalProperties: false };
const WRITES: AdapterSchema = { type: 'object', properties: { summary: { type: 'string' }, document: { type: 'string' } }, required: ['summary', 'document'], additionalProperties: false };
const VERDICT: AdapterSchema = {
  type: 'object',
  properties: { summary: { type: 'string' }, verdict: { type: 'string', enum: ['approve', 'changes-requested'] }, findings: { type: 'array', items: { type: 'string' } } },
  required: ['summary', 'verdict', 'findings'],
  additionalProperties: false,
};

/** One mock call. `delayMs: 0` throughout: no test in this file waits on the 20ms default. */
const run = (over: Partial<AdapterRunOptions> = {}): Promise<AdapterResult> => mockAdapter({ delayMs: 0 }).run({
  prompt: '# Role: mock-default', schema: PLAIN, cwd: tempDir('mock-'), allowWrite: false, ...over,
});

const thrown = async (fn: () => Promise<unknown>): Promise<AdapterError> => {
  try {
    await fn();
  } catch (e) {
    return e as AdapterError;
  }
  throw new Error('expected a throw, and nothing was thrown');
};

describe('AC-10 — the adapter itself', () => {
  test('it is an adapter: a vendor, a cheap check, and a run', async () => {
    const adapter = mockAdapter();
    expect(adapter.vendor).toBe('mock');
    expect(await adapter.check()).toBe('mock 0.0.1');
  });

  test('the result carries the shape everything downstream reads', async () => {
    const res = await run({ prompt: '# Role: ac10-shape' });
    expect(res).toStrictEqual({
      vendor: 'mock',
      output: { summary: 'mock ac10-shape:plain #1' },
      raw: '{"summary":"mock ac10-shape:plain #1"}',
      usage: { vendor: 'mock', input_tokens: expect.any(Number), output_tokens: 200, cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: 0.01 },
      session: null,
      ms: 20,
    });
  });

  test('the call key is role:kind, and the counter is per key', async () => {
    expect((await run({ prompt: '# Role: ac10-counter' })).output.summary).toBe('mock ac10-counter:plain #1');
    expect((await run({ prompt: '# Role: ac10-counter' })).output.summary).toBe('mock ac10-counter:plain #2');
    expect((await run({ prompt: '# Role: ac10-counter', schema: VERDICT })).output.summary).toBe('mock ac10-counter:verdict #1');
    expect((await run({ prompt: '# Role: ac10-counter-other' })).output.summary).toBe('mock ac10-counter-other:plain #1');
  });

  test('a task heading takes the key instead of the schema kind', async () => {
    const prompt = '# Role: ac10-task\n\n# Task Q-0046.1 (backend)\nDo the thing.';
    expect((await run({ prompt })).output.summary).toBe('mock ac10-task:Q-0046.1 #1');
  });

  test('a prompt with no role at all still has a key', async () => {
    expect((await run({ prompt: 'no headings here' })).output.summary).toBe('mock agent:plain #1');
  });

  test('the delay is the configured one', async () => {
    const started = Date.now();
    await mockAdapter({ delayMs: 60 }).run({ prompt: '# Role: ac10-delay', schema: PLAIN, cwd: tempDir('mock-'), allowWrite: false });
    expect(Date.now() - started).toBeGreaterThanOrEqual(50);
  });

  test('it emits one stdout event and nothing else', async () => {
    const events: AdapterEvent[] = [];
    await run({ prompt: '# Role: ac10-events', onEvent: (event) => events.push(event) });
    expect(events.map((event) => event.type)).toStrictEqual(['stdout']);
    expect(adapterEventSchema.safeParse(events[0]).success).toBe(true);
    expect(events[0].type === 'stdout' && events[0].line).toContain('[mock] ac10-events:plain call #1');
  });
});

describe('AC-10 — the verdict rule', () => {
  test('the first call per key fails and every call after it passes', async () => {
    const first = await run({ prompt: '# Role: ac10-verdict', schema: VERDICT });
    expect(first.output.verdict).toBe('changes-requested');
    expect(first.output.findings).toStrictEqual(['major: src/mock.ts:1 (mock) placeholder finding']);

    const second = await run({ prompt: '# Role: ac10-verdict', schema: VERDICT });
    expect(second.output.verdict).toBe('approve');
    expect(second.output.findings).toStrictEqual([]);
  });

  test('MOCK_ALWAYS_PASS passes on the first call, where the rule would have failed', async () => {
    await withEnv({ MOCK_ALWAYS_PASS: '1', MOCK_ALWAYS_FAIL: null }, async () => {
      const res = await run({ prompt: '# Role: ac10-always-pass', schema: VERDICT });
      expect(res.output.verdict).toBe('approve');
      expect(res.output.findings).toStrictEqual([]);
    });
  });

  test('MOCK_ALWAYS_FAIL fails on the second call, where the rule would have passed', async () => {
    await withEnv({ MOCK_ALWAYS_FAIL: '1', MOCK_ALWAYS_PASS: null }, async () => {
      await run({ prompt: '# Role: ac10-always-fail', schema: VERDICT });
      const second = await run({ prompt: '# Role: ac10-always-fail', schema: VERDICT });
      expect(second.output.verdict).toBe('changes-requested');
      expect(second.output.findings).toHaveLength(1);
    });
  });

  test('the two switches together are refused in as many words', async () => {
    await withEnv({ MOCK_ALWAYS_PASS: '1', MOCK_ALWAYS_FAIL: '1' }, async () => {
      const error = await thrown(() => run({ prompt: '# Role: ac10-exclusive', schema: VERDICT }));
      expect(error.message).toBe('MOCK_ALWAYS_PASS and MOCK_ALWAYS_FAIL are mutually exclusive');
    });
  });

  test('a schema with no verdict gets no verdict, whatever the switches say', async () => {
    await withEnv({ MOCK_ALWAYS_FAIL: '1', MOCK_ALWAYS_PASS: null }, async () => {
      const res = await run({ prompt: '# Role: ac10-no-verdict', schema: WRITES });
      expect(Object.hasOwn(res.output, 'verdict')).toBe(false);
      expect(Object.hasOwn(res.output, 'findings')).toBe(false);
    });
  });
});

describe('AC-10 — what a schema asks for is what it answers with', () => {
  test('a document step gets a document, and it carries the tasks fixture', async () => {
    const res = await run({ prompt: '# Role: ac10-document\n\n## Input: one\n## Input: two', schema: WRITES });
    const document = String(res.output.document);
    expect(document).toContain('# ac10-document output (mock, call 1)');
    expect(document).toContain('mentioned 2 inputs');
    expect(document).toContain('id: "T-0000.1"');
  });

  test('the tasks step gets the fixture on its own, with the ticket\'s id substituted', async () => {
    const res = await run({ prompt: '# Role: ac10-tasks\n# Ticket T-0009: port\n\nExtract the Tasks section', schema: WRITES });
    expect(res.output.document).toBe(
      'tasks:\n'
      + '  - id: "T-0009.1"\n    role: backend\n    title: Proration service\n'
      + '    contracts: [contracts/ProrationService.ts]\n    depends_on: []\n'
      + '  - id: "T-0009.2"\n    role: frontend\n    title: Downgrade confirmation\n'
      + '    contracts: [contracts/ProrationService.ts]\n    depends_on: ["T-0009.1"]\n',
    );
  });

  test('a probe-shaped schema gets its `ok`', async () => {
    const res = await run({ prompt: '# Role: ac10-ok', schema: { type: 'object', properties: { ok: { type: 'boolean' }, summary: { type: 'string' } }, required: ['ok', 'summary'], additionalProperties: false } });
    expect(res.output.ok).toBe(true);
  });
});

describe('AC-10 — usage, and the switches that shape it', () => {
  test('MOCK_TOKEN_ONLY reports tokens and no price at all — never a rounded zero', async () => {
    await withEnv({ MOCK_TOKEN_ONLY: '1' }, async () => {
      const res = await run({ prompt: '# Role: ac10-token-only' });
      expect(res.usage?.cost_usd).toBeNull();
      expect(res.usage?.output_tokens).toBe(200);
    });
  });

  test('MOCK_VENDOR relabels the call, on the result and on its usage', async () => {
    await withEnv({ MOCK_VENDOR: 'claude' }, async () => {
      const res = await run({ prompt: '# Role: ac10-vendor' });
      expect(res.vendor).toBe('claude');
      expect(res.usage?.vendor).toBe('claude');
    });
  });

  test('the cache measures are folded INTO input_tokens, never reported larger than it', async () => {
    // contracts/Q-0011/mock-adapter-run-history.contract.md: the cached fields are subsets of
    // input_tokens. Before Q-0034 they were computed beside it and the subset could exceed it.
    await withEnv({ MOCK_CACHED_INPUT_TOKENS: '500', MOCK_CACHE_WRITE_INPUT_TOKENS: '100' }, async () => {
      const usage = (await run({ prompt: '# Role: ac10-cache' })).usage;
      expect(usage?.cached_input_tokens).toBe(500);
      expect(usage?.cache_write_input_tokens).toBe(100);
      expect(usage?.input_tokens).toBeGreaterThanOrEqual(600);
      expect(usage?.cached_input_tokens ?? 0).toBeLessThanOrEqual(usage?.input_tokens ?? 0);
    });
  });

  test('an unset or empty numeric switch is null, not zero', async () => {
    await withEnv({ MOCK_CACHED_INPUT_TOKENS: '' }, async () => {
      expect((await run({ prompt: '# Role: ac10-cache-empty' })).usage?.cached_input_tokens).toBeNull();
    });
  });

  test.each([
    ['MOCK_CACHED_INPUT_TOKENS', '-1', 'MOCK_CACHED_INPUT_TOKENS must be a non-negative number'],
    ['MOCK_CACHE_WRITE_INPUT_TOKENS', 'nope', 'MOCK_CACHE_WRITE_INPUT_TOKENS must be a non-negative number'],
  ])('%s = %s is refused by name', async (name, value, message) => {
    await withEnv({ [name]: value }, async () => {
      expect((await thrown(() => run({ prompt: '# Role: ac10-bad-numeric' }))).message).toBe(message);
    });
  });
});

describe('AC-10 — MOCK_RUN_HISTORY_PROFILES', () => {
  test('a profile applies to its own role and leaves the others alone', async () => {
    await withEnv({ MOCK_RUN_HISTORY_PROFILES: JSON.stringify({ 'ac10-profiled': { vendor: 'codex', token_only: true, cached_input_tokens: 7 } }) }, async () => {
      const profiled = await run({ prompt: '# Role: ac10-profiled' });
      expect(profiled.usage).toMatchObject({ vendor: 'codex', cost_usd: null, cached_input_tokens: 7 });

      const other = await run({ prompt: '# Role: ac10-unprofiled' });
      expect(other.usage).toMatchObject({ vendor: 'mock', cost_usd: 0.01, cached_input_tokens: null });
    });
  });

  test('a profile beats the environment switch it overlaps with', async () => {
    await withEnv({
      MOCK_CACHED_INPUT_TOKENS: '999',
      MOCK_RUN_HISTORY_PROFILES: JSON.stringify({ 'ac10-profile-wins': { cached_input_tokens: 5 } }),
    }, async () => {
      expect((await run({ prompt: '# Role: ac10-profile-wins' })).usage?.cached_input_tokens).toBe(5);
    });
  });

  test.each([
    ['invalid JSON', '{bad', /^MOCK_RUN_HISTORY_PROFILES is invalid JSON: /],
    ['a JSON array', '[]', /^MOCK_RUN_HISTORY_PROFILES must be an object$/],
    ['a role entry that is not an object', '{"ac10-bad-profile": 3}', /^mock profile for ac10-bad-profile must be an object$/],
    ['a profile field that is not a number', '{"ac10-bad-profile": {"cached_input_tokens": "lots"}}', /^mock profile ac10-bad-profile cached_input_tokens must be a non-negative number$/],
  ])('%s is refused with its own message', async (_label, value, expected) => {
    await withEnv({ MOCK_RUN_HISTORY_PROFILES: value }, async () => {
      expect((await thrown(() => run({ prompt: '# Role: ac10-bad-profile' }))).message).toMatch(expected);
    });
  });
});

describe('AC-10 — MOCK_FAIL_WRITE bills the call it kills', () => {
  test('the thrown error carries the vendor and what the request cost', async () => {
    await withEnv({ MOCK_FAIL_WRITE: 'solution/tasks.yaml' }, async () => {
      const error = await thrown(() => run({ prompt: '# Role: ac10-fail-write\n\nWrite solution/tasks.yaml please.' }));
      expect(error.message).toBe('mock: simulated adapter failure for solution/tasks.yaml');
      expect(error.vendor).toBe('mock');
      expect(error.usage).toMatchObject({ vendor: 'mock', input_tokens: 100, output_tokens: 10, cost_usd: 0.07 });
    });
  });

  test('a step whose prompt does not mention it is untouched', async () => {
    await withEnv({ MOCK_FAIL_WRITE: 'solution/tasks.yaml' }, async () => {
      expect((await run({ prompt: '# Role: ac10-fail-write-other' })).output.summary).toBe('mock ac10-fail-write-other:plain #1');
    });
  });

  test('and it reports no price when the vendor reports none', async () => {
    await withEnv({ MOCK_FAIL_WRITE: 'tasks.yaml', MOCK_TOKEN_ONLY: '1' }, async () => {
      const error = await thrown(() => run({ prompt: '# Role: ac10-fail-write-unpriced\n\ntasks.yaml' }));
      expect(error.usage?.cost_usd).toBeNull();
    });
  });
});

describe('AC-10 — what it writes, and where', () => {
  test('allowWrite: false leaves the directory it was given exactly as it found it', async () => {
    const cwd = tempDir('mock-readonly-');
    for (const [role, schema] of [['principal-architect', PLAIN], ['automation-qa', PLAIN], ['developer-backend', PLAIN]] as const) {
      await run({ prompt: `# Role: ${role}\n# Ticket T-0100: x\n\n# Task T-0100.1 (backend)`, schema, cwd, allowWrite: false });
    }
    expect(walk(cwd)).toStrictEqual([]);
  });

  test('the architect writes its contract, inside the cwd and nowhere else', async () => {
    const cwd = tempDir('mock-architect-');
    await run({ prompt: '# Role: principal-architect', cwd, allowWrite: true });
    expect(walk(cwd)).toStrictEqual(['contracts', 'contracts/ProrationService.ts']);
    expect(fs.readFileSync(path.join(cwd, 'contracts/ProrationService.ts'), 'utf8')).toContain('export interface ProrationService');
  });

  test('QA writes a suite that fails until every task\'s source exists', async () => {
    const cwd = tempDir('mock-qa-');
    await run({ prompt: '# Role: automation-qa\n# Ticket T-0200: x', cwd, allowWrite: true });
    expect(walk(cwd)).toStrictEqual(['tests', 'tests/check.sh']);
    expect(fs.readFileSync(path.join(cwd, 'tests/check.sh'), 'utf8')).toContain('src/T-0200.1.ts src/T-0200.2.ts');
  });

  test('a developer writes its own task\'s file and no other', async () => {
    const cwd = tempDir('mock-dev-');
    await run({ prompt: '# Role: developer-backend\n\n# Task T-0300.1 (backend)', cwd, allowWrite: true });
    expect(walk(cwd)).toStrictEqual(['src', 'src/T-0300.1.ts']);
  });

  test('a role with no writing job of its own writes nothing even when it may', async () => {
    const cwd = tempDir('mock-nowrite-');
    await run({ prompt: '# Role: ac10-idle', cwd, allowWrite: true });
    expect(walk(cwd)).toStrictEqual([]);
  });

  test('MOCK_DEV_FLAKY skips the second task\'s first attempt, and says so', async () => {
    await withEnv({ MOCK_DEV_FLAKY: '1' }, async () => {
      const cwd = tempDir('mock-flaky-');
      const prompt = '# Role: developer-backend\n\n# Task T-0400.2 (backend)';

      const first = await run({ prompt, cwd, allowWrite: true });
      expect(first.output.summary).toBe('mock developer-backend:T-0400.2 #1 (flaky: wrote nothing)');
      expect(walk(cwd)).toStrictEqual([]);

      const second = await run({ prompt, cwd, allowWrite: true });
      expect(second.output.summary).toBe('mock developer-backend:T-0400.2 #2');
      expect(walk(cwd)).toStrictEqual(['src', 'src/T-0400.2.ts']);
    });
  });

  test('the first task is never flaky — only the one the fan-out needs to fail', async () => {
    await withEnv({ MOCK_DEV_FLAKY: '1' }, async () => {
      const cwd = tempDir('mock-flaky-first-');
      await run({ prompt: '# Role: developer-backend\n\n# Task T-0500.1 (backend)', cwd, allowWrite: true });
      expect(walk(cwd)).toStrictEqual(['src', 'src/T-0500.1.ts']);
    });
  });
});

describe('AC-11 defect 4 — the mock assumes schemaFor\'s output', () => {
  test('a schema with no `properties` throws a raw TypeError rather than being reported', async () => {
    // No guard is added: the mock is only ever handed a generated schema, and inventing a message
    // here would be a behaviour change (charter §2). Preserved, pinned, and named in the report.
    const error = await thrown(() => run({ prompt: '# Role: ac11-no-properties', schema: { type: 'object' } }));
    expect(error).toBeInstanceOf(TypeError);
    expect(error.message).toContain("reading 'verdict'");
  });
});
