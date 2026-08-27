/**
 * The adapter contract: the interface a vendor CLI implements, and the four things this layer does
 * on behalf of every one of them — bounded retries, one actionable sentence when a login is dead, a
 * real authenticated round-trip, and the pair of functions that turn a vendor's final message into
 * an object the engine may route on.
 *
 * This is the file a contributor's adapter inherits, which is why `withRetry`, `authError` and
 * `probeAdapter` live here rather than in a vendor file: a third adapter gets all three without
 * writing any of them ("check() proves presence; only `adapters --probe` proves login",
 * docs/DECISIONS.md 2026-08-22).
 *
 * Nothing in this module calls `check()`. Presence and login are separate questions and no path
 * here may let the cheap one stand in for the expensive one — `probeAdapter` is the only
 * authenticated request in the package. The BYOS refusal itself sits inside each vendor's own
 * `check()`, ahead of its CLI probe, and is Q-0047's to assert
 * (backlog/Q-0046-…/requirements/errata.md E-1).
 *
 * Nothing here prints. The marker, the colour and the rendered sentence belong to the CLI, because
 * M3's server would otherwise put terminal control codes on a WebSocket (charter §7).
 *
 * Why: behaviour preserved from spike/src/adapters/index.js (Q-0046).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { USAGE_MEASURES } from '@quorum/shared';
import type { AdapterEvent, UsageMeasure } from '@quorum/shared';

import { claudeAdapter } from './claude.js';
import { codexAdapter } from './codex.js';
import { mockAdapter } from './mock.js';

// ---------- the contract, as types ----------

/**
 * What one call was billed: the five measures a vendor may report, plus the vendor it was billed to.
 *
 * Keyed by `USAGE_MEASURES` rather than by five more string literals — the constant exists because
 * the spike spells them twice and a roll-up drifts on the second copy. `null` means the vendor did
 * not report that measure, which is not zero ("Codex cost is reported as tokens, never priced
 * locally", docs/DECISIONS.md 2026-08-22).
 */
export type AdapterUsage = { vendor: string } & { [Measure in UsageMeasure]: number | null };

/** Usage as an adapter may hand it over — a measure, or the vendor, may be absent as well as null. */
type ReportedUsage = Partial<AdapterUsage>;

/**
 * A failure the vendor may still have charged for.
 *
 * {@link withRetry} reads all three fields off whatever an adapter throws and writes them back, so a
 * step that died still has its cost counted — one crashed review hid $4.54 of a $10.25 run before
 * this existed (docs/DECISIONS.md, M0's closing entry).
 */
export interface AdapterError extends Error {
  /** The vendor the failed call was billed to, when the call declared one. */
  vendor?: string;
  /** Whatever the call reported before it died. */
  usage?: ReportedUsage;
  /** How many invocations were made. Written by {@link withRetry}, never by an adapter. */
  attempts?: number;
}

/**
 * The JSON Schema subset this layer actually reads — what `checkAgainstSchema` enforces and what
 * {@link PROBE_SCHEMA} and the engine's generated step schemas are.
 *
 * A structural type and deliberately not a zod schema: collapsing it into `packages/shared`'s zod
 * would merge two of the four validations that must stay apart (register row 13;
 * packages/shared/src/step-output.ts:1-26). It is `AdapterSchema` rather than `StepSchema` because
 * `shared` already exports `stepOutputDeclarationSchema` for a flow file's `output:` block, and the
 * two mean opposite things: one is what a step was ASKED for, this is what an answer is CHECKED
 * against.
 */
