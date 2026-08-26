/**
 * The mock adapter: every flow, loop, gate, worktree and integration this product has, provable
 * without a CLI and without spending anything. It ships beside the contract layer rather than beside
 * the vendors because it is what every test and every demo runs on (docs/04-architecture.md).
 *
 * What it simulates, and what each is for:
 *
 * - a reviewer returns the FAILING verdict on its first call per key and the passing one afterwards,
 *   so a bounded revise loop has something to converge from. `MOCK_ALWAYS_PASS` and
 *   `MOCK_ALWAYS_FAIL` force it either way;
 * - the architect writes a contract file, and the tasks step emits a real `tasks.yaml`;
 * - QA writes `tests/check.sh`, which fails until every task's source file exists;
 * - developers write `src/<task>.ts` in their own worktree, and `MOCK_DEV_FLAKY=1` makes the second
 *   task skip its first attempt, so integration fails once and the fan-out re-runs scoped.
 *
 * The call counter is MODULE-SCOPED and no reset is exported. In the spike every run is a fresh
 * process, so the counter is per-run; under Vitest a test file shares this module for its lifetime.
 * A test therefore selects behaviour with the always-switches or with a role name of its own, and no
 * test may depend on being the first caller for a key it shares with another. Adding a reset export
 * would be a behaviour change (charter §2), and Q-0054 inherits this constraint.
 *
 * Why: behaviour preserved from spike/src/adapters/mock.js (Q-0046).
 */
import fs from 'node:fs';
import path from 'node:path';

import type { Adapter, AdapterConfig, AdapterError, AdapterResult, AdapterUsage } from './adapters.js';

/** How many times each `role:task` or `role:kind` key has been called, for the life of the module. */
const calls = new Map<string, number>();

/** What the tasks step emits, with `{id}` replaced by the ticket's own id. */
const TASKS = `tasks:
  - id: "{id}.1"
    role: backend
    title: Proration service
    contracts: [contracts/ProrationService.ts]
    depends_on: []
  - id: "{id}.2"
    role: frontend
    title: Downgrade confirmation
    contracts: [contracts/ProrationService.ts]
    depends_on: ["{id}.1"]
`;

/**
 * One role's entry in `MOCK_RUN_HISTORY_PROFILES`, as the switch documents it.
 *
 * The two numeric fields are validated by {@link numericSwitch}; the other two are trusted, exactly
 * as the spike trusts them.
 */
interface MockProfile {
  vendor?: string;
  token_only?: boolean;
  cached_input_tokens?: number;
  cache_write_input_tokens?: number;
}

/** What the mock answers with. A type alias rather than an interface, so it is an {@link AdapterResult}'s `output`. */
type MockOutput = {
  summary: string;
  document?: string;
  ok?: boolean;
  /** Whatever the schema's enum held, unexamined — the mock chooses a member, it does not coerce one. */
  verdict?: unknown;
  findings?: string[];
};

/**
 * The mock adapter, which is a real {@link Adapter} in every respect except that it talks to nobody.
 *
 * @param cfg only `delayMs` is read — the simulated latency, 20ms unless a caller says otherwise.
 */
