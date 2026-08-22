# Adapter probe — 2026-08-22

First evidence for M0. Machine: darwin 25.3.0, Node 24.15.0, Claude Code 2.1.220, Codex CLI
not installed. No flow has run yet; this is `harness adapters` plus a read of the CLIs' own
`--help`, done before spending tokens on a real run.

Probed from a throwaway project in a scratchpad (`harness init` there), not from the Quorum
repo itself — `adapters` needs a `harness/harness.yaml` to load config, and scaffolding
`harness/` into Quorum is M2 (Q-0010). The M0 runs target a SaaS repo anyway.

## Result

```
✓ claude: 2.1.220 (Claude Code)
✗ codex:  codex CLI not runnable: Error: spawn codex ENOENT
```

With `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` set for that one command:

```
✗ claude: ANTHROPIC_API_KEY is set — unset it; Harness runs on subscription OAuth only
✗ codex:  CODEX_API_KEY/OPENAI_API_KEY is set — unset it; Harness runs on subscription OAuth only
```

## Findings

**1. `--max-turns` does not exist on Claude Code 2.1.220 — fixed.** The adapter passed
`--max-turns 40` on every `run()` invocation (`spike/src/adapters/claude.js`), so the first
real requirements run would have died on the first spawn. `check()` never caught it because
it only runs `--version`. `claude --help` has no turn-budget flag under any name. The flag is
removed; `maxTurns` stays in the adapter contract but is now accepted-and-ignored by the
claude adapter, exactly as the codex adapter already did. `docs/03-adapter-contract.md` said
`--max-turns N` in the canonical invocation and has been corrected.

Open question this raises, deliberately not answered here: a flow that declares
`step.max_turns` now silently gets nothing from either adapter, which sits badly with the
"never default silently" rule. Turn/cost budgets are already slated for `harness.yaml` before
M3 — that is where this belongs, not in the adapters.

**2. The BYOS guard was ordered behind the CLI check — fixed.** Both adapters ran
`--version` first and only then tested for API keys, so a missing CLI masked the key guard
entirely: the codex line above reported ENOENT while an API key was in fact set. The guard is
about the environment, not the CLI, so it now runs first in both adapters. Covered by two new
checks in the mock-adapter smoke suite (now 32, was 30), which pass on a machine whether or
not either CLI is installed.

**3. Codex is a PATH problem, not a login problem.** `which codex` finds nothing, but
`~/.codex/auth.json` and `config.toml` exist — the ChatGPT subscription login is already set
up. Installing the CLI (or putting it on PATH) is the remaining blocker on M0's first
done-criterion; nothing about the adapter's auth path is in doubt yet.

**4. The structured-output path is present on the Claude side.** `--json-schema`,
`--output-format`, `--permission-mode` and `--add-dir` all exist in 2.1.220. That does not yet
answer M0's real question — whether `--json-schema` returns a 2–4 KB markdown document in a
string field without truncating or escaping badly — which needs a real run. The milestone's
headline risk is still open, just not blocked by a missing flag.

## Re-probe after installing Codex — same day

Installed via `brew install codex` (cask 0.149.0, linked to `/opt/homebrew/bin/codex`) rather
than `npm i -g @openai/codex`: node here is managed by mise, so an npm global would live inside
`~/.local/share/mise/installs/node/24.15.0` and disappear on the next node upgrade. Homebrew's
bin is already on PATH and survives that.

```
✓ claude: 2.1.220 (Claude Code)
✓ codex: codex-cli 0.149.0
```

**M0's first done-criterion is met**: both CLIs report ✓, and both refuse when an API key is in
the environment.

`codex login status` → "Logged in using ChatGPT", confirming the subscription auth path with no
API key involved. And every flag the codex adapter passes is verified present on 0.149.0 —
`exec --json --output-schema -o -C --sandbox --skip-git-repo-check --ephemeral -m --add-dir` —
including `--add-dir`, which `docs/03-adapter-contract.md` had singled out as doubtful. The
trailing `-` for stdin is documented behaviour of the `[PROMPT]` argument.

That closes every flag question in M0 without a single token spent on a model. What remains is
only answerable by a real run: whether Claude's `--json-schema` returns a 2–4 KB markdown
document intact, and what Codex's JSONL stream calls its usage and session fields.

## First real run — failed on auth, taught us four things

Ran `requirements` on Q-0006 in this repo (see that ticket for why here and not a SaaS repo).
The Codex step died about three seconds in: *"Your access token could not be refreshed because
your refresh token was already used."* Nothing reached a model on the Claude side either — its
step was still running and was thrown away. Zero artifacts, stage still `draft`.

The auth expiry itself is not a Quorum bug. What it exposed is.

**5. `check()` reported ✓ on a login that was already dead.** Both adapters only ran
`--version`, so `adapters` printed `✓ codex: codex-cli 0.149.0` minutes before the token failed,
and `codex login status` independently claimed "Logged in using ChatGPT". The contract doc
promised `check()` throws when "not logged in" — it never could. For a cold-clone adopter this
is the worst shape available: two green ticks, then a vendor stack trace partway into their
first paid run.

