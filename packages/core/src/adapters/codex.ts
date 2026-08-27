/**
 * The Codex CLI adapter: `codex exec` on the user's own ChatGPT login (`~/.codex/auth.json`). Never
 * an API key.
 *
 * Every vendor token comes from `codex-capabilities.ts`, so a CLI update breaks that file rather
 * than this one. Three things here were expensive to learn and each carries its own note: the
 * refusal that runs *before* the CLI is probed, the failures that arrive on **stdout** as JSONL with
 * the vendor's own error nested inside a string, and the cost that stays `null` because nothing in
 * this product prices a token locally.
 *
 * Why: behaviour preserved from spike/src/adapters/codex.js (Q-0047).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { authError, extractJson } from './adapters.js';
import type { Adapter, AdapterConfig, AdapterError, AdapterResult, AdapterRunOptions, AdapterUsage } from './adapters.js';
import { CODEX_CAPABILITIES } from './codex-capabilities.js';
import { exec } from './exec.js';

const { flags, values, jsonl, usage: usageFields } = CODEX_CAPABILITIES;

/** A JSON object as the vendor sent it: whatever keys it holds, whatever types they carry. */
type Fields = Record<string, unknown>;

/** `value` read as such an object, or `undefined` — the typed form of the spike's `value?.key`. */
const fields = (value: unknown): Fields | undefined =>
  (typeof value === 'object' && value !== null ? (value as Fields) : undefined);

/**
 * One measure as the vendor reported it, carried through **without inspection** — an absent one
 * leaves the previous value standing, and for this vendor `cost_usd` is never reported at all
 * ("Codex cost is reported as tokens, never priced locally", docs/DECISIONS.md 2026-08-22).
 *
 * The cast is the load-bearing part, for the reason `claude.ts` gives at the same helper: rejecting
 * a value because it is not a `number` would make the port disagree with the spike over a stream
 * neither suite covers, both suites staying green while it did (charter §2).
 *
 * Why: preserved from spike/src/adapters/codex.js:66-69; narrowing was the review finding on
 * iteration 1 (Q-0047, review/chore-iter-1.md).
 */
/** Named to leave the spike's own `reported` free for the joined error text below. */
const verbatim = (value: unknown): number | null => (value ?? null) as number | null;

/**
 * The error text a JSONL event carries, in each of the three shapes codex uses for one.
 *
 * @returns the message, or `null` when the event is not a failure at all.
 */
function errorMessageOf(event: Fields | undefined): unknown {
  if (event?.[jsonl.type] === jsonl.errorEvent) return event[jsonl.message];
  if (event?.[jsonl.type] === jsonl.turnFailedEvent) return fields(event[jsonl.error])?.[jsonl.message];
  const item = fields(event?.[jsonl.item]);
  if (item?.[jsonl.type] === jsonl.errorEvent) return item[jsonl.message];
  return null;
}

/**
 * Codex nests the vendor's own JSON error inside the message string of its own error event. Digs
 * out the human sentence; falls back to the original text, which is what an adapter reading stderr
 * alone would have printed as nothing at all.
 */
function unwrapCodexError(message: unknown): unknown {
  try {
    // `JSON.parse` coerces a non-string argument itself, and an argument that does not survive that
    // throws into the fallback below — which is the spike's own route through this function.
    const inner = fields(JSON.parse(message as string));
    return fields(inner?.[jsonl.error])?.[jsonl.message] ?? inner?.[jsonl.message] ?? message;
  } catch {
    return message;
  }
}

/**
 * The adapter, configured from this vendor's own `harness.yaml` entry.
 *
 * @param cfg `bin` and `extraArgs` are read here; `retry` is applied by `withRetry` above this
 *   layer, and `delayMs` belongs to the mock.
 */
