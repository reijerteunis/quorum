# Writer and reviewer are never the same vendor — 2026-08-21
**Decision:** Flows can set `cross_vendor: required`; the flow linter rejects a step whose reviewer/judge adapter equals the adapter that produced its input. All shipped SDLC templates set it.
**Alternatives considered:** Same-vendor self-review (cheaper, but shares blind spots and erases the product's differentiator).
**Why:** Cross-vendor critique is the headline; making it a lint makes the opinion enforceable where it matters without constraining user-authored flows.
