/**
 * The Claude Code adapter: `claude -p` on the user's own subscription login. Never an API key.
 *
 * Every vendor token this file needs comes from `claude-capabilities.ts`, so a CLI update breaks
 * that file and not this one. What is left here is the three things M0 paid for and none of which
 * is visible in the shape of the code — each carries its own note where it happens: the refusal that
 * runs *before* the CLI is probed, the envelope that is parsed *before* the exit code is judged, and
 * the token arithmetic that folds cache traffic back in.
 *
 * Why: behaviour preserved from spike/src/adapters/claude.js (Q-0047).
 */
import { authError, extractJson } from './adapters.js';
import type { Adapter, AdapterConfig, AdapterError, AdapterResult, AdapterRunOptions, AdapterUsage } from './adapters.js';
import { CLAUDE_CAPABILITIES } from './claude-capabilities.js';
import { exec } from './exec.js';

const { flags, values, envelope, usage: usageFields } = CLAUDE_CAPABILITIES;

/** A JSON object as the vendor sent it: whatever keys it holds, whatever types they carry. */
type Fields = Record<string, unknown>;

/** `value` read as such an object, or `undefined` — the typed form of the spike's `value?.key`. */
const fields = (value: unknown): Fields | undefined =>
  (typeof value === 'object' && value !== null ? (value as Fields) : undefined);

/**
 * One measure as the vendor reported it. Anything that is not a number counts as **not reported**
 * rather than as zero, which is the distinction the whole roll-up rests on
 * ("Codex cost is reported as tokens, never priced locally", docs/DECISIONS.md 2026-08-22).
 */
const measure = (value: unknown): number | null => (typeof value === 'number' ? value : null);

/**
 * One argument as the `spawn` event shows it: single-quoted when it holds whitespace or a quote,
 * inner quotes escaped, truncated to 80 characters.
 *
 * Module-private, and deliberately not shared with codex, which joins its argv raw. Unifying the two
 * would change what a run prints, which is externally observable behaviour (charter §2, AC-9).
 */
