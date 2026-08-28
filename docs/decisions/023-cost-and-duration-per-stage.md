# Cost and duration per stage, measured — 2026-08-22
**Decision:** Cost is recorded per step in the ticket's `runs.log` and rolled up per run into `ticket.md`'s `history`, taken from each vendor's own reporting and never estimated. Where a vendor reports no cost the roll-up is understated rather than guessed, and the tokens are recorded instead. First measurement, `requirements` on Q-0006 with real CLIs on subscription auth:

| Step | Adapter / model | Cost | Wall clock | Notes |
| --- | --- | --- | --- | --- |
| `pm-claude` | claude / opus | $2.2056 | 408s | 19 turns |
| `pm-codex` | codex / CLI default | not reported | 122s | 71600 in (38400 cached), 4218 out |
| `head-of-product` | claude / opus | $1.9407 | 363s | 13 turns |
| **run total** | | **$4.146** | **~13 min** | PMs run in parallel, so wall ≈ 408 + 363 |

An `adapters --probe` round-trip costs about $0.39 on Claude even in an empty directory, because the CLI's own system prompt and tool definitions dominate a hello-world request.

**Alternatives considered:** Price Codex tokens locally against a published rate table so every run shows one comparable number — rejected for now: the table goes stale silently, and on a subscription the marginal cost of a run genuinely is not a dollar figure. Q-0003 (tokens-only vs priced) stays open with this as its evidence.

**Why:** M0 requires cost per stage on the record, and a measured number changes two things. First, the roll-up in `ticket.md` is vendor-blind by construction — $4.146 is the *Claude* cost of that run, not its total, and any UI showing it must say so. Second, and more awkward: `requirements` is the cheapest of the seven stages and it took thirteen minutes. Seven stages cannot fit the cold-clone test's thirty minutes, so either the README's first-run path covers one stage rather than the full SDLC, or the test's premise changes. That is a v1 scoping decision and is deliberately not taken here — but it is now a measured constraint rather than a guess, and it should be settled before M6 writes the README.
