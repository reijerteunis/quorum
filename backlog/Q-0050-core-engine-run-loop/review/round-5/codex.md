# Review — Q-0050 round 5 · codex

*Cross-vendor reviewer · read-only · 2026-08-29 · out of band, over `addefa8..HEAD`*

- `major` — `packages/core/src/engine/q0050.source.test.ts:145`: The purported sentence scan splits on every newline as well as sentence boundaries. Markdown prose is commonly soft-wrapped across lines, so a verbatim sentence spanning multiple lines is broken into fragments rather than normalized into one sentence. An authority line can therefore reproduce such a full sentence without matching any corpus entry—especially when each fragment is shorter than the E-20 40-character cutoff. This leaves AC-13d capable of reporting success while missing its subject. Normalize soft-wrapped paragraphs before splitting on terminal punctuation, then retain the non-empty-corpus guard and add a fixture proving that a copied multi-line source sentence is detected.

Tests could not be executed because the read-only sandbox prevented Vitest from creating its `.vite-temp` configuration file.