Fixed by separating the two questions. `check()` stays cheap and now says out loud that it
proves presence only. `harness adapters --probe` makes the smallest possible authenticated
request per adapter and reports round-trip time and cost; `--json` emits the report the
engineering rules already referred to. The verification table in the contract doc had a row
claiming both logins were verified, on the strength of `codex login status`. That row was wrong
and now says so.

**6. A failing parallel branch discarded its siblings' finished work.** `Promise.all` rejects on
the first failure, the CLI exits, and the slower sibling — already paid for — never gets to
write its output. Now `Promise.allSettled`: survivors land in the ticket folder and the error
names both what failed and what was kept, so a retry only repeats what actually broke. This
matters more than it looks, because bounded backward edges make re-runs routine.

**7. A failed run left no trace in `runs.log`.** The file recorded `run=1 … start stage=draft`
and then nothing, so the ticket's history had no memory of the attempt. `finish()` now records a
`failed` line with the first line of the error, without advancing the stage.

**8. The failure surfaced as a raw Node stack trace** plus nine duplicate `ERROR codex_login`
lines. `authError()` now turns recognised auth noise into one actionable sentence — "codex login
expired or missing — run: `codex logout && codex login`" — and lives at the contract layer as
well as in each built-in adapter, so a contributor's adapter inherits it for free.

Smoke suite: 42 checks, from 32. The new ones cover the survivor-keeps-its-output rule, the
`failed` line in `runs.log`, the stage not advancing, the auth translation (including that a
non-auth failure is left alone), and that a probe reports an unusable login rather than ✓.

## Probing properly — Codex was never going to work as shipped

The auth expiry turned out to be transient; `codex doctor` reported `HTTP 101 Switching
Protocols`, `stored API key false`, `auth mode chatgpt`. Underneath it sat three blockers, each
hidden behind the one before it, and none of them would have been visible without `--probe`.

**9. Every codex model alias in the templates is rejected on a subscription.** `gpt-5`,
`gpt-5-codex`, `gpt-5.1-codex`, `gpt-5.1`, `gpt-5.2` and the `gpt-5.2-codex` pinned in
`~/.codex/config.toml` all return 400: *"The 'X' model is not supported when using Codex with a
ChatGPT account."* Model availability differs between API keys and subscriptions, and BYOS means
only the subscription set exists for us. The templates hardcoded `model: gpt-5` in five flow
steps and three role files, so every codex step in every shipped template was broken for every
cold-clone adopter. All pins are gone; the CLI picks a model its own login supports, which also
survives the next rename.

**10. The machine's `config.toml` outranked the flow file.** The pin applied even when Quorum
passed no `-m`, so what a run did depended on the developer's personal CLI config rather than on
the versioned flow. The adapter now passes `--ignore-user-config`. Accepted cost: MCP servers and
sandbox preferences configured there do not apply inside a run. DECISIONS entry written.

**11. Role model defaults leaked across vendors.** `product-manager.md` pins `model: opus`, and
the engine's `step.model ?? role.meta.model` handed that to `pm-codex` — an Anthropic alias sent
to Codex. Now `resolveModel()`: the step always wins, a role default is inherited only by steps
on that role's own adapter, otherwise the CLI chooses.

**12. Codex reports failures on stdout, not stderr.** They arrive as `{"type":"error"}`,
`{"type":"turn.failed"}` or an `item.type === "error"`, with the vendor's JSON error nested as a
string inside `message`. Reading `stderr` alone produced `codex exited 1:` followed by nothing,
which is what made finding 9 invisible in the first place. Fixed — and the fix immediately
surfaced a strict-schema rejection that was mine, not the engine's: OpenAI structured outputs
require `additionalProperties: false` with every property in `required`, which `schemaFor()`
already did correctly and my probe schema did not.

## Both adapters verified — M0's first criterion, properly

```
✓ claude: 2.1.220        login verified — 4674ms, $0.3919, 74264 tokens
✓ codex:  codex-cli 0.149.0   login verified — 4148ms, 14026 tokens
```

Two more M0 questions answered along the way, both recorded in `docs/03-adapter-contract.md`:

**Codex's JSONL shape.** `thread.started` carries `thread_id`; `turn.completed` carries
`usage: {input_tokens, cached_input_tokens, cache_write_input_tokens, output_tokens,
reasoning_output_tokens}`. There is no cost field — Codex is tokens-only, which settles the
premise of Q-0003 without needing its own investigation. `reasoning_output_tokens` is billed as
output and is now added to the total.

**Claude's token accounting was fiction.** `usage.input_tokens` counts only uncached input: the
first probe reported 65 tokens against a real $0.39. Counting `cache_creation_input_tokens` and
`cache_read_input_tokens` gives 74264 for the same request. `total_cost_usd` was correct
throughout, so cost roll-ups were never wrong — only token roll-ups were, by three orders of
magnitude.

A note on probe cost: ~$0.39 on Claude even in an empty temp directory, because the CLI's own
system prompt and tool definitions dominate a hello-world request. Cheap enough to run before a
real flow, too expensive to put in CI.

Smoke suite: 48 checks, from 42.

## Next

Re-run the requirements flow. Still open: whether Claude's `--json-schema` returns a full 2–4 KB
markdown document intact — the probe proves the mechanism, not the size.
