# Q-0125 — code review, run 2 iteration 2

**Verdict: approve.**

The implementation satisfies the merged requirements and binding erratum. In particular, iteration 2 corrects both prior major findings: AC-3 now applies one invariant to the real manifest and hostile fixtures, while AC-2 derives the configurations owed by `tsc` emitters and separately demonstrates discovery across both workspace roots.

The package now exposes only its barrel through the required conditional export map, emits JavaScript and declarations through the established `tsc` configuration, remains private and undistributed, and is exercised under plain Node through a synthetic dependency link. The emitting and distribution registers, Turbo inputs, architecture documentation, glossary, and live-versus-historical count classifications agree with Decision 093. No dependency edge or daemon behavior was added.

## Finding

nit: packages/core/src/test-discovery.test.ts:348 The AC-13 “clause fires” test only counts and matches the daemon name in a string it constructs itself; it does not exercise the manifest-scanning rule used by the preceding test, so it adds no regression protection. Extract the occurrence/permission check into a shared predicate and run both the real manifests and hostile fixture through it, or remove this redundant demonstration while retaining the real all-manifest assertion.

## Verification note

The targeted suite could not be rerun in this read-only review environment because Vitest attempted to create a file under `packages/server/node_modules/.vite-temp` and received `EPERM`. This is an environment limitation rather than evidence of a defect in the change.
