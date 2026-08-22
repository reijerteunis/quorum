// Adapter contract (see docs/ADAPTER-CONTRACT.md).
//
//   run({ prompt, schema, model, cwd, extraDirs, maxTurns, allowWrite, onEvent }) -> Promise<AdapterResult>
//
//   AdapterResult = {
//     output:   object            // validated against `schema` (the "structured tail")
//     raw:      string            // the agent's final message as text
//     usage:    { input_tokens, output_tokens, cost_usd }   // any field may be null
//     session:  string | null
//     vendor:   'claude' | 'codex' | 'mock'
//     ms:       number
//   }
//
// Every adapter MUST end up with `output` as parsed JSON. Native structured output
// (claude --json-schema, codex --output-schema) is the primary path; the fallback
// is extractJson() on the final message: last ```json fence or last {...} block.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { claudeAdapter } from './claude.js';
import { codexAdapter } from './codex.js';
import { mockAdapter } from './mock.js';

const registry = { claude: claudeAdapter, codex: codexAdapter, mock: mockAdapter };

export function getAdapter(name, config = {}) {
  const a = registry[name];
  if (!a) throw new Error(`unknown adapter "${name}" (known: ${Object.keys(registry).join(', ')})`);
  const cfg = config[name] ?? {};
  return withRetry(a(cfg), cfg.retry);
}

// A dropped connection is not a verdict. These are failures of the network between here and the
// vendor, not of the work — retrying is what a human would do, and losing a $4 step to a minute
// of bad wifi is the kind of thing that makes a tool untrustworthy. See Q-0004.
const TRANSIENT = [
  [/connection closed/i, 'the connection closed mid-response'],
  [/connection error/i, 'a connection error'],
  [/socket hang up/i, 'the socket hung up'],
  [/\b(ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|EPIPE)\b/, 'a network error'],
  [/fetch failed/i, 'the request could not be sent'],
  // Specific before generic: "429 rate_limit_error" is a rate limit, not an anonymous 5xx.
  [/rate.?limit/i, 'a rate limit'],
  [/overloaded/i, 'the vendor reporting overload'],
  [/\b(429|500|502|503|504|529)\b/, 'a server error'],
  [/temporarily unavailable/i, 'the vendor being temporarily unavailable'],
  [/stream (was )?interrupted/i, 'the stream being interrupted'],
  [/timed? ?out/i, 'a timeout'],
];

// Returns a description when the failure looks worth retrying, else null. Deterministic failures
// — a bad login, an unavailable model, an invalid schema, an exhausted turn budget — return null:
// retrying those just spends the budget again to reach the same answer.
export function transientError(text = '') {
  if (authError('x', text)) return null;          // auth and model availability never self-heal
  for (const [re, describe] of TRANSIENT) if (re.test(text)) return describe;
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Wraps any adapter — including a contributor's — so the retry policy lives in one place.
// Defaults sized against the failure that prompted this: a home connection gone for about a
// minute. 5s + 10s + 20s + 40s spans 75s of downtime. The cost of being wrong is asymmetric — a
// genuinely dead network wastes 75s, while giving up too early wastes a step that cost dollars
// and ten minutes. Override per adapter with `adapters.<vendor>.retry` in harness.yaml.
export function withRetry(adapter, { attempts = 5, baseDelayMs = 5000, maxDelayMs = 60000 } = {}) {
  return {
    ...adapter,
    async run(opts) {
      const spent = { input_tokens: 0, output_tokens: 0, cost_usd: 0 };
      const add = (u) => {
        if (!u) return;
        spent.input_tokens += u.input_tokens ?? 0;
        spent.output_tokens += u.output_tokens ?? 0;
        spent.cost_usd += u.cost_usd ?? 0;
      };
      for (let attempt = 1; ; attempt++) {
        try {
          const res = await adapter.run(opts);
          if (attempt > 1) {
            // Earlier attempts were billed too; a run's cost must include what the retries cost.
            add(res.usage);
            return { ...res, usage: { ...res.usage, input_tokens: spent.input_tokens, output_tokens: spent.output_tokens, cost_usd: res.usage?.cost_usd == null && spent.cost_usd === 0 ? null : spent.cost_usd }, attempts: attempt };
          }
          return res;
        } catch (e) {
          add(e.usage);
          const why = transientError(e.message);
          if (!why || attempt >= attempts) {
            if (spent.cost_usd || spent.input_tokens) e.usage = { ...spent, cost_usd: spent.cost_usd || null };
            if (why) e.message = `${e.message} (gave up after ${attempt} attempts)`;
            throw e;
          }
          const delayMs = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
          opts.onEvent?.({ type: 'retry', vendor: adapter.vendor, attempt, of: attempts, delayMs, reason: why, message: String(e.message).slice(0, 160) });
          await sleep(delayMs);
        }
      }
    },
  };
}

// A CLI can be installed, report a version, and still be unable to talk to its vendor because
// the subscription login expired. The CLIs bury that in a wall of stack traces, so translate it
// into the one sentence that tells the user what to do. See Q-0001.
const AUTH_PATTERNS = [
  /refresh token/i, /log ?out and (sign|log) ?in again/i, /401 Unauthorized/i,
  /not logged in/i, /please run\s+\/?login/i, /authentication (failed|required)/i,
  /invalid api key/i, /oauth token (has )?expired/i, /session (has )?expired/i,
];

const RELOGIN = { claude: 'claude  (then /login)', codex: 'codex logout && codex login' };

// Returns a clear one-line message when `text` looks like an auth failure, else null.
export function authError(vendor, text = '') {
  // A model the subscription cannot use reads like a generic 400. Name the real problem, since
  // the fix is to change the flow or the CLI config, not to log in again. See Q-0001.
  const m = text.match(/The '([^']+)' model is not supported when using (\w+) with a ([\w ]+) account/i);
  if (m) return `${vendor}: model "${m[1]}" is not available on a ${m[3]} subscription — remove the model from the flow step (and from ~/.codex/config.toml) to let the CLI pick one its own login supports`;
  if (!AUTH_PATTERNS.some((re) => re.test(text))) return null;
  return `${vendor} login expired or missing — run: ${RELOGIN[vendor] ?? `${vendor} login`}`;
}

