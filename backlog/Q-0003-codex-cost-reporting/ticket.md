---
id: Q-0003
title: Decide Codex cost reporting — tokens only or priced
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0003/integration
priority: p2
created: 2026-08-22
iterations: {}
history: []
---
Claude Code reports `total_cost_usd` per run; Codex reports token counts and no cost field at
all. Quorum therefore has two vendors whose spend is not expressed in the same unit, and a
per-ticket roll-up that silently means "the part of this run we could see a price for" — Q-0006
reads $8.03 against roughly $18.28 actually spent. The question this ticket settles is whether
Quorum prices Codex tokens itself against a local rate table so every run shows one comparable
number, or reports what each vendor reports and makes the asymmetry visible instead. It is the
last open M0 ticket, and the evidence it needs was gathered by the Q-0001 and Q-0002 runs: the
observed JSONL usage fields, the absence of any cost field, and a measured stage where the
recorded figure understated reality by more than half. Belongs to M0 in
docs/06-development-plan.md.
