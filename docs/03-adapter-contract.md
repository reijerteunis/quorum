# Adapter contract (spike v0)

*Status: 2026-08-22 — Q-0001. Verification table filled in, `--max-turns` dropped from the
Claude invocation, BYOS guard moved ahead of the CLI check. The first real run then failed on an
expired Codex login that `check()` had reported as ✓, which added `adapters --probe`, the
`authError()` translation, and the rule that a failing parallel branch must not discard its
siblings' work. Still open: Claude's structured output for a large document, and Codex's JSONL
field names.*

An adapter lets one vendor's headless CLI participate in a flow step. It is the only
place vendor-specific knowledge lives. Everything above it (engine, flows, backlog)
sees one shape.

## Interface

```js
adapter.vendor            // 'claude' | 'codex' | ...
await adapter.check()     // cheap: throws if an API key is set, or if the CLI is missing.
                          // Does NOT prove the login works — no request is made.
await probeAdapter(a)     // the real thing: smallest possible authenticated request, returns
                          // { ok, ms, cost_usd, tokens } or { ok: false, error }
await adapter.run({
  prompt,                 // string — complete prompt (role + ticket + inputs + task + output contract)
  schema,                 // JSON Schema object the final answer must match
  model,                  // vendor model alias or null (CLI default)
  cwd,                    // repo dir, or the step's worktree when the step writes code
  extraDirs,              // dirs the agent may read (ticket folder, harness/)
  allowWrite,             // true only for worktree steps
  maxTurns,               // agentic turn budget — accepted by every adapter, honoured only where
                          // the CLI has an equivalent flag (neither claude nor codex does today)
  onEvent,                // ({type:'spawn'|'stdout', ...}) streaming trace
}) -> {
  output,                 // object matching schema   ← the "structured tail"
  raw,                    // final message as text
  usage: { input_tokens, output_tokens, cost_usd },   // null where the CLI doesn't report it
  session,                // vendor session id or null
  vendor, ms,
}
```

## The structured tail

Every step needs a machine-readable answer (a document to save, a verdict to route on).
Order of preference:

1. **Native structured output.** Claude Code: `--json-schema '<schema>'` with
   `--output-format json` → `structured_output` field. Codex: `--output-schema <file>`
   with `-o <file>` → the last message is the JSON.
2. **Fallback extraction** (`extractJson`): last ```json fence in the final message,
   else the last `{…}` block, else the whole message.
3. **Validation** (`checkAgainstSchema`): required keys present, enums honoured. On
   failure the raw output is saved to `<ticket>/.harness/<step>-<ts>.raw.txt` and the
   run stops with a FlowError — never a silent default.

Schemas are generated per step from the flow (`schemaFor`): always `summary`;
`document` when the step writes a file; `verdict` + `findings` when it routes. The
first enum value of `verdict` means pass.

## BYOS — bring your own subscriptions

`check()` must refuse to run if `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or
`CODEX_API_KEY` is set. The CLIs would silently prefer the key over the subscription
login, which breaks the product's one hard promise.

The key check runs **before** the CLI is probed. The guard is about the environment, not
about the CLI, so a CLI that is missing on this machine must not mask a key that is set —
otherwise `adapters` reports "not installed" and the user never learns the real problem.

## check() is not proof of login

A CLI can be installed, print a version, and still be unable to reach its vendor because the
subscription's OAuth token expired. `check()` cannot see that: it makes no request. `codex
login status` cannot always see it either — it reported "Logged in using ChatGPT" while the
refresh token was dead (Q-0001, 2026-08-22).

So `harness adapters` prints presence only and says so; `harness adapters --probe` performs the
smallest possible authenticated request per adapter and reports round-trip time and cost.
**Run `--probe` before a real run**, and before trusting any green tick in this document.

Auth failures are translated into one actionable line ("codex login expired or missing — run:
`codex logout && codex login`") instead of the vendor's stack trace. The translation lives in
`authError()` at the contract layer as well as inside each built-in adapter, so a contributor's
adapter inherits it without doing anything.

## Exact invocations used by this spike

Claude Code:

```
claude -p --output-format json --json-schema '<schema>' \
  --permission-mode acceptEdits|plan --model <alias> --add-dir <ticket> --add-dir <harness>