// A real authenticated round-trip: the smallest possible paid request. check() only proves the
// binary exists; this proves the subscription actually answers. Used by `harness adapters --probe`.
// additionalProperties:false and every property in `required` are mandatory for OpenAI strict
// structured outputs — codex rejects anything else. schemaFor() already obeys this; so must we.
const PROBE_SCHEMA = {
  type: 'object',
  properties: { ok: { type: 'boolean' }, summary: { type: 'string' } },
  required: ['ok'], additionalProperties: false,
};
const PROBE_PROMPT = 'Reply with exactly this JSON and nothing else: {"ok": true}. Do not use any tools.';

export async function probeAdapter(adapter, { cwd, model } = {}) {
  const t0 = Date.now();
  // Deliberately an empty directory: run it in the project and the CLI loads CLAUDE.md, rules and
  // whatever else the repo carries, which turned a hello-world round-trip into $0.39. See Q-0001.
  const sandbox = cwd ?? fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-probe-'));
  const disposable = !cwd;
  try {
    const res = await adapter.run({ prompt: PROBE_PROMPT, schema: PROBE_SCHEMA, model, cwd: sandbox, extraDirs: [], allowWrite: false });
    const problems = checkAgainstSchema(res.output, PROBE_SCHEMA);
    if (problems.length) return { ok: false, vendor: adapter.vendor, ms: Date.now() - t0, error: `structured output invalid (${problems.join('; ')})`, raw: (res.raw ?? '').slice(0, 400) };
    return { ok: true, vendor: adapter.vendor, ms: Date.now() - t0, cost_usd: res.usage.cost_usd ?? null, tokens: (res.usage.input_tokens ?? 0) + (res.usage.output_tokens ?? 0), session: res.session };
  } catch (e) {
    // Normalise here too, not only inside the built-in adapters: a contributor's adapter should
    // not have to remember to translate its vendor's auth noise.
    return { ok: false, vendor: adapter.vendor, ms: Date.now() - t0, error: authError(adapter.vendor, e.message) ?? e.message };
  } finally {
    if (disposable) fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

export function extractJson(text) {
  if (!text) return null;
  const fences = [...text.matchAll(/```(?:json)?\s*\n([\s\S]*?)\n```/g)];
  for (let i = fences.length - 1; i >= 0; i--) {
    try { return JSON.parse(fences[i][1]); } catch { /* keep looking */ }
  }
  const start = text.lastIndexOf('\n{');
  if (start >= 0) { try { return JSON.parse(text.slice(start + 1)); } catch { /* fallthrough */ } }
  try { return JSON.parse(text.trim()); } catch { return null; }
}

// Minimal schema check: required keys present, enums honoured. Not a full validator on purpose.
export function checkAgainstSchema(obj, schema) {
  const problems = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return ['output is not an object'];
  for (const k of schema.required ?? []) if (!(k in obj)) problems.push(`missing "${k}"`);
  if (schema.additionalProperties === false) {
    for (const k of Object.keys(obj)) if (!(k in (schema.properties ?? {}))) problems.push(`unknown "${k}"`);
  }
  for (const [k, def] of Object.entries(schema.properties ?? {})) {
    if (k in obj && def.enum && !def.enum.includes(obj[k])) problems.push(`"${k}" must be one of ${def.enum.join('|')}, got ${JSON.stringify(obj[k])}`);
    if (!(k in obj)) continue;
    if (def.type === 'string' && (typeof obj[k] !== 'string' || (def.minLength && obj[k].length < def.minLength))) problems.push(`"${k}" must be a non-empty string`);
    if (def.type === 'array') {
      if (!Array.isArray(obj[k])) problems.push(`"${k}" must be an array`);
      else {
        if (def.minItems != null && obj[k].length < def.minItems) problems.push(`"${k}" needs at least ${def.minItems} item(s)`);
        if (def.maxItems != null && obj[k].length > def.maxItems) problems.push(`"${k}" needs at most ${def.maxItems} item(s)`);
        if (def.items?.type === 'string') for (const item of obj[k]) {
          if (typeof item !== 'string') problems.push(`"${k}" items must be strings`);
          else if (def.items.pattern && !(new RegExp(def.items.pattern)).test(item)) problems.push(`"${k}" item has invalid format: ${JSON.stringify(item)}`);
        }
      }
    }
  }
  if (obj.verdict === 'approve' && Array.isArray(obj.findings) && obj.findings.length) problems.push('approve requires empty findings');
  if (obj.verdict === 'changes-requested' && Array.isArray(obj.findings) && !obj.findings.length) problems.push('changes-requested requires findings');
  return problems;
}