export function mockAdapter(cfg: AdapterConfig = {}): Adapter {
  return {
    vendor: 'mock',
    async check(): Promise<string> { return 'mock 0.0.1'; },
    async run({ prompt, schema, model, cwd, allowWrite, onEvent }): Promise<AdapterResult> {
      const role = (prompt.match(/^# Role: (.+)$/m) ?? [])[1] ?? 'agent';
      const profile = mockProfile(role);
      const vendor = profile.vendor ?? nonempty(process.env.MOCK_VENDOR) ?? 'mock';
      const cached = numericSwitch('MOCK_CACHED_INPUT_TOKENS', profile.cached_input_tokens);
      const cacheWrite = numericSwitch('MOCK_CACHE_WRITE_INPUT_TOKENS', profile.cache_write_input_tokens);
      // The cache measures are folded INTO input_tokens rather than computed beside it, exactly as
      // the real vendor's fields are: a cached subset larger than its superset is what
      // contracts/Q-0011/mock-adapter-run-history.contract.md forbids. See Q-0034.
      const uncachedInput = prompt.length / 4 | 0;
      const usage: AdapterUsage = { vendor, input_tokens: uncachedInput + (cached ?? 0) + (cacheWrite ?? 0), output_tokens: 200, cached_input_tokens: cached, cache_write_input_tokens: cacheWrite, cost_usd: profile.token_only || process.env.MOCK_TOKEN_ONLY === '1' ? null : 0.01 };
      const ticketId = (prompt.match(/^# Ticket (T-\d+)/m) ?? [])[1] ?? 'T-0000';
      const task = (prompt.match(/^# Task (\S+) \((\w+)\)/m) ?? []);
      // Why: preserved defect, see Q-0046 AC-11 defect 4 — a schema with no `properties` throws a
      // raw TypeError here rather than being reported, because the mock assumes `schemaFor`'s output.
      const kind = schema.properties!.verdict ? 'verdict' : 'plain';
      const key = task[1] ? `${role}:${task[1]}` : `${role}:${kind}`;
      const n = (calls.get(key) ?? 0) + 1; calls.set(key, n);
      // MOCK_FAIL_WRITE=<substring> makes exactly the step whose prompt mentions that output blow
      // up, so the engine's "keep the siblings' work" behaviour is testable without a real CLI.
      if (process.env.MOCK_FAIL_WRITE && prompt.includes(process.env.MOCK_FAIL_WRITE)) {
        // Billed like a real vendor would: the request was made and charged before it failed.
        const error: AdapterError = new Error(`mock: simulated adapter failure for ${process.env.MOCK_FAIL_WRITE}`);
        error.vendor = vendor;
        error.usage = { ...usage, input_tokens: 100, output_tokens: 10, cost_usd: profile.token_only || process.env.MOCK_TOKEN_ONLY === '1' ? null : 0.07 };
        throw error;
      }
      onEvent?.({ type: 'stdout', line: `[mock] ${key} call #${n} (model ${model ?? '-'}, cwd ${path.basename(cwd ?? '')}, write=${allowWrite})` });
      await new Promise((resolve) => { setTimeout(resolve, cfg.delayMs ?? 20); });

      const output: MockOutput = { summary: `mock ${key} #${n}` };
      const write = (rel: string, text: string): void => { const file = path.join(cwd, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };

      if (allowWrite && role === 'principal-architect') write('contracts/ProrationService.ts', `export interface ProrationService { prorate(days: number): number } // mock call ${n}\n`);
      if (allowWrite && role === 'automation-qa') {
        write('tests/check.sh', `#!/bin/sh\nfor f in src/${ticketId}.1.ts src/${ticketId}.2.ts; do [ -f "$f" ] || { echo "MISSING $f"; exit 1; }; done\necho "all present"\n`);
      }
      if (allowWrite && task[1] && role.startsWith('developer-')) {
        const flaky = process.env.MOCK_DEV_FLAKY === '1' && task[1].endsWith('.2') && n === 1;
        if (flaky) output.summary += ' (flaky: wrote nothing)';
        else write(`src/${task[1]}.ts`, `// ${task[1]} by ${role} (mock call ${n})\nexport const ok = true;\n`);
      }

      if (schema.properties!.document) {
        output.document = prompt.includes('Extract the Tasks section')
          ? TASKS.replaceAll('{id}', ticketId)
          : `# ${role} output (mock, call ${n})\n\nPrompt was ${prompt.length} chars and mentioned ${(prompt.match(/^## Input: /gm) ?? []).length} inputs.\n\n\`\`\`yaml\n${TASKS.replaceAll('{id}', ticketId)}\`\`\`\n`;
      }
      if (schema.properties!.ok) output.ok = true;   // the adapters --probe round-trip
      if (schema.properties!.verdict) {
        const alwaysPass = process.env.MOCK_ALWAYS_PASS === '1';
        const alwaysFail = process.env.MOCK_ALWAYS_FAIL === '1';
        if (alwaysPass && alwaysFail) {
          throw new Error('MOCK_ALWAYS_PASS and MOCK_ALWAYS_FAIL are mutually exclusive');
        }
        const opts = schema.properties!.verdict.enum!;
        const fail = alwaysFail || (!alwaysPass && n === 1);
        output.verdict = fail ? opts[opts.length - 1] : opts[0];
        output.findings = fail ? [
          'major: src/mock.ts:1 (mock) placeholder finding',
        ] : [];
      }
      return { vendor, output, raw: JSON.stringify(output), usage, session: null, ms: 20 };
    },
  };
}

/** A string that is present and not empty, or `null` — an unset switch and an empty one are the same. */
function nonempty(value: string | undefined): string | null { return typeof value === 'string' && value.length ? value : null; }

/**
 * A switch that must be a finite, non-negative number if it is set at all.
 *
 * @param name what a failure names — an environment variable, or a profile field's full path.
 * @param override a profile's own value, which wins over the environment.
 * @throws {Error} naming the switch when the value is neither absent nor a non-negative number.
 */
function numericSwitch(name: string, override?: unknown): number | null {
  const raw = override ?? process.env[name];
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${name} must be a non-negative number`);
  return n;
}

/**
 * One role's usage profile from `MOCK_RUN_HISTORY_PROFILES`, so a run can produce realistic
 * per-vendor history without a real CLI.
 *
 * @throws {Error} with a distinct message for each of: invalid JSON, a map that is not an object, a
 *   role entry that is not an object, and a numeric field that is not a non-negative number.
 */
function mockProfile(role: string): MockProfile {
  const raw = process.env.MOCK_RUN_HISTORY_PROFILES;
  if (!raw) return {};
  let profiles: unknown;
  try { profiles = JSON.parse(raw); } catch (e) { throw new Error(`MOCK_RUN_HISTORY_PROFILES is invalid JSON: ${(e as Error).message}`); }
  if (!profiles || Array.isArray(profiles) || typeof profiles !== 'object') throw new Error('MOCK_RUN_HISTORY_PROFILES must be an object');
  const profile = (profiles as Record<string, unknown>)[role] ?? {};
  if (!profile || Array.isArray(profile) || typeof profile !== 'object') throw new Error(`mock profile for ${role} must be an object`);
  const typed = profile as MockProfile;
  numericSwitch(`mock profile ${role} cached_input_tokens`, typed.cached_input_tokens);
  numericSwitch(`mock profile ${role} cache_write_input_tokens`, typed.cache_write_input_tokens);
  return typed;
}
