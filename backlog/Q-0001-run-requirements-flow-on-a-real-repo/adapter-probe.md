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

## Next

Install / PATH the Codex CLI, re-probe, then run the requirements flow for real.