```

Codex CLI:

```
codex exec --json --output-schema schema.json -o last.txt -C <cwd> \
  --sandbox workspace-write|read-only --skip-git-repo-check --ephemeral \
  --ignore-user-config [-m <model> only if the flow names one] -
```

`--ignore-user-config` is deliberate: `~/.codex/config.toml` can pin a model the user's own
subscription cannot use, and that pin wins even when Quorum passes no `-m`. The flow file is the
source of truth, so the machine's personal CLI config must not decide what a run does. The cost
is that MCP servers and sandbox preferences configured there do not apply inside a run.

Both take the prompt on stdin. Override any flag via `harness.yaml → adapters.<vendor>.extraArgs`.

Verification status (Q-0001 probe, 2026-08-22, Claude Code 2.1.220 and codex-cli 0.149.0):

| Flag / field | Status |
| --- | --- |
| `claude --json-schema`, `--output-format`, `--permission-mode`, `--add-dir` | **verified present** in `--help` |
| `claude --max-turns` | **verified absent** — removed from the adapter; see the `maxTurns` note above |
| `codex exec --json --output-schema -o -C --sandbox --skip-git-repo-check --ephemeral -m --add-dir` | **verified present** — every flag the adapter passes, including `--add-dir`, which this doc previously called out as doubtful |
| `codex` prompt on stdin via trailing `-` | **verified** — documented behaviour of the `[PROMPT]` argument |
| Both CLIs logged in on a subscription | **not verified — and not verifiable this way.** An earlier revision of this table claimed it on the strength of `codex login status`, which reported "Logged in using ChatGPT" while the refresh token was already dead. Only `adapters --probe` settles it. |
| Both adapters return schema-valid structured output on subscription auth | **verified** by `adapters --probe`, 2026-08-22: claude 4674ms / $0.3919 / 74264 tokens, codex 4148ms / 14026 tokens |
| `codex` JSONL usage/session field names | **verified** — see below |
| Codex model aliases (`gpt-5`, `gpt-5-codex`, `gpt-5.1-codex`, `gpt-5.1`, `gpt-5.2`, `gpt-5.2-codex`) | **verified rejected** on a ChatGPT account: *"The 'X' model is not supported when using Codex with a ChatGPT account."* No model name is pinned for codex anywhere any more |
| `claude` structured output for a full 2–4 KB document | still open — the probe proves the mechanism, not the size |

### Codex JSONL, as observed on 0.149.0

Session id arrives first as `{"type":"thread.started","thread_id":"…"}`. Usage arrives on
`turn.completed`:

```json
{"type":"turn.completed","usage":{"input_tokens":13970,"cached_input_tokens":9984,
 "cache_write_input_tokens":0,"output_tokens":6,"reasoning_output_tokens":0}}
```

There is no cost field: **Codex is tokens-only**, which settles the premise of Q-0003.
`reasoning_output_tokens` is billed as output and must be added to `output_tokens`.

Failures do **not** go to stderr. They arrive on stdout as `{"type":"error"}`,
`{"type":"turn.failed"}` or an `item.type === "error"`, with the vendor's own JSON error nested
as a string inside `message`. An adapter that reports `stderr` alone prints an empty error.

Codex enforces OpenAI strict structured outputs: every object needs `additionalProperties: false`
and every property listed in `required`. `schemaFor()` already complies.

### Claude usage fields

`usage.input_tokens` counts only uncached input. A hello-world probe reported 65 tokens against
a real cost of $0.39; adding `cache_creation_input_tokens` and `cache_read_input_tokens` gives
74264. `total_cost_usd` was correct throughout — only the token roll-up was fiction.

## What to verify on day 1 (the real spike questions)

1. Does `claude -p --json-schema` return `structured_output` for a 2–4 KB markdown
   document in a string field, or does it truncate / escape badly?
2. Does `codex exec --output-schema` honour the schema on a subscription login, and
   what does the JSONL stream call its usage/session fields?
3. Cost: Claude reports `total_cost_usd`; Codex reports tokens at best. Decide whether
   the Studio prices Codex tokens itself or shows tokens only.
4. `--permission-mode plan` on Claude for read-only steps: does it still let the agent
   read the repo and the `--add-dir` folders?
