---
id: Q-0001
title: Run requirements flow on a real repo
stage: draft
owner: ruud
repos: []
branch: harness/Q-0001/integration
priority: p1
created: 2026-08-22
iterations: {}
history: []
---
First contact between the spike and reality: run the `requirements` flow end to end on
one real repository, driven by real Claude Code and Codex CLI logins instead of the mock
adapter, and let whatever breaks be the finding. This is the M0 ticket that retires the
milestone's headline risk — whether subscription-authed CLIs can be made to emit
structured output reliably enough for the engine to chain stages — and it is also the
first proof that `adapters` refuses to run when an API key is in the environment. Where
the CLIs disagree with `docs/03-adapter-contract.md` (flags, JSONL field names, usage
reporting), the adapters and the doc get corrected to match observed behaviour, and the
resulting ticket folder plus `runs.log` become the repo's first real fixture. The target
repo is one of Ruud's own SaaS products, chosen at the start of the run; nothing about
that product may leak back into Quorum.
