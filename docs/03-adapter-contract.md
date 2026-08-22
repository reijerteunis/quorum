# Adapter contract (spike v0)

An adapter lets one vendor's headless CLI participate in a flow step. It is the only
place vendor-specific knowledge lives. Everything above it (engine, flows, backlog)
sees one shape.

## Interface

```js
adapter.vendor            // 'claude' | 'codex' | ...
await adapter.check()     // throws if the CLI is missing, not logged in, or an API key is set
await adapter.run({
  prompt,                 // string — complete prompt (role + ticket + inputs + task + output contract)
  schema,                 // JSON Schema object the final answer must match
  model,                  // vendor model alias or null (CLI default)
  cwd,                    // repo dir, or the step's worktree when the step writes code
  extraDirs,              // dirs the agent may read (ticket folder, harness/)
  allowWrite,             // true only for worktree steps
  maxTurns,               // agentic turn budget
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

## Exact invocations used by this spike

Claude Code:

```
claude -p --output-format json --json-schema '<schema>' --max-turns N \
  --permission-mode acceptEdits|plan --model <alias> --add-dir <ticket> --add-dir <harness>
```

Codex CLI:

```
codex exec --json --output-schema schema.json -o last.txt -C <cwd> \
  --sandbox workspace-write|read-only --skip-git-repo-check --ephemeral -m <model> -
```

Both take the prompt on stdin. Flags are from the vendors' CLI references as of
2026-08; treat `--add-dir` on Codex and the JSONL usage field names as **unverified** —
the adapters tolerate their absence. Override any flag via `harness.yaml → adapters.<vendor>.extraArgs`.

## What to verify on day 1 (the real spike questions)

1. Does `claude -p --json-schema` return `structured_output` for a 2–4 KB markdown
   document in a string field, or does it truncate / escape badly?
2. Does `codex exec --output-schema` honour the schema on a subscription login, and
   what does the JSONL stream call its usage/session fields?
3. Cost: Claude reports `total_cost_usd`; Codex reports tokens at best. Decide whether
   the Studio prices Codex tokens itself or shows tokens only.
4. `--permission-mode plan` on Claude for read-only steps: does it still let the agent
   read the repo and the `--add-dir` folders?
