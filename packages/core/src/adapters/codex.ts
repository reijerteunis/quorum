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
 * One measure as the vendor reported it. Anything that is not a number counts as **not reported**
 * rather than as zero — and for this vendor `cost_usd` is never reported at all
 * ("Codex cost is reported as tokens, never priced locally", docs/DECISIONS.md 2026-08-22).
 */
const measure = (value: unknown): number | null => (typeof value === 'number' ? value : null);

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
function unwrapCodexError(message: string): string {
  try {
    const inner = fields(JSON.parse(message));
    return String(fields(inner?.[jsonl.error])?.[jsonl.message] ?? inner?.[jsonl.message] ?? message);
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
      const errors: string[] = [];   // codex puts failures on stdout as JSONL, not on stderr
      const result = await exec(bin, args, {
        cwd,
        stdin: prompt,
        onLine: (line) => {
          onEvent?.({ type: 'stdout', line });
          // Pick up usage, session and errors where present; tolerate every other line, including
          // the ones that are not JSON at all.
          try {
            const event = fields(JSON.parse(line));
            const measured = fields(
              event?.[jsonl.usage]
              ?? fields(event?.[jsonl.payload])?.[jsonl.usage]
              ?? fields(event?.[jsonl.item])?.[jsonl.usage],
            );
            if (measured) {
              usage.input_tokens = measure(measured[usageFields.inputTokens]) ?? usage.input_tokens;
              // Reasoning tokens are billed as output; counting the output field alone undercounts.
              usage.output_tokens = (measure(measured[usageFields.outputTokens]) ?? 0) + (measure(measured[usageFields.reasoningOutputTokens]) ?? 0) || usage.output_tokens;
              usage.cached_input_tokens = measure(measured[usageFields.cachedInputTokens]) ?? usage.cached_input_tokens;
            }
            const thread = event?.[jsonl.threadId] ?? event?.[jsonl.sessionId] ?? fields(event?.[jsonl.payload])?.[jsonl.threadId];
            if (typeof thread === 'string') session = thread;
            const message = errorMessageOf(event);
            if (message) errors.push(unwrapCodexError(String(message)));
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