export interface AdapterSchema {
  type?: string;
  properties?: Record<string, AdapterSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

/** One property of an {@link AdapterSchema}. Every field is optional; absent means unchecked. */
interface AdapterSchemaProperty {
  type?: string;
  enum?: unknown[];
  minLength?: number;
  minItems?: number;
  maxItems?: number;
  /** Only `items.type === 'string'` is inspected, and then only its `pattern`. */
  items?: { type?: string; pattern?: string };
  /** Carried to the vendor, read by nothing here. */
  description?: string;
}

/** What an adapter is invoked with. Everything the vendor CLIs read, and nothing they do not. */
export interface AdapterRunOptions {
  /** The complete prompt: role, ticket, inputs, task and output contract. */
  prompt: string;
  /** The shape the final answer must match. */
  schema: AdapterSchema;
  /** A vendor model alias, or absent to let the CLI pick one its own login supports. */
  model?: string;
  /** The repository directory, or the step's worktree when the step writes code. */
  cwd: string;
  /** Directories the agent may additionally read — the ticket folder, `harness/`. */
  extraDirs?: string[];
  /** The agentic turn budget: part of the contract, honoured only where a CLI has the flag. */
  maxTurns?: number;
  /** True only for worktree steps. */
  allowWrite: boolean;
  /**
   * The streaming trace. Typed as `packages/shared`'s union rather than as a local shape, so an
   * adapter cannot emit an event the one event format does not describe (register row 22).
   */
  onEvent?: (event: AdapterEvent) => void;
}

/**
 * What one adapter call answers with — the six fields docs/03-adapter-contract.md:38-45 names, and
 * nothing the wrapper adds.
 *
 * `usage` is `null` when nothing was reported rather than an object of five nulls, because a
 * roll-up counts any non-null usage as an occurrence and would otherwise invent a vendor row for a
 * call nobody measured.
 */
export interface AdapterResult {
  /** The structured tail: parsed JSON matching the `schema` the step asked for. */
  output: Record<string, unknown>;
  /** The agent's final message as text, kept for the raw file an invalid answer is saved beside. */
  raw: string;
  usage: AdapterUsage | null;
  /** The vendor's own session id, where it has one. */
  session: string | null;
  /**
   * Which vendor this call was billed to — a per-call declaration, not the adapter's name, which is
   * why both shipped adapters set it per call.
   *
   * Optional because the contract permits a call to omit it: `withRetry` then falls back through
   * `usage.vendor` to the adapter's own name, and a contributor implementing that documented case
   * must not meet a type error for it (docs/03-adapter-contract.md:48-51). What the wrapper hands
   * back is {@link RetriedAdapterResult}, where the resolution has happened and this is a `string`.
   */
  vendor?: string;
  /** Wall clock for the call. */
  ms: number;
}

/**
 * What a {@link RetryingAdapter} answers with: an {@link AdapterResult} plus the two things only the
 * wrapper can know — which vendor the call resolved to, and how many invocations it took.
 */
export interface RetriedAdapterResult extends AdapterResult {
  /** Resolved: the call's own declaration, else its usage's, else the adapter's own name. */
  vendor: string;
  /** How many invocations it took. Written by {@link withRetry}, never by an adapter. */
  attempts: number;
}

/**
 * One vendor CLI, as everything above the adapter layer sees it.
 *
 * `vendor` is an OPEN string, never an enum of the three shipped names: a contributor's adapter must
 * not need this file or `packages/shared` edited before it can exist (register row 22).
 */
export interface Adapter {
  /** The label this adapter bills under, and the key it is registered by. */
  vendor: string;
  /**
   * Cheap: it refuses when an API key is in the environment and confirms the binary runs. It makes
   * NO authenticated request, so it does not — and must never be read as if it does — prove that the
   * subscription login still works. Only {@link probeAdapter} proves that.
   */
  check(): Promise<string>;
  run(options: AdapterRunOptions): Promise<AdapterResult>;
}

/**
 * An adapter that has been through {@link withRetry} — which is every adapter {@link getAdapter}
 * hands out, and the only kind anything above this layer receives.
 *
 * It is an {@link Adapter} in every other respect; what the type adds is the guarantee the wrapper
 * makes about its answer.
 */
export interface RetryingAdapter extends Adapter {
  run(options: AdapterRunOptions): Promise<RetriedAdapterResult>;
}

/**
 * How many times a failing call is retried and how far apart.
 *
 * Declared here rather than imported: `retryPolicySchema` is a module-private const in
 * packages/shared/src/project.ts:36, and adding an export to a landed, declarations-only package is
 * a non-goal of this ticket (AC-2).
 */
export interface RetryPolicy {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

/**
 * One adapter's entry in `harness.yaml`'s `adapters` map, as {@link getAdapter} reads it and as each
 * factory receives it. Declared here for the same reason {@link RetryPolicy} is — its zod
 * counterpart, `adapterConfigSchema`, is module-private in packages/shared/src/project.ts:50.
 */
export interface AdapterConfig {
  /** The executable name an adapter spawns. */
  bin?: string;
  /** Appended to the CLI's argv. */
  extraArgs?: string[];
  /** The mock's simulated latency, in milliseconds. */
  delayMs?: number;
  /** Applied by {@link withRetry} over whatever the factory returned. */
  retry?: RetryPolicy;
}

/**
 * What {@link probeAdapter} answers: a round-trip that happened, or one that did not and why.
 *
 * `ok: false` is the ONLY thing a caller may render as an unusable login, which is exactly what
 * AC-11 defect 1 makes untrue today — see the note on {@link probeAdapter}.
 */
export type ProbeResult =
  | {
    ok: true;
    vendor: string;
    /** Round-trip wall clock. */
    ms: number;
    /** `null` where the vendor reports no price; never rounded to zero. */
    cost_usd: number | null;
    /** Input plus output tokens, counting an unreported measure as zero. */
    tokens: number;
    session: string | null;
  }
  | {
    ok: false;
    vendor: string;
    ms: number;
    /** One actionable sentence where {@link authError} recognised the failure, else the raw message. */
    error: string;
    /** The first 400 characters of the answer, present only when the structured tail was invalid. */
    raw?: string;
  };

// ---------- the registry ----------

/**
 * The adapters this package can hand out, by the name a flow step or `--adapter` uses.
 *
 * The two vendors and the mock, which is the whole of v1: `gemini` is a community milestone and is
 * designed as a copy-and-edit of `codex` (docs/04-architecture.md, §Adapters), needing nothing in
 * this file changed but a line here.
 *
 * The KEY ORDER is load-bearing, because it is the list an unknown name is answered with, and it is
 * the spike's own (spike/src/adapters/index.js:25) so both sides of the port print the same
 * sentence. Q-0046 shipped this with `mock` alone as a deliberate transitional divergence; Q-0047
 * restores the two entries.
 */
const registry: Record<string, (config: AdapterConfig) => Adapter> = { claude: claudeAdapter, codex: codexAdapter, mock: mockAdapter };

/**
 * Resolves an adapter name to a retry-wrapped adapter, configured from `harness.yaml`.
 *
 * @param name the adapter's registered name.
 * @param config the whole `adapters` map; the entry for `name` is what reaches the factory.
 * @returns the adapter, already wrapped in {@link withRetry}.
 * @throws {Error} naming the adapter and listing the registry's own keys — never a second, drifting
 *   list of what is known.
 */
export function getAdapter(name: string, config: Record<string, AdapterConfig> = {}): RetryingAdapter {
  const factory = registry[name];
  if (!factory) throw new Error(`unknown adapter "${name}" (known: ${Object.keys(registry).join(', ')})`);
  const cfg = config[name] ?? {};
  return withRetry(factory(cfg), cfg.retry);
}

// ---------- retrying what is worth retrying ----------

/**
 * Failures of the network between here and the vendor, each with the description a user reads.
 *
 * The order is load-bearing and SPECIFIC PRECEDES GENERIC: `429 rate_limit_error` is a rate limit,
 * not an anonymous 5xx. Reordering these changes which sentence a run prints without changing
 * whether it retries, so no assertion on the boolean would catch it (AC-5).
 *
 * Why: preserved defect, see Q-0046 AC-11 defect 2 — the bare status-code alternation matches any
 * message that happens to contain one of those numbers, so a compile error on line 502 is retried
 * five times across 75 seconds. The alternation is not narrowed here.
 */
const TRANSIENT: [RegExp, string][] = [
  [/connection closed/i, 'the connection closed mid-response'],
  [/connection error/i, 'a connection error'],
  [/socket hang up/i, 'the socket hung up'],
  [/\b(ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|EPIPE)\b/, 'a network error'],
  [/fetch failed/i, 'the request could not be sent'],
  [/rate.?limit/i, 'a rate limit'],
  [/overloaded/i, 'the vendor reporting overload'],
  [/\b(429|500|502|503|504|529)\b/, 'a server error'],
  [/temporarily unavailable/i, 'the vendor being temporarily unavailable'],
  [/stream (was )?interrupted/i, 'the stream being interrupted'],
  [/timed? ?out/i, 'a timeout'],
];

/**
 * Whether a failure is worth another attempt, and in what words.
 *
 * Auth and model-availability failures short-circuit first: they never self-heal, and retrying one
 * spends the budget again to reach the same answer. So do the other deterministic failures — an
 * invalid schema, an exhausted turn budget — by matching nothing below.
 *
 * @returns a description of what went wrong, or `null` when the failure will not heal itself.
 *
 * Why: preserved defect, see Q-0046 AC-11 defect 3 — the auth probe passes the placeholder vendor
 * `'x'`, builds a sentence naming it, and discards it. The call is not refactored to take a vendor.
 */
export function transientError(text = ''): string | null {
  if (authError('x', text)) return null;
  for (const [pattern, describe] of TRANSIENT) if (pattern.test(text)) return describe;
  return null;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });

/**
 * Wraps any adapter — a contributor's included — so the retry policy lives in exactly one place.
 *
 * Everything the adapter carries passes through untouched; only `run` is replaced. Across attempts
 * it accumulates all five measures, because every attempt was billed, and it exposes the real
 * invocation count as `attempts` on success and on failure alike. A per-call vendor declaration wins
 * over the adapter's own name; the adapter's name is used only when a call omits one.
 *
 * The defaults span 5s + 10s + 20s + 40s = 75s, sized against a home connection gone for about a
 * minute. The asymmetry is the whole argument: a genuinely dead network wastes 75 seconds, while
 * giving up early wastes a step that cost dollars and ten minutes (Q-0004). Override per adapter
 * with `adapters.<vendor>.retry` in `harness.yaml`.
 *
 * @param adapter the adapter to wrap.
 * @param policy how many attempts, and how far apart.
 * @returns the same adapter with a retrying `run`, whose answer carries a resolved `vendor` and the
 *   real invocation count.
 */
export function withRetry(
  adapter: Adapter,
  { attempts = 5, baseDelayMs = 5000, maxDelayMs = 60000 }: RetryPolicy = {},
): RetryingAdapter {
  return {
    ...adapter,
    async run(opts: AdapterRunOptions): Promise<RetriedAdapterResult> {
      const spent = Object.fromEntries(USAGE_MEASURES.map((measure) => [measure, null])) as Record<UsageMeasure, number | null>;
      let declaredVendor: string | null = null;
      const add = (usage: ReportedUsage | null | undefined): void => {
        if (!usage) return;
        declaredVendor = usage.vendor ?? declaredVendor;
        for (const measure of USAGE_MEASURES) {
          const value = usage[measure];
          if (value != null) spent[measure] = (spent[measure] ?? 0) + value;
        }
      };
      const measured = (): boolean => USAGE_MEASURES.some((measure) => spent[measure] != null);
      for (let attempt = 1; ; attempt++) {
        try {
          const res = await adapter.run(opts);
          add(res.usage);
          const vendor = res.vendor ?? res.usage?.vendor ?? adapter.vendor;
          // An adapter that reported nothing must not acquire a usage object here: `rollup()` counts
          // any non-null usage as an occurrence, so an all-null spend would invent a vendor row for
          // a call nobody measured. Why: see Q-0034, found by Q-0011 review round 2.
          return { ...res, vendor, usage: measured() ? { vendor, ...spent } : null, attempts: attempt };
        } catch (e) {
          const error = e as AdapterError;
          add(error.usage);
          declaredVendor = error.vendor ?? declaredVendor;
          const why = transientError(error.message);
          if (!why || attempt >= attempts) {
            if (measured()) {
              const vendor = declaredVendor ?? adapter.vendor;
              error.vendor = vendor;
              error.usage = { vendor, ...spent };
            }
            error.attempts = attempt;
            if (why) error.message = `${error.message} (gave up after ${attempt} attempts)`;
            throw error;
          }
          const delayMs = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
          // The UNWRAPPED adapter's vendor, which is deliberately not the vendor a failed call
          // declared: this event says who is being retried, while the thrown error's usage says who
          // was billed. Both are preserved.
          opts.onEvent?.({
            type: 'retry',
            vendor: adapter.vendor,
            attempt,
            of: attempts,
            delayMs,
            reason: why,
            message: String(error.message).slice(0, 160),
          });
          await sleep(delayMs);
        }
      }
    },
  };
}

// ---------- translating a vendor's auth noise ----------

/**
 * A CLI can be installed, report a version, and still be unable to talk to its vendor because the
 * subscription login expired. The CLIs bury that in a wall of stack traces (Q-0001).
 */
const AUTH_PATTERNS: RegExp[] = [
  /refresh token/i, /log ?out and (sign|log) ?in again/i, /401 Unauthorized/i,
  /not logged in/i, /please run\s+\/?login/i, /authentication (failed|required)/i,
  /invalid api key/i, /oauth token (has )?expired/i, /session (has )?expired/i,
];

/** What each shipped vendor's re-login actually is. A vendor absent here gets `<vendor> login`. */
const RELOGIN: Record<string, string> = { claude: 'claude  (then /login)', codex: 'codex logout && codex login' };

/**
 * Translates an auth or model-availability failure into the one sentence that says what to do.
 *
 * The model-availability match runs FIRST and produces a different sentence: a model the
 * subscription cannot use reads like a generic 400, and the fix is to change the flow step or the
 * CLI config rather than to log in again, so this one deliberately does not mention logging in
 * (Q-0001).
 *
 * It lives at the contract layer, not inside a vendor file, so a contributor's adapter inherits
 * actionable auth failures without writing any of this — the fallback below is that inheritance.
 *
 * @returns one line, or `null` when the text is not an auth failure at all.
 */
export function authError(vendor: string, text = ''): string | null {
  const model = text.match(/The '([^']+)' model is not supported when using (\w+) with a ([\w ]+) account/i);
  if (model) return `${vendor}: model "${model[1]}" is not available on a ${model[3]} subscription — remove the model from the flow step (and from ~/.codex/config.toml) to let the CLI pick one its own login supports`;
  if (!AUTH_PATTERNS.some((pattern) => pattern.test(text))) return null;
  return `${vendor} login expired or missing — run: ${RELOGIN[vendor] ?? `${vendor} login`}`;
}