const quoted = (value: string): string =>
  (/[\s"']/.test(value) ? `'${value.replace(/'/g, "'\\''").slice(0, 80)}${value.length > 80 ? '…' : ''}'` : value);

/**
 * The five measures, counted as Q-0001 established they must be.
 *
 * Claude's own input count excludes cache traffic, which is most of a real prompt: a probe that cost
 * $0.39 reported 65 tokens. Folding the two cache fields in is the difference between a roll-up and
 * a fiction. They are also reported on their own, because they are subsets of input rather than
 * values to add to it (docs/03-adapter-contract.md:51). Cost was always right.
 *
 * An envelope carrying no usage at all yields `null` for every token measure — never zero, which
 * would claim a call was measured and found free.
 */
function usageOf(env: Fields | undefined): AdapterUsage {
  const reported = fields(env?.[envelope.usage]);
  const count = (field: string): number => measure(reported?.[field]) ?? 0;
  return {
    vendor: 'claude',
    input_tokens: reported
      ? count(usageFields.inputTokens) + count(usageFields.cacheCreationInputTokens) + count(usageFields.cacheReadInputTokens)
      : null,
    output_tokens: measure(reported?.[usageFields.outputTokens]),
    cached_input_tokens: measure(reported?.[usageFields.cacheReadInputTokens]),
    cache_write_input_tokens: measure(reported?.[usageFields.cacheCreationInputTokens]),
    cost_usd: measure(env?.[envelope.costUsd]),
  };
}

/**
 * The adapter, configured from this vendor's own `harness.yaml` entry.
 *
 * @param cfg `bin` and `extraArgs` are read here; `retry` is applied by `withRetry` above this
 *   layer, and `delayMs` belongs to the mock.
 */
export function claudeAdapter(cfg: AdapterConfig = {}): Adapter {
  const bin = cfg.bin ?? CLAUDE_CAPABILITIES.bin;
  return {
    vendor: 'claude',
    async check(): Promise<string> {
      // The BYOS guard comes first, and the order is the criterion: a key in the environment would
      // silently outrank the subscription login, and that is true whether or not the CLI is
      // installed — so a missing binary must not be able to mask it (register row 1). This adapter
      // refuses on its own vendor's variable and on no other.
      if (process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is set — unset it; Harness runs on subscription OAuth only');
      const probe = await exec(bin, [...CLAUDE_CAPABILITIES.versionArgs], { cwd: process.cwd() });
      if (probe.code !== 0) throw new Error(`claude CLI not runnable: ${probe.stderr || probe.stdout}`);
      return probe.stdout.trim();
    },
    /**
     * `maxTurns` is part of the common contract and Claude Code has no turn-budget flag — verified
     * absent on 2.1.220 (docs/03-adapter-contract.md:127) — so it is accepted and ignored, exactly
     * as codex ignores it. Passing an unverified flag instead would be a behaviour change.
     */
    async run({ prompt, schema, model, cwd, extraDirs = [], maxTurns, allowWrite, onEvent }: AdapterRunOptions): Promise<AdapterResult> {
      void maxTurns;
      const args = [
        flags.print,
        flags.outputFormat, values.outputFormatJson,
        flags.jsonSchema, JSON.stringify(schema),
        flags.permissionMode, allowWrite ? values.permissionModeWrite : values.permissionModeRead,
        ...(model ? [flags.model, model] : []),
        ...extraDirs.flatMap((dir) => [flags.addDir, dir]),
        ...(cfg.extraArgs ?? []),
      ];
      const startedAt = Date.now();
      onEvent?.({ type: 'spawn', vendor: 'claude', cmd: `${bin} ${args.map(quoted).join(' ')}` });
      const result = await exec(bin, args, { cwd, stdin: prompt, onLine: (line) => onEvent?.({ type: 'stdout', line }) });

      // Parse before deciding. Claude reports a failure inside the envelope on stdout with stderr
      // empty, and can set its error flag while still exiting 0 — so reading the exit code alone
      // both loses the message ("claude exited 1:" and nothing after it) and can read a failure as a
      // success. See Q-0002 and register row 4.
      let parsed: unknown = null;
      try { parsed = JSON.parse(result.stdout); } catch { parsed = null; }
      const env = fields(parsed);

      if (result.code !== 0 || env?.[envelope.isError] === true) {
        const streams = `${result.stderr}\n${result.stdout}`.trim();   // whitespace-only is still "nothing"
        const subtype = env?.[envelope.subtype];
        const detail = env?.[envelope.result]
          ?? fields(env?.[envelope.error])?.[envelope.errorMessage]
          ?? subtype
          ?? (streams.slice(-2000) || 'no output on stderr or stdout');
        const translated = authError('claude', `${result.stderr}\n${result.stdout}`);
        const error: AdapterError = new Error(
          translated ?? `claude failed (exit ${result.code}${subtype ? `, ${String(subtype)}` : ''}): ${String(detail).slice(0, 2000)}`,
        );
        // The vendor already billed this attempt; carry the usage so the run can still count it.
        // One crashed review hid $4.54 of a $10.25 run before this existed (register row 4).
        error.usage = usageOf(env);
        throw error;
      }

      const message = env?.[envelope.result];
      const raw = typeof message === 'string' ? message : result.stdout;
      // The vendor's own channel first, then the fallback that tolerates how it wrapped the answer.
      // Nothing here validates or repairs: an unparseable tail is `null`, which becomes an explicit
      // stop upstream rather than a default (register rows 13 and 21).
      const output = env?.[envelope.structuredOutput] ?? extractJson(raw);
      const session = env?.[envelope.sessionId];
      return {
        vendor: 'claude',
        // `extractJson` answers `null` for a tail it cannot parse, which `checkAgainstSchema`
        // reports as "output is not an object". `AdapterResult` types this as an object, so the
        // `null` travels through the cast rather than through a repair — Q-0046 owns that type.
        output: output as Record<string, unknown>,
        raw,
        usage: usageOf(env),
        session: typeof session === 'string' ? session : null,
        ms: Date.now() - startedAt,
      };
    },
  };
}
