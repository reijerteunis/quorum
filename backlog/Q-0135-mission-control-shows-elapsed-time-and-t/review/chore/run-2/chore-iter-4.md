# Review — Q-0135, iteration 4

Verdict: revise.

major: apps/web/src/mission-control-status.tsx:253 The absent-vendor state is derived only from `snapshot.events`, but that event tail is bounded, head-evicting, and may omit a vendor’s `spawn`/`retry`. Consequently, a vendor that participated in the run but has no roll-up row can still render as nothing, contrary to AC-16’s requirement to name that case. The implementation itself acknowledges that `observedVendors` is only a lower bound. Source the vendor roster from authoritative history data, or obtain a binding requirements ruling that explicitly narrows AC-16 to retained/observed vendors; add a late-join or head-eviction test where the vendor event is absent but the run history still identifies the vendor.

observation: The supplied patch omitted `packages/server/src/read.test.ts`, `packages/server/src/wire.ts`, `packages/shared/src/docs.test.ts`, `packages/shared/src/wire.test.ts`, and `packages/shared/src/wire.ts` because of truncation; those files were inspected directly from `harness/Q-0135/implement` rather than judged from the diff stat.