// ---------- the only proof of a login ----------

/**
 * The smallest possible authenticated request's schema.
 *
 * Every property it declares is in `required` and `additionalProperties` is false. That is not
 * style: OpenAI strict structured outputs REJECT anything else, and the vendor error that comes back
 * looks exactly like a broken login — which is how `adapters --probe` reported codex unusable while
 * the login was fine. The rule used to live in a comment above this object and nothing checked it;
 * it is now executable (Q-0034; AC-8).
 */
export const PROBE_SCHEMA: AdapterSchema = {
  type: 'object',
  properties: { ok: { type: 'boolean' }, summary: { type: 'string' } },
  required: ['ok', 'summary'], additionalProperties: false,
};

const PROBE_PROMPT = 'Reply with exactly this JSON and nothing else: {"ok": true, "summary": "subscription answered"}. Do not use any tools.';

/**
 * A real authenticated round-trip: the one thing in this product that proves a subscription answers.
 *
 * The adapter is invoked exactly once, in a directory that is deliberately EMPTY — run it in the
 * project and the CLI loads `CLAUDE.md`, the rules and everything else the repository carries, which
 * turned a hello-world round-trip into $0.39 (Q-0001). A directory this function created is removed
 * on every path; one the caller supplied is left alone.
 *
 * `check()` is not called here, or anywhere else in this module: presence and login are separate
 * questions (requirements/errata.md E-1).
 *
 * @param adapter the adapter to probe — wrapped or raw.
 * @param options `cwd` to probe somewhere specific, `model` to name one.
 * @returns the round-trip, or the reason there was none. Never throws.
 *
 * Why: preserved defect, see Q-0046 AC-11 defect 1 — `usage` is `null` whenever no attempt reported
 * a measure, and the three reads below are unguarded, so an adapter whose login is perfect and which
 * reports nothing answers `ok: false` with a `TypeError` in `error`, which a caller renders as an
 * unusable login. The spike has this; a quiet fix here would leave both suites green over a product
 * that disagrees with itself.
 */
