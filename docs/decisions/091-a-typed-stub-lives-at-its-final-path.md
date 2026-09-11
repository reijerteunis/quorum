# A typed stub lives at its final path; `contracts/` holds what is not code — 2026-09-11

**Decision:** Solutioning emits a **typed stub at the final path inside the package that will own
it** — `packages/shared/src/wire.ts`, not `contracts/Q-0120/wire.contract.ts` — exporting the real
names with bodies that throw. Everything else it emits stays under `contracts/<ID>/`: the prose
contract (`<name>.contract.md`), the JSON Schema (`<name>.schema.json`, executable through
`quorum validate`), the fixture (`<name>.fixture.json`) and any YAML shape
(`<name>.contract.yaml`). A stub is never written twice — a copy under `contracts/` beside the real
file would be a second definition free to drift, which is the defect the one-definition criteria in
this repository keep being written to prevent.

`harness/architecture.md`'s *"Contract conventions"* section carries the table, and
`harness/flows/solutioning.yaml`'s architect instruction and `docs/02-sdlc-pipeline-spec.md:51` are
corrected to match: both said type stubs live under `contracts/`.

**Alternatives considered:**

(a) **Keep every contract under `contracts/<ID>/`, stubs included** — what the flow's instruction and
the spec's folder comment have said since 2026-08-21. Rejected on a measurement rather than on
taste: `contracts/` is outside every package, so it has no `node_modules` and no workspace link, and
a stub that references a workspace package therefore does not typecheck. Probed directly —
`packages/shared/src` importing `contracts/Q-0050/run-flow-api.contract.ts` gives
`TS2307: Cannot find module '@quorum/shared'`, raised **inside the contract file**, because line 2 of
that file imports `@quorum/shared`. So a red test cannot compile against it, which is the one thing
*"Solutioning emits contracts; red phase tests against contracts"* (2026-08-21) requires of the red
phase. That entry's mechanism has been unavailable to TypeScript for as long as the workspace has
existed.

(b) **Give `contracts/` a `package.json` and a `tsconfig.json`** so it resolves workspace packages.
Rejected: it makes the contract directory an eighth workspace member, which pulls it into
`pnpm-workspace.yaml`, `test-discovery.test.ts`'s package register, the turbo task graph and every
guard that enumerates packages — a large structural change bought to keep a file in a folder.

(c) **Emit the stub in both places, the final path for compiling and `contracts/` for the record.**
Rejected: two definitions of one interface with nothing holding them together is the drift this
repository has paid for repeatedly, and the git history of the final path is the record.

**Why:** Measured at Q-0120's requirements gate, which is **the first solutioning run this workspace
has ever had** — the four tickets that walked this route (Q-0006, Q-0011, Q-0033, Q-0050) all ran in
August against the `spike/` tree Q-0103 deleted, and everything since has gone
`requirements` → `chore`. Nineteen contract files exist and **thirteen are prose**; the single
`.contract.ts` among them is imported by nothing, which is that gap visible in the tree rather than
argued about. The convention is written down now, before an architect chooses one and a qa-red step
discovers at `prove-red` that its tests fail to compile — which *"Red for the right reason is an
engine property, not a role property"* (2026-08-22) says is the wrong kind of red.

The narrower claim is worth stating so this is not read as wider than it is: **what moves is the
stub, and only the stub.** A contract that is not code — prose, schema, fixture, YAML — has no
compilation problem and stays exactly where nineteen files already are.
