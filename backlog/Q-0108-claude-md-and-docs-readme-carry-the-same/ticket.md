---
id: Q-0108
title: CLAUDE.md and docs README carry the same term list, and nothing checks it
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0108/integration
priority: p2
created: 2026-09-07
iterations: {}
history: []
---
Q-0105's GO-2 found CLAUDE.md:13 three terms behind docs/README.md:32, not one: build task and emitted artifact had been missing since Q-0098 on 2026-09-02, four days and eleven merges, while README carried both. GO-2's own premise is the finding — no assertion in packages/ reads that list, so an omission is silent. The check is one clause and would have caught it the day it happened. What needs deciding first is where it lives and whether a suite may read CLAUDE.md at all: Q-0103's erratum E-2 ruled that file the human's to WRITE, being the vendor dialect of the canonical harness, and says nothing about reading it. docs.test.ts already reads docs/README.md by the same mechanism, so the shape exists; a new read site also earns a turbo-inputs registration, which is that guard working as designed.