export async function probeAdapter(adapter: Adapter, { cwd, model }: { cwd?: string; model?: string } = {}): Promise<ProbeResult> {
  const t0 = Date.now();
  const sandbox = cwd ?? fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-probe-'));
  const disposable = !cwd;
  try {
    const res = await adapter.run({ prompt: PROBE_PROMPT, schema: PROBE_SCHEMA, model, cwd: sandbox, extraDirs: [], allowWrite: false });
    const problems = checkAgainstSchema(res.output, PROBE_SCHEMA);
    if (problems.length) return { ok: false, vendor: adapter.vendor, ms: Date.now() - t0, error: `structured output invalid (${problems.join('; ')})`, raw: (res.raw ?? '').slice(0, 400) };
    return { ok: true, vendor: adapter.vendor, ms: Date.now() - t0, cost_usd: res.usage!.cost_usd ?? null, tokens: (res.usage!.input_tokens ?? 0) + (res.usage!.output_tokens ?? 0), session: res.session };
  } catch (e) {
    // Normalised here as well as inside each built-in adapter: a contributor's adapter should not
    // have to remember to translate its vendor's auth noise.
    return { ok: false, vendor: adapter.vendor, ms: Date.now() - t0, error: authError(adapter.vendor, (e as Error).message) ?? (e as Error).message };
  } finally {
    if (disposable) fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

// ---------- the structured tail ----------

/**
 * Finds the JSON an agent wrapped its answer in.
 *
 * The ONLY place tolerance for how a vendor wraps its answer belongs (register row 13). It tries
 * every fenced block from the last backwards, then the last `{…}` block, then the whole trimmed
 * text, and it repairs nothing: a text it cannot parse returns `null`, never `{}` and never a
 * partial object. That `null` becomes `output is not an object` from {@link checkAgainstSchema}, so
 * the run stops with a message instead of proceeding on a default (register row 21).
 *
 * @returns the parsed value — which may legitimately be an array or a scalar — or `null`.
 */
export function extractJson(text?: string | null): unknown {
  if (!text) return null;
  const fences = [...text.matchAll(/```(?:json)?\s*\n([\s\S]*?)\n```/g)];
  for (let i = fences.length - 1; i >= 0; i--) {
    try { return JSON.parse(fences[i][1]); } catch { /* keep looking */ }
  }
  const start = text.lastIndexOf('\n{');
  if (start >= 0) { try { return JSON.parse(text.slice(start + 1)); } catch { /* fallthrough */ } }
  try { return JSON.parse(text.trim()); } catch { return null; }
}

/**
 * Checks an agent's answer against the schema QUORUM ITSELF generated from the flow file.
 *
 * Strict on purpose, and deliberately minimal in a different direction: it does not recurse into
 * nested objects, validate non-string items, or know `$ref`, `oneOf` or `format`. Those belong to
 * ajv over solutioning's contracts, which is a different validation over a different subject
 * (register row 13; packages/shared/src/step-output.ts:1-26).
 *
 * The last rule is the one that earns the function its place: the first enum value of `verdict`
 * means pass, and a pass carrying findings — or any other verdict carrying none — is reported.
 * Accepting `verdict: "approve"` alongside a list of blockers is not tolerance but a routing bug,
 * which is why this coupling was moved here rather than into the engine ("Step-output validation is
 * Quorum's contract with its own agents", docs/DECISIONS.md 2026-08-22).
 *
 * @returns every problem found, in the order they are pushed — never only the first, and empty when
 *   the answer matches.
 */
export function checkAgainstSchema(output: unknown, schema: AdapterSchema): string[] {
  const problems: string[] = [];
  if (!output || typeof output !== 'object' || Array.isArray(output)) return ['output is not an object'];
  const record = output as Record<string, unknown>;
  for (const key of schema.required ?? []) if (!(key in record)) problems.push(`missing "${key}"`);
  if (schema.additionalProperties === false) {
    for (const key of Object.keys(record)) if (!(key in (schema.properties ?? {}))) problems.push(`unknown "${key}"`);
  }
  for (const [key, def] of Object.entries(schema.properties ?? {})) {
    const value = record[key];
    if (key in record && def.enum && !def.enum.includes(value)) problems.push(`"${key}" must be one of ${def.enum.join('|')}, got ${JSON.stringify(value)}`);
    if (!(key in record)) continue;
    if (def.type === 'string' && (typeof value !== 'string' || (def.minLength && value.length < def.minLength))) problems.push(`"${key}" must be a non-empty string`);
    if (def.type === 'array') {
      if (!Array.isArray(value)) problems.push(`"${key}" must be an array`);
      else {
        const items: unknown[] = value;
        if (def.minItems != null && items.length < def.minItems) problems.push(`"${key}" needs at least ${def.minItems} item(s)`);
        if (def.maxItems != null && items.length > def.maxItems) problems.push(`"${key}" needs at most ${def.maxItems} item(s)`);
        if (def.items?.type === 'string') for (const item of items) {
          if (typeof item !== 'string') problems.push(`"${key}" items must be strings`);
          else if (def.items.pattern && !(new RegExp(def.items.pattern)).test(item)) problems.push(`"${key}" item has invalid format: ${JSON.stringify(item)}`);
        }
      }
    }
  }
  const verdicts = schema.properties?.verdict?.enum;
  if (Array.isArray(verdicts) && Array.isArray(record.findings)) {
    if (record.verdict === verdicts[0] && record.findings.length) problems.push(`${verdicts[0]} requires empty findings`);
    if (verdicts.slice(1).includes(record.verdict) && !record.findings.length) problems.push(`${record.verdict} requires findings`);
  }
  return problems;
}
