// Q-0047 AC-2: the registry regains its two entries.
//
// Q-0046 shipped `getAdapter` with `mock` alone and said so in its own JSDoc — a deliberate
// transitional divergence, with `getAdapter('claude')` throwing in `core` while the spike answered
// it. The membership was left unpinned in adapters.test.ts for exactly this landing; what was
// already pinned there is that every name the message lists must resolve.
import { afterAll, describe, expect, test } from 'vitest';

import { getAdapter } from './adapters.js';
import type { AdapterRunOptions, AdapterSchema } from './adapters.js';
import { cliStub } from '../../test/cli-stub.js';
import { removeTempDirs, tempDir } from '../../test/repo.js';

afterAll(removeTempDirs);

const SCHEMA: AdapterSchema = { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] };

const runOptions = (): AdapterRunOptions => ({
  prompt: 'a prompt', schema: SCHEMA, cwd: tempDir('registry-cwd-'), allowWrite: false,
});

describe('AC-2 — claude and codex resolve, and an unknown name lists all three', () => {
  test.each(['claude', 'codex'])('%s resolves to a retry-wrapped adapter billing under its own name', async (name) => {
    const stub = cliStub({ stdout: '{"summary": "ok"}' });
    const adapter = getAdapter(name, { [name]: { bin: stub.bin } });

    expect(adapter.vendor).toBe(name);
    const result = await adapter.run(runOptions());
    expect(result.vendor).toBe(name);
    expect(result.attempts, 'getAdapter hands out wrapped adapters and only wrapped ones').toBe(1);
  });

  test('an unknown name is refused with the registry\'s own keys, in the spike\'s order', () => {
    // The order is the spike's (spike/src/adapters/index.js:25), so both sides of the port print
    // the same sentence to a stranger who typed a name that does not exist.
    expect(() => getAdapter('gemini')).toThrow('unknown adapter "gemini" (known: claude, codex, mock)');
  });

  test('each vendor\'s harness.yaml entry reaches that vendor\'s argv, and not the other\'s', async () => {
    const claude = cliStub({ stdout: '{"summary": "ok"}' });
    const codex = cliStub({ stdout: '{"summary": "ok"}' });
    const config = {
      claude: { bin: claude.bin, extraArgs: ['--only-claude'] },
      codex: { bin: codex.bin, extraArgs: ['--only-codex'] },
    };

    await getAdapter('claude', config).run(runOptions());
    await getAdapter('codex', config).run(runOptions());

    expect(claude.argv()).toContain('--only-claude');
    expect(claude.argv()).not.toContain('--only-codex');
    expect(codex.argv()).toContain('--only-codex');
    expect(codex.argv()).not.toContain('--only-claude');
  });
});
