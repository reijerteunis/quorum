/**
 * Claude Code's vocabulary: what its flags are called, what values they take, and what it calls the
 * fields of the one JSON envelope it prints. Nothing else — no function, no I/O, no branch, and no
 * selection between versions.
 *
 * It exists so that a CLI update breaks one file (`docs/04-architecture.md`, §Adapters).
 * {@link CLAUDE_CAPABILITIES.versionArgs} is what `check()` spawns and
 * {@link CLAUDE_CAPABILITIES.verifiedVersion} is the version they were last verified against — a
 * recorded measurement, which is what keeps this file data (Q-0067).
 *
 * The names on the left are Quorum's and the strings on the right are the vendor's. Two of them —
 * `input_tokens` and `output_tokens` — are spelled the same as two of `USAGE_MEASURES`, and the
 * coincidence is exactly why they belong in a file like this one: they are the vendor's field names,
 * not the product's measures, and only one of the two can change without the other.
 *
 * Codex's module is deliberately a different shape and shares no interface with this one: claude
 * returns one envelope and codex streams JSONL, so a common type would describe neither, and
 * `gemini` is designed as a copy-and-edit of `codex` (docs/04-architecture.md, §Adapters).
 */
export const CLAUDE_CAPABILITIES = {
  /** The executable, unless `harness.yaml`'s `adapters.claude.bin` names another. */
  bin: 'claude',
  /** What `check()` spawns to prove the binary runs. */
  versionArgs: ['--version'],
  /**
   * The CLI version the flags and envelope fields below were last verified against, and nothing
   * else — not a minimum, a maximum or a range.
   *
   * Why: moving it claims a re-verification nobody performed; see *"An adapter records the version
   * it was verified against, and never a version it supports"* (2026-09-08). Held equal to
   * `docs/03-adapter-contract.md`'s verification-status line by `capabilities.source.test.ts`.
   */
  verifiedVersion: '2.1.220',
  /** Every flag a run invocation passes, in the order it passes them. */
  flags: {
    print: '-p',
    outputFormat: '--output-format',
    jsonSchema: '--json-schema',
    permissionMode: '--permission-mode',
    /** Passed only when the caller names a model; no alias is pinned here or anywhere (Q-0001). */
    model: '--model',
    addDir: '--add-dir',
  },
  /** The enumerated values those flags take. */
  values: {
    outputFormatJson: 'json',
    permissionModeWrite: 'acceptEdits',
    permissionModeRead: 'plan',
  },
  /** The fields read out of the JSON envelope claude prints on stdout. */
  envelope: {
    /** True on a failure claude reports while still exiting 0. */
    isError: 'is_error',
    /** The agent's final message as text. */
    result: 'result',
    /** An object whose `message` is the vendor's own sentence. */
    error: 'error',
    /** The key inside `error` that carries that sentence. */
    errorMessage: 'message',
    /** A short machine-readable cause, e.g. an exhausted turn budget. */
    subtype: 'subtype',
    /** The structured tail, when the CLI produced one natively. */
    structuredOutput: 'structured_output',
    sessionId: 'session_id',
    /** Money, reported by claude and correct throughout M0 — unlike its token counts. */
    costUsd: 'total_cost_usd',
    usage: 'usage',
  },
  /** The fields inside the envelope's `usage` object. */
  usage: {
    /** Uncached input only — see the note on the adapter's own `usageOf`. */
    inputTokens: 'input_tokens',
    cacheCreationInputTokens: 'cache_creation_input_tokens',
    cacheReadInputTokens: 'cache_read_input_tokens',
    outputTokens: 'output_tokens',
  },
} as const;
