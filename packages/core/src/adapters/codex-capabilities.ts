/**
 * Codex CLI's vocabulary: what its flags are called, what values they take, and what its JSONL
 * stream calls the fields the adapter reads. Nothing else — no function, no I/O, no branch, and no
 * selection between versions.
 *
 * Same purpose and same limit as `claude-capabilities.ts`: one file changes when the CLI does.
 * {@link CODEX_CAPABILITIES.versionArgs} is what `check()` spawns and
 * {@link CODEX_CAPABILITIES.verifiedVersion} is the version the two were last verified against
 * (Q-0067).
 *
 * Deliberately NOT the same shape as claude's module and sharing no interface with it: claude
 * returns one JSON envelope and codex streams JSONL, so a common type would describe neither.
 * `gemini` is designed as a copy-and-edit of this file (docs/04-architecture.md, §Adapters), which
 * is the intended reuse and needs no abstraction.
 *
 * The field names were read off a real 0.149.0 stream and are tabulated in
 * `docs/03-adapter-contract.md`, §"Codex JSONL, as observed on 0.149.0".
 */
export const CODEX_CAPABILITIES = {
  /** The executable, unless `harness.yaml`'s `adapters.codex.bin` names another. */
  bin: 'codex',
  /** What `check()` spawns to prove the binary runs. */
  versionArgs: ['--version'],
  /**
   * The CLI version the flags and JSONL field names below were last verified against, and nothing
   * else: not a minimum, not a maximum and not a range. Nothing branches on it.
   *
   * Why: it is M0's measurement and moving it claims a re-verification nobody performed — see
   * *"An adapter records the version it was verified against, and never a version it supports"*
   * (2026-09-08), and `docs/03-adapter-contract.md`'s verification-status line, which
   * `capabilities.source.test.ts` holds equal to this string.
   */
  verifiedVersion: '0.149.0',
  /** Every token a run invocation passes, in the order it passes them. */
  flags: {
    /** The subcommand, not a flag — first argument, and the only one that is positional but for the last. */
    exec: 'exec',
    json: '--json',
    outputSchema: '--output-schema',
    /** Where the CLI writes the final message. */
    lastMessage: '-o',
    changeDirectory: '-C',
    sandbox: '--sandbox',
    skipGitRepoCheck: '--skip-git-repo-check',
    ephemeral: '--ephemeral',
    /**
     * Passed unconditionally. `~/.codex/config.toml` can pin a model a ChatGPT subscription cannot
     * use, and that pin wins even when Quorum passes no model at all — so a run's behaviour would
     * depend on the developer's personal CLI config rather than on the versioned flow file
     * (Q-0001; register row 2).
     */
    ignoreUserConfig: '--ignore-user-config',
    /** Passed only when the caller names a model; no alias is pinned here or anywhere (Q-0001). */
    model: '-m',
    addDir: '--add-dir',
    /** The trailing argument that makes the CLI read its prompt from stdin. Always last. */
    promptOnStdin: '-',
  },
  /** The enumerated values those flags take. */
  values: {
    sandboxWrite: 'workspace-write',
    sandboxRead: 'read-only',
  },
  /** The fields read out of the JSONL events codex prints on stdout — failures included. */
  jsonl: {
    type: 'type',
    usage: 'usage',
    /** Some events nest their payload; usage and the thread id can arrive inside it. */
    payload: 'payload',
    /** Others nest an item, which is also where a third shape of error lives. */
    item: 'item',
    message: 'message',
    error: 'error',
    threadId: 'thread_id',
    sessionId: 'session_id',
    /** `type` values that mean the turn failed. Failures arrive here, never on stderr. */
    errorEvent: 'error',
    turnFailedEvent: 'turn.failed',
  },
  /** The fields inside a `turn.completed` event's `usage` object. */
  usage: {
    inputTokens: 'input_tokens',
    cachedInputTokens: 'cached_input_tokens',
    outputTokens: 'output_tokens',
    /** Billed as output; counting `output_tokens` alone undercounts. */
    reasoningOutputTokens: 'reasoning_output_tokens',
  },
} as const;