export function codexAdapter(cfg: AdapterConfig = {}): Adapter {
  const bin = cfg.bin ?? CODEX_CAPABILITIES.bin;
  return {
    vendor: 'codex',
    async check(): Promise<string> {
      // The BYOS guard comes first, and the order is the criterion: a missing CLI must not be able
      // to mask a key that is set (register row 1). This adapter refuses on its own vendor's two
      // variables and on no others.
      if (process.env.CODEX_API_KEY || process.env.OPENAI_API_KEY) throw new Error('CODEX_API_KEY/OPENAI_API_KEY is set — unset it; Harness runs on subscription OAuth only');
      const probe = await exec(bin, [...CODEX_CAPABILITIES.versionArgs], { cwd: process.cwd() });
      if (probe.code !== 0) throw new Error(`codex CLI not runnable: ${probe.stderr || probe.stdout}`);
      return probe.stdout.trim();
    },
    async run({ prompt, schema, model, cwd, extraDirs = [], allowWrite, onEvent }: AdapterRunOptions): Promise<AdapterResult> {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-codex-'));
      const schemaPath = path.join(tmp, 'schema.json');
      const lastPath = path.join(tmp, 'last.txt');
      fs.writeFileSync(schemaPath, JSON.stringify(schema));
      // Codex sandboxes to cwd; extra dirs are surfaced in the prompt by the engine as well as here.
      const args = [
        flags.exec,
        flags.json,
        flags.outputSchema, schemaPath,
        flags.lastMessage, lastPath,
        flags.changeDirectory, cwd,
        flags.sandbox, allowWrite ? values.sandboxWrite : values.sandboxRead,
        flags.skipGitRepoCheck,
        flags.ephemeral,
        flags.ignoreUserConfig,
        ...(model ? [flags.model, model] : []),
        ...extraDirs.flatMap((dir) => [flags.addDir, dir]),
        ...(cfg.extraArgs ?? []),
        flags.promptOnStdin,
      ];
      const startedAt = Date.now();
      onEvent?.({ type: 'spawn', vendor: 'codex', cmd: `${bin} ${args.join(' ')}` });
      // Built before the spawn, so a stream that dies mid-turn still reports what it had spent.
      // Cost is `null` on every path and no rate table exists here or anywhere in the product.
      const usage: AdapterUsage = { vendor: 'codex', input_tokens: null, output_tokens: null, cost_usd: null, cached_input_tokens: null, cache_write_input_tokens: null };
      let session: string | null = null;
      const errors: unknown[] = [];   // codex puts failures on stdout as JSONL, not on stderr
      const result = await exec(bin, args, {
        cwd,
        stdin: prompt,
        onLine: (line) => {
          onEvent?.({ type: 'stdout', line });
          // Pick up usage, session and errors where present; tolerate every other line, including
          // the ones that are not JSON at all.
          try {
            const event = fields(JSON.parse(line));
            // Cast rather than `fields()`, as in `claude.ts`: the spike reads its keys off whatever
            // `usage` holds, so a value that is not an object answers `undefined` for each of them.
            const measured = (
              event?.[jsonl.usage]
              ?? fields(event?.[jsonl.payload])?.[jsonl.usage]
              ?? fields(event?.[jsonl.item])?.[jsonl.usage]
            ) as Fields | undefined;
            if (measured) {
              usage.input_tokens = verbatim(measured[usageFields.inputTokens]) ?? usage.input_tokens;
              // Reasoning tokens are billed as output; counting the output field alone undercounts.
              usage.output_tokens = (verbatim(measured[usageFields.outputTokens]) ?? 0) + (verbatim(measured[usageFields.reasoningOutputTokens]) ?? 0) || usage.output_tokens;
              usage.cached_input_tokens = verbatim(measured[usageFields.cachedInputTokens]) ?? usage.cached_input_tokens;
            }
            // Absent leaves the previous id standing; present is the vendor's own, unexamined.
            session = (event?.[jsonl.threadId] ?? event?.[jsonl.sessionId] ?? fields(event?.[jsonl.payload])?.[jsonl.threadId] ?? session) as string | null;
            const message = errorMessageOf(event);
            if (message) errors.push(unwrapCodexError(message));
          } catch { /* not JSON, ignore */ }
        },
      });
      if (result.code !== 0) {
        fs.rmSync(tmp, { recursive: true, force: true });
        const reported = [...new Set(errors)].join('; ');
        const streams = `${result.stderr}\n${result.stdout}`;
        const error: AdapterError = new Error(
          authError('codex', streams) ?? `codex exited ${result.code}: ${reported || streams.trim().slice(-2000) || 'no output on stderr or stdout'}`,
        );
        error.usage = usage;   // whatever the stream reported before it died — the tokens were spent
        throw error;
      }
      const raw = fs.existsSync(lastPath) ? fs.readFileSync(lastPath, 'utf8') : result.stdout;
      // The vendor's own channel first, then the fallback that tolerates how it wrapped the answer.
      // Nothing here validates or repairs (register rows 13 and 21).
      let output: unknown;
      try { output = JSON.parse(raw); } catch { output = extractJson(raw); }
      fs.rmSync(tmp, { recursive: true, force: true });
      // The cast is `claude.ts`'s, for the same reason: an unparseable tail is `null`, and
      // `AdapterResult` types this field as an object.
      return { vendor: 'codex', output: output as Record<string, unknown>, raw, usage, session, ms: Date.now() - startedAt };
    },
  };
}
